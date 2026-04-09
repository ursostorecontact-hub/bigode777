import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Download media from Evolution API and upload to Supabase storage
async function downloadAndStoreMedia(
  supabase: any,
  evolutionUrl: string,
  evolutionApiKey: string,
  instanceName: string,
  messageId: string,
  mediaType: string,
): Promise<string | null> {
  try {
    // Try to get base64 media from Evolution API
    const mediaRes = await fetch(
      `${evolutionUrl}/chat/getBase64FromMediaMessage/${instanceName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: evolutionApiKey,
        },
        body: JSON.stringify({ message: { key: { id: messageId } } }),
      }
    );

    if (!mediaRes.ok) {
      console.log("Failed to download media:", mediaRes.status);
      return null;
    }

    const mediaData = await mediaRes.json();
    const base64 = mediaData?.base64;
    const mimetype = mediaData?.mimetype || `${mediaType}/*`;

    if (!base64) {
      console.log("No base64 in media response");
      return null;
    }

    // Determine file extension
    const extMap: Record<string, string> = {
      "audio/ogg": "ogg",
      "audio/mpeg": "mp3",
      "audio/mp4": "m4a",
      "audio/aac": "aac",
      "audio/opus": "opus",
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "video/mp4": "mp4",
      "application/pdf": "pdf",
    };
    const ext = extMap[mimetype] || mediaType;
    const filePath = `webhook/${Date.now()}_${messageId.slice(-8)}.${ext}`;

    // Decode base64 and upload
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const { error: uploadError } = await supabase.storage
      .from("whatsapp-media")
      .upload(filePath, bytes.buffer, { contentType: mimetype, upsert: true });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return null;
    }

    const { data: publicUrl } = supabase.storage
      .from("whatsapp-media")
      .getPublicUrl(filePath);

    return publicUrl?.publicUrl || null;
  } catch (err) {
    console.error("Media download/upload error:", err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("Webhook received:", JSON.stringify(body).slice(0, 500));

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Normalize event name: Evolution API v2 sends MESSAGES_UPSERT, v1 sends messages.upsert
    const rawEvent = body.event || "";
    const event = rawEvent.toLowerCase().replace(/_/g, ".");
    const instanceName = body.instance || body.instanceName || body.sender || "";
    const data = body.data || body;

    if (!instanceName) {
      console.log("No instance name in webhook body, keys:", Object.keys(body));
      return new Response(JSON.stringify({ ok: true, skipped: "no instance name" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find the instance in our DB (with evolution credentials)
    const { data: instance } = await supabase
      .from("whatsapp_instances")
      .select("id, evolution_url, evolution_api_key, tenant_id")
      .eq("instance_name", instanceName)
      .single();

    if (!instance) {
      console.log("Instance not found:", instanceName);
      return new Response(JSON.stringify({ ok: true, skipped: "instance not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Processing event:", event, "for instance:", instanceName);

    if (event === "messages.upsert") {
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
      let mediaUrl: string | null = null;
      let needsMediaDownload = false;

      const message = msg.message || {};
      if (message.conversation) {
        content = message.conversation;
      } else if (message.extendedTextMessage?.text) {
        content = message.extendedTextMessage.text;
      } else if (message.imageMessage) {
        messageType = "image";
        content = message.imageMessage.caption || "📷 Imagem";
        needsMediaDownload = true;
      } else if (message.audioMessage) {
        messageType = "audio";
        content = "🎵 Áudio";
        needsMediaDownload = true;
      } else if (message.videoMessage) {
        messageType = "video";
        content = message.videoMessage.caption || "🎥 Vídeo";
        needsMediaDownload = true;
      } else if (message.documentMessage) {
        messageType = "document";
        content = message.documentMessage.fileName || "📄 Documento";
        needsMediaDownload = true;
      } else if (message.stickerMessage) {
        messageType = "sticker";
        content = "🎨 Sticker";
        needsMediaDownload = true;
      } else {
        content = "Mensagem não suportada";
      }

      // Download and store media in our bucket
      if (needsMediaDownload && messageId) {
        const storedUrl = await downloadAndStoreMedia(
          supabase,
          instance.evolution_url,
          instance.evolution_api_key,
          instanceName,
          messageId,
          messageType,
        );
        if (storedUrl) {
          mediaUrl = storedUrl;
        }
      }

      const contactName = data.pushName || msg.pushName || remoteJid.split("@")[0];
      const contactPhone = remoteJid.split("@")[0];

      // Fetch profile picture
      let profilePicUrl: string | null = null;
      try {
        const picRes = await fetch(
          `${instance.evolution_url}/chat/fetchProfilePictureUrl/${instanceName}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: instance.evolution_api_key },
            body: JSON.stringify({ number: contactPhone }),
          }
        );
        if (picRes.ok) {
          const picData = await picRes.json();
          profilePicUrl = picData?.profilePictureUrl || picData?.picture || null;
        }
      } catch (e) {
        console.log("Profile pic fetch failed:", e);
      }

      // Upsert chat
      const upsertData: Record<string, any> = {
        whatsapp_instance_id: instance.id,
        remote_jid: remoteJid,
        contact_phone: contactPhone,
        last_message: content,
        last_message_at: new Date().toISOString(),
        unread_count: fromMe ? 0 : 1,
      };
      if (!fromMe) upsertData.contact_name = contactName;
      if (profilePicUrl) upsertData.profile_picture_url = profilePicUrl;

      const { data: chat, error: chatError } = await supabase
        .from("whatsapp_chats")
        .upsert(upsertData, { onConflict: "whatsapp_instance_id,remote_jid" })
        .select()
        .single();

      if (chatError) {
        console.error("Chat upsert error:", chatError);
        const { data: existingChat } = await supabase
          .from("whatsapp_chats")
          .select("*")
          .eq("whatsapp_instance_id", instance.id)
          .eq("remote_jid", remoteJid)
          .single();

        if (existingChat) {
          await supabase
            .from("whatsapp_chats")
            .update({
              last_message: content,
              last_message_at: new Date().toISOString(),
              unread_count: fromMe ? 0 : existingChat.unread_count + 1,
              ...(fromMe ? {} : { contact_name: contactName }),
            })
            .eq("id", existingChat.id);

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

        // Auto-create lead if new contact
        if (!fromMe) {
          const tenantId = instance.tenant_id || null;

          let leadQuery = supabase
            .from("leads")
            .select("id")
            .eq("phone", contactPhone);
          if (tenantId) leadQuery = leadQuery.eq("tenant_id", tenantId);

          const { data: existingLead } = await leadQuery.maybeSingle();

          if (!existingLead) {
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

        // Assign chat to seller based on distribution
        if (!chat.assigned_to) {
          const { data: assignments } = await supabase
            .from("whatsapp_assignments")
            .select("*")
            .eq("whatsapp_instance_id", instance.id)
            .order("percentage", { ascending: false });

          if (assignments && assignments.length > 0) {
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
    } else if (event === "messages.update" || event === "messages.edited") {
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
    } else if (event === "connection.update") {
      const state = data?.state || data?.status;
      if (state && instance) {
        const newStatus = state === "open" ? "connected" : "disconnected";
        await supabase
          .from("whatsapp_instances")
          .update({ status: newStatus })
          .eq("id", instance.id);
        console.log(`Connection update for ${instanceName}: ${newStatus}`);
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
