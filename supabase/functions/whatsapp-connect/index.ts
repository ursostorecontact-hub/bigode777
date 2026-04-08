import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EVOLUTION_URL = "http://76.13.230.7:64644";
const EVOLUTION_API_KEY = "bigodao77chave";
const INSTANCE_NAME = "bigodao77";
const STALE_INSTANCE_MAX_AGE_MS = 10 * 60 * 1000;

type ConnectionStateResponse = {
  instance?: {
    state?: string;
    owner?: string | null;
  };
};

type InstanceDetails = {
  connectionStatus?: string;
  createdAt?: string;
  number?: string | null;
  ownerJid?: string | null;
  profileName?: string | null;
  instance?: {
    owner?: string | null;
  };
  owner?: string | null;
};

async function evolutionRequest(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("apikey", EVOLUTION_API_KEY);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${EVOLUTION_URL}${path}`, {
    ...init,
    headers,
  });
}

async function getConnectionState(): Promise<ConnectionStateResponse | null> {
  const response = await evolutionRequest(`/instance/connectionState/${INSTANCE_NAME}`);
  if (!response.ok) return null;
  return await response.json();
}

async function getInstanceDetails(): Promise<InstanceDetails | null> {
  const response = await evolutionRequest(`/instance/fetchInstances?instanceName=${INSTANCE_NAME}`);
  if (!response.ok) return null;

  const data = await response.json();
  if (Array.isArray(data)) {
    return (data[0] ?? null) as InstanceDetails | null;
  }

  return (data ?? null) as InstanceDetails | null;
}

function getConnectedPhone(details: InstanceDetails | null) {
  return details?.number || details?.ownerJid || details?.instance?.owner || details?.owner || null;
}

function isOpenState(state: ConnectionStateResponse | null, details: InstanceDetails | null) {
  return state?.instance?.state === "open" || details?.connectionStatus === "open";
}

function isStaleInstance(details: InstanceDetails | null) {
  if (!details?.createdAt) return false;

  const createdAt = Date.parse(details.createdAt);
  if (Number.isNaN(createdAt)) return false;

  return Date.now() - createdAt > STALE_INSTANCE_MAX_AGE_MS;
}

async function createInstance() {
  const response = await evolutionRequest(`/instance/create`, {
    method: "POST",
    body: JSON.stringify({
      instanceName: INSTANCE_NAME,
      integration: "WHATSAPP-BAILEYS",
      qrcode: true,
    }),
  });

  if (!response.ok && response.status !== 409) {
    throw new Error(`Erro ao criar instância: ${await response.text()}`);
  }
}

async function resetInstance() {
  await evolutionRequest(`/instance/logout/${INSTANCE_NAME}`, { method: "DELETE" }).catch(() => null);
  await evolutionRequest(`/instance/delete/${INSTANCE_NAME}`, { method: "DELETE" }).catch(() => null);
  await createInstance();
}

async function ensureConnectableInstance() {
  let state = await getConnectionState();
  let details = await getInstanceDetails();

  const shouldCreate = !state && !details;
  const shouldReset = !isOpenState(state, details) && isStaleInstance(details);

  if (shouldCreate) {
    await createInstance();
    state = await getConnectionState();
    details = await getInstanceDetails();
  } else if (shouldReset) {
    await resetInstance();
    state = await getConnectionState();
    details = await getInstanceDetails();
  }

  return { state, details, reset: shouldReset };
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
      const state = await getConnectionState();
      const details = await getInstanceDetails();

      if (!state && !details) {
        // Instance might not exist yet
        return new Response(JSON.stringify({ status: "disconnected", phone: null }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isConnected = isOpenState(state, details);
      const phoneNumber = isConnected ? getConnectedPhone(details) : null;

      return new Response(JSON.stringify({ 
        status: isConnected ? "connected" : "disconnected",
        phone: phoneNumber,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create instance if it doesn't exist, then get QR code
    if (action === "qrcode") {
      await ensureConnectableInstance();

      // Get QR code by connecting
      const qrRes = await evolutionRequest(`/instance/connect/${INSTANCE_NAME}`);

      if (!qrRes.ok) {
        const err = await qrRes.text();
        console.error("QR code error:", qrRes.status, err);
        return new Response(JSON.stringify({ 
          error: `Erro ao obter QR Code: ${err}`,
          fallback: true,
        }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
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

      await ensureConnectableInstance();

      // Try the specific pairing code endpoint
      const pairCodeRes = await evolutionRequest(`/instance/connect/${INSTANCE_NAME}?number=${cleanPhone}`);

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
      await evolutionRequest(`/instance/logout/${INSTANCE_NAME}`, { method: "DELETE" });
      
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
