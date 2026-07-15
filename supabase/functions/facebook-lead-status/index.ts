import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Envia atualizações de estágio de lead para a Meta, seguindo o formato oficial
// da "Integração de leads qualificados" (CRM Lead Status / Conversions API para CRM):
// https://www.facebook.com/business/help — CRM integration guide.
//
// Isso é DIFERENTE do evento "Purchase" (facebook-capi), que serve para alimentar
// públicos/audiências. Este aqui serve para a própria Meta saber em que estágio do
// funil cada lead dela está, e assim otimizar a entrega dos anúncios de geração de leads.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { lead_id, event_name } = await req.json();
    if (!lead_id || !event_name) {
      return new Response(JSON.stringify({ error: "lead_id e event_name são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Cada empresa (tenant) tem seu próprio conjunto de dados/pixel e token —
    // as credenciais nunca são fixas ou compartilhadas entre empresas.
    const { data: membership } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    const tenantId = membership?.tenant_id;

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, name, email, phone, meta_lead_id, tenant_id")
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      return new Response(JSON.stringify({ error: "Lead não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Só envia se o lead realmente veio de um anúncio da Meta (tem lead_id gerado por ela)
    if (!lead.meta_lead_id) {
      return new Response(JSON.stringify({ ok: true, skipped: "lead não veio da Meta" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: settings } = await supabase
      .from("settings")
      .select("facebook_pixel_id, facebook_access_token")
      .eq("tenant_id", tenantId ?? lead.tenant_id)
      .maybeSingle();

    const pixelId = settings?.facebook_pixel_id;
    const accessToken = settings?.facebook_access_token;
    if (!pixelId || !accessToken) {
      return new Response(JSON.stringify({ ok: true, skipped: "Facebook não configurado para esta empresa" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userData: Record<string, unknown> = {
      lead_id: Number(lead.meta_lead_id),
    };
    if (lead.email) userData.em = [await sha256(lead.email)];
    if (lead.phone) userData.ph = [await sha256(lead.phone.replace(/\D/g, ""))];

    const payload = {
      data: [
        {
          action_source: "system_generated",
          event_name,
          event_time: Math.floor(Date.now() / 1000),
          user_data: userData,
          custom_data: {
            event_source: "crm",
            lead_event_source: "Flash CRMs",
          },
        },
      ],
    };

    const fbRes = await fetch(
      `https://graph.facebook.com/v21.0/${pixelId}/events`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, access_token: accessToken }),
      }
    );
    const fbResult = await fbRes.json();

    if (!fbRes.ok) {
      console.error("Facebook CRM lead status error:", fbResult);
      return new Response(
        JSON.stringify({ error: fbResult.error?.message || "Erro na API do Facebook", fb_error: fbResult.error }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ ok: true, fb_result: fbResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("facebook-lead-status error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
