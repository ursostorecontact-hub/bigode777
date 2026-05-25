import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOLUTION_API_URL_ENV = Deno.env.get("EVOLUTION_API_URL") || "";
const EVOLUTION_API_KEY_ENV = Deno.env.get("EVOLUTION_API_KEY") || "";

function mapState(state: string | undefined): "connected" | "connecting" | "disconnected" {
  if (state === "open") return "connected";
  if (state === "connecting") return "connecting";
  return "disconnected";
}

async function registerWebhookWithRetry(
  evolutionUrl: string,
  apiKey: string,
  instanceName: string,
): Promise<{ ok: boolean; error?: string }> {
  const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;
  const config = {
    webhook: {
      enabled: true,
      url: webhookUrl,
      webhookByEvents: false,
      webhookBase64: true,
      events: [
        "MESSAGES_UPSERT", "MESSAGES_UPDATE",
        "CONNECTION_UPDATE",
        "CONTACTS_UPSERT", "CONTACTS_UPDATE",
        "CHATS_UPSERT", "CHATS_UPDATE",
      ],
    },
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await fetch(`${evolutionUrl}/webhook/set/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify(config),
        signal: AbortSignal.timeout(10000),
      });

      await new Promise((r) => setTimeout(r, 500));

      const verifyRes = await fetch(`${evolutionUrl}/webhook/find/${instanceName}`, {
        headers: { apikey: apiKey },
        signal: AbortSignal.timeout(8000),
      });

      if (verifyRes.ok) {
        const verifyData = await verifyRes.json();
        if (verifyData?.enabled === true && verifyData?.url === webhookUrl) {
          console.log(`[health-check] webhook validado na tentativa ${attempt} para ${instanceName}`);
          return { ok: true };
        }
        console.warn(`[health-check] tentativa ${attempt} falhou, dados:`, JSON.stringify(verifyData).slice(0, 200));
      }

      await new Promise((r) => setTimeout(r, attempt * 1000));
    } catch (e) {
      console.error(`[health-check] tentativa ${attempt} erro:`, e);
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }

  return { ok: false, error: "Webhook não validou após 3 tentativas" };
}

async function healInstance(
  supabase: ReturnType<typeof createClient>,
  inst: {
    id: string;
    instance_name: string;
    tenant_id: string;
    webhook_url: string | null;
    evolution_url: string | null;
    evolution_api_key: string | null;
    status: string;
  },
): Promise<Record<string, unknown>> {
  const evoUrl = inst.evolution_url || EVOLUTION_API_URL_ENV;
  const evoKey = inst.evolution_api_key || EVOLUTION_API_KEY_ENV;
  const expectedWebhook = `${supabaseUrl}/functions/v1/whatsapp-webhook`;

  const result: Record<string, unknown> = {
    id: inst.id,
    instance_name: inst.instance_name,
  };

  if (!evoUrl || !evoKey) {
    result.error = "Sem credenciais Evolution API";
    return result;
  }

  // 1. Verificar estado de conexão
  try {
    const stateRes = await fetch(`${evoUrl}/instance/connectionState/${inst.instance_name}`, {
      headers: { apikey: evoKey },
      signal: AbortSignal.timeout(8000),
    });

    if (stateRes.ok) {
      const stateData = await stateRes.json();
      const currentState = mapState(stateData?.instance?.state);
      result.connection = currentState;

      if (currentState !== inst.status) {
        await supabase
          .from("whatsapp_instances")
          .update({ status: currentState })
          .eq("id", inst.id);
        result.status_updated = `${inst.status} → ${currentState}`;
      }
    } else {
      result.connection_check_status = stateRes.status;
    }
  } catch (e) {
    result.connection_check_error = String(e);
  }

  // 2. Verificar e reparar webhook
  try {
    let webhookOk = false;

    const findRes = await fetch(`${evoUrl}/webhook/find/${inst.instance_name}`, {
      headers: { apikey: evoKey },
      signal: AbortSignal.timeout(8000),
    });

    if (findRes.ok) {
      const webhookData = await findRes.json();
      webhookOk = webhookData?.enabled === true && webhookData?.url === expectedWebhook;
      result.webhook_current = webhookData?.url;
    }

    if (!webhookOk) {
      console.log(`[health-check] webhook incorreto em ${inst.instance_name}, reparando...`);
      const healResult = await registerWebhookWithRetry(evoUrl, evoKey, inst.instance_name);
      result.webhook_healed = healResult.ok;

      await supabase
        .from("whatsapp_instances")
        .update({
          webhook_url: healResult.ok ? expectedWebhook : inst.webhook_url,
          webhook_verified_at: healResult.ok ? new Date().toISOString() : null,
          webhook_last_error: healResult.ok ? null : (healResult.error ?? null),
        })
        .eq("id", inst.id);
    } else {
      result.webhook_ok = true;
    }
  } catch (e) {
    result.webhook_check_error = String(e);
  }

  // 3. Atualizar last_health_check
  await supabase
    .from("whatsapp_instances")
    .update({ last_health_check: new Date().toISOString() })
    .eq("id", inst.id);

  return result;
}

Deno.serve(async (_req) => {
  console.log("[health-check] iniciando verificação");

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: instances, error } = await supabase
      .from("whatsapp_instances")
      .select("id, instance_name, tenant_id, webhook_url, evolution_url, evolution_api_key, status")
      .eq("status", "connected");

    if (error) {
      console.error("[health-check] erro ao buscar instâncias:", error);
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`[health-check] verificando ${instances?.length ?? 0} instâncias`);

    const results = [];
    for (const inst of instances ?? []) {
      try {
        const r = await healInstance(supabase, inst as any);
        results.push(r);
      } catch (e) {
        console.error(`[health-check] erro em ${inst.instance_name}:`, e);
        results.push({ id: inst.id, instance_name: inst.instance_name, error: String(e) });
      }
    }

    console.log("[health-check] concluído:", JSON.stringify(results).slice(0, 500));

    return new Response(
      JSON.stringify({ ok: true, checked: instances?.length ?? 0, results }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[health-check] ERROR FATAL:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
