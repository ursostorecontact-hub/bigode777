import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function replacePlaceholders(template: string, lead: Record<string, any>): string {
  return template
    .replace(/\{\{nome\}\}/gi, lead.name || '')
    .replace(/\{\{telefone\}\}/gi, lead.phone || '')
    .replace(/\{\{email\}\}/gi, lead.email || '')
    .replace(/\{\{etapa\}\}/gi, lead.pipeline_stage || '')
    .replace(/\{\{origem\}\}/gi, lead.source || '')
    .replace(/\{\{valor\}\}/gi, String(lead.value || 0));
}

async function sendWebhook(config: Record<string, string>, lead: Record<string, any>, message: string) {
  const url = config.webhook_url;
  if (!url) throw new Error("webhook_url não configurado");

  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lead,
      message,
      timestamp: new Date().toISOString(),
    }),
  });
}

async function sendWhatsApp(
  adminClient: any,
  config: Record<string, string>,
  lead: Record<string, any>,
  message: string,
  tenantId: string | null,
  media?: { type: string; url: string } | null
) {
  let evolution_url = config.evolution_url;
  let evolution_api_key = config.evolution_api_key;
  let evolution_instance = config.evolution_instance;

  // Auto-fetch tenant's connected instance
  if (config.use_tenant_instance === 'true' && tenantId) {
    const { data: instance } = await adminClient
      .from("whatsapp_instances")
      .select("evolution_url, evolution_api_key, instance_name")
      .eq("tenant_id", tenantId)
      .eq("status", "connected")
      .limit(1)
      .single();

    if (!instance) throw new Error("Nenhuma instância WhatsApp conectada para esta empresa");
    evolution_url = instance.evolution_url;
    evolution_api_key = instance.evolution_api_key;
    evolution_instance = instance.instance_name;
  }

  if (!evolution_url || !evolution_api_key || !evolution_instance) {
    throw new Error("Configuração da Evolution API incompleta");
  }

  const phone = (lead.phone || '').replace(/\D/g, '');
  if (!phone) throw new Error("Lead sem telefone");

  // Mensagem com mídia (áudio, foto, vídeo, documento) configurada na automação
  if (media?.url) {
    if (media.type === "audio") {
      const url = `${evolution_url}/message/sendWhatsAppAudio/${evolution_instance}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": evolution_api_key },
        body: JSON.stringify({ number: phone, audio: media.url }),
      });
      if (!res.ok) throw new Error(`Evolution API error: ${await res.text()}`);
      return;
    }
    const url = `${evolution_url}/message/sendMedia/${evolution_instance}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": evolution_api_key },
      body: JSON.stringify({
        number: phone,
        mediatype: media.type,
        media: media.url,
        caption: message || "",
      }),
    });
    if (!res.ok) throw new Error(`Evolution API error: ${await res.text()}`);
    return;
  }

  const url = `${evolution_url}/message/sendText/${evolution_instance}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": evolution_api_key,
    },
    body: JSON.stringify({
      number: phone,
      text: message,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Evolution API error: ${err}`);
  }
}

async function sendSMS(config: Record<string, string>, lead: Record<string, any>, message: string) {
  const twilioFrom = config.twilio_from;
  if (!twilioFrom) throw new Error("Número Twilio (From) não configurado");

  const phone = (lead.phone || '').replace(/\D/g, '');
  if (!phone) throw new Error("Lead sem telefone");

  // Check for Twilio connector gateway
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");

  if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
    throw new Error("Twilio não está conectado. Configure o conector Twilio nas configurações do projeto.");
  }

  const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";
  const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWILIO_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: phone.startsWith("+") ? phone : `+${phone}`,
      From: twilioFrom,
      Body: message,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Twilio API error: ${err}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { trigger_type, lead, extra } = await req.json();
    if (!trigger_type || !lead) {
      throw new Error("trigger_type e lead são obrigatórios");
    }

    // Fetch active automations for this trigger
    const { data: automations, error } = await adminClient
      .from("automations")
      .select("*")
      .eq("trigger_type", trigger_type)
      .eq("active", true);

    if (error) throw error;
    if (!automations || automations.length === 0) {
      return new Response(JSON.stringify({ message: "Nenhuma automação ativa para este gatilho" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { id: string; status: string; error?: string }[] = [];

    for (const auto of automations) {
      try {
        const message = auto.message_template
          ? replacePlaceholders(auto.message_template, lead)
          : `Novo evento: ${trigger_type} - Lead: ${lead.name}`;

        const config = auto.config as Record<string, string>;

        switch (auto.action_type) {
          case "webhook":
            await sendWebhook(config, lead, message);
            break;
          case "whatsapp":
            await sendWhatsApp(
              adminClient, config, lead, message, auto.tenant_id,
              auto.media_url ? { type: auto.media_type, url: auto.media_url } : null
            );
            break;
          case "sms":
            await sendSMS(config, lead, message);
            break;
        }

        results.push({ id: auto.id, status: "success" });
      } catch (err: any) {
        console.error(`Automação ${auto.id} falhou:`, err.message);
        results.push({ id: auto.id, status: "error", error: err.message });
      }
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
