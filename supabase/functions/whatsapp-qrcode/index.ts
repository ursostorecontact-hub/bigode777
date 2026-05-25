import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EVOLUTION_API_URL_ENV = Deno.env.get("EVOLUTION_API_URL") || "";
const EVOLUTION_API_KEY_ENV = Deno.env.get("EVOLUTION_API_KEY") || "";

function getCredentials(inst: Record<string, any>) {
  const url = inst.evolution_url || EVOLUTION_API_URL_ENV || "";
  const key = inst.evolution_api_key || EVOLUTION_API_KEY_ENV || "";
  return { url, key };
}

function buildInstancePayload(params: {
  evolution_url: string;
  evolution_api_key: string;
  instance_name?: string;
  name?: string;
  status: string;
  tenant_id?: string | null;
}) {
  const payload: Record<string, unknown> = {
    evolution_url: params.evolution_url,
    evolution_api_key: params.evolution_api_key,
    api_url: params.evolution_url,
    api_key: params.evolution_api_key,
    evolution_api_url: params.evolution_url,
    status: params.status,
    name: params.name || params.instance_name || "",
  };
  if (params.instance_name !== undefined) payload.instance_name = params.instance_name;
  if (params.tenant_id) payload.tenant_id = params.tenant_id;
  return payload;
}

async function registerWebhookWithRetry(
  evolutionUrl: string,
  apiKey: string,
  instanceName: string,
  supabaseUrl: string,
  supabase?: ReturnType<typeof createClient>,
  instanceId?: string,
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
          console.log(`[qrcode] webhook validado na tentativa ${attempt} para ${instanceName}`);
          if (supabase && instanceId) {
            await supabase.from("whatsapp_instances").update({
              webhook_url: webhookUrl,
              webhook_verified_at: new Date().toISOString(),
              webhook_last_error: null,
            }).eq("id", instanceId);
          }
          return { ok: true };
        }
        console.warn(`[qrcode] tentativa ${attempt} falhou, validação:`, JSON.stringify(verifyData).slice(0, 200));
      } else {
        console.warn(`[qrcode] GET webhook/find status=${verifyRes.status} na tentativa ${attempt}`);
      }

      await new Promise((r) => setTimeout(r, attempt * 1000));
    } catch (e) {
      console.error(`[qrcode] tentativa ${attempt} erro:`, e);
      await new Promise((r) => setTimeout(r, attempt * 1000));
    }
  }

  const errMsg = "Webhook não validou após 3 tentativas";
  if (supabase && instanceId) {
    await supabase.from("whatsapp_instances").update({ webhook_last_error: errMsg }).eq("id", instanceId);
  }
  return { ok: false, error: errMsg };
}

// Backward-compat shim — callers that don't need the result
async function registerWebhook(evolutionUrl: string, apiKey: string, instanceName: string, supabaseUrl: string) {
  await registerWebhookWithRetry(evolutionUrl, apiKey, instanceName, supabaseUrl);
}

function isAlreadyExistsError(text: string, status: number) {
  return (
    status === 409 ||
    /already (in use|exists)/i.test(text) ||
    /instance.*exist/i.test(text) ||
    /exist.*instance/i.test(text)
  );
}

