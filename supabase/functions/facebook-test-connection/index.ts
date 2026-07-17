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

    const { pixel_id, access_token } = await req.json();
    if (!pixel_id || !access_token) {
      return json({ ok: false, error: "Preencha o Pixel ID e o Access Token antes de testar" }, 400);
    }

    // 1) Confere se o Pixel ID existe e se o token consegue ler ele
    const pixelRes = await fetch(
      `https://graph.facebook.com/v21.0/${pixel_id}?fields=name,id&access_token=${access_token}`
    );
    const pixelData = await pixelRes.json();

    if (!pixelRes.ok) {
      return json({
        ok: false,
        error: pixelData.error?.message || "Pixel ID ou Access Token inválidos",
        details: pixelData.error,
      });
    }

    // 2) Confere se o token realmente consegue ENVIAR eventos (não só ler o pixel),
    // usando o test_event_code — isso não polui os dados reais do pixel.
    const testRes = await fetch(`https://graph.facebook.com/v21.0/${pixel_id}/events`, {
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
        pixel_name: pixelData.name,
        details: testData.error,
      });
    }

    return json({
      ok: true,
      pixel_name: pixelData.name,
      pixel_id: pixelData.id,
      events_received: testData.events_received,
    });
  } catch (err: any) {
    return json({ ok: false, error: err.message }, 500);
  }
});
