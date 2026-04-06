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

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claims.claims.sub as string;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check admin role
    const { data: hasAdmin } = await adminClient.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!hasAdmin) {
      return new Response(JSON.stringify({ error: "Apenas administradores" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, instance_id, evolution_url, evolution_api_key, instance_name, name } = await req.json();

    if (action === "create") {
      // Create instance on Evolution API
      const createRes = await fetch(`${evolution_url}/instance/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evolution_api_key },
        body: JSON.stringify({
          instanceName: instance_name,
          integration: "WHATSAPP-BAILEYS",
          qrcode: true,
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.text();
        throw new Error(`Evolution API: ${err}`);
      }

      const createData = await createRes.json();

      // Save to DB
      const { data: saved, error: saveErr } = await adminClient
        .from("whatsapp_instances")
        .insert({
          name: name || instance_name,
          evolution_url,
          evolution_api_key,
          instance_name,
          status: "connecting",
        })
        .select()
        .single();

      if (saveErr) throw saveErr;

      return new Response(JSON.stringify({
        instance: saved,
        qrcode: createData.qrcode || createData,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "qrcode") {
      // Get QR code for existing instance
      const { data: inst } = await adminClient
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instance_id)
        .single();

      if (!inst) throw new Error("Instância não encontrada");

      const qrRes = await fetch(
        `${inst.evolution_url}/instance/connect/${inst.instance_name}`,
        { headers: { apikey: inst.evolution_api_key } }
      );

      if (!qrRes.ok) {
        const err = await qrRes.text();
        throw new Error(`Evolution API: ${err}`);
      }

      const qrData = await qrRes.json();
      return new Response(JSON.stringify({ qrcode: qrData }), {
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

      if (!statusRes.ok) {
        const err = await statusRes.text();
        throw new Error(`Evolution API: ${err}`);
      }

      const statusData = await statusRes.json();
      const newStatus = statusData.instance?.state === "open" ? "connected" : "disconnected";

      await adminClient
        .from("whatsapp_instances")
        .update({ status: newStatus })
        .eq("id", instance_id);

      return new Response(JSON.stringify({ status: newStatus, raw: statusData }), {
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

      const { phone, message } = await req.json().catch(() => ({}));
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
