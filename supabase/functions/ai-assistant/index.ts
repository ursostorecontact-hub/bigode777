import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseKey);
    const { messages } = await req.json();

    // Gather CRM context for the AI
    const [
      { data: profile },
      { data: roleData },
      { data: leads },
      { data: chats },
      { data: tasks },
      { data: clients },
    ] = await Promise.all([
      adminClient.from("profiles").select("*").eq("id", user.id).single(),
      adminClient.from("user_roles").select("role").eq("user_id", user.id).single(),
      adminClient.from("leads").select("id, name, phone, status, pipeline_stage, source, value, assigned_to, created_at").order("created_at", { ascending: false }).limit(50),
      adminClient.from("whatsapp_chats").select("id, contact_name, contact_phone, last_message, last_message_at, unread_count, assigned_to").order("last_message_at", { ascending: false }).limit(30),
      adminClient.from("tasks").select("id, title, status, priority, due_date, assigned_to").order("due_date", { ascending: true }).limit(30),
      adminClient.from("clients").select("id, name, phone, email, total_revenue").order("created_at", { ascending: false }).limit(30),
    ]);

    const role = roleData?.role || "salesperson";
    const userName = profile?.full_name || user.email;

    const systemPrompt = `Você é o Assistente IA do CRM. Seu nome é "Assistente CRM". Você é super inteligente, profissional e resolve problemas rapidamente.

CONTEXTO DO USUÁRIO:
- Nome: ${userName}
- Cargo: ${role === "admin" ? "Administrador" : role === "manager" ? "Gerente" : "Vendedor"}

DADOS DO CRM (atualizados agora):

📊 LEADS (${leads?.length || 0} mais recentes):
${leads?.map(l => `- ${l.name} | Tel: ${l.phone || 'N/A'} | Status: ${l.status} | Etapa: ${l.pipeline_stage} | Valor: R$${l.value} | Fonte: ${l.source}`).join("\n") || "Nenhum lead"}

💬 CONVERSAS WHATSAPP (${chats?.length || 0} mais recentes):
${chats?.map(c => `- ${c.contact_name || c.contact_phone} | Última msg: ${c.last_message?.slice(0, 50) || 'N/A'} | Não lidas: ${c.unread_count} | Em: ${c.last_message_at}`).join("\n") || "Nenhuma conversa"}

✅ TAREFAS (${tasks?.length || 0}):
${tasks?.map(t => `- ${t.title} | Status: ${t.status} | Prioridade: ${t.priority} | Vencimento: ${t.due_date}`).join("\n") || "Nenhuma tarefa"}

👥 CLIENTES (${clients?.length || 0}):
${clients?.map(c => `- ${c.name} | Tel: ${c.phone || 'N/A'} | Email: ${c.email || 'N/A'} | Receita: R$${c.total_revenue}`).join("\n") || "Nenhum cliente"}

SUAS CAPACIDADES:
1. Analisar dados do CRM e dar insights inteligentes
2. Sugerir ações para melhorar vendas e atendimento
3. Identificar leads quentes, problemas de atendimento, tarefas atrasadas
4. Responder dúvidas sobre o sistema e seus dados
5. Gerar relatórios e resumos rápidos
6. Sugerir mensagens para enviar aos clientes
7. Identificar padrões e oportunidades

REGRAS:
- Responda SEMPRE em português do Brasil
- Seja direto, conciso e profissional
- Use emojis com moderação para organizar informações
- Quando der sugestões, seja específico com nomes e dados reais
- Se não souber algo, diga honestamente`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro na IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (err) {
    console.error("AI assistant error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
