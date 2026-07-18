import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
const openaiKey = Deno.env.get("OPENAI_API_KEY") || "";
const EVOLUTION_SERVER_URL_OVERRIDE = Deno.env.get("EVOLUTION_SERVER_URL") || "";

function evoUrl(instanceUrl: string): string {
  return EVOLUTION_SERVER_URL_OVERRIDE || instanceUrl;
}

// claude-sonnet-4-6 pricing: $3/M input, $15/M output
const COST_INPUT_USD = 3 / 1_000_000;
const COST_OUTPUT_USD = 15 / 1_000_000;
const USD_TO_BRL = 5.0;

function calcCostBrl(input: number, output: number): number {
  return (input * COST_INPUT_USD + output * COST_OUTPUT_USD) * USD_TO_BRL;
}

const SYSTEM_BASE = `Você é um vendedor sênior brasileiro com 30 anos de experiência em vendas milionárias.

MÉTODO: Use o método AIDA (Atenção, Interesse, Desejo, Ação) de forma natural, sem que o cliente perceba.

ESTILO: Tom consultivo, caloroso e profissional. Nunca soe robótico ou agressivo.

PRINCÍPIOS:
- Identifique a dor do cliente antes de oferecer solução
- Faça no máximo 1-2 perguntas qualificadoras por mensagem
- Cross-sell e up-sell de forma elegante e natural
- Use o nome do cliente quando souber
- Cite benefícios antes de preços
- Crie urgência real, não fictícia
- Quando o cliente estiver pronto, proponha a ação de forma clara

RESTRIÇÕES:
- NUNCA invente produtos fora do catálogo
- NUNCA prometa o que não pode cumprir
- Problemas graves (reclamação séria, ameaça de processo) → ative requiresHumanHandoff

{personality}

CATÁLOGO DISPONÍVEL:
{catalog}

FORMATO DA RESPOSTA — responda APENAS com JSON válido, sem texto fora do JSON:
{
  "suggestedResponse": "mensagem para o cliente (WhatsApp, sem markdown excessivo)",
  "productsToShow": ["id-produto-1"],
  "confidence": 0.85,
  "requiresHumanHandoff": false,
  "reasoning": "justificativa interna breve"
}`;

// ── Types ─────────────────────────────────────────────────────────────────────

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "url"; url: string } };

interface ClaudeMessage {
  role: "user" | "assistant";
  content: string | ContentBlock[];
}

interface DBMessage {
  id: string;
  content: string;
  from_me: boolean;
  message_type: string;
  media_url: string | null;
}

interface AiSettings {
  ai_enabled: boolean;
  ai_mode: string;
  custom_personality: string | null;
  work_start: string | null;
  work_end: string | null;
  escalation_keywords: string | null;
  monthly_conversation_limit: number;
  current_month_usage: number;
  total_cost_brl: number;
}

interface RequestBody {
  chatId: string;
  tenantId: string;
  trigger_type?: "manual" | "auto";
  internal?: boolean;
  contactName?: string;
}

interface SalesResponse {
  suggestedResponse: string;
  productsToShow: string[];
  confidence: number;
  requiresHumanHandoff: boolean;
  reasoning?: string;
  tokens_input: number;
  tokens_output: number;
  cost_brl: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isInsideBusinessHours(start: string, end: string): boolean {
  const now = new Date();
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const cur = now.getUTCHours() * 60 + now.getUTCMinutes();
  return cur >= sh * 60 + sm && cur < eh * 60 + em;
}

function checkEscalation(text: string, customKeywords: string | null): boolean {
  const defaults = [
    "reclamação", "reclamar", "cancelar", "cancelamento", "reembolso",
    "devolução", "procon", "processo", "advogado", "enganado", "fraude",
  ];
  const custom = customKeywords
    ? customKeywords.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean)
    : [];
  const kws = [...defaults, ...custom];
  const lower = text.toLowerCase();
  return kws.some((kw) => lower.includes(kw));
}

async function transcribeAudio(url: string): Promise<string | null> {
  if (!openaiKey) return null;
  try {
    const audioRes = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!audioRes.ok) return null;
    const blob = await audioRes.blob();
    const form = new FormData();
    form.append("file", blob, "audio.ogg");
    form.append("model", "whisper-1");
    form.append("language", "pt");
    const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: form,
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.text as string) || null;
  } catch {
    return null;
  }
}

