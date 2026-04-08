import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, chat_id, content, message_type = "text", phone, instance_id } = await req.json();

    if (action === "send") {
      if (!chat_id || !content) {
        return new Response(JSON.stringify({ error: "chat_id and content required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get chat and verify access
      const { data: chat, error: chatErr } = await supabase
        .from("whatsapp_chats")
        .select("*, whatsapp_instances(*)")
        .eq("id", chat_id)
        .single();

      if (chatErr || !chat) {
        return new Response(JSON.stringify({ error: "Chat not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check access: must be assigned or admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      const isAdmin = roleData?.role === "admin" || roleData?.role === "manager";
      if (!isAdmin && chat.assigned_to !== user.id) {
        return new Response(JSON.stringify({ error: "Access denied" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const instance = chat.whatsapp_instances;
      const number = chat.remote_jid.replace("@s.whatsapp.net", "");

      // Send via Evolution API
      const evoUrl = `${instance.evolution_url}/message/sendText/${instance.instance_name}`;
      const evoRes = await fetch(evoUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: instance.evolution_api_key,
        },
        body: JSON.stringify({
          number,
          text: content,
        }),
      });

      const evoData = await evoRes.json();
      console.log("Evolution send response:", JSON.stringify(evoData).slice(0, 300));

      const messageId = evoData?.key?.id || null;

      // Save message to DB
      const { data: msg, error: msgErr } = await supabase
        .from("whatsapp_messages")
        .insert({
          chat_id,
          from_me: true,
          remote_jid: chat.remote_jid,
          message_type: message_type,
          content,
          status: "sent",
          evolution_message_id: messageId,
        })
        .select()
        .single();

      if (msgErr) {
        console.error("Insert message error:", msgErr);
      }

      // Update chat last message
      await supabase
        .from("whatsapp_chats")
        .update({
          last_message: content,
          last_message_at: new Date().toISOString(),
          unread_count: 0,
        })
        .eq("id", chat_id);

      return new Response(JSON.stringify({ ok: true, message: msg, evolution: evoData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "fetch_chats") {
      // Fetch chats from Evolution API and sync to DB
      if (!instance_id) {
        return new Response(JSON.stringify({ error: "instance_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: instance } = await supabase
        .from("whatsapp_instances")
        .select("*")
        .eq("id", instance_id)
        .single();

      if (!instance) {
        return new Response(JSON.stringify({ error: "Instance not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch chats from Evolution
      const evoRes = await fetch(
        `${instance.evolution_url}/chat/findChats/${instance.instance_name}`,
        { headers: { apikey: instance.evolution_api_key } }
      );
      const chats = await evoRes.json();

      return new Response(JSON.stringify({ ok: true, chats }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "mark_read") {
      if (!chat_id) {
        return new Response(JSON.stringify({ error: "chat_id required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("whatsapp_chats")
        .update({ unread_count: 0 })
        .eq("id", chat_id);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Send error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
