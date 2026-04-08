import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    if (action === "create") {
      // Try to create instance on Evolution API (ignore if already exists)
      const createRes = await fetch(`${evolution_url}/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evolution_api_key },
        body: JSON.stringify({
          instanceName: instance_name,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
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
      }

      // If not connected, get QR code
      let qrcode = createData.qrcode || null;
      if (initialStatus !== "connected" && !qrcode) {
        const qrRes = await fetch(
          `${evolution_url}/instance/connect/${instance_name}`,
          { headers: { apikey: evolution_api_key } }
        );
        if (qrRes.ok) {
          const qrData = await qrRes.json();
          qrcode = qrData.base64 || qrData.qrcode?.base64 || qrData;
        }
      }

      // Save to DB
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

      // Ensure instance exists on Evolution API (recreate if needed)
      const checkRes = await fetch(
        `${inst.evolution_url}/instance/connectionState/${inst.instance_name}`,
        { headers: { apikey: inst.evolution_api_key } }
      );
      if (!checkRes.ok) {
        // Instance doesn't exist on Evolution, recreate it
        const createRes = await fetch(`${inst.evolution_url}/instance/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: inst.evolution_api_key },
          body: JSON.stringify({
            instanceName: inst.instance_name,
            integration: "WHATSAPP-BAILEYS",
            qrcode: true,
          }),
        });
        if (!createRes.ok && createRes.status !== 409) {
          const err = await createRes.text();
          if (!err.includes("already in use")) {
            throw new Error(`Evolution API: ${err}`);
          }
        }
        if (createRes.ok || createRes.status === 409) {
          await createRes.text(); // consume body
        }
      } else {
        await checkRes.text(); // consume body
      }

      // Now get QR code
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

      const statusRes = await fetch(
        `${inst.evolution_url}/instance/connectionState/${inst.instance_name}`,
        { headers: { apikey: inst.evolution_api_key } }
      );

      let newStatus = "disconnected";
      let rawData: any = null;
      if (statusRes.ok) {
        rawData = await statusRes.json();
        newStatus = rawData.instance?.state === "open" ? "connected" : "disconnected";
      } else {
        await statusRes.text();
      }

      await adminClient
        .from("whatsapp_instances")
        .update({ status: newStatus })
        .eq("id", instance_id);

      return new Response(JSON.stringify({ status: newStatus, raw: rawData }), {
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

      // Ensure instance exists
      const checkRes = await fetch(
        `${inst.evolution_url}/instance/connectionState/${inst.instance_name}`,
        { headers: { apikey: inst.evolution_api_key } }
      );
      if (!checkRes.ok) {
        await fetch(`${inst.evolution_url}/instance/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: inst.evolution_api_key },
          body: JSON.stringify({
            instanceName: inst.instance_name,
            integration: "WHATSAPP-BAILEYS",
            qrcode: false,
          }),
        });
      } else {
        await checkRes.text();
      }

      // Request pairing code with phone number via POST
      const pairRes = await fetch(
        `${inst.evolution_url}/instance/connect/${inst.instance_name}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: inst.evolution_api_key },
          body: JSON.stringify({ number: cleanPhone }),
        }
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
        // Try to delete from Evolution API
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
