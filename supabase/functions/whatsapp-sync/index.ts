import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// EVOLUTION_SERVER_URL overrides instance.evolution_url for server-side calls.
// Use this when the public HTTPS URL has SSL issues (e.g. NotValidForName).
// Set it in Supabase Edge Function secrets to the internal HTTP URL of the VPS,
// e.g. http://YOUR_VPS_IP:64644
const EVOLUTION_SERVER_URL_OVERRIDE = Deno.env.get("EVOLUTION_SERVER_URL") || "";

// Returns the URL to use for server-side calls to Evolution API.
function evoServerUrl(instanceUrl: string): string {
  return EVOLUTION_SERVER_URL_OVERRIDE || instanceUrl;
}

// Normalize WhatsApp JID so the same contact always maps to the same row.
// Evolution API v2 uses @lid for linked-device IDs alongside @s.whatsapp.net.
// We always store the @s.whatsapp.net form to prevent duplicates.
function normalizeJid(jid: string): string {
  if (!jid) return jid;
  // @lid -> @s.whatsapp.net (same phone, different transport format)
  if (jid.endsWith("@lid")) return jid.replace(/@lid$/, "@s.whatsapp.net");
  return jid;
}

// Valid WhatsApp JIDs must end with a recognized suffix.
// Evolution internal IDs (e.g. "cmo7tr8ex6nzdp34j44v4o16b") have no suffix — reject them.
function isValidJid(jid: string): boolean {
  return jid.endsWith("@s.whatsapp.net") || jid.endsWith("@g.us") || jid.endsWith("@lid");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const isAdmin = roleData?.role === "admin" || roleData?.role === "manager";
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { instance_id } = await req.json();
    if (!instance_id) {
      return new Response(JSON.stringify({ error: "instance_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get instance
    const { data: instance, error: instErr } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("id", instance_id)
      .single();

    if (instErr || !instance) {
      return new Response(JSON.stringify({ error: "Instance not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Syncing chats for instance: ${instance.instance_name}`);

    // 0. Fetch contacts from WhatsApp address book
    const contactMap: Record<string, string> = {};
    try {
      const contactsRes = await fetch(
        `${evoServerUrl(instance.evolution_url)}/chat/findContacts/${instance.instance_name}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: instance.evolution_api_key,
          },
          body: JSON.stringify({}),
        }
      );
      const contactsData = await contactsRes.json();
      const contactsList = Array.isArray(contactsData) ? contactsData : (contactsData?.contacts || contactsData?.data || []);
      console.log(`Found ${contactsList.length} contacts in address book`);
      for (const c of contactsList) {
        const jid = c.id || c.remoteJid || c.jid || "";
        const name = c.pushName || c.name || c.notify || c.verifiedName || c.shortName || "";
        if (jid && name) {
          contactMap[jid] = name;
          // Also map the phone number without @suffix
          const phone = jid.split("@")[0];
          if (phone) contactMap[phone] = name;
        }
      }
    } catch (contactErr) {
      console.error("Contact fetch error (non-fatal):", contactErr);
    }

    // 1. Fetch all chats from Evolution API (try POST first, then GET)
    let chats: any[] = [];
    
    // Try POST /chat/findChats
    let chatsRes = await fetch(
      `${evoServerUrl(instance.evolution_url)}/chat/findChats/${instance.instance_name}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: instance.evolution_api_key,
        },
        body: JSON.stringify({}),
      }
    );
    let chatsData = await chatsRes.json();
    console.log("findChats POST response:", JSON.stringify(chatsData).slice(0, 500));

    if (Array.isArray(chatsData)) {
      chats = chatsData;
    } else if (chatsData?.chats && Array.isArray(chatsData.chats)) {
      chats = chatsData.chats;
    } else {
      // Try GET /chat/findContacts as fallback
      chatsRes = await fetch(
        `${evoServerUrl(instance.evolution_url)}/chat/findContacts/${instance.instance_name}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: instance.evolution_api_key,
          },
          body: JSON.stringify({}),
        }
      );
      chatsData = await chatsRes.json();
      console.log("findContacts response:", JSON.stringify(chatsData).slice(0, 500));
      if (Array.isArray(chatsData)) chats = chatsData;
    }

    if (chats.length === 0) {
      return new Response(JSON.stringify({ ok: true, synced_chats: 0, synced_messages: 0, synced_contacts: Object.keys(contactMap).length, message: "No chats found from API" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Found ${chats.length} chats to sync`);

    let syncedChats = 0;
    let syncedMessages = 0;

    for (const chat of chats) {
      try {
        // Evolution API v2: chat has remoteJid field, id is internal.
        // Normalize @lid -> @s.whatsapp.net to prevent duplicate rows for the same contact.
        const remoteJid = normalizeJid(chat.remoteJid || "");

        // Skip invalid JIDs (Evolution internal IDs without @ suffix) and status broadcasts
        if (!isValidJid(remoteJid) || remoteJid === "status@broadcast") {
          continue;
        }

        const isGroup = remoteJid.endsWith("@g.us");
        const contactPhone = remoteJid.split("@")[0];

        // Resolve name: for groups use subject/name; for contacts use address book > pushName
        const contactName = isGroup
          ? (chat.name || chat.subject || chat.pushName || contactPhone)
          : (contactMap[remoteJid] || contactMap[contactPhone] || chat.pushName || chat.name || chat.contact || contactPhone);

        // Upsert chat — tenant_id must be set so RLS lets the row be visible
        const { data: dbChat, error: chatErr } = await supabase
          .from("whatsapp_chats")
          .upsert(
            {
              whatsapp_instance_id: instance.id,
              tenant_id: instance.tenant_id,
              remote_jid: remoteJid,
              contact_name: contactName,
              contact_phone: contactPhone,
              last_message: chat.lastMessage?.message?.conversation ||
                chat.lastMessage?.message?.extendedTextMessage?.text ||
                chat.lastMsgContent || "",
              last_message_at: chat.lastMessage?.messageTimestamp
                ? new Date(Number(chat.lastMessage.messageTimestamp) * 1000).toISOString()
                : chat.updatedAt || new Date().toISOString(),
              unread_count: chat.unreadCount || 0,
            },
            { onConflict: "whatsapp_instance_id,remote_jid" }
          )
          .select()
          .single();

        if (chatErr) {
          console.error(`Chat upsert error for ${remoteJid}:`, chatErr);
          continue;
        }

        // Auto-assign seller for individual chats only (not groups)
        if (!dbChat.assigned_to && !isGroup) {
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
            chatCounts?.forEach((c: any) => {
              if (c.assigned_to) counts[c.assigned_to] = (counts[c.assigned_to] || 0) + 1;
            });
            const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;

            let bestSeller = assignments[0].user_id;
            let bestGap = -Infinity;
            for (const a of assignments) {
              const actual = ((counts[a.user_id] || 0) / total) * 100;
              const gap = a.percentage - actual;
              if (gap > bestGap) { bestGap = gap; bestSeller = a.user_id; }
            }

            await supabase.from("whatsapp_chats").update({ assigned_to: bestSeller }).eq("id", dbChat.id);
          }
        }

        syncedChats++;

        // 2. Fetch messages for this chat
        try {
          const msgsRes = await fetch(
            `${evoServerUrl(instance.evolution_url)}/chat/findMessages/${instance.instance_name}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: instance.evolution_api_key,
              },
              body: JSON.stringify({
                where: { key: { remoteJid } },
                limit: 100,
              }),
            }
          );

          const msgsData = await msgsRes.json();
          
          // Log first chat's response to debug format
          if (syncedChats <= 2) {
            console.log(`Messages response for ${remoteJid}:`, JSON.stringify(msgsData).slice(0, 500));
          }

          // Handle various response formats including nested messages.records
          let messages: any[] = [];
          if (Array.isArray(msgsData)) {
            messages = msgsData;
          } else if (msgsData?.messages?.records && Array.isArray(msgsData.messages.records)) {
            messages = msgsData.messages.records;
          } else if (msgsData?.messages && Array.isArray(msgsData.messages)) {
            messages = msgsData.messages;
          } else if (msgsData?.data && Array.isArray(msgsData.data)) {
            messages = msgsData.data;
          } else if (msgsData?.records && Array.isArray(msgsData.records)) {
            messages = msgsData.records;
          }

          if (messages.length === 0) {
            continue;
          }

          for (const msg of messages) {
            try {
              const key = msg.key || {};
              const messageId = key.id || msg.id || "";
              const fromMe = key.fromMe ?? false;
              // For group messages, participant is the actual sender JID
              const msgSenderJid = isGroup ? normalizeJid(key.participant || "") : null;
              const msgSenderName = isGroup ? (msg.pushName || null) : null;

              if (!messageId) continue;

              // Check if message already exists
              const { data: existing } = await supabase
                .from("whatsapp_messages")
                .select("id")
                .eq("evolution_message_id", messageId)
                .maybeSingle();

              if (existing) continue;

              // Extract content
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
                mediaUrl = message.imageMessage.url || null;
              } else if (message.audioMessage) {
                messageType = "audio";
                content = "🎵 Áudio";
                mediaUrl = message.audioMessage.url || null;
              } else if (message.videoMessage) {
                messageType = "video";
                content = message.videoMessage.caption || "🎥 Vídeo";
                mediaUrl = message.videoMessage.url || null;
              } else if (message.documentMessage) {
                messageType = "document";
                content = message.documentMessage.fileName || "📄 Documento";
                mediaUrl = message.documentMessage.url || null;
              } else if (message.stickerMessage) {
                messageType = "sticker";
                content = "🎨 Sticker";
              } else if (message.locationMessage) {
                messageType = "location";
                const lm = message.locationMessage as Record<string, number | string>;
                content = JSON.stringify({ lat: lm.degreesLatitude, lng: lm.degreesLongitude, name: lm.name || null });
              } else if (message.liveLocationMessage) {
                messageType = "location";
                const llm = message.liveLocationMessage as Record<string, number | string>;
                content = JSON.stringify({ lat: llm.degreesLatitude, lng: llm.degreesLongitude, name: "Localização em tempo real" });
              } else {
                content = "Mensagem não suportada";
              }

              const timestamp = msg.messageTimestamp
                ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
                : new Date().toISOString();

              await supabase.from("whatsapp_messages").insert({
                chat_id: dbChat.id,
                tenant_id: instance.tenant_id,
                from_me: fromMe,
                remote_jid: remoteJid,
                message_type: messageType,
                content,
                media_url: mediaUrl,
                status: fromMe ? "sent" : "received",
                evolution_message_id: messageId,
                created_at: timestamp,
                sender_name: msgSenderName,
                sender_jid: msgSenderJid,
              });

              syncedMessages++;
            } catch (msgErr) {
              console.error("Message sync error:", msgErr);
            }
          }
        } catch (fetchMsgErr) {
          console.error(`Fetch messages error for ${remoteJid}:`, fetchMsgErr);
        }
      } catch (chatProcessErr) {
        console.error("Chat process error:", chatProcessErr);
      }
    }

    // 3. Update existing chats that have no contact_name using the address book
    let updatedNames = 0;
    if (Object.keys(contactMap).length > 0) {
      const { data: namelessChats } = await supabase
        .from("whatsapp_chats")
        .select("id, remote_jid, contact_phone")
        .eq("whatsapp_instance_id", instance.id)
        .or("contact_name.is.null,contact_name.eq.");

      for (const nc of (namelessChats || [])) {
        const resolvedName = contactMap[nc.remote_jid] || contactMap[nc.contact_phone || ""];
        if (resolvedName) {
          await supabase.from("whatsapp_chats").update({ contact_name: resolvedName }).eq("id", nc.id);
          updatedNames++;
        }
      }
    }

    console.log(`Sync complete: ${syncedChats} chats, ${syncedMessages} messages, ${updatedNames} names updated`);

    return new Response(
      JSON.stringify({ ok: true, synced_chats: syncedChats, synced_messages: syncedMessages, updated_names: updatedNames, contacts_found: Object.keys(contactMap).length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Sync error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
