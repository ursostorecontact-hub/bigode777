import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  // Facebook verification challenge (GET)
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token) {
      // Verify token against stored webhooks
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

  // Facebook lead data (POST)
  if (req.method === "POST") {
    try {
      const body = await req.json();

      if (body.object === "page" && body.entry) {
        for (const entry of body.entry) {
          for (const change of entry.changes || []) {
            if (change.field === "leadgen") {
              const leadData = change.value;
              
              // Insert lead into CRM
              await adminClient.from("leads").insert({
                name: leadData.full_name || leadData.field_data?.find((f: any) => f.name === "full_name")?.values?.[0] || "Lead Facebook",
                email: leadData.email || leadData.field_data?.find((f: any) => f.name === "email")?.values?.[0] || null,
                phone: leadData.phone_number || leadData.field_data?.find((f: any) => f.name === "phone_number")?.values?.[0] || null,
                source: "Facebook",
                notes: `Facebook Lead ID: ${leadData.leadgen_id || leadData.id || "N/A"}`,
              });
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
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});
