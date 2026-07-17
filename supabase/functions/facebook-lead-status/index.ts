import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Envia atualizações de estágio de lead para a Meta, seguindo o formato oficial
// da "Integração de leads qualificados" (CRM Lead Status / Conversions API para CRM):
// https://www.facebook.com/business/help — CRM integration guide.
//
// Isso é DIFERENTE do evento "Purchase" (facebook-capi), que serve para alimentar
// públicos/audiências. Este aqui serve para a própria Meta saber em que estágio do
// funil cada lead dela está, e assim otimizar a entrega dos anúncios de geração de leads.
//
// Toda tentativa (sucesso ou erro) fica registrada em meta_events_log, pra permitir
// conferência e reenvio manual em caso de falha.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) return json({ error: "Não autorizado" }, 401);

    const body = await req.json();
    const { lead_id, event_name, retry_log_id } = body;

    // Reenvio manual de um evento que falhou antes, usando o payload já salvo no log
    if (retry_log_id) {
      const { data: logRow } = await supabase.from("meta_events_log").select("*").eq("id", retry_log_id).single();
      if (!logRow) return json({ error: "Evento não encontrado no histórico" }, 404);

      const { data: settingsRetry } = await supabase
        .from("settings")
        .select("facebook_pixel_id, facebook_access_token")
        .eq("tenant_id", logRow.tenant_id)
        .maybeSingle();

      let status: "success" | "error" = "success";
      let errorMessage: string | null = null;
      try {
        const fbRes = await fetch(`https://graph.facebook.com/v25.0/${settingsRetry?.facebook_pixel_id}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...logRow.payload, access_token: settingsRetry?.facebook_access_token }),
        });
        const fbResult = await fbRes.json();
        if (!fbRes.ok) {
          status = "error";
          errorMessage = fbResult.error?.message || "Erro na API do Facebook";
        }
      } catch (err: any) {
        status = "error";
        errorMessage = err.message;
      }
      await supabase.from("meta_events_log").insert({
        tenant_id: logRow.tenant_id,
        lead_id: logRow.lead_id,
        event_name: logRow.event_name,
        event_source: logRow.event_source,
        status,
        error_message: errorMessage,
        payload: logRow.payload,
      });
      return json({ ok: status === "success", error: errorMessage });
    }

    if (!lead_id || !event_name) return json({ error: "lead_id e event_name são obrigatórios" }, 400);

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

    if (leadError || !lead) return json({ error: "Lead não encontrado" }, 404);

    // Só envia se o lead realmente veio de um anúncio da Meta (tem lead_id gerado por ela)
    if (!lead.meta_lead_id) {
      return json({ ok: true, skipped: "lead não veio da Meta" });
    }

    const finalTenantId = tenantId ?? lead.tenant_id;
    const { data: settings } = await supabase
      .from("settings")
      .select("facebook_pixel_id, facebook_access_token")
      .eq("tenant_id", finalTenantId)
      .maybeSingle();

    const pixelId = settings?.facebook_pixel_id;
    const accessToken = settings?.facebook_access_token;
    if (!pixelId || !accessToken) {
      return json({ ok: true, skipped: "Facebook não configurado para esta empresa" });
    }

    const userData: Record<string, unknown> = { lead_id: lead.meta_lead_id };
    if (lead.email) userData.em = [await sha256(lead.email)];
    if (lead.phone) userData.ph = [await sha256(lead.phone.replace(/\D/g, ""))];

    const payload = {
      data: [{
        action_source: "system_generated",
        event_name,
        event_time: Math.floor(Date.now() / 1000),
        user_data: userData,
        custom_data: { event_source: "crm", lead_event_source: "Flash CRMs" },
      }],
    };

    let status: "success" | "error" = "success";
    let errorMessage: string | null = null;
    try {
      const fbRes = await fetch(`https://graph.facebook.com/v25.0/${pixelId}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, access_token: accessToken }),
      });
      const fbResult = await fbRes.json();
      if (!fbRes.ok) {
        status = "error";
        errorMessage = fbResult.error?.message || "Erro na API do Facebook";
        console.error("Facebook CRM lead status error:", fbResult);
      }
    } catch (err: any) {
      status = "error";
      errorMessage = err.message;
    }

    await supabase.from("meta_events_log").insert({
      tenant_id: finalTenantId,
      lead_id: lead.id,
      event_name,
      event_source: event_name === "Qualified" ? "qualified" : "lead_status",
      status,
      error_message: errorMessage,
      payload,
    });

    if (status === "error") return json({ error: errorMessage }, 400);
    return json({ ok: true });
  } catch (err: any) {
    console.error("facebook-lead-status error:", err);
    return json({ error: err.message }, 500);
  }
});
