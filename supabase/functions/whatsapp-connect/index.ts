import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EVOLUTION_URL = "http://76.13.230.7:64644";
const EVOLUTION_API_KEY = "bigodao77chave";
const INSTANCE_NAME = "bigodao77";

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

    const { data: hasAdmin } = await adminClient.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!hasAdmin) {
      return new Response(JSON.stringify({ error: "Apenas administradores" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, phone } = await req.json();

    // Get connection status
    if (action === "status") {
      const statusRes = await fetch(
        `${EVOLUTION_URL}/instance/connectionState/${INSTANCE_NAME}`,
        { headers: { apikey: EVOLUTION_API_KEY } }
      );
      
      if (!statusRes.ok) {
        // Instance might not exist yet
        return new Response(JSON.stringify({ status: "disconnected", phone: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const statusData = await statusRes.json();
      const isConnected = statusData.instance?.state === "open";
      
      let phoneNumber = null;
      if (isConnected) {
        try {
          const infoRes = await fetch(
            `${EVOLUTION_URL}/instance/fetchInstances?instanceName=${INSTANCE_NAME}`,
            { headers: { apikey: EVOLUTION_API_KEY } }
          );
          if (infoRes.ok) {
            const infoData = await infoRes.json();
            const inst = Array.isArray(infoData) ? infoData[0] : infoData;
            phoneNumber = inst?.instance?.owner || inst?.owner || null;
          }
        } catch (_) { /* ignore */ }
      }

      return new Response(JSON.stringify({ 
        status: isConnected ? "connected" : "disconnected",
        phone: phoneNumber,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create instance if it doesn't exist, then get QR code
    if (action === "qrcode") {
      // Try to create instance (will fail silently if exists)
      try {
        await fetch(`${EVOLUTION_URL}/instance/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
          body: JSON.stringify({
            instanceName: INSTANCE_NAME,
            integration: "WHATSAPP-BAILEYS",
            qrcode: true,
          }),
        });
      } catch (_) { /* instance may already exist */ }

      // Get QR code
      const qrRes = await fetch(
        `${EVOLUTION_URL}/instance/connect/${INSTANCE_NAME}`,
        { headers: { apikey: EVOLUTION_API_KEY } }
      );

      if (!qrRes.ok) {
        const err = await qrRes.text();
        throw new Error(`Erro ao obter QR Code: ${err}`);
      }

      const qrData = await qrRes.json();
      return new Response(JSON.stringify({ 
        qrcode: qrData.base64 || qrData.qrcode?.base64 || null,
        pairingCode: qrData.pairingCode || null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get pairing code
    if (action === "pairing_code") {
      if (!phone) throw new Error("Número de telefone obrigatório");
      
      const cleanPhone = phone.replace(/\D/g, "");
      
      // Ensure instance exists
      try {
        await fetch(`${EVOLUTION_URL}/instance/create`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
          body: JSON.stringify({
            instanceName: INSTANCE_NAME,
            integration: "WHATSAPP-BAILEYS",
            qrcode: false,
          }),
        });
      } catch (_) { /* instance may already exist */ }

      // Request pairing code
      const pairRes = await fetch(
        `${EVOLUTION_URL}/instance/connect/${INSTANCE_NAME}`,
        { 
          method: "GET",
          headers: { apikey: EVOLUTION_API_KEY },
        }
      );

      // Try the specific pairing code endpoint
      const pairCodeRes = await fetch(
        `${EVOLUTION_URL}/instance/connect/${INSTANCE_NAME}?number=${cleanPhone}`,
        { headers: { apikey: EVOLUTION_API_KEY } }
      );

      if (!pairCodeRes.ok) {
        const err = await pairCodeRes.text();
        throw new Error(`Erro ao obter código: ${err}`);
      }

      const pairData = await pairCodeRes.json();
      return new Response(JSON.stringify({ 
        pairingCode: pairData.pairingCode || pairData.code || null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Disconnect / logout
    if (action === "disconnect") {
      const logoutRes = await fetch(
        `${EVOLUTION_URL}/instance/logout/${INSTANCE_NAME}`,
        { method: "DELETE", headers: { apikey: EVOLUTION_API_KEY } }
      );
      
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
