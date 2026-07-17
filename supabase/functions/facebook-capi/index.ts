import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
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

    const { pixel_id, access_token, client_id, retry_log_id } = await req.json();

    // Reenvio manual de um evento que falhou antes, usando o payload já salvo no log
    if (retry_log_id) {
      const { data: logRow, error: logError } = await supabase
        .from("meta_events_log")
        .select("*")
        .eq("id", retry_log_id)
        .single();
      if (logError || !logRow) {
        return new Response(JSON.stringify({ error: "Evento não encontrado no histórico" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let status: "success" | "error" = "success";
      let errorMessage: string | null = null;
      try {
        const fbRes = await fetch(`https://graph.facebook.com/v25.0/${pixel_id}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...logRow.payload, access_token }),
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
        client_id: logRow.client_id,
        lead_id: logRow.lead_id,
        event_name: logRow.event_name,
        event_source: logRow.event_source,
        status,
        error_message: errorMessage,
        payload: logRow.payload,
      });
      return new Response(JSON.stringify({ ok: status === "success", error: errorMessage }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pixel_id || !access_token) {
      return new Response(
        JSON.stringify({ error: "pixel_id e access_token são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get tenant
    const { data: membership } = await supabase
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    const tenantId = membership?.tenant_id;

    // Get clients (um único, se client_id foi informado — usado no envio automático
    // no momento da compra; senão, todos os clientes do tenant)
    let query = supabase.from("clients").select("*");
    if (client_id) query = query.eq("id", client_id);
    else if (tenantId) query = query.eq("tenant_id", tenantId);
    const { data: clients, error: clientsError } = await query;

    if (clientsError) {
      return new Response(JSON.stringify({ error: clientsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!clients?.length) {
      return new Response(JSON.stringify({ error: "Nenhum cliente encontrado", sent_count: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build events
    const now = Math.floor(Date.now() / 1000);
    const events = await Promise.all(
      clients.map(async (client) => {
        const userData: Record<string, string[]> = {};
        if (client.email) userData.em = [await sha256(client.email)];
        if (client.phone) {
          const phone = client.phone.replace(/\D/g, "");
          userData.ph = [await sha256(phone)];
        }
        if (client.name) {
          const nameParts = client.name.trim().split(/\s+/);
          if (nameParts.length > 0) userData.fn = [await sha256(nameParts[0])];
          if (nameParts.length > 1) userData.ln = [await sha256(nameParts[nameParts.length - 1])];
        }
        userData.country = [await sha256("br")];

        return {
          event_name: "Purchase",
          event_time: now,
          action_source: "system_generated",
          user_data: userData,
          custom_data: {
            value: client.total_revenue || 0,
            currency: "BRL",
          },
        };
      })
    );

    // Envia um cliente por vez (não em lote), pra conseguir registrar e reenviar
    // individualmente cada evento que falhar.
    let totalSent = 0;
    let totalFailed = 0;
    for (let i = 0; i < clients.length; i++) {
      const client = clients[i];
      const event = events[i];
      const payload = { data: [event], access_token };

      let logStatus: "success" | "error" = "success";
      let errorMessage: string | null = null;

      try {
        const fbRes = await fetch(`https://graph.facebook.com/v25.0/${pixel_id}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const fbResult = await fbRes.json();
        if (!fbRes.ok) {
          logStatus = "error";
          errorMessage = fbResult.error?.message || "Erro na API do Facebook";
        } else {
          totalSent++;
        }
      } catch (err: any) {
        logStatus = "error";
        errorMessage = err.message;
      }

      if (logStatus === "error") totalFailed++;

      await supabase.from("meta_events_log").insert({
        tenant_id: tenantId,
        client_id: client.id,
        lead_id: client.lead_id || null,
        event_name: "Purchase",
        event_source: "purchase",
        status: logStatus,
        error_message: errorMessage,
        payload,
      });
    }

    return new Response(
      JSON.stringify({ ok: true, sent_count: totalSent, failed_count: totalFailed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