async function buildClaudeMessages(msgs: DBMessage[]): Promise<ClaudeMessage[]> {
  const result: ClaudeMessage[] = [];
  for (const m of msgs) {
    const role = m.from_me ? "assistant" : "user";
    if (m.message_type === "audio" && m.media_url && !m.from_me) {
      const transcript = await transcribeAudio(m.media_url);
      result.push({
        role,
        content: transcript ? `[Áudio]: ${transcript}` : "[Áudio recebido - conteúdo não disponível]",
      });
    } else if (m.message_type === "image" && m.media_url && !m.from_me) {
      result.push({
        role,
        content: [
          { type: "image", source: { type: "url", url: m.media_url } },
          { type: "text", text: m.content || "O cliente enviou esta imagem." },
        ],
      });
    } else if (m.content?.trim()) {
      result.push({ role, content: m.content });
    }
  }

  // A API da Claude exige que a conversa sempre termine com uma mensagem do
  // usuário (cliente) — alguns modelos não aceitam "prefill" com o turno final
  // sendo do assistente. Se as últimas mensagens forem do vendedor (from_me),
  // removemos elas daqui: a IA sugere com base na última fala real do cliente.
  while (result.length > 0 && result[result.length - 1].role === "assistant") {
    result.pop();
  }

  return result;
}

async function callClaude(
  system: string,
  messages: ClaudeMessage[],
): Promise<{ content: string; usage: { input_tokens: number; output_tokens: number } }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return {
    content: data.content?.[0]?.text ?? "",
    usage: data.usage ?? { input_tokens: 0, output_tokens: 0 },
  };
}

function parseClaudeJson(raw: string): Partial<SalesResponse> {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return JSON.parse(match ? match[0] : raw);
  } catch {
    return { suggestedResponse: raw };
  }
}

