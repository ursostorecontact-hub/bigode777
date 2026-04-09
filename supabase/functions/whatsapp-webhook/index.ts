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
    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body).slice(0, 500));

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Evolution API sends different event types
    const event = body.event;
    const instanceName = body.instance;
    const data = body.data;

    if (!data) {
      return new Response(JSON.stringify({ ok: true, skipped: "no data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the instance in our DB
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("id")
      .eq("instance_name", instanceName)
      .single();

    if (!instance) {
      console.log("Instance not found:", instanceName);
      return new Response(JSON.stringify({ ok: true, skipped: "instance not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event === "messages.upsert") {
      // Evolution API v2 can send data in different formats
      // Sometimes data is the message directly, sometimes it's wrapped
      const msg = data;
      const key = msg.key || {};
      const remoteJid = key.remoteJid || msg.remoteJid || "";
      const fromMe = key.fromMe ?? false;
      const messageId = key.id || msg.id || "";

      console.log("Processing message:", JSON.stringify({ remoteJid, fromMe, messageId }).slice(0, 200));

      // Skip status broadcasts and groups
      if (remoteJid === "status@broadcast" || remoteJid.includes("@g.us")) {
        return new Response(JSON.stringify({ ok: true, skipped: "broadcast/group" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Extract message content
      let content = "";
      let messageType = "text";
      let mediaUrl = null;

      const message = msg.message || {};
      if (message.conversation) {
        content = message.conversation;
      } else if (message.extendedTextMessage?.text) {
        content = message.extendedTextMessage.text;
      } else if (message.imageMessage) {
        messageType = "image";
        content = message.imageMessage.caption || "📷 Imagem";
        mediaUrl = message.imageMessage.url || data.mediaUrl || null;
      } else if (message.audioMessage) {
        messageType = "audio";
        content = "🎵 Áudio";
        mediaUrl = message.audioMessage.url || data.mediaUrl || null;
      } else if (message.videoMessage) {
        messageType = "video";
        content = message.videoMessage.caption || "🎥 Vídeo";
        mediaUrl = message.videoMessage.url || data.mediaUrl || null;
      } else if (message.documentMessage) {
        messageType = "document";
        content = message.documentMessage.fileName || "📄 Documento";
        mediaUrl = message.documentMessage.url || data.mediaUrl || null;
      } else if (message.stickerMessage) {
        messageType = "sticker";
        content = "🎨 Sticker";
        mediaUrl = message.stickerMessage.url || data.mediaUrl || null;
      } else {
        content = "Mensagem não suportada";
      }

      const contactName = data.pushName || msg.pushName || remoteJid.split("@")[0];
      const contactPhone = remoteJid.split("@")[0];

      // Upsert chat
      const { data: chat, error: chatError } = await supabase
        .from("whatsapp_chats")
        .upsert(
          {
            whatsapp_instance_id: instance.id,
            remote_jid: remoteJid,
            contact_name: fromMe ? undefined : contactName,
            contact_phone: contactPhone,
            last_message: content,
            last_message_at: new Date().toISOString(),
            unread_count: fromMe ? 0 : 1,
          },
          { onConflict: "whatsapp_instance_id,remote_jid" }
        )
        .select()
        .single();

      if (chatError) {
        console.error("Chat upsert error:", chatError);
        // Try to get existing chat
        const { data: existingChat } = await supabase
          .from("whatsapp_chats")
          .select("*")
          .eq("whatsapp_instance_id", instance.id)
          .eq("remote_jid", remoteJid)
          .single();

        if (existingChat) {
          // Update existing chat
          await supabase
            .from("whatsapp_chats")
            .update({
              last_message: content,
              last_message_at: new Date().toISOString(),
              unread_count: fromMe ? 0 : existingChat.unread_count + 1,
              ...(fromMe ? {} : { contact_name: contactName }),
            })
            .eq("id", existingChat.id);

          // Insert message
          await supabase.from("whatsapp_messages").insert({
            chat_id: existingChat.id,
            from_me: fromMe,
            remote_jid: remoteJid,
            message_type: messageType,
            content,
            media_url: mediaUrl,
            status: fromMe ? "sent" : "received",
            evolution_message_id: messageId,
          });
        }
      } else if (chat) {
        // If not fromMe, increment unread
        if (!fromMe) {
          await supabase
            .from("whatsapp_chats")
            .update({ unread_count: (chat.unread_count || 0) + 1 })
            .eq("id", chat.id);
        }

        // Auto-create lead if this is a new contact (not from us)
        if (!fromMe) {
          // Get tenant_id from the instance
          const { data: instData } = await supabase
            .from("whatsapp_instances")
            .select("tenant_id")
            .eq("id", instance.id)
            .single();

          const tenantId = instData?.tenant_id || null;

          // Check if a lead with this phone already exists for this tenant
          let leadQuery = supabase
            .from("leads")
            .select("id")
            .eq("phone", contactPhone);
          if (tenantId) leadQuery = leadQuery.eq("tenant_id", tenantId);

          const { data: existingLead } = await leadQuery.maybeSingle();

          if (!existingLead) {
            // Also check if a client with this phone exists
            let clientQuery = supabase
              .from("clients")
              .select("id")
              .eq("phone", contactPhone);
            if (tenantId) clientQuery = clientQuery.eq("tenant_id", tenantId);

            const { data: existingClient } = await clientQuery.maybeSingle();

            if (!existingClient) {
              const newLead: Record<string, any> = {
                name: contactName || contactPhone,
                phone: contactPhone,
                source: "WhatsApp",
                notes: `Primeira mensagem: ${content}`,
                status: "novo",
                pipeline_stage: "novo",
              };
              if (tenantId) newLead.tenant_id = tenantId;

              const { data: createdLead, error: leadError } = await supabase
                .from("leads")
                .insert(newLead)
                .select()
                .single();

              if (leadError) {
                console.error("Auto-create lead error:", leadError);
              } else {
                console.log("Lead auto-created:", createdLead?.id, contactPhone);
              }
            }
          }
        }

        // Assign chat to a seller based on distribution if not yet assigned
        if (!chat.assigned_to) {
          const { data: assignments } = await supabase
            .from("whatsapp_assignments")
            .select("*")
            .eq("whatsapp_instance_id", instance.id)
            .order("percentage", { ascending: false });

          if (assignments && assignments.length > 0) {
            // Count existing chats per seller for this instance
            const { data: chatCounts } = await supabase
              .from("whatsapp_chats")
              .select("assigned_to")
              .eq("whatsapp_instance_id", instance.id)
              .not("assigned_to", "is", null);

            const counts: Record<string, number> = {};
            chatCounts?.forEach((c) => {
              if (c.assigned_to) counts[c.assigned_to] = (counts[c.assigned_to] || 0) + 1;
            });

            const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;

            // Find seller with biggest gap between target % and actual %
            let bestSeller = assignments[0].user_id;
            let bestGap = -Infinity;

            for (const a of assignments) {
              const actual = ((counts[a.user_id] || 0) / total) * 100;
              const gap = a.percentage - actual;
              if (gap > bestGap) {
                bestGap = gap;
                bestSeller = a.user_id;
              }
            }

            await supabase
              .from("whatsapp_chats")
              .update({ assigned_to: bestSeller })
              .eq("id", chat.id);

            // Also assign the auto-created lead to the same seller
            if (contactPhone) {
              await supabase
                .from("leads")
                .update({ assigned_to: bestSeller })
                .eq("phone", contactPhone)
                .is("assigned_to", null);
            }
          }
        }

        // Insert message
        await supabase.from("whatsapp_messages").insert({
          chat_id: chat.id,
          from_me: fromMe,
          remote_jid: remoteJid,
          message_type: messageType,
          content,
          media_url: mediaUrl,
          status: fromMe ? "sent" : "received",
          evolution_message_id: messageId,
        });
      }
    } else if (event === "messages.update") {
      // Status updates (delivered, read)
      const updates = Array.isArray(data) ? data : [data];
      for (const upd of updates) {
        const msgId = upd.key?.id;
        const status = upd.update?.status;
        if (msgId && status !== undefined) {
          const statusMap: Record<number, string> = {
            2: "sent",
            3: "delivered",
            4: "read",
          };
          const newStatus = statusMap[status] || "sent";
          await supabase
            .from("whatsapp_messages")
            .update({ status: newStatus })
            .eq("evolution_message_id", msgId);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
