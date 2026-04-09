import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Register the webhook URL on Evolution API so it pushes events to us
async function registerWebhook(evolutionUrl: string, apiKey: string, instanceName: string, supabaseUrl: string) {
  const webhookUrl = `${supabaseUrl}/functions/v1/whatsapp-webhook`;
  
  // Try Evolution API v2 endpoint first, then v1
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
      });
      const txt = await res.text();
      console.log(`Webhook register (${ep.url}) status=${res.status}: ${txt.slice(0, 200)}`);
      if (res.ok) return;
    } catch (err) {
      console.error(`Webhook register error (${ep.url}):`, err);
    }
  }
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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      console.error("getClaims error:", claimsError);
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = { id: claimsData.claims.sub as string };

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

    if (action === "create") {
      const createRes = await fetch(`${evolution_url}/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evolution_api_key },
        body: JSON.stringify({
          instanceName: instance_name,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
          rejectCall: false,
          alwaysOnline: true,
        }),
      });

      let createData: any = {};
      if (!createRes.ok) {
        const errText = await createRes.text();
        const isAlreadyExists = errText.includes("already in use") || createRes.status === 409;
        if (!isAlreadyExists) {
          throw new Error(`Evolution API: ${errText}`);
        }
      } else {
        createData = await createRes.json();
      }

      // Register webhook for this instance
      await registerWebhook(evolution_url, evolution_api_key, instance_name, supabaseUrl);

      // Check if already connected
      const stateRes = await fetch(
        `${evolution_url}/instance/connectionState/${instance_name}`,
        { headers: { apikey: evolution_api_key } }
      );
      let initialStatus = "connecting";
      if (stateRes.ok) {
        const stateData = await stateRes.json();
        if (stateData?.instance?.state === "open") {
          initialStatus = "connected";
        }
      } else {
        await stateRes.text();
      }

      let qrcode = createData.qrcode || null;
      if (initialStatus !== "connected" && !qrcode) {
        const qrRes = await fetch(
          `${evolution_url}/instance/connect/${instance_name}`,
          { headers: { apikey: evolution_api_key } }
        );
        if (qrRes.ok) {
          const qrData = await qrRes.json();
          qrcode = qrData.base64 || qrData.qrcode?.base64 || qrData;
        } else {
          await qrRes.text();
        }
      }

      const { data: saved, error: saveErr } = await adminClient
        .from("whatsapp_instances")
        .insert({
          name: name || instance_name,
          evolution_url,
          evolution_api_key,
          instance_name,
          status: initialStatus,
        })
        .select()
        .single();

      if (saveErr) throw saveErr;

      return new Response(JSON.stringify({
        instance: saved,
        qrcode: qrcode || {},
        alreadyConnected: initialStatus === "connected",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "qrcode") {
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instance_id)
        .single();

      if (!inst) throw new Error("Instância não encontrada");

      // Ensure instance exists on Evolution API
      const checkRes = await fetch(
        `${inst.evolution_url}/instance/connectionState/${inst.instance_name}`,
        { headers: { apikey: inst.evolution_api_key } }
      );

      if (!checkRes.ok) {
        // Recreate instance
        const createRes = await fetch(`${inst.evolution_url}/instance/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: inst.evolution_api_key },
          body: JSON.stringify({
            instanceName: inst.instance_name,
            integration: "WHATSAPP-BAILEYS",
            qrcode: true,
            alwaysOnline: true,
          }),
        });
        if (!createRes.ok && createRes.status !== 409) {
          const err = await createRes.text();
          if (!err.includes("already in use")) {
            throw new Error(`Evolution API: ${err}`);
          }
        } else {
          await createRes.text();
        }
        // Re-register webhook after recreate
        await registerWebhook(inst.evolution_url, inst.evolution_api_key, inst.instance_name, supabaseUrl);
      } else {
        const stateData = await checkRes.json();
        // If already connected, just return
        if (stateData?.instance?.state === "open") {
          await adminClient.from("whatsapp_instances").update({ status: "connected" }).eq("id", instance_id);
          return new Response(JSON.stringify({ status: "connected", alreadyConnected: true }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const qrRes = await fetch(
        `${inst.evolution_url}/instance/connect/${inst.instance_name}`,
        { headers: { apikey: inst.evolution_api_key } }
      );

      if (!qrRes.ok) {
        const err = await qrRes.text();
        throw new Error(`Evolution API: ${err}`);
      }

      const qrData = await qrRes.json();
      const base64 = qrData.base64 || qrData.qrcode?.base64 || null;
      return new Response(JSON.stringify({ 
        qrcode: base64 ? { base64 } : qrData,
        pairingCode: qrData.pairingCode || null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instance_id)
        .single();

      if (!inst) throw new Error("Instância não encontrada");

      let newStatus = inst.status || "disconnected";
      let rawData: any = null;

      try {
        const statusRes = await fetch(
          `${inst.evolution_url}/instance/connectionState/${inst.instance_name}`,
          { 
            headers: { apikey: inst.evolution_api_key },
            signal: AbortSignal.timeout(10000),
          }
        );

        if (statusRes.ok) {
          rawData = await statusRes.json();
          newStatus = rawData.instance?.state === "open" ? "connected" : "disconnected";
        } else {
          await statusRes.text();
          // Don't change status on API error — keep last known state
        }
      } catch (err) {
        // Network timeout or error — keep existing status, don't mark as disconnected
        console.log(`Status check timeout/error for ${inst.instance_name}, keeping status: ${inst.status}`);
        return new Response(JSON.stringify({ status: inst.status, raw: null, cached: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Only update DB if status actually changed
      if (newStatus !== inst.status) {
        await adminClient
          .from("whatsapp_instances")
          .update({ status: newStatus })
          .eq("id", instance_id);
      }

      // If reconnected, ensure webhook is registered
      if (newStatus === "connected" && inst.status !== "connected") {
        await registerWebhook(inst.evolution_url, inst.evolution_api_key, inst.instance_name, supabaseUrl);
      }

      return new Response(JSON.stringify({ status: newStatus, raw: rawData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reconnect") {
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instance_id)
        .single();

      if (!inst) throw new Error("Instância não encontrada");

      // Try to restart the instance on Evolution API
      try {
        await fetch(`${inst.evolution_url}/instance/restart/${inst.instance_name}`, {
          method: "PUT",
          headers: { apikey: inst.evolution_api_key },
        });
      } catch (_) { /* ignore */ }

      // Wait and check status
      await new Promise(r => setTimeout(r, 2000));

      const stateRes = await fetch(
        `${inst.evolution_url}/instance/connectionState/${inst.instance_name}`,
        { headers: { apikey: inst.evolution_api_key } }
      );

      let newStatus = "disconnected";
      if (stateRes.ok) {
        const stateData = await stateRes.json();
        newStatus = stateData?.instance?.state === "open" ? "connected" : "connecting";
      } else {
        await stateRes.text();
      }

      await adminClient.from("whatsapp_instances").update({ status: newStatus }).eq("id", instance_id);

      if (newStatus === "connected") {
        await registerWebhook(inst.evolution_url, inst.evolution_api_key, inst.instance_name, supabaseUrl);
      }

      return new Response(JSON.stringify({ status: newStatus }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "pairing_code") {
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instance_id)
        .single();

      if (!inst) throw new Error("Instância não encontrada");
      if (!phone) throw new Error("Informe o número de telefone");

      const cleanPhone = phone.replace(/\D/g, "");

      try {
        await fetch(`${inst.evolution_url}/instance/logout/${inst.instance_name}`, {
          method: "DELETE",
          headers: { apikey: inst.evolution_api_key },
        });
      } catch (_) { /* ignore */ }
      try {
        await fetch(`${inst.evolution_url}/instance/delete/${inst.instance_name}`, {
          method: "DELETE",
          headers: { apikey: inst.evolution_api_key },
        });
      } catch (_) { /* ignore */ }

      const createRes = await fetch(`${inst.evolution_url}/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: inst.evolution_api_key },
        body: JSON.stringify({
          instanceName: inst.instance_name,
          integration: "WHATSAPP-BAILEYS",
          qrcode: false,
          alwaysOnline: true,
        }),
      });
      if (!createRes.ok && createRes.status !== 409) {
        const errText = await createRes.text();
        if (!errText.includes("already in use")) {
          throw new Error(`Evolution API create: ${errText}`);
        }
      } else {
        await createRes.text();
      }

      // Re-register webhook after recreate
      await registerWebhook(inst.evolution_url, inst.evolution_api_key, inst.instance_name, supabaseUrl);

      await new Promise(r => setTimeout(r, 1000));

      const pairRes = await fetch(
        `${inst.evolution_url}/instance/connect/${inst.instance_name}?number=${cleanPhone}`,
        { method: "GET", headers: { apikey: inst.evolution_api_key } }
      );

      if (!pairRes.ok) {
        const err = await pairRes.text();
        throw new Error(`Evolution API: ${err}`);
      }

      const pairData = await pairRes.json();
      return new Response(JSON.stringify({ pairingCode: pairData.pairingCode || null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instance_id)
        .single();

      if (inst) {
        try {
          await fetch(`${inst.evolution_url}/instance/delete/${inst.instance_name}`, {
            method: "DELETE",
            headers: { apikey: inst.evolution_api_key },
          });
        } catch (_) { /* ignore */ }
        await adminClient.from("whatsapp_instances").delete().eq("id", instance_id);
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "send_test") {
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instance_id)
        .single();

      if (!inst) throw new Error("Instância não encontrada");

      const cleanPhone = (phone || "").replace(/\D/g, "");
      if (!cleanPhone) throw new Error("Telefone inválido");

      const sendRes = await fetch(`${inst.evolution_url}/message/sendText/${inst.instance_name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: inst.evolution_api_key },
        body: JSON.stringify({ number: cleanPhone, text: message || "Mensagem de teste do CRM" }),
      });

      if (!sendRes.ok) {
        const err = await sendRes.text();
        throw new Error(`Erro ao enviar: ${err}`);
      }

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Ação inválida");
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
