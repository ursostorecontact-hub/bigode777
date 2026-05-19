import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;

const SYSTEM_PROMPT = `Você é um vendedor sênior brasileiro com 30 anos de experiência em vendas milionárias.

MÉTODO: Use SEMPRE o método AIDA (Atenção, Interesse, Desejo, Ação) de forma natural e não óbvia. Incorpore-o à conversa sem que o cliente perceba que está sendo guiado.

ESTILO: Tom consultivo, caloroso e profissional. Nunca soe robótico ou agressivo. Você é como um amigo especialista que está ajudando.

PRINCÍPIOS:
- Identifique a dor do cliente antes de oferecer qualquer solução
- Faça perguntas qualificadoras (máx. 1-2 por mensagem para não pressionar)
- Sempre que possível, faça cross-sell e up-sell de forma elegante e natural
- Use o nome do cliente quando souber
- Seja direto mas não invasivo
- Cite benefícios antes de preços
- Crie urgência real, não fictícia
- Quando o cliente estiver pronto, proponha a ação de forma clara e simples

RESTRIÇÕES:
- NUNCA invente produtos que não estão no catálogo
- NUNCA prometa o que não pode cumprir
- Se não souber a resposta, admita e ofereça buscar a informação
- Se o cliente estiver com problema grave (reclamação séria, cancelamento), sinalize para atendimento humano

CATÁLOGO DISPONÍVEL: {catalog}

CONTEXTO DE VENDAS BEM-SUCEDIDAS: {rag_context}`;

interface MessageHistory {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  messageHistory: MessageHistory[];
  tenantId: string;
  chatId: string;
  contactName?: string;
  customSystemPrompt?: string;
}

interface SalesResponse {
  suggestedResponse: string;
  productsToShow: string[];
  confidence: number;
  requiresHumanHandoff: boolean;
  reasoning?: string;
}

// Keywords that suggest human escalation is needed
const ESCALATION_KEYWORDS = [
  "reclamação", "reclamar", "cancelar", "cancelamento", "reembolso", "devolução",
  "problema grave", "processo", "procon", "advogado", "enganado", "fraude",
  "péssimo", "horrível", "absurdo", "inadmissível",
];

function needsHumanHandoff(text: string): boolean {
  const lower = text.toLowerCase();
  return ESCALATION_KEYWORDS.some((kw) => lower.includes(kw));
}

async function fetchRelevantProducts(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  query: string,
): Promise<{ id: string; name: string; description: string | null; price: number | null; stock: number }[]> {
  // Text search across name, description, sku
  const terms = query.split(/\s+/).filter((t) => t.length > 2).slice(0, 5);
  if (terms.length === 0) {
    // Return top 10 active products if no search terms
    const { data } = await supabase
      .from("products")
      .select("id, name, description, price, stock")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .order("name")
      .limit(10);
    return data ?? [];
  }

  const orClause = terms.map((t) => `name.ilike.%${t}%,description.ilike.%${t}%,sku.ilike.%${t}%`).join(",");
  const { data } = await supabase
    .from("products")
    .select("id, name, description, price, stock")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .or(orClause)
    .limit(5);
  return data ?? [];
}

async function fetchConversationHistory(
  supabase: ReturnType<typeof createClient>,
  chatId: string,
  tenantId: string,
): Promise<{ role: "user" | "assistant"; content: string }[]> {
  const { data } = await supabase
    .from("whatsapp_messages")
    .select("content, from_me, created_at")
    .eq("chat_id", chatId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!data) return [];
  return data
    .reverse()
    .filter((m) => m.content?.trim())
    .map((m) => ({
      role: m.from_me ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));
}

async function fetchRAGContext(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
): Promise<string> {
  // Find chats tagged as "venda_fechada" and get patterns from those conversations
  const { data: chats } = await supabase
    .from("whatsapp_chats")
    .select("id")
    .eq("tenant_id", tenantId)
    .contains("tags", ["venda_fechada"])
    .limit(5);

  if (!chats?.length) return "Nenhum padrão de venda disponível ainda.";

  const chatIds = chats.map((c: { id: string }) => c.id);
  const { data: messages } = await supabase
    .from("whatsapp_messages")
    .select("content, from_me, chat_id")
    .in("chat_id", chatIds)
    .eq("tenant_id", tenantId)
    .eq("from_me", true)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!messages?.length) return "Nenhum padrão de venda disponível ainda.";

  const sample = messages
    .slice(0, 20)
    .map((m: { content: string }) => m.content)
    .filter(Boolean)
    .join("\n");
  return `Exemplos de mensagens que fecharam vendas:\n${sample}`;
}

