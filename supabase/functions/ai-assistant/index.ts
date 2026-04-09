import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tools available for admin users
const adminTools = [
  {
    type: "function",
    function: {
      name: "create_lead",
      description: "Criar um novo lead no CRM",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome do lead" },
          phone: { type: "string", description: "Telefone do lead" },
          email: { type: "string", description: "Email do lead" },
          source: { type: "string", description: "Origem do lead (ex: WhatsApp, Facebook, Indicação)" },
          value: { type: "number", description: "Valor estimado do lead em reais" },
          notes: { type: "string", description: "Observações sobre o lead" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_lead",
      description: "Atualizar dados de um lead existente (status, etapa do pipeline, valor, etc)",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "ID do lead a atualizar" },
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          status: { type: "string", enum: ["novo", "em_atendimento", "qualificado", "convertido", "perdido"] },
          pipeline_stage: { type: "string" },
          value: { type: "number" },
          priority: { type: "string", enum: ["baixa", "media", "alta"] },
          notes: { type: "string" },
          assigned_to: { type: "string", description: "UUID do vendedor" },
        },
        required: ["lead_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_lead",
      description: "Excluir um lead do CRM",
      parameters: {
        type: "object",
        properties: {
          lead_id: { type: "string", description: "ID do lead a excluir" },
        },
        required: ["lead_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Criar uma nova tarefa",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Título da tarefa" },
          description: { type: "string", description: "Descrição da tarefa" },
          due_date: { type: "string", description: "Data de vencimento (YYYY-MM-DD)" },
          priority: { type: "string", enum: ["baixa", "media", "alta"] },
          assigned_to: { type: "string", description: "UUID do responsável (se omitido, atribui ao admin)" },
        },
        required: ["title", "due_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_task",
      description: "Atualizar uma tarefa existente",
      parameters: {
        type: "object",
        properties: {
          task_id: { type: "string", description: "ID da tarefa" },
          title: { type: "string" },
          status: { type: "string", enum: ["pendente", "em_progresso", "concluida", "cancelada"] },
          priority: { type: "string", enum: ["baixa", "media", "alta"] },
          due_date: { type: "string" },
          assigned_to: { type: "string" },
        },
        required: ["task_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_whatsapp",
      description: "Enviar uma mensagem WhatsApp para um contato",
      parameters: {
        type: "object",
        properties: {
          phone: { type: "string", description: "Número de telefone com DDI (ex: 5511999999999)" },
          message: { type: "string", description: "Texto da mensagem" },
        },
        required: ["phone", "message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_client",
      description: "Converter/criar um cliente",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          email: { type: "string" },
          notes: { type: "string" },
          lead_id: { type: "string", description: "ID do lead de origem (opcional)" },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_team",
      description: "Listar todos os membros da equipe com seus IDs, nomes e cargos",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "search_leads",
      description: "Buscar leads por nome ou telefone",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Texto para buscar no nome ou telefone" },
        },
        required: ["query"],
      },
    },
  },
];

async function executeToolCall(
  adminClient: any,
  userId: string,
  tenantId: string | null,
  fnName: string,
  args: Record<string, any>
): Promise<string> {
  try {
    switch (fnName) {
      case "create_lead": {
        const { data, error } = await adminClient.from("leads").insert({
          name: args.name,
          phone: args.phone || null,
          email: args.email || null,
          source: args.source || "Outro",
          value: args.value || 0,
          notes: args.notes || null,
          assigned_to: args.assigned_to || userId,
          tenant_id: tenantId,
        }).select("id, name").single();
        if (error) return `❌ Erro ao criar lead: ${error.message}`;
        return `✅ Lead "${data.name}" criado com sucesso (ID: ${data.id})`;
      }

      case "update_lead": {
        const updates: Record<string, any> = {};
        for (const k of ["name", "phone", "email", "status", "pipeline_stage", "value", "priority", "notes", "assigned_to"]) {
          if (args[k] !== undefined) updates[k] = args[k];
        }
        const { error } = await adminClient.from("leads").update(updates).eq("id", args.lead_id);
        if (error) return `❌ Erro ao atualizar lead: ${error.message}`;
        return `✅ Lead atualizado com sucesso`;
      }

      case "delete_lead": {
        const { error } = await adminClient.from("leads").delete().eq("id", args.lead_id);
        if (error) return `❌ Erro ao excluir lead: ${error.message}`;
        return `✅ Lead excluído com sucesso`;
      }

      case "create_task": {
        const { data, error } = await adminClient.from("tasks").insert({
          title: args.title,
          description: args.description || null,
          due_date: args.due_date,
          priority: args.priority || "media",
          assigned_to: args.assigned_to || userId,
          created_by: userId,
          tenant_id: tenantId,
        }).select("id, title").single();
        if (error) return `❌ Erro ao criar tarefa: ${error.message}`;
        return `✅ Tarefa "${data.title}" criada com sucesso`;
      }

      case "update_task": {
        const updates: Record<string, any> = {};
        for (const k of ["title", "status", "priority", "due_date", "assigned_to"]) {
          if (args[k] !== undefined) updates[k] = args[k];
        }
        const { error } = await adminClient.from("tasks").update(updates).eq("id", args.task_id);
        if (error) return `❌ Erro ao atualizar tarefa: ${error.message}`;
        return `✅ Tarefa atualizada com sucesso`;
      }

      case "send_whatsapp": {
        const { data: instance } = await adminClient
          .from("whatsapp_instances")
          .select("id, evolution_url, evolution_api_key, instance_name")
          .eq("status", "connected")
          .limit(1)
          .single();

        if (!instance) return `❌ Nenhuma instância WhatsApp conectada`;

        const phone = args.phone.replace(/\D/g, "");
        const jid = phone.includes("@") ? phone : `${phone}@s.whatsapp.net`;

        const resp = await fetch(`${instance.evolution_url}/message/sendText/${instance.instance_name}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: instance.evolution_api_key,
          },
          body: JSON.stringify({ number: jid, text: args.message }),
        });

        if (!resp.ok) {
          const t = await resp.text();
          return `❌ Erro ao enviar WhatsApp: ${t}`;
        }
        return `✅ Mensagem enviada para ${args.phone}`;
      }

      case "create_client": {
        const { data, error } = await adminClient.from("clients").insert({
          name: args.name,
          phone: args.phone || null,
          email: args.email || null,
          notes: args.notes || null,
          lead_id: args.lead_id || null,
          tenant_id: tenantId,
        }).select("id, name").single();
        if (error) return `❌ Erro ao criar cliente: ${error.message}`;
        return `✅ Cliente "${data.name}" criado com sucesso`;
      }

      case "list_team": {
        const { data: profiles } = await adminClient
          .from("profiles")
          .select("id, full_name, email, active")
          .eq("tenant_id", tenantId);
        
        if (!profiles?.length) return "Nenhum membro da equipe encontrado";

        const rolePromises = profiles.map(async (p: any) => {
          const { data: r } = await adminClient
            .from("user_roles")
            .select("role")
            .eq("user_id", p.id)
            .single();
          return { ...p, role: r?.role || "salesperson" };
        });
        const team = await Promise.all(rolePromises);

        return team.map((m: any) =>
          `- ${m.full_name} (${m.email}) | Cargo: ${m.role} | Ativo: ${m.active ? "Sim" : "Não"} | ID: ${m.id}`
        ).join("\n");
      }

      case "search_leads": {
        const q = `%${args.query}%`;
        const { data } = await adminClient
          .from("leads")
          .select("id, name, phone, status, pipeline_stage, value, assigned_to")
          .or(`name.ilike.${q},phone.ilike.${q}`)
          .limit(20);
        
        if (!data?.length) return "Nenhum lead encontrado com essa busca";
        return data.map((l: any) =>
          `- ${l.name} | Tel: ${l.phone || "N/A"} | Status: ${l.status} | Etapa: ${l.pipeline_stage} | Valor: R$${l.value} | ID: ${l.id}`
        ).join("\n");
      }

      default:
        return `Função desconhecida: ${fnName}`;
    }
  } catch (err: any) {
    return `❌ Erro: ${err.message}`;
  }
}

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

    // Gather CRM context
    const [
      { data: profile },
      { data: roleData },
      { data: leads },
      { data: chats },
      { data: tasks },
      { data: clients },
      { data: tenantMember },
    ] = await Promise.all([
      adminClient.from("profiles").select("*").eq("id", user.id).single(),
      adminClient.from("user_roles").select("role").eq("user_id", user.id).single(),
      adminClient.from("leads").select("id, name, phone, status, pipeline_stage, source, value, assigned_to, created_at").order("created_at", { ascending: false }).limit(50),
      adminClient.from("whatsapp_chats").select("id, contact_name, contact_phone, last_message, last_message_at, unread_count, assigned_to").order("last_message_at", { ascending: false }).limit(30),
      adminClient.from("tasks").select("id, title, status, priority, due_date, assigned_to").order("due_date", { ascending: true }).limit(30),
      adminClient.from("clients").select("id, name, phone, email, total_revenue").order("created_at", { ascending: false }).limit(30),
      adminClient.from("tenant_members").select("tenant_id").eq("user_id", user.id).limit(1).single(),
    ]);

    const role = roleData?.role || "salesperson";
    const userName = profile?.full_name || user.email;
    const tenantId = tenantMember?.tenant_id || profile?.tenant_id || null;
    const isAdmin = role === "admin";

    const adminCapabilities = isAdmin ? `

🔧 PODERES DE ADMINISTRADOR (VOCÊ TEM PERMISSÃO TOTAL):
Você pode EXECUTAR AÇÕES REAIS no CRM usando as ferramentas disponíveis:
- Criar, atualizar e excluir leads
- Criar e atualizar tarefas
- Enviar mensagens WhatsApp
- Criar clientes
- Listar equipe com IDs
- Buscar leads

REGRAS PARA AÇÕES:
- Quando o admin pedir para fazer algo, USE AS FERRAMENTAS para executar a ação
- Confirme o que foi feito após executar
- Se precisar de um ID que não tem, use search_leads ou list_team para encontrar
- Sempre confirme dados importantes antes de excluir` : "";

    const systemPrompt = `Você é o Assistente IA do CRM. Seu nome é "Assistente CRM". Você é super inteligente, profissional e resolve problemas rapidamente.

CONTEXTO DO USUÁRIO:
- Nome: ${userName}
- Cargo: ${role === "admin" ? "Administrador" : role === "manager" ? "Gerente" : "Vendedor"}
- Permissão de ações: ${isAdmin ? "SIM - TOTAL" : "NÃO - apenas consulta"}

DADOS DO CRM (atualizados agora):

📊 LEADS (${leads?.length || 0} mais recentes):
${leads?.map(l => `- ${l.name} | Tel: ${l.phone || 'N/A'} | Status: ${l.status} | Etapa: ${l.pipeline_stage} | Valor: R$${l.value} | Fonte: ${l.source} | ID: ${l.id}`).join("\n") || "Nenhum lead"}

💬 CONVERSAS WHATSAPP (${chats?.length || 0} mais recentes):
${chats?.map(c => `- ${c.contact_name || c.contact_phone} | Última msg: ${c.last_message?.slice(0, 50) || 'N/A'} | Não lidas: ${c.unread_count} | Em: ${c.last_message_at}`).join("\n") || "Nenhuma conversa"}

✅ TAREFAS (${tasks?.length || 0}):
${tasks?.map(t => `- ${t.title} | Status: ${t.status} | Prioridade: ${t.priority} | Vencimento: ${t.due_date} | ID: ${t.id}`).join("\n") || "Nenhuma tarefa"}

👥 CLIENTES (${clients?.length || 0}):
${clients?.map(c => `- ${c.name} | Tel: ${c.phone || 'N/A'} | Email: ${c.email || 'N/A'} | Receita: R$${c.total_revenue}`).join("\n") || "Nenhum cliente"}
${adminCapabilities}

SUAS CAPACIDADES:
1. Analisar dados do CRM e dar insights inteligentes
2. Sugerir ações para melhorar vendas e atendimento
3. Identificar leads quentes, problemas de atendimento, tarefas atrasadas
4. Responder dúvidas sobre o sistema e seus dados
5. Gerar relatórios e resumos rápidos
6. Sugerir mensagens para enviar aos clientes
7. Identificar padrões e oportunidades
${isAdmin ? "8. EXECUTAR ações no CRM (criar leads, tarefas, enviar mensagens, etc)" : ""}

REGRAS:
- Responda SEMPRE em português do Brasil
- Seja direto, conciso e profissional
- Use emojis com moderação para organizar informações
- Quando der sugestões, seja específico com nomes e dados reais
- Se não souber algo, diga honestamente`;

    // Build AI request - include tools only for admins
    const aiBody: any = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    };

    if (isAdmin) {
      aiBody.tools = adminTools;
    }

    // First AI call (may include tool calls)
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...aiBody, stream: false }),
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

    const aiResult = await response.json();
    const assistantMessage = aiResult.choices?.[0]?.message;

    // Check if the AI wants to call tools
    if (assistantMessage?.tool_calls?.length > 0) {
      // Execute all tool calls
      const toolResults: Array<{ role: string; tool_call_id: string; content: string }> = [];

      for (const tc of assistantMessage.tool_calls) {
        const fnName = tc.function.name;
        let fnArgs: Record<string, any> = {};
        try {
          fnArgs = JSON.parse(tc.function.arguments);
        } catch { /* empty args */ }

        const result = await executeToolCall(adminClient, user.id, tenantId, fnName, fnArgs);
        toolResults.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        });
      }

      // Second AI call: let AI summarize what was done (streaming)
      const followUpMessages = [
        { role: "system", content: systemPrompt },
        ...messages,
        assistantMessage,
        ...toolResults,
      ];

      const streamResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: followUpMessages,
          stream: true,
        }),
      });

      if (!streamResp.ok) {
        // Fallback: return tool results directly
        const summary = toolResults.map(r => r.content).join("\n");
        return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content: summary } }] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(streamResp.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
      });
    }

    // No tool calls - stream directly for non-tool responses
    // Re-do as streaming request
    const streamResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...aiBody, stream: true }),
    });

    if (!streamResp.ok) {
      // Fallback to non-streamed result
      const content = assistantMessage?.content || "Sem resposta";
      return new Response(JSON.stringify({ choices: [{ message: { role: "assistant", content } }] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(streamResp.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (err: any) {
    console.error("AI assistant error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
