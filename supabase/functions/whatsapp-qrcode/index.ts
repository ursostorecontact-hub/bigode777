import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Env-based Evolution API credentials — set in Supabase Edge Function secrets.
const EVOLUTION_API_URL_ENV = Deno.env.get("EVOLUTION_API_URL") || "";
const EVOLUTION_API_KEY_ENV = Deno.env.get("EVOLUTION_API_KEY") || "";

// Normalize credentials from DB row, falling back to env vars
function getCredentials(inst: Record<string, any>) {
  const url = inst.evolution_url || EVOLUTION_API_URL_ENV || "";
  const key = inst.evolution_api_key || EVOLUTION_API_KEY_ENV || "";
  return { url, key };
}

// Build insert/update payload matching the actual whatsapp_instances schema.
// 'name' is optional — falls back to instance_name if omitted.
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
    // api_url and api_key mirror evolution_url/evolution_api_key to satisfy
    // the NOT NULL constraint on api_url that exists in production.
    api_url: params.evolution_url,
    api_key: params.evolution_api_key,
    // evolution_api_url is a denormalized copy used by some legacy code paths.
    evolution_api_url: params.evolution_url,
    status: params.status,
    // Always include name, defaulting to instance_name so the column is never
    // omitted from INSERT (a missing name on an existing NOT NULL column causes errors).
    name: params.name || params.instance_name || "",
  };
  if (params.instance_name !== undefined) payload.instance_name = params.instance_name;
  if (params.tenant_id) payload.tenant_id = params.tenant_id;
  return payload;
}

// Register the webhook URL on Evolution API so it pushes events to us
async function registerWebhook(evolutionUrl: string, apiKey: string, instanceName: string, supabaseUrl: string) {
  const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;

  const endpoints = [
    { url: `${evolutionUrl}/webhook/set/${instanceName}`, method: "POST" },
    { url: `${evolutionUrl}/webhook/instance/${instanceName}`, method: "PUT" },
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        method: ep.method,
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({
          enabled: true,
          url: webhookUrl,
          webhookByEvents: false,
          events: [
            "MESSAGES_UPSERT",
            "MESSAGES_UPDATE",
            "CONNECTION_UPDATE",
            "QRCODE_UPDATED",
            "messages.upsert",
            "messages.update",
            "connection.update",
          ],
        }),
        signal: AbortSignal.timeout(10000),
      });
      const txt = await res.text();
      console.log(`Webhook register (${ep.url}) status=${res.status}: ${txt.slice(0, 200)}`);
      if (res.ok) return;
    } catch (err) {
      console.error(`Webhook register error (${ep.url}):`, err);
    }
  }
}