async function callClaude(
  systemPrompt: string,
  messages: MessageHistory[],
): Promise<{ content: string; usage: { input_tokens: number; output_tokens: number } }> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return {
    content: data.content?.[0]?.text ?? "",
    usage: data.usage ?? { input_tokens: 0, output_tokens: 0 },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body: RequestBody = await req.json();
    const { messageHistory, tenantId, chatId, contactName, customSystemPrompt } = body;

    if (!tenantId || !chatId) {
      return new Response(JSON.stringify({ error: "tenantId e chatId são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the last user message to understand intent
    const lastUserMsg = [...messageHistory].reverse().find((m) => m.role === "user")?.content ?? "";

    // Check if human handoff is needed based on user message
    if (needsHumanHandoff(lastUserMsg)) {
      console.log(`[ai-sales-agent] Human handoff triggered for chat ${chatId}`);
      return new Response(
        JSON.stringify({
          suggestedResponse: "Vou transferir você para um de nossos atendentes para resolver isso da melhor forma possível. Um momento!",
          productsToShow: [],
          confidence: 0.3,
          requiresHumanHandoff: true,
        } satisfies SalesResponse),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Parallel: fetch products, conversation history, RAG context
    const [relevantProducts, conversationHistory, ragContext] = await Promise.all([
      fetchRelevantProducts(supabase, tenantId, lastUserMsg),
      fetchConversationHistory(supabase, chatId, tenantId),
      fetchRAGContext(supabase, tenantId),
    ]);

    // Build catalog section for system prompt
    const catalogSection = relevantProducts.length
      ? relevantProducts.map((p) => {
          const price = p.price !== null ? `R$ ${p.price.toFixed(2)}` : "consulte";
          return `- ${p.name} | Preço: ${price} | Estoque: ${p.stock}${p.description ? ` | ${p.description.slice(0, 150)}` : ""}`;
        }).join("\n")
      : "Catálogo não configurado ainda.";

    // Build final system prompt
    const finalSystemPrompt = (customSystemPrompt || SYSTEM_PROMPT)
      .replace("{catalog}", catalogSection)
      .replace("{rag_context}", ragContext);

    // Merge: use DB history as base, overlay with provided messageHistory (more recent)
    const baseHistory = conversationHistory.length > 0 ? conversationHistory : [];
    const finalMessages: MessageHistory[] = baseHistory.length > messageHistory.length
      ? baseHistory
      : messageHistory;

    // Add contact name context if available
    const systemWithName = contactName
      ? finalSystemPrompt + `\n\nNome do cliente nesta conversa: ${contactName}`
      : finalSystemPrompt;

    // Call Claude
    console.log(`[ai-sales-agent] Calling Claude for tenant=${tenantId} chat=${chatId} msgs=${finalMessages.length}`);
    const { content, usage } = await callClaude(systemWithName, finalMessages);

    console.log(`[ai-sales-agent] Response generated. tokens=${JSON.stringify(usage)}`);

    // Determine confidence based on response length and product relevance
    const confidence = relevantProducts.length > 0 ? 0.85 : 0.65;

    const response: SalesResponse = {
      suggestedResponse: content,
      productsToShow: relevantProducts.map((p) => p.id),
      confidence,
      requiresHumanHandoff: false,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[ai-sales-agent] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
