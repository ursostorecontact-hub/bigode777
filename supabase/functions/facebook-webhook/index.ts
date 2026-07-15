import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Fetch actual lead field_data from Facebook Graph API
// The webhook payload only contains leadgen_id — the real data requires an API call.
// "platform" tells us if the lead came from Instagram ("ig") or Facebook ("fb").
async function fetchLeadFromGraph(
  leadgenId: string,
  accessToken: string,
): Promise<{ name: string; email: string | null; phone: string | null; platform: string | null } | null> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${leadgenId}?fields=field_data,platform&access_token=${accessToken}`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!res.ok) {
      const txt = await res.text();
      console.error(`Graph API error for leadgen_id ${leadgenId}: ${txt.slice(0, 300)}`);
      return null;
    }
    const data = await res.json();
    const fieldData: { name: string; values: string[] }[] = data.field_data || [];

    const getField = (names: string[]) => {
      for (const n of names) {
        const found = fieldData.find((f) => f.name === n);
        if (found?.values?.[0]) return found.values[0];
      }
      return null;
    };

    const firstName = getField(["first_name"]);
    const lastName = getField(["last_name"]);
    const fullName = getField(["full_name"]) ||
      [firstName, lastName].filter(Boolean).join(" ") ||
      null;

    return {
      name: fullName || "Lead Facebook",
      email: getField(["email"]),
      phone: getField(["phone_number", "phone"]),
      platform: data.platform || null,
    };
  } catch (err) {
    console.error("fetchLeadFromGraph error:", err);
    return null;
  }
}

// Converte o valor bruto da Meta ("ig", "fb", "instagram", "facebook") num rótulo legível
function platformToSource(platform: string | null): string {
  if (!platform) return "Facebook Ads";
  const p = platform.toLowerCase();
  if (p.includes("ig") || p.includes("instagram")) return "Instagram";
  if (p.includes("fb") || p.includes("facebook")) return "Facebook Ads";
  if (p.includes("messenger")) return "Messenger";
  return "Facebook Ads";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // ── GET: Facebook webhook verification challenge ──────────────────────────
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token) {
      const { data: webhooks } = await adminClient
        .from("facebook_webhooks")
        .select("verify_token")
        .eq("active", true);

      const match = webhooks?.some((w) => w.verify_token === token);
      if (match) {
        return new Response(challenge, { status: 200, headers: corsHeaders });
      }
    }

    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  // ── POST: Facebook lead event ─────────────────────────────────────────────
  if (req.method === "POST") {
    try {
      const body = await req.json();
      console.log("Facebook webhook received:", JSON.stringify(body).slice(0, 500));

      if (body.object === "page" && body.entry) {
        // Build a map of tenant_id → access_token from all active webhooks.
        // Used to fetch lead field data from the Graph API.
        const { data: activeWebhooks } = await adminClient
          .from("facebook_webhooks")
          .select("tenant_id")
          .eq("active", true);

        // For each unique tenant, look up facebook_access_token from settings
        const tenantTokenMap: Map<string, string> = new Map();
        const seenTenants = new Set<string>();
        for (const wh of activeWebhooks || []) {
          if (!wh.tenant_id || seenTenants.has(wh.tenant_id)) continue;
          seenTenants.add(wh.tenant_id);
          const { data: settings } = await adminClient
            .from("settings")
            .select("facebook_access_token")
            .eq("tenant_id", wh.tenant_id)
            .maybeSingle();
          if (settings?.facebook_access_token) {
            tenantTokenMap.set(wh.tenant_id, settings.facebook_access_token);
          }
        }

        for (const entry of body.entry) {
          for (const change of entry.changes || []) {
            if (change.field !== "leadgen") continue;

            const leadData = change.value;
            const leadgenId = leadData.leadgen_id || leadData.id;

            if (!leadgenId) {
              console.log("No leadgen_id in payload, skipping");
              continue;
            }

            // Try each tenant's access token to fetch lead field data.
            // In a single-tenant setup (most common) there will be only one.
            // In multi-tenant setups we try all until one succeeds.
            let parsedLead: { name: string; email: string | null; phone: string | null; platform: string | null } | null = null;
            let leadTenantId: string | null = null;

            for (const [tenantId, accessToken] of tenantTokenMap.entries()) {
              const result = await fetchLeadFromGraph(leadgenId, accessToken);
              if (result) {
                parsedLead = result;
                leadTenantId = tenantId;
                break;
              }
            }

            // Fallback: if no access token configured or Graph API failed,
            // create a placeholder lead so the contact is not lost.
            const leadName = parsedLead?.name || "Lead Facebook";
            const leadEmail = parsedLead?.email || null;
            const leadPhone = parsedLead?.phone || null;
            const leadSource = platformToSource(parsedLead?.platform ?? null);

            const newLead: Record<string, any> = {
              name: leadName,
              email: leadEmail,
              phone: leadPhone,
              source: leadSource,
              meta_lead_id: leadgenId,
              notes: `Facebook Lead ID: ${leadgenId}`,
              status: "novo",
              pipeline_stage: "novo",
            };
            if (leadTenantId) newLead.tenant_id = leadTenantId;

            const { error: insertError } = await adminClient
              .from("leads")
              .insert(newLead);

            if (insertError) {
              console.error("Lead insert error:", insertError);
            } else {
              console.log(`Lead created from Facebook: ${leadName} (leadgen_id: ${leadgenId})`);
            }
          }
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err: any) {
      console.error("Facebook webhook error:", err.message);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});