// Fetch a fresh QR Code from the Evolution API connect endpoint
async function fetchQrFromConnect(evoUrl: string, evoKey: string, instanceName: string): Promise<string | null> {
  try {
    const res = await fetch(`${evoUrl}/instance/connect/${instanceName}`, {
      headers: { apikey: evoKey },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.log(`/instance/connect/${instanceName} returned ${res.status}`);
      return null;
    }
    const data = await res.json();
    const base64 = data?.base64 || data?.qrcode?.base64 || null;
    if (base64) console.log(`Got QR from /instance/connect/${instanceName}`);
    return base64;
  } catch (err) {
    console.error(`fetchQrFromConnect error for ${instanceName}:`, err);
    return null;
  }
}

// Map Evolution API connection state string to our status
function mapState(state: string | undefined): "connected" | "connecting" | "disconnected" {
  if (state === "open") return "connected";
  if (state === "connecting") return "connecting";
  return "disconnected";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autorizado" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return json({ error: "Não autorizado" }, 401);
    }

    const userId = user.id;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: hasAdmin } = await adminClient.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!hasAdmin) {
      return json({ error: "Apenas administradores" }, 403);
    }

    const body = await req.json();
    const { action, instance_id, evolution_url, evolution_api_key, instance_name, name, phone, message } = body;

    // ─────────────────────────────────────────────────────────────────────────
    // CREATE — creates instance on Evolution API and returns QR Code immediately
    // ─────────────────────────────────────────────────────────────────────────
    if (action === "create") {
      const evoUrl = EVOLUTION_API_URL_ENV || evolution_url || "";
      const evoKey = EVOLUTION_API_KEY_ENV || evolution_api_key || "";
      if (!evoUrl || !evoKey) {
        return json({ error: "Servidor WhatsApp indisponível — EVOLUTION_API_URL e EVOLUTION_API_KEY não configurados" }, 503);
      }

      const { data: adminProfile } = await adminClient
        .from("profiles")
        .select("tenant_id")
        .eq("id", userId)
        .single();
      const tenantId = adminProfile?.tenant_id || null;

      let finalInstanceName = instance_name || "";
      if (!finalInstanceName) {
        let slug = "tenant";
        if (tenantId) {
          const { data: tenantRow } = await adminClient
            .from("tenants")
            .select("slug")
            .eq("id", tenantId)
            .single();
          if (tenantRow?.slug) slug = tenantRow.slug.replace(/[^a-z0-9]/gi, "").toLowerCase();
        }
        finalInstanceName = `${slug}-${Date.now().toString(36)}`;
      }

      console.log(`CREATE instance: ${finalInstanceName} tenant: ${tenantId}`);

      // ── Collision check: delete stale instance if it exists in Evolution API ──
      try {
        const fetchRes = await fetch(`${evoUrl}/instance/fetchInstances`, {
          headers: { apikey: evoKey },
          signal: AbortSignal.timeout(5000),
        });
        if (fetchRes.ok) {
          const allInstances: any[] = await fetchRes.json();
          const stale = allInstances.find(
            (i) => i.name === finalInstanceName && i.connectionStatus !== "open"
          );
          if (stale) {
            console.log(`Deleting stale instance ${finalInstanceName} (${stale.connectionStatus}) before create`);
            await fetch(`${evoUrl}/instance/logout/${finalInstanceName}`, {
              method: "DELETE", headers: { apikey: evoKey }, signal: AbortSignal.timeout(5000),
            }).catch(() => {});
            await fetch(`${evoUrl}/instance/delete/${finalInstanceName}`, {
              method: "DELETE", headers: { apikey: evoKey }, signal: AbortSignal.timeout(5000),
            }).catch(() => {});
            await new Promise((r) => setTimeout(r, 500));
          }
        }
      } catch (e) {
        console.log("Collision check skipped:", e);
      }

      // ── Create on Evolution API ──
      let evolutionOk = false;
      let evolutionWarning: string | null = null;
      let qrcodeBase64: string | null = null;

      try {
        const createRes = await fetch(`${evoUrl}/instance/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evoKey },
          body: JSON.stringify({
            instanceName: finalInstanceName,
            integration: "WHATSAPP-BAILEYS",
            qrcode: true,
            rejectCall: false,
          }),
          signal: AbortSignal.timeout(15000),
        });

        const responseText = await createRes.text();
        console.log(`Evolution create status=${createRes.status}: ${responseText.slice(0, 300)}`);

        if (createRes.ok || isAlreadyExistsError(responseText, createRes.status)) {
          evolutionOk = true;
          // Capture QR from the create response (Evolution API v2 includes it when qrcode: true)
          try {
            const createData = JSON.parse(responseText);
            qrcodeBase64 = createData?.qrcode?.base64 || null;
            if (qrcodeBase64) console.log("Got QR from create response");
          } catch (_) {}
        } else {
          evolutionWarning = `Evolution API: ${responseText.slice(0, 200)}`;
          console.error("Evolution create error:", evolutionWarning);
        }
      } catch (err: any) {
        // Server unreachable — return 503 with clear message
        console.error("Evolution API unreachable:", err.message);
        return json({
          error: "Servidor WhatsApp indisponível, tente em 1 minuto",
          detail: err.message,
        }, 503);
      }

      // If no QR in create response, fetch it from /instance/connect
      if (evolutionOk && !qrcodeBase64) {
        qrcodeBase64 = await fetchQrFromConnect(evoUrl, evoKey, finalInstanceName);
      }

      // Register webhook with validation (best-effort — ID não existe ainda, sem DB update agora)
      if (evolutionOk) {
        await registerWebhookWithRetry(evoUrl, evoKey, finalInstanceName, supabaseUrl);
      }

      // Check connection state (best-effort)
      let initialStatus = "connecting";
      if (evolutionOk) {
        try {
          const stateRes = await fetch(
            `${evoUrl}/instance/connectionState/${finalInstanceName}`,
            { headers: { apikey: evoKey }, signal: AbortSignal.timeout(8000) }
          );
          if (stateRes.ok) {
            const stateData = await stateRes.json();
            initialStatus = mapState(stateData?.instance?.state);
          } else {
            await stateRes.text();
          }
        } catch (_) {}
      }

      // Save to DB
      const instanceStatus = evolutionOk ? initialStatus : "disconnected";
      const payload = buildInstancePayload({
        evolution_url: evoUrl,
        evolution_api_key: evoKey,
        instance_name: finalInstanceName,
        name: name || finalInstanceName,
        status: instanceStatus,
        tenant_id: tenantId,
      });

      let existingQuery = adminClient
        .from("whatsapp_instances")
        .select("id")
        .eq("instance_name", finalInstanceName);
      if (tenantId) existingQuery = existingQuery.eq("tenant_id", tenantId);
      const { data: existing } = await existingQuery.maybeSingle();

      let saved: any;
      let saveErr: any;
      if (existing) {
        const { instance_name: _, ...updatePayload } = payload as any;
        const res = await adminClient
          .from("whatsapp_instances")
          .update(updatePayload)
          .eq("id", existing.id)
          .select()
          .single();
        saved = res.data;
        saveErr = res.error;
      } else {
        const res = await adminClient
          .from("whatsapp_instances")
          .insert(payload)
          .select()
          .single();
        saved = res.data;
        saveErr = res.error;
      }

      if (saveErr) {
        console.error("DB save error:", JSON.stringify(saveErr));
        return json({ error: `Erro ao salvar instância: ${saveErr.message}` }, 500);
      }

      return json({
        instance_id: saved.id,
        instance_name: finalInstanceName,
        qrcode_base64: qrcodeBase64,
        expires_at: qrcodeBase64 ? new Date(Date.now() + 60000).toISOString() : null,
        instance: saved,
        alreadyConnected: initialStatus === "connected",
        warning: evolutionWarning,
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REFRESH_QR — fetches a fresh QR Code for an existing instance
    // ─────────────────────────────────────────────────────────────────────────
    if (action === "refresh_qr") {
      if (!instance_id) return json({ error: "instance_id é obrigatório" }, 400);

      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instance_id)
        .single();
      if (!inst) return json({ error: "Instância não encontrada" }, 404);

      const { url: evoUrl, key: evoKey } = getCredentials(inst);
      if (!evoUrl || !evoKey) return json({ error: "Credenciais da Evolution API não configuradas" }, 500);

      console.log(`REFRESH_QR for ${inst.instance_name}`);

      // Check if already connected
      try {
        const stateRes = await fetch(`${evoUrl}/instance/connectionState/${inst.instance_name}`, {
          headers: { apikey: evoKey },
          signal: AbortSignal.timeout(8000),
        });
        if (stateRes.ok) {
          const stateData = await stateRes.json();
          if (stateData?.instance?.state === "open") {
            await adminClient.from("whatsapp_instances").update({ status: "connected" }).eq("id", instance_id);
            return json({ connected: true });
          }
        } else {
          await stateRes.text();
        }
      } catch (_) {}

      const qrcodeBase64 = await fetchQrFromConnect(evoUrl, evoKey, inst.instance_name);

      if (!qrcodeBase64) {
        return json({ error: "Não foi possível gerar QR Code. Verifique se a instância está ativa no servidor." }, 503);
      }

      return json({
        qrcode_base64: qrcodeBase64,
        expires_at: new Date(Date.now() + 60000).toISOString(),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK_STATUS — polls connection state, updates DB, fires onboard on connect
    // ─────────────────────────────────────────────────────────────────────────
    if (action === "check_status") {
      if (!instance_id) return json({ error: "instance_id é obrigatório" }, 400);

      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instance_id)
        .single();
      if (!inst) return json({ error: "Instância não encontrada" }, 404);

      const { url: evoUrl, key: evoKey } = getCredentials(inst);
      const oldStatus = inst.status || "disconnected";
      let newStatus: string = oldStatus;

      try {
        const statusRes = await fetch(
          `${evoUrl}/instance/connectionState/${inst.instance_name}`,
          { headers: { apikey: evoKey }, signal: AbortSignal.timeout(8000) }
        );
        if (statusRes.ok) {
          const rawData = await statusRes.json();
          newStatus = mapState(rawData?.instance?.state);
          console.log(`CHECK_STATUS ${inst.instance_name}: ${rawData?.instance?.state} → ${newStatus}`);
        } else {
          await statusRes.text();
          // Keep previous status if we can't reach Evolution API
          return json({ status: oldStatus, cached: true });
        }
      } catch (_) {
        return json({ status: oldStatus, cached: true });
      }

      if (newStatus !== oldStatus) {
        await adminClient.from("whatsapp_instances").update({ status: newStatus }).eq("id", instance_id);
        console.log(`Status changed: ${oldStatus} → ${newStatus} for ${inst.instance_name}`);

        // Re-register webhook when newly connected (with validation + DB update)
        if (newStatus === "connected") {
          await registerWebhookWithRetry(evoUrl, evoKey, inst.instance_name, supabaseUrl, adminClient, instance_id);
          // Fire whatsapp-sync in background (best-effort, non-blocking)
          fetch(`${supabaseUrl}/functions/v1/whatsapp-sync`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ instance_id }),
          }).catch((e) => console.log("whatsapp-sync trigger error:", e));
          // Sync nomes reais dos grupos imediatamente ao conectar
          fetch(`${supabaseUrl}/functions/v1/whatsapp-sync-groups`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ instance_id, internal: true }),
          }).catch((e) => console.log("whatsapp-sync-groups trigger error:", e));
        }
      }

      return json({ status: newStatus, last_change_at: new Date().toISOString() });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // QRCODE — fetch QR for existing instance (backward compat)
    // ─────────────────────────────────────────────────────────────────────────
    if (action === "qrcode") {
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instance_id)
        .single();
      if (!inst) return json({ error: "Instância não encontrada" }, 404);
      const { url: evoUrl, key: evoKey } = getCredentials(inst);
      if (!evoUrl || !evoKey) return json({ error: "Credenciais da Evolution API não configuradas na instância" }, 500);

      try {
        const checkRes = await fetch(
          `${evoUrl}/instance/connectionState/${inst.instance_name}`,
          { headers: { apikey: evoKey }, signal: AbortSignal.timeout(10000) }
        );
        if (!checkRes.ok) {
          // Instance not found on Evolution API — recreate
          const createRes = await fetch(`${evoUrl}/instance/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: evoKey },
            body: JSON.stringify({
              instanceName: inst.instance_name,
              integration: "WHATSAPP-BAILEYS",
              qrcode: true,
            }),
            signal: AbortSignal.timeout(15000),
          });
          const createText = await createRes.text();
          console.log(`Recreate status=${createRes.status}: ${createText.slice(0, 200)}`);
          if (!createRes.ok && !isAlreadyExistsError(createText, createRes.status)) {
            return json({ error: `Evolution API (recreate): ${createText.slice(0, 200)}` }, 502);
          }
          await registerWebhook(evoUrl, evoKey, inst.instance_name, supabaseUrl);
        } else {
          const stateData = await checkRes.json();
          if (stateData?.instance?.state === "open") {
            await adminClient.from("whatsapp_instances").update({ status: "connected" }).eq("id", instance_id);
            return json({ status: "connected", alreadyConnected: true });
          }
        }
      } catch (err: any) {
        return json({ error: `Não foi possível conectar à Evolution API: ${err.message}` }, 503);
      }

      const qrRes = await fetch(
        `${evoUrl}/instance/connect/${inst.instance_name}`,
        { headers: { apikey: evoKey }, signal: AbortSignal.timeout(15000) }
      );
      if (!qrRes.ok) {
        const err = await qrRes.text();
        return json({ error: `Evolution API (QR): ${err.slice(0, 200)}` }, 502);
      }
      const qrData = await qrRes.json();
      const base64 = qrData.base64 || qrData.qrcode?.base64 || null;
      return json({ qrcode: base64 ? { base64 } : qrData, pairingCode: qrData.pairingCode || null });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STATUS — poll connection state (backward compat; fixed state mapping)
    // ─────────────────────────────────────────────────────────────────────────
    if (action === "status") {
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instance_id)
        .single();
      if (!inst) return json({ error: "Instância não encontrada" }, 404);
      const { url: evoUrl, key: evoKey } = getCredentials(inst);
      let newStatus = inst.status || "disconnected";
      let rawData: any = null;

      try {
        const statusRes = await fetch(
          `${evoUrl}/instance/connectionState/${inst.instance_name}`,
          { headers: { apikey: evoKey }, signal: AbortSignal.timeout(10000) }
        );
        if (statusRes.ok) {
          rawData = await statusRes.json();
          newStatus = mapState(rawData?.instance?.state);
        } else {
          await statusRes.text();
        }
      } catch (_) {
        return json({ status: inst.status, raw: null, cached: true });
      }

      if (newStatus !== inst.status) {
        await adminClient.from("whatsapp_instances").update({ status: newStatus }).eq("id", instance_id);
      }
      if (newStatus === "connected") {
        await registerWebhook(evoUrl, evoKey, inst.instance_name, supabaseUrl);
      }
      return json({ status: newStatus, raw: rawData });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RECONNECT
    // ─────────────────────────────────────────────────────────────────────────
    if (action === "reconnect") {
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instance_id)
        .single();
      if (!inst) return json({ error: "Instância não encontrada" }, 404);
      const { url: evoUrl, key: evoKey } = getCredentials(inst);

      try {
        await fetch(`${evoUrl}/instance/restart/${inst.instance_name}`, {
          method: "PUT", headers: { apikey: evoKey }, signal: AbortSignal.timeout(10000),
        });
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 2000));

      let newStatus = "disconnected";
      try {
        const stateRes = await fetch(
          `${evoUrl}/instance/connectionState/${inst.instance_name}`,
          { headers: { apikey: evoKey }, signal: AbortSignal.timeout(10000) }
        );
        if (stateRes.ok) {
          const stateData = await stateRes.json();
          newStatus = mapState(stateData?.instance?.state);
        } else {
          await stateRes.text();
        }
      } catch (_) {}

      await adminClient.from("whatsapp_instances").update({ status: newStatus }).eq("id", instance_id);
      if (newStatus === "connected") {
        await registerWebhook(evoUrl, evoKey, inst.instance_name, supabaseUrl);
      }
      return json({ status: newStatus });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PAIRING CODE
    // ─────────────────────────────────────────────────────────────────────────
    if (action === "pairing_code") {
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instance_id)
        .single();
      if (!inst) return json({ error: "Instância não encontrada" }, 404);
      if (!phone) return json({ error: "Informe o número de telefone" }, 400);
      const { url: evoUrl, key: evoKey } = getCredentials(inst);
      const cleanPhone = phone.replace(/\D/g, "");

      try {
        await fetch(`${evoUrl}/instance/logout/${inst.instance_name}`, {
          method: "DELETE", headers: { apikey: evoKey }, signal: AbortSignal.timeout(8000),
        });
      } catch (_) {}
      try {
        await fetch(`${evoUrl}/instance/delete/${inst.instance_name}`, {
          method: "DELETE", headers: { apikey: evoKey }, signal: AbortSignal.timeout(8000),
        });
      } catch (_) {}

      const createRes = await fetch(`${evoUrl}/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evoKey },
        body: JSON.stringify({
          instanceName: inst.instance_name,
          integration: "WHATSAPP-BAILEYS",
          qrcode: false,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!createRes.ok && createRes.status !== 409) {
        const errText = await createRes.text();
        if (!isAlreadyExistsError(errText, createRes.status)) {
          return json({ error: `Evolution API create: ${errText.slice(0, 200)}` }, 502);
        }
      } else {
        await createRes.text();
      }

      await registerWebhook(evoUrl, evoKey, inst.instance_name, supabaseUrl);
      await new Promise((r) => setTimeout(r, 1000));

      const pairRes = await fetch(
        `${evoUrl}/instance/connect/${inst.instance_name}?number=${cleanPhone}`,
        { method: "GET", headers: { apikey: evoKey }, signal: AbortSignal.timeout(15000) }
      );
      if (!pairRes.ok) {
        const err = await pairRes.text();
        return json({ error: `Evolution API: ${err.slice(0, 200)}` }, 502);
      }
      const pairData = await pairRes.json();
      return json({ pairingCode: pairData.pairingCode || null });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE — redirect to dedicated function
    // ─────────────────────────────────────────────────────────────────────────
    if (action === "delete") {
      return json({ error: "Use a função whatsapp-delete-instance para remover instâncias" }, 400);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SEND TEST
    // ─────────────────────────────────────────────────────────────────────────
    if (action === "send_test") {
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instance_id)
        .single();
      if (!inst) return json({ error: "Instância não encontrada" }, 404);
      const { url: evoUrl, key: evoKey } = getCredentials(inst);
      const cleanPhone = (phone || "").replace(/\D/g, "");
      if (!cleanPhone) return json({ error: "Telefone inválido" }, 400);

      const sendRes = await fetch(`${evoUrl}/message/sendText/${inst.instance_name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evoKey },
        body: JSON.stringify({ number: cleanPhone, text: message || "Mensagem de teste do CRM" }),
        signal: AbortSignal.timeout(15000),
      });
      if (!sendRes.ok) {
        const err = await sendRes.text();
        return json({ error: `Erro ao enviar: ${err.slice(0, 200)}` }, 502);
      }
      return json({ ok: true });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CHECK WEBHOOK
    // ─────────────────────────────────────────────────────────────────────────
    if (action === "check_webhook") {
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instance_id)
        .single();
      if (!inst) return json({ error: "Instância não encontrada" }, 404);
      const { url: evoUrl, key: evoKey } = getCredentials(inst);

      let currentWebhook = null;
      try {
        const checkRes = await fetch(`${evoUrl}/webhook/find/${inst.instance_name}`, {
          headers: { apikey: evoKey }, signal: AbortSignal.timeout(8000),
        });
        if (checkRes.ok) currentWebhook = await checkRes.json();
      } catch (_) {}

      const webhookResult = await registerWebhookWithRetry(evoUrl, evoKey, inst.instance_name, supabaseUrl, adminClient, instance_id);
      if (!webhookResult.ok) {
        return json({
          ok: false,
          current_webhook: currentWebhook,
          error: webhookResult.error,
        }, 502);
      }
      return json({
        ok: true,
        current_webhook: currentWebhook,
        expected_url: `${supabaseUrl}/functions/v1/whatsapp-webhook`,
        re_registered: true,
        verified: true,
      });
    }

    return json({ error: "Ação inválida" }, 400);
  } catch (err: any) {
    console.error("whatsapp-qrcode error:", err.message);
    return json({ error: err.message }, 500);
  }
});
