import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// Analisa um lead (dados + histórico real de conversa no WhatsApp, quando existe)
// usando IA, e decide o quão "quente" ele está. Roda automaticamente sempre que
// um lead é criado ou muda de etapa/status.
//
// Com o resultado, faz duas coisas:
// 1) Salva a pontuação no próprio lead, pra equipe de vendas saber quem atacar primeiro.
// 2) Se o lead veio de um anúncio da Meta e está "quente", avisa a Meta (evento
//    "Qualified"), pra ela otimizar a entrega de anúncios buscando mais parecidos.

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

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const body = await req.json();

    // Chamadas internas (ex: vindas do próprio webhook do Facebook, sem usuário
    // logado) se autenticam com a service role key + internal:true.
    let tenantId: string | null = body.tenantId ?? null;
    if (!(body.internal && token === supabaseServiceKey)) {
      const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
      const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
      if (authErr || !user) return json({ error: "Não autorizado" }, 401);
    }

    const { lead_id } = body;
    if (!lead_id) return json({ error: "lead_id é obrigatório" }, 400);

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", lead_id)
      .single();
    if (leadError || !lead) return json({ error: "Lead não encontrado" }, 404);
    tenantId = tenantId || lead.tenant_id;

    // Busca a conversa real de WhatsApp desse lead, se existir — é o melhor sinal
    // de interesse real (o que ele perguntou, se falou de preço, se demonstrou pressa etc).
    let conversationText = "Sem conversa de WhatsApp registrada ainda.";
    if (lead.phone) {
      const cleanPhone = lead.phone.replace(/\D/g, "");
      const { data: chat } = await supabase
        .from("whatsapp_chats")
        .select("id")
        .ilike("contact_phone", `%${cleanPhone.slice(-8)}%`)
        .limit(1)
        .maybeSingle();

      if (chat) {
        const { data: messages } = await supabase
          .from("whatsapp_messages")
          .select("content, from_me, created_at")
          .eq("chat_id", chat.id)
          .order("created_at", { ascending: false })
          .limit(25);
        if (messages?.length) {
          conversationText = messages
            .reverse()
            .map((m) => `${m.from_me ? "Vendedor" : "Lead"}: ${m.content || "[mídia]"}`)
            .join("\n");
        }
      }
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) return json({ error: "IA não configurada" }, 500);

    const prompt = `Dados do lead:
Nome: ${lead.name}
Origem: ${lead.source || "desconhecida"}
Status atual: ${lead.status}
Etapa do pipeline: ${lead.pipeline_stage}
Valor estimado: R$ ${lead.value || 0}
Observações: ${lead.notes || "nenhuma"}
Criado em: ${lead.created_at}

Conversa de WhatsApp (mais recente por último):
${conversationText}

Analise o quanto esse lead está perto de comprar, baseado em sinais reais como: perguntas sobre preço/prazo/forma de pagamento, urgência demonstrada, respostas rápidas, objeções resolvidas, ou o oposto (sumiu, respostas frias, só curiosidade).

Além disso, tente descobrir de onde esse lead realmente veio, procurando pistas na conversa
(ex: "vi seu anúncio no Instagram", "achei no Google", "fulano me indicou", "vi no Facebook").
Só preencha "source" se encontrar uma pista real e clara — se não tiver nenhuma pista, deixe null
(não invente, e não confunda "conversei pelo WhatsApp" com a origem real dele).`;

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        system: 'Você é um analista de vendas expert em qualificação de leads. Responda APENAS com um JSON válido, sem markdown, no formato exato: {"temperature": "quente" | "morno" | "frio", "score": <0 a 100>, "reason": "<explicação curta em português, 1-2 frases>", "source": "<Instagram" | "Facebook Ads" | "Indicação" | "Google" | "Website" | null>}',
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("Anthropic API error:", aiRes.status, errText);
      return json({ error: "Erro ao consultar IA" }, 500);
    }

    const aiData = await aiRes.json();
    const rawText = aiData.content?.find((b: any) => b.type === "text")?.text || "{}";
    let parsed: { temperature: string; score: number; reason: string; source?: string | null };
    try {
      const cleaned = rawText.trim().replace(/^```json\s*|\s*```$/g, "");
      parsed = JSON.parse(cleaned);
    } catch {
      console.error("Falha ao interpretar resposta da IA:", rawText);
      return json({ error: "Resposta inválida da IA" }, 500);
    }

    const updates: Record<string, any> = {
      ai_score: parsed.score,
      ai_temperature: parsed.temperature,
      ai_score_reason: parsed.reason,
      ai_scored_at: new Date().toISOString(),
    };

    // Só atualiza a origem se a IA achou uma pista real E o lead não veio de um
    // anúncio confirmado da Meta (esses já têm a origem certa, vinda direto da
    // plataforma de anúncios — não deixamos a IA "adivinhar" por cima disso).
    if (parsed.source && !lead.meta_lead_id) {
      updates.source = parsed.source;
    }

    await supabase.from("leads").update(updates).eq("id", lead_id);

    // Lead quente + veio de anúncio da Meta → avisa a Meta pra ela buscar mais parecidos.
    if (parsed.temperature === "quente" && lead.meta_lead_id) {
      try {
        const { data: settings } = await supabase
          .from("settings")
          .select("facebook_pixel_id, facebook_access_token")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (settings?.facebook_pixel_id && settings?.facebook_access_token) {
          const userData: Record<string, unknown> = { lead_id: Number(lead.meta_lead_id) };
          if (lead.email) userData.em = [await sha256(lead.email)];
          if (lead.phone) userData.ph = [await sha256(lead.phone.replace(/\D/g, ""))];

          await fetch(`https://graph.facebook.com/v21.0/${settings.facebook_pixel_id}/events`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              access_token: settings.facebook_access_token,
              data: [{
                action_source: "system_generated",
                event_name: "Qualified",
                event_time: Math.floor(Date.now() / 1000),
                user_data: userData,
                custom_data: { event_source: "crm", lead_event_source: "Flash CRMs" },
              }],
            }),
          });
        }
      } catch (err) {
        console.error("Erro ao avisar a Meta sobre lead quente:", err);
      }
    }

    return json({ ok: true, ...parsed });
  } catch (err: any) {
    console.error("ai-lead-scoring error:", err);
    return json({ error: err.message }, 500);
  }
});