// Check if Evolution API error means "instance already exists"
function isAlreadyExistsError(text: string, status: number) {
  return (
    status === 409 ||
    /already (in use|exists)/i.test(text) ||
    /instance.*exist/i.test(text) ||
    /exist.*instance/i.test(text)
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error("getUser error:", userError);
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check admin role
    const { data: hasAdmin } = await adminClient.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!hasAdmin) {
      return new Response(JSON.stringify({ error: "Apenas administradores" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, instance_id, evolution_url, evolution_api_key, instance_name, name, phone, message } = await req.json();

    // ─────────────────────────────────────────────────────────────────────────
    // CREATE
    // ─────────────────────────────────────────────────────────────────────────
    if (action === "create") {
      // Prefer env vars (centralized); request params allowed as override for legacy callers
      const evoUrl = EVOLUTION_API_URL_ENV || evolution_url || "";
      const evoKey = EVOLUTION_API_KEY_ENV || evolution_api_key || "";
      if (!evoUrl || !evoKey) {
        throw new Error("Evolution API não configurada. Defina EVOLUTION_API_URL e EVOLUTION_API_KEY nos secrets.");
      }

      // Look up admin tenant_id for proper scoping
      const { data: adminProfile } = await adminClient
        .from("profiles")
        .select("tenant_id")
        .eq("id", userId)
        .single();
      const tenantId = adminProfile?.tenant_id || null;

      // Auto-generate instance_name from tenant slug + timestamp if not explicitly provided
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

      console.log(`Creating instance: ${finalInstanceName} for tenant: ${tenantId}`);

      // ── Step 1: Create on Evolution API (best-effort) ──
      let evolutionOk = false;
      let evolutionWarning: string | null = null;

      try {
        const createRes = await fetch(`${evoUrl}/instance/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evoKey },
          body: JSON.stringify({
            instanceName: finalInstanceName,
            integration: "WHATSAPP-BAILEYS",
            qrcode: true,
            rejectCall: false,
            alwaysOnline: true,
          }),
          signal: AbortSignal.timeout(15000),
        });

        const responseText = await createRes.text();
        console.log(`Evolution create status=${createRes.status}: ${responseText.slice(0, 300)}`);

        if (createRes.ok || isAlreadyExistsError(responseText, createRes.status)) {
          evolutionOk = true;
        } else {
          evolutionWarning = `Evolution API: ${responseText.slice(0, 200)}`;
          console.error("Evolution create error (non-fatal):", evolutionWarning);
        }
      } catch (err: any) {
        evolutionWarning = `Não foi possível conectar à Evolution API: ${err.message}`;
        console.error("Evolution API unreachable during create:", err.message);
      }

      // ── Step 2: Register webhook (best-effort) ──
      if (evolutionOk) {
        await registerWebhook(evoUrl, evoKey, finalInstanceName, supabaseUrl);
      }

      // ── Step 3: Check connection state (best-effort) ──
      let initialStatus = "connecting";
      if (evolutionOk) {
        try {
          const stateRes = await fetch(
            `${evoUrl}/instance/connectionState/${finalInstanceName}`,
            { headers: { apikey: evoKey }, signal: AbortSignal.timeout(8000) }
          );
          if (stateRes.ok) {
            const stateData = await stateRes.json();
            if (stateData?.instance?.state === "open") initialStatus = "connected";
          } else {
            await stateRes.text();
          }
        } catch (_) { /* keep "connecting" */ }
      }

      // ── Step 4: Save to DB (insert or update, scoped to tenant) ──
      const instanceStatus = evolutionOk ? initialStatus : "disconnected";
      const payload = buildInstancePayload({
        evolution_url: evoUrl,
        evolution_api_key: evoKey,
        instance_name: finalInstanceName,
        name: name || finalInstanceName,
        status: instanceStatus,
        tenant_id: tenantId,
      });

      // Scope existing-instance lookup to tenant to respect multi-tenant isolation
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
        throw new Error(`Erro ao salvar instância: ${saveErr.message}`);
      }

      return new Response(JSON.stringify({
        instance: saved,
        qrcode: {},
        alreadyConnected: initialStatus === "connected",
        warning: evolutionWarning,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // QRCODE
    // ─────────────────────────────────────────────────────────────────────────
    if (action === "qrcode") {
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instance_id)
        .single();

      if (!inst) throw new Error("Instância não encontrada");
      const { url: evoUrl, key: evoKey } = getCredentials(inst);
      if (!evoUrl || !evoKey) throw new Error("Credenciais da Evolution API não configuradas na instância");

      let instanceReady = false;
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
              alwaysOnline: true,
            }),
            signal: AbortSignal.timeout(15000),
          });
          const createText = await createRes.text();
          console.log(`Recreate status=${createRes.status}: ${createText.slice(0, 200)}`);
          if (createRes.ok || isAlreadyExistsError(createText, createRes.status)) {
            instanceReady = true;
            await registerWebhook(evoUrl, evoKey, inst.instance_name, supabaseUrl);
          } else {
            throw new Error(`Evolution API (recreate): ${createText.slice(0, 200)}`);
          }
        } else {
          const stateData = await checkRes.json();
          console.log("State check:", JSON.stringify(stateData).slice(0, 200));
          if (stateData?.instance?.state === "open") {
            await adminClient.from("whatsapp_instances").update({ status: "connected" }).eq("id", instance_id);
            return new Response(JSON.stringify({ status: "connected", alreadyConnected: true }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          instanceReady = true;
        }
      } catch (err: any) {
        if (err.message.startsWith("Evolution API")) throw err;
        throw new Error(`Não foi possível conectar à Evolution API: ${err.message}`);
      }

      if (!instanceReady) throw new Error("Instância não está pronta na Evolution API");

      const qrRes = await fetch(
        `${evoUrl}/instance/connect/${inst.instance_name}`,
        { headers: { apikey: evoKey }, signal: AbortSignal.timeout(15000) }
      );

      if (!qrRes.ok) {
        const err = await qrRes.text();
        throw new Error(`Evolution API (QR): ${err.slice(0, 200)}`);
      }

      const qrData = await qrRes.json();
      console.log("QR data keys:", Object.keys(qrData));
      const base64 = qrData.base64 || qrData.qrcode?.base64 || null;
      return new Response(JSON.stringify({
        qrcode: base64 ? { base64 } : qrData,
        pairingCode: qrData.pairingCode || null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STATUS
    // ─────────────────────────────────────────────────────────────────────────
    if (action === "status") {
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instance_id)
        .single();

      if (!inst) throw new Error("Instância não encontrada");
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
          newStatus = rawData.instance?.state === "open" ? "connected" : "disconnected";
        } else {
          await statusRes.text();
        }
      } catch (err) {
        console.log(`Status check timeout/error for ${inst.instance_name}, keeping: ${inst.status}`);
        return new Response(JSON.stringify({ status: inst.status, raw: null, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (newStatus !== inst.status) {
        await adminClient.from("whatsapp_instances").update({ status: newStatus }).eq("id", instance_id);
      }

      // Always re-register webhook when connected (idempotent — ensures it's never lost)
      if (newStatus === "connected") {
        await registerWebhook(evoUrl, evoKey, inst.instance_name, supabaseUrl);
      }

      return new Response(JSON.stringify({ status: newStatus, raw: rawData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

      if (!inst) throw new Error("Instância não encontrada");
      const { url: evoUrl, key: evoKey } = getCredentials(inst);

      try {
        await fetch(`${evoUrl}/instance/restart/${inst.instance_name}`, {
          method: "PUT",
          headers: { apikey: evoKey },
          signal: AbortSignal.timeout(10000),
        });
      } catch (_) { /* ignore */ }

      await new Promise(r => setTimeout(r, 2000));

      let newStatus = "disconnected";
      try {
        const stateRes = await fetch(
          `${evoUrl}/instance/connectionState/${inst.instance_name}`,
          { headers: { apikey: evoKey }, signal: AbortSignal.timeout(10000) }
        );
        if (stateRes.ok) {
          const stateData = await stateRes.json();
          newStatus = stateData?.instance?.state === "open" ? "connected" : "connecting";
        } else {
          await stateRes.text();
        }
      } catch (_) { /* keep disconnected */ }

      await adminClient.from("whatsapp_instances").update({ status: newStatus }).eq("id", instance_id);

      if (newStatus === "connected") {
        await registerWebhook(evoUrl, evoKey, inst.instance_name, supabaseUrl);
      }

      return new Response(JSON.stringify({ status: newStatus }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

      if (!inst) throw new Error("Instância não encontrada");
      if (!phone) throw new Error("Informe o número de telefone");
      const { url: evoUrl, key: evoKey } = getCredentials(inst);

      const cleanPhone = phone.replace(/\D/g, "");

      try {
        await fetch(`${evoUrl}/instance/logout/${inst.instance_name}`, {
          method: "DELETE", headers: { apikey: evoKey }, signal: AbortSignal.timeout(8000),
        });
      } catch (_) { /* ignore */ }
      try {
        await fetch(`${evoUrl}/instance/delete/${inst.instance_name}`, {
          method: "DELETE", headers: { apikey: evoKey }, signal: AbortSignal.timeout(8000),
        });
      } catch (_) { /* ignore */ }

      const createRes = await fetch(`${evoUrl}/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evoKey },
        body: JSON.stringify({
          instanceName: inst.instance_name,
          integration: "WHATSAPP-BAILEYS",
          qrcode: false,
          alwaysOnline: true,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (!createRes.ok && createRes.status !== 409) {
        const errText = await createRes.text();
        if (!isAlreadyExistsError(errText, createRes.status)) {
          throw new Error(`Evolution API create: ${errText.slice(0, 200)}`);
        }
      } else {
        await createRes.text();
      }

      await registerWebhook(evoUrl, evoKey, inst.instance_name, supabaseUrl);
      await new Promise(r => setTimeout(r, 1000));

      const pairRes = await fetch(
        `${evoUrl}/instance/connect/${inst.instance_name}?number=${cleanPhone}`,
        { method: "GET", headers: { apikey: evoKey }, signal: AbortSignal.timeout(15000) }
      );

      if (!pairRes.ok) {
        const err = await pairRes.text();
        throw new Error(`Evolution API: ${err.slice(0, 200)}`);
      }

      const pairData = await pairRes.json();
      return new Response(JSON.stringify({ pairingCode: pairData.pairingCode || null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DELETE
    // ─────────────────────────────────────────────────────────────────────────
    if (action === "delete") {
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instance_id)
        .single();

      if (inst) {
        const { url: evoUrl, key: evoKey } = getCredentials(inst);
        try {
          await fetch(`${evoUrl}/instance/delete/${inst.instance_name}`, {
            method: "DELETE",
            headers: { apikey: evoKey },
            signal: AbortSignal.timeout(10000),
          });
        } catch (_) { /* ignore */ }
        await adminClient.from("whatsapp_instances").delete().eq("id", instance_id);
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

      if (!inst) throw new Error("Instância não encontrada");
      const { url: evoUrl, key: evoKey } = getCredentials(inst);

      const cleanPhone = (phone || "").replace(/\D/g, "");
      if (!cleanPhone) throw new Error("Telefone inválido");

      const sendRes = await fetch(`${evoUrl}/message/sendText/${inst.instance_name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evoKey },
        body: JSON.stringify({ number: cleanPhone, text: message || "Mensagem de teste do CRM" }),
        signal: AbortSignal.timeout(15000),
      });

      if (!sendRes.ok) {
        const err = await sendRes.text();
        throw new Error(`Erro ao enviar: ${err.slice(0, 200)}`);
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

      if (!inst) throw new Error("Instância não encontrada");
      const { url: evoUrl, key: evoKey } = getCredentials(inst);

      let currentWebhook = null;
      try {
        const checkRes = await fetch(`${evoUrl}/webhook/find/${inst.instance_name}`, {
          headers: { apikey: evoKey },
          signal: AbortSignal.timeout(8000),
        });
        if (checkRes.ok) currentWebhook = await checkRes.json();
      } catch (_) {}

      await registerWebhook(evoUrl, evoKey, inst.instance_name, supabaseUrl);

      return new Response(JSON.stringify({
        ok: true,
        current_webhook: currentWebhook,
        expected_url: `${supabaseUrl}/functions/v1/whatsapp-webhook`,
        re_registered: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Ação inválida");
  } catch (err: any) {
    console.error("whatsapp-qrcode error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