async function sendEvolutionMessage(
  instanceUrl: string,
  apiKey: string,
  instanceName: string,
  remoteJid: string,
  text: string,
): Promise<void> {
  const res = await fetch(`${evoUrl(instanceUrl)}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ number: remoteJid, text }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Evolution ${res.status}: ${await res.text()}`);
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "").trim();
    const body: RequestBody = await req.json();

    // ── Auth ────────────────────────────────────────────────────────────────
    let tenantId: string;
    if (body.internal && token === supabaseServiceKey) {
      tenantId = body.tenantId;
    } else {
      const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
      if (authErr || !user) return json({ error: "Não autorizado" }, 401);
      const { data: profile } = await supabase
        .from("profiles").select("tenant_id").eq("id", user.id).single();
      if (!profile?.tenant_id) return json({ error: "Tenant não encontrado" }, 403);
      tenantId = profile.tenant_id;
      if (body.tenantId && body.tenantId !== tenantId) return json({ error: "Tenant mismatch" }, 403);
    }

    const { chatId, trigger_type = "manual", contactName } = body;
    if (!chatId || !tenantId) return json({ error: "chatId e tenantId são obrigatórios" }, 400);

    // ── ai_settings ─────────────────────────────────────────────────────────
    const { data: settingsRow } = await supabase
      .from("ai_settings")
      .select("ai_enabled, ai_mode, custom_personality, work_start, work_end, escalation_keywords, monthly_conversation_limit, current_month_usage, total_cost_brl")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const settings = settingsRow as AiSettings | null;
    if (!settings?.ai_enabled) return json({ error: "IA desativada" }, 403);

    const limit = settings.monthly_conversation_limit ?? 2000;
    const usage = settings.current_month_usage ?? 0;
    if (usage >= limit) return json({ error: `Limite mensal de ${limit} conversas atingido` }, 429);

    // Hybrid: auto fires only OUTSIDE business hours
    if (trigger_type === "auto" && settings.ai_mode === "hybrid") {
      if (isInsideBusinessHours(settings.work_start ?? "08:00", settings.work_end ?? "18:00")) {
        return json({ skipped: "dentro do horário de funcionamento" });
      }
    }

    // Suggestion mode: never auto-send
    if (trigger_type === "auto" && settings.ai_mode === "suggestion") {
      return json({ skipped: "modo sugestão — sem auto-envio" });
    }

    // ── Conversation history ─────────────────────────────────────────────────
    const { data: dbMsgs } = await supabase
      .from("whatsapp_messages")
      .select("id, content, from_me, message_type, media_url")
      .eq("chat_id", chatId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true })
      .limit(40);

    const msgs = (dbMsgs ?? []) as DBMessage[];
    const lastUserMsg = [...msgs].reverse().find((m) => !m.from_me)?.content ?? "";

    // Escalation check
    if (checkEscalation(lastUserMsg, settings.escalation_keywords)) {
      const handoff: SalesResponse = {
        suggestedResponse: "Vou transferir você para um de nossos atendentes para resolver isso da melhor forma. Um momento!",
        productsToShow: [],
        confidence: 0.3,
        requiresHumanHandoff: true,
        tokens_input: 0,
        tokens_output: 0,
        cost_brl: 0,
      };
      return json(handoff);
    }

    // ── Product catalog ──────────────────────────────────────────────────────
    const terms = lastUserMsg.split(/\s+/).filter((t) => t.length > 2).slice(0, 5);
    let prodQuery = supabase
      .from("products")
      .select("id, name, description, price, promotional_price, stock, ai_keywords, ai_sales_pitch, is_featured")
      .eq("tenant_id", tenantId)
      .eq("is_active", true);

    if (terms.length > 0) {
      const orClauses = terms
        .map((t) => `name.ilike.%${t}%,description.ilike.%${t}%,ai_keywords.ilike.%${t}%`)
        .join(",");
      prodQuery = prodQuery.or(orClauses);
    }

    const { data: products } = await prodQuery.order("is_featured", { ascending: false }).limit(10);
    const productList = (products ?? []) as Array<{
      id: string; name: string; description: string | null;
      price: number | null; promotional_price: number | null;
      stock: number; ai_keywords: string | null; ai_sales_pitch: string | null;
      is_featured: boolean;
    }>;

    const catalogText = productList.length
      ? productList.map((p) => {
          const priceStr = p.promotional_price
            ? `R$ ${Number(p.promotional_price).toFixed(2)} (promoção; era R$ ${Number(p.price ?? 0).toFixed(2)})`
            : p.price !== null ? `R$ ${Number(p.price).toFixed(2)}` : "consulte";
          const pitch = p.ai_sales_pitch ? `\n   Pitch: ${p.ai_sales_pitch.slice(0, 200)}` : "";
          const kw = p.ai_keywords ? ` | Keywords: ${p.ai_keywords}` : "";
          const desc = p.description ? `\n   ${p.description.slice(0, 150)}` : "";
          return `- [${p.id}] ${p.name}${p.is_featured ? " ⭐" : ""} | ${priceStr} | Estoque: ${p.stock}${kw}${desc}${pitch}`;
        }).join("\n")
      : "Catálogo não configurado ainda.";

    // ── System prompt ────────────────────────────────────────────────────────
    const personalitySection = settings.custom_personality
      ? `PERSONALIDADE DO NEGÓCIO:\n${settings.custom_personality}`
      : "";
    const systemPrompt =
      SYSTEM_BASE.replace("{personality}", personalitySection).replace("{catalog}", catalogText) +
      (contactName ? `\n\nNome do cliente: ${contactName}` : "");

    // ── Build Claude messages ────────────────────────────────────────────────
    const claudeMessages = await buildClaudeMessages(msgs);
    if (claudeMessages.length === 0) return json({ error: "Sem histórico de conversa" }, 400);

    // ── Call Claude ──────────────────────────────────────────────────────────
    console.log(`[ai-sales-agent] tenant=${tenantId} chat=${chatId} trigger=${trigger_type} msgs=${claudeMessages.length}`);
    const { content: raw, usage: tok } = await callClaude(systemPrompt, claudeMessages);
    console.log(`[ai-sales-agent] tokens in=${tok.input_tokens} out=${tok.output_tokens}`);

    const parsed = parseClaudeJson(raw);
    const costBrl = calcCostBrl(tok.input_tokens, tok.output_tokens);

    const response: SalesResponse = {
      suggestedResponse: parsed.suggestedResponse ?? raw,
      productsToShow: parsed.productsToShow ?? [],
      confidence: parsed.confidence ?? 0.75,
      requiresHumanHandoff: parsed.requiresHumanHandoff ?? false,
      reasoning: parsed.reasoning,
      tokens_input: tok.input_tokens,
      tokens_output: tok.output_tokens,
      cost_brl: costBrl,
    };

    // ── Auto-send ────────────────────────────────────────────────────────────
    let sentAuto = false;
    if (trigger_type === "auto" && !response.requiresHumanHandoff) {
      try {
        const { data: chat } = await supabase
          .from("whatsapp_chats")
          .select("remote_jid, whatsapp_instance_id")
          .eq("id", chatId)
          .single();
        if (chat) {
          const { data: inst } = await supabase
            .from("whatsapp_instances")
            .select("instance_name, evolution_url, evolution_api_key")
            .eq("id", chat.whatsapp_instance_id)
            .single();
          if (inst) {
            await sendEvolutionMessage(
              inst.evolution_url,
              inst.evolution_api_key,
              inst.instance_name,
              chat.remote_jid,
              response.suggestedResponse,
            );
            sentAuto = true;
            console.log(`[ai-sales-agent] auto-sent to ${chat.remote_jid}`);
          }
        }
      } catch (e) {
        console.error("[ai-sales-agent] auto-send failed:", (e as Error).message);
      }
    }

    // ── Log + counters (fire-and-forget) ─────────────────────────────────────
    supabase.from("ai_conversation_logs").insert({
      tenant_id: tenantId,
      chat_id: chatId,
      trigger_type,
      tokens_input: tok.input_tokens,
      tokens_output: tok.output_tokens,
      cost_brl: costBrl,
      requires_handoff: response.requiresHumanHandoff,
      sent_auto: sentAuto,
    }).then(({ error }) => { if (error) console.error("[ai-sales-agent] log error:", error.message); });

    supabase.from("ai_settings").update({
      current_month_usage: usage + 1,
      total_cost_brl: (settings.total_cost_brl ?? 0) + costBrl,
    }).eq("tenant_id", tenantId).then(({ error }) => {
      if (error) console.error("[ai-sales-agent] usage update error:", error.message);
    });

    return json(response);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[ai-sales-agent] Error:", msg);
    return json({ error: msg }, 500);
  }
});
