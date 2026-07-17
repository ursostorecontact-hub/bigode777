import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Testa de verdade se o Pixel ID e o Access Token configurados são válidos,
// perguntando direto pra API do Facebook (não só confere se os campos estão
// preenchidos). Também confere se o token tem permissão de enviar eventos
// (ads_management ou business_management), que é o que a Conversions API exige.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "Não autorizado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) return json({ ok: false, error: "Não autorizado" }, 401);

    const body = await req.json();
    const pixel_id = (body.pixel_id || "").toString().trim();
    const access_token = (body.access_token || "").toString().trim().replace(/[\r\n]/g, "");
    if (!pixel_id || !access_token) {
      return json({ ok: false, error: "Preencha o Pixel ID e o Access Token antes de testar" }, 400);
    }

    // 1) Tenta ler o nome do pixel — alguns tokens (ex: gerados pelo fluxo de
    // "Integração de Leads") não têm permissão pra isso, e tudo bem: isso não
    // significa que o token é inválido, só que ele é focado em ENVIAR eventos.
    let pixelName: string | null = null;
    try {
      const pixelRes = await fetch(
        `https://graph.facebook.com/v25.0/${encodeURIComponent(pixel_id)}?fields=name,id&access_token=${encodeURIComponent(access_token)}`
      );
      const pixelData = await pixelRes.json();
      if (pixelRes.ok) pixelName = pixelData.name;
    } catch { /* segue sem o nome, não é bloqueante */ }

    // 2) Confere se o token realmente consegue ENVIAR eventos (não só ler o pixel),
    // usando o test_event_code — isso não polui os dados reais do pixel.
    const testRes = await fetch(`https://graph.facebook.com/v25.0/${pixel_id}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_token,
        data: [{
          event_name: "TestConnection",
          event_time: Math.floor(Date.now() / 1000),
          action_source: "system_generated",
          user_data: { client_ip_address: "127.0.0.1" },
        }],
      }),
    });
    const testData = await testRes.json();

    if (!testRes.ok) {
      return json({
        ok: false,
        error: testData.error?.message || "O token não tem permissão para enviar eventos",
        pixel_name: pixelName,
        details: testData.error,
      });
    }

    return json({
      ok: true,
      pixel_name: pixelName || pixel_id,
      pixel_id,
      events_received: testData.events_received,
    });
  } catch (err: any) {
    return json({ ok: false, error: err.message }, 500);
  }
});
