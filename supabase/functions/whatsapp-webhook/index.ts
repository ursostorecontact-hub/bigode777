import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Override para chamar Evolution API via IP interno (evita SSL com domínio público)
const EVOLUTION_SERVER_URL_OVERRIDE = Deno.env.get("EVOLUTION_SERVER_URL") || "";
function evoServerUrl(instanceUrl: string): string {
  return EVOLUTION_SERVER_URL_OVERRIDE || instanceUrl;
}

function normalizeJid(jid: string): string {
  if (!jid) return jid;
  if (jid.endsWith("@lid")) return jid.replace(/@lid$/, "@s.whatsapp.net");
  return jid;
}

function isValidJid(jid: string): boolean {
  return jid.endsWith("@s.whatsapp.net") || jid.endsWith("@g.us");
}

interface MediaResult {
  url: string | null;
  mimeType: string | null;
}

async function downloadAndStoreMedia(
  supabase: ReturnType<typeof createClient>,
  evolutionUrl: string,
  evolutionApiKey: string,
  instanceName: string,
  messageId: string,
  tenantId: string,
  hintMimeType?: string,
): Promise<MediaResult> {
  try {
    const mediaRes = await fetch(
      `${evoServerUrl(evolutionUrl)}/chat/getBase64FromMediaMessage/${instanceName}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evolutionApiKey },
        body: JSON.stringify({ message: { key: { id: messageId } } }),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!mediaRes.ok) {
      console.log(`[webhook] mídia download falhou ${mediaRes.status} para msg ${messageId}`);
      return { url: null, mimeType: null };
    }

    const mediaData = await mediaRes.json();
    const base64 = mediaData?.base64;
    const mimetype: string = mediaData?.mimetype || hintMimeType || "application/octet-stream";

    if (!base64) {
      console.log(`[webhook] sem base64 para msg ${messageId}`);
      return { url: null, mimeType: null };
    }

    const extMap: Record<string, string> = {
      "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a",
      "audio/aac": "aac", "audio/opus": "opus", "audio/webm": "webm",
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
      "video/mp4": "mp4", "video/webm": "webm",
      "application/pdf": "pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    };
    const ext = extMap[mimetype] || mimetype.split("/").pop() || "bin";
    const filePath = `webhook/${tenantId}/${Date.now()}_${messageId.slice(-8)}.${ext}`;

    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const { error: uploadError } = await supabase.storage
      .from("whatsapp-media")
      .upload(filePath, bytes.buffer, { contentType: mimetype, upsert: true });

    if (uploadError) {
      console.error("[webhook] upload error:", uploadError);
      return { url: null, mimeType: mimetype };
    }

    const { data: publicUrlData } = supabase.storage.from("whatsapp-media").getPublicUrl(filePath);
    return { url: publicUrlData?.publicUrl || null, mimeType: mimetype };
  } catch (err) {
    console.error(`[webhook] downloadAndStoreMedia error para ${messageId}:`, err);
    return { url: null, mimeType: null };
  }
}

// ── Detecção de origem por anúncio (click-to-WhatsApp) ─────────────────────
// Quando alguém clica em "Enviar mensagem" num anúncio do Facebook/Instagram,
// o WhatsApp anexa esse metadado na primeira mensagem. Sem ler isso aqui, o
// CRM nunca sabe de verdade se o lead veio de anúncio (ou de qual) — só resta
// a IA "advinhar" pelo texto da conversa, o que é impreciso.
interface AdReferral {
  sourceType?: string;
  sourceUrl?: string;
  title?: string;
  ctwaClid?: string;
}

function extractAdReferral(message: Record<string, unknown>): AdReferral | null {
  for (const key of Object.keys(message)) {
    if (!key.endsWith("Message")) continue;
    const sub = message[key] as Record<string, unknown> | undefined;
    const ctx = sub?.contextInfo as Record<string, unknown> | undefined;
    const ad = ctx?.externalAdReply as Record<string, unknown> | undefined;
    if (ad) {
      return {
        sourceType: ad.sourceType as string | undefined,
        sourceUrl: ad.sourceUrl as string | undefined,
        title: ad.title as string | undefined,
        ctwaClid: ad.ctwaClid as string | undefined,
      };
    }
  }
  return null;
}

// Transforma o metadado técnico do anúncio numa origem legível (o que aparece
// na coluna "Origem" da tela de Leads).
function labelFromAdReferral(ad: AdReferral | null): string | null {
  if (!ad) return null;
  const url = (ad.sourceUrl || "").toLowerCase();
  if (url.includes("instagram")) return "Instagram Ads";
  if (url.includes("facebook") || url.includes("fb.")) return "Facebook Ads";
  return "Anúncio (Meta)";
}

async function fetchProfilePic(evoUrl: string, evoKey: string, instanceName: string, contactPhone: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${evoServerUrl(evoUrl)}/chat/fetchProfilePictureUrl/${instanceName}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: evoKey },
        body: JSON.stringify({ number: contactPhone }),
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.profilePictureUrl || data?.picture || null;
  } catch {
    return null;
  }
}

// ── Group name auto-fetch ──────────────────────────────────────────────────

async function fetchGroupNameIfMissing(
  supabase: ReturnType<typeof createClient>,
  instance: { id: string; evolution_url: string; evolution_api_key: string },
  instanceName: string,
  remoteJid: string,
): Promise<void> {
  try {
    const { data: chat } = await supabase
      .from("whatsapp_chats")
      .select("contact_name, custom_name")
      .eq("whatsapp_instance_id", instance.id)
      .eq("remote_jid", remoteJid)
      .single();

    if (!chat) return;
    if (chat.custom_name && (chat.custom_name as string).trim() !== "") return;
    if (chat.contact_name && chat.contact_name !== remoteJid) return;

    const evoUrl = (Deno.env.get("EVOLUTION_API_URL") || instance.evolution_url).replace(/\/$/, "");
    const evoKey = Deno.env.get("EVOLUTION_API_KEY") || instance.evolution_api_key;

    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 10000);

    try {
      const res = await fetch(
        `${evoUrl}/group/findGroupInfos/${instanceName}?groupJid=${encodeURIComponent(remoteJid)}`,
        { headers: { apikey: evoKey }, signal: ctrl.signal },
      );
      clearTimeout(timeout);

      if (!res.ok) {
        console.log(`[fetchGroupName] ${res.status} para ${remoteJid}`);
        return;
      }

      const data = await res.json();
      const subject = (data?.subject || data?.name) as string | undefined;
      if (!subject) return;

      await supabase
        .from("whatsapp_chats")
        .update({ contact_name: subject })
        .eq("whatsapp_instance_id", instance.id)
        .eq("remote_jid", remoteJid);

      console.log(`[fetchGroupName] OK: ${remoteJid} → "${subject}"`);
    } catch (e) {
      clearTimeout(timeout);
      console.log(`[fetchGroupName] erro ${remoteJid}:`, (e as Error).message);
    }
  } catch (e) {
    console.log(`[fetchGroupName] outer:`, (e as Error).message);
  }
}

// ── Event Handlers ─────────────────────────────────────────────────────────

async function handleMessagesUpsert(
  supabase: ReturnType<typeof createClient>,
  data: unknown,
  instance: { id: string; evolution_url: string; evolution_api_key: string; tenant_id: string },
  instanceName: string,
): Promise<void> {
  const msgs = Array.isArray(data) ? data : [data];

  for (const msg of msgs) {
    const key = (msg as Record<string, unknown>).key as Record<string, unknown> || {};
    const remoteJid = normalizeJid((key.remoteJid as string) || (msg as Record<string, string>).remoteJid || "");
    const fromMe = (key.fromMe as boolean) ?? false;
    const messageId = (key.id as string) || (msg as Record<string, string>).id || "";

    if (!isValidJid(remoteJid) || remoteJid === "status@broadcast") continue;

    const isGroup = remoteJid.endsWith("@g.us");
    const senderJid = isGroup ? normalizeJid((key.participant as string) || "") : null;
    const pushNameRaw = (msg as Record<string, string>).pushName || null;
    const senderName = isGroup ? pushNameRaw : null; // nome do remetente em grupo

    console.log(`[webhook] msg: jid=${remoteJid} fromMe=${fromMe} type=${isGroup ? "group" : "individual"} id=${messageId}`);

    // Extrair conteúdo e tipo
    let content = "";
    let messageType = "text";
    let needsMedia = false;
    let mediaFilename: string | null = null;
    let mediaCaption: string | null = null;
    let hintMimeType: string | undefined;

    let message = (msg as Record<string, unknown>).message as Record<string, unknown> || {};

    // O WhatsApp "embrulha" o conteúdo real numa camada extra em alguns casos
    // (visualização única, mensagens efêmeras) — sem desembrulhar isso primeiro,
    // o áudio/foto real fica escondido e a gente marca como "não suportada".
    const wrapper = (message.viewOnceMessage || message.viewOnceMessageV2 || message.ephemeralMessage) as
      { message?: Record<string, unknown> } | undefined;
    if (wrapper?.message) {
      message = wrapper.message;
    }

    if (message.conversation) {
      content = message.conversation as string;
    } else if ((message.extendedTextMessage as Record<string, unknown>)?.text) {
      content = ((message.extendedTextMessage as Record<string, string>).text);
    } else if (message.imageMessage) {
      const im = message.imageMessage as Record<string, string>;
      messageType = "image";
      mediaCaption = im.caption || null;
      content = mediaCaption || "📷 Imagem";
      needsMedia = true;
      hintMimeType = im.mimetype || "image/jpeg";
    } else if (message.videoMessage) {
      const vm = message.videoMessage as Record<string, string>;
      messageType = "video";
      mediaCaption = vm.caption || null;
      content = mediaCaption || "🎥 Vídeo";
      needsMedia = true;
      hintMimeType = vm.mimetype || "video/mp4";
    } else if (message.audioMessage || message.pttMessage) {
      const am = (message.audioMessage || message.pttMessage) as Record<string, string>;
      messageType = "audio";
      content = "🎵 Áudio";
      needsMedia = true;
      hintMimeType = am.mimetype || "audio/ogg";
    } else if (message.documentMessage) {
      const dm = message.documentMessage as Record<string, string>;
      messageType = "document";
      mediaFilename = dm.fileName || dm.title || null;
      mediaCaption = dm.caption || null;
      content = mediaFilename || mediaCaption || "📄 Documento";
      needsMedia = true;
      hintMimeType = dm.mimetype || "application/octet-stream";
    } else if (message.stickerMessage) {
      const sm = message.stickerMessage as Record<string, string>;
      messageType = "sticker";
      content = "🎨 Sticker";
      needsMedia = true;
      hintMimeType = sm.mimetype || "image/webp";
    } else if (message.locationMessage) {
      const lm = message.locationMessage as Record<string, number | string>;
      messageType = "location";
      content = JSON.stringify({
        lat: lm.degreesLatitude,
        lng: lm.degreesLongitude,
        name: lm.name || null,
      });
    } else if (message.liveLocationMessage) {
      // Localização "em tempo real" (compartilhada por um período) — mesmo
      // formato da localização fixa, só vem num campo diferente do WhatsApp.
      const llm = message.liveLocationMessage as Record<string, number | string>;
      messageType = "location";
      content = JSON.stringify({
        lat: llm.degreesLatitude,
        lng: llm.degreesLongitude,
        name: "Localização em tempo real",
      });
    } else if (message.contactMessage || message.contactsArrayMessage) {
      const cm = (message.contactMessage || (message.contactsArrayMessage as Record<string, unknown[]>)?.contacts?.[0]) as Record<string, string> || {};
      messageType = "contact";
      content = cm.displayName || "Contato";
    } else if (message.reactionMessage) {
      const rm = message.reactionMessage as Record<string, string>;
      messageType = "reaction";
      content = rm.text || "❤️";
    } else {
      messageType = "unsupported";
      content = "Mensagem não suportada";
    }

    // Download mídia
    let mediaUrl: string | null = null;
    let mediaMimeType: string | null = null;
    if (needsMedia && messageId) {
      try {
        const result = await downloadAndStoreMedia(
          supabase,
          evoServerUrl(instance.evolution_url),
          instance.evolution_api_key,
          instanceName,
          messageId,
          instance.tenant_id,
          hintMimeType,
        );
        mediaUrl = result.url;
        mediaMimeType = result.mimeType;
      } catch (e) {
        console.error(`[webhook] mídia falhou para ${messageId}:`, e);
        messageType = "unsupported";
      }
    }

    // Nome e push_name
    const contactPhone = remoteJid.split("@")[0];
    // Grupos: NUNCA usar pushName do remetente como nome do grupo.
    // O nome correto vem do evento chats.upsert (campo subject).
    const contactName = isGroup ? null : (pushNameRaw || contactPhone);
    const pushName = isGroup ? null : pushNameRaw; // push_name apenas para individuais

    // Foto de perfil (apenas para novas conversas, fire-and-forget)
    let profilePicUrl: string | null = null;
    try {
      profilePicUrl = await fetchProfilePic(
        evoServerUrl(instance.evolution_url),
        instance.evolution_api_key,
        instanceName,
        contactPhone,
      );
    } catch (e) {
      console.log("[webhook] foto de perfil falhou:", e);
    }

    // Detecta se essa conversa é nova (primeiro contato desse número), pra saber
    // se precisa criar um lead sem dono pra ela entrar na Fila de Leads — assim
    // nenhuma conversa "escapa" direto pros vendedores sem passar pela pesca.
    const { data: existingChatCheck } = await supabase
      .from("whatsapp_chats")
      .select("id")
      .eq("whatsapp_instance_id", instance.id)
      .eq("remote_jid", remoteJid)
      .maybeSingle();
    const isNewChat = !existingChatCheck;

    // Detecta se essa mensagem carrega o metadado de anúncio (clique no Facebook/Instagram)
    const adReferral = extractAdReferral(message);
    const adLabel = labelFromAdReferral(adReferral);

    // 🔍 DEBUG TEMPORÁRIO: loga a mensagem crua de toda conversa nova, pra a gente
    // achar onde o WhatsApp realmente coloca o metadado de anúncio nesse ambiente
    // (Evolution API pode entregar isso numa estrutura um pouco diferente do padrão).
    // Remover depois de confirmar o formato certo.
    if (isNewChat && !isGroup && !fromMe) {
      console.log("[webhook][AD-DEBUG] adReferral encontrado:", JSON.stringify(adReferral));
      console.log("[webhook][AD-DEBUG] message keys:", Object.keys(message));
      console.log("[webhook][AD-DEBUG] message completo:", JSON.stringify(message));
    }

    // Prévia amigável pra lista de conversas — location salva coordenadas em JSON
    // no "content" da mensagem em si (necessário pro mapa funcionar), mas ninguém
    // deveria ver esse JSON cru como texto de prévia.
    const previewText = messageType === "location" ? "📍 Localização" : content;

    // Upsert do chat
    const upsertData: Record<string, unknown> = {
      whatsapp_instance_id: instance.id,
      remote_jid: remoteJid,
      contact_phone: contactPhone,
      last_message: previewText,
      last_message_at: new Date().toISOString(),
      tenant_id: instance.tenant_id,
      is_group: isGroup,
    };

    // Só grava o anúncio na primeira vez que ele aparece (normalmente só vem na
    // mensagem inicial do clique) — não queremos apagar isso depois.
    if (adReferral && isNewChat) {
      upsertData.ad_title = adReferral.title || null;
      upsertData.ad_source_url = adReferral.sourceUrl || null;
    }

    if (!isGroup && (!fromMe || contactName)) upsertData.contact_name = contactName;
    if (pushName && !fromMe) upsertData.push_name = pushName;
    if (profilePicUrl) {
      upsertData.profile_picture_url = profilePicUrl;
      upsertData.profile_pic_url = profilePicUrl;
    }

    const { data: chat, error: chatError } = await supabase
      .from("whatsapp_chats")
      .upsert(upsertData, { onConflict: "whatsapp_instance_id,remote_jid" })
      .select()
      .single();

    // Se upsert falhou, tentar update direto
    let targetChat: Record<string, unknown> | null = chat;
    if (chatError) {
      console.error("[webhook] chat upsert error:", chatError);
      const { data: existing } = await supabase
        .from("whatsapp_chats")
        .select("*")
        .eq("whatsapp_instance_id", instance.id)
        .eq("remote_jid", remoteJid)
        .single();
      if (existing) {
        await supabase.from("whatsapp_chats").update({
          last_message: previewText,
          last_message_at: new Date().toISOString(),
          is_group: isGroup,
          ...(!fromMe && pushName ? { push_name: pushName } : {}),
          ...(!fromMe && !isGroup && contactName ? { contact_name: contactName } : {}),
        }).eq("id", existing.id);
        targetChat = existing;
      }
    }

    if (!targetChat) {
      console.error("[webhook] não foi possível obter chat para", remoteJid);
      continue;
    }

    const chatId = targetChat.id as string;

    // Conversa nova (primeiro contato, não é grupo, não fomos nós que mandamos):
    // cria um lead SEM DONO pra ela cair na Fila de Leads, em vez de já aparecer
    // liberada pra qualquer vendedor ver/responder sem passar pela pesca.
    if (isNewChat && !isGroup && !fromMe) {
      try {
        const { data: newLead } = await supabase
          .from("leads")
          .insert({
            name: contactName || pushName || contactPhone,
            phone: contactPhone,
            // Se veio de um clique em anúncio, já sabemos a origem real —
            // só deixamos null (pra IA tentar descobrir) quando não veio de anúncio.
            source: adLabel,
            ad_title: adReferral?.title || null,
            ad_source_url: adReferral?.sourceUrl || null,
            status: "novo",
            pipeline_stage: "novo",
            tenant_id: instance.tenant_id,
            assigned_to: null,
          })
          .select("id")
          .single();

        if (newLead) {
          fetch(`${supabaseUrl}/functions/v1/ai-lead-scoring`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseKey}` },
            body: JSON.stringify({ lead_id: newLead.id, internal: true, tenantId: instance.tenant_id }),
          }).catch((err) => console.error("[webhook] erro ao chamar ai-lead-scoring:", err));
        }
      } catch (err) {
        console.error("[webhook] erro ao criar lead automatico:", err);
      }
    }

    // Fire-and-forget: preencher nome real de grupos que ainda exibem o JID como nome
    if (isGroup) {
      fetchGroupNameIfMissing(supabase, instance, instanceName, remoteJid).catch(() => {});
    }

    // Incrementar não-lidos para mensagens recebidas
    if (!fromMe) {
      await supabase
        .from("whatsapp_chats")
        .update({ unread_count: ((targetChat.unread_count as number) || 0) + 1 })
        .eq("id", chatId);
    }

    // Auto-criar lead (apenas individual, não grupo)
    if (!fromMe && !isGroup) {
      const tenantId = instance.tenant_id;
      const { data: existingLead } = await supabase
        .from("leads").select("id").eq("phone", contactPhone).eq("tenant_id", tenantId).maybeSingle();

      if (!existingLead) {
        const { data: existingClient } = await supabase
          .from("clients").select("id").eq("phone", contactPhone).eq("tenant_id", tenantId).maybeSingle();

        if (!existingClient) {
          const { error: leadError } = await supabase.from("leads").insert({
            name: contactName || contactPhone,
            phone: contactPhone,
            source: adLabel || "WhatsApp",
            ad_title: adReferral?.title || null,
            ad_source_url: adReferral?.sourceUrl || null,
            notes: `Primeira mensagem: ${content}`,
            status: "novo",
            pipeline_stage: "novo",
            whatsapp_instance_id: instance.id,
            tenant_id: tenantId,
          });
          if (leadError) console.error("[webhook] lead auto-create error:", leadError);
          else console.log(`[webhook] lead criado para ${contactPhone}`);
        }
      }
    }

    // Distribuição automática por porcentagem
    if (!targetChat.assigned_to) {
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

        let bestSeller = (assignments[0] as Record<string, string>).user_id;
        let bestGap = -Infinity;
        for (const a of assignments) {
          const ass = a as Record<string, number | string>;
          const actual = ((counts[ass.user_id as string] || 0) / total) * 100;
          const gap = (ass.percentage as number) - actual;
          if (gap > bestGap) { bestGap = gap; bestSeller = ass.user_id as string; }
        }

        await supabase.from("whatsapp_chats").update({ assigned_to: bestSeller }).eq("id", chatId);
        if (contactPhone) {
          await supabase.from("leads").update({ assigned_to: bestSeller })
            .eq("phone", contactPhone).is("assigned_to", null);
        }
      }
    }

    // Inserir mensagem
    const { error: msgError } = await supabase.from("whatsapp_messages").insert({
      chat_id: chatId,
      from_me: fromMe,
      remote_jid: remoteJid,
      message_type: messageType,
      content,
      media_url: mediaUrl,
      media_mime_type: mediaMimeType,
      media_filename: mediaFilename,
      media_caption: mediaCaption,
      status: fromMe ? "sent" : "received",
      evolution_message_id: messageId,
      tenant_id: instance.tenant_id,
      sender_name: senderName,
      sender_jid: senderJid,
    });
    if (msgError) console.error("[webhook] insert message error:", msgError);

    // Fire-and-forget: AI auto-response (apenas mensagens recebidas em chats individuais)
    if (!fromMe && !isGroup && !msgError) {
      triggerAiSalesAgent(chatId, instance.tenant_id).catch(() => {});
    }
  }
}

async function triggerAiSalesAgent(chatId: string, tenantId: string): Promise<void> {
  const url = `${supabaseUrl}/functions/v1/ai-sales-agent`;
  await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseKey}`,
    },
    body: JSON.stringify({ chatId, tenantId, trigger_type: "auto", internal: true }),
    signal: AbortSignal.timeout(60000),
  });
}

async function handleMessagesUpdate(
  supabase: ReturnType<typeof createClient>,
  data: unknown,
): Promise<void> {
  const updates = Array.isArray(data) ? data : [data];
  for (const upd of updates) {
    const u = upd as Record<string, Record<string, unknown>>;
    const msgId = u.key?.id as string;
    const status = u.update?.status as number;
    if (!msgId || status === undefined) continue;

    const statusMap: Record<number, string> = { 2: "sent", 3: "delivered", 4: "read" };
    const newStatus = statusMap[status] || "sent";
    await supabase.from("whatsapp_messages").update({ status: newStatus }).eq("evolution_message_id", msgId);
  }
}

async function handleConnectionUpdate(
  supabase: ReturnType<typeof createClient>,
  data: unknown,
  instance: { id: string; instance_name: string },
): Promise<void> {
  const d = data as Record<string, string>;
  const state = d?.state || d?.status;
  if (!state) return;

  const statusMap: Record<string, string> = {
    "open": "connected",
    "connecting": "connecting",
    "close": "disconnected",
  };
  const newStatus = statusMap[state] || "disconnected";

  await supabase.from("whatsapp_instances").update({ status: newStatus }).eq("id", instance.id);
  console.log(`[webhook] connection.update ${instance.instance_name}: ${state} → ${newStatus}`);
}

async function handleContacts(
  supabase: ReturnType<typeof createClient>,
  data: unknown,
  instance: { id: string },
): Promise<void> {
  const contacts = Array.isArray(data) ? data : [data];
  for (const contact of contacts) {
    const c = contact as Record<string, string>;
    const jid = normalizeJid(c.id || "");
    const pushName = c.pushName || c.notify || null;
    if (!jid || !pushName) continue;

    // Atualizar push_name apenas para individuais sem custom_name definido
    await supabase
      .from("whatsapp_chats")
      .update({ push_name: pushName, contact_name: pushName })
      .eq("whatsapp_instance_id", instance.id)
      .eq("remote_jid", jid)
      .eq("is_group", false)
      .is("custom_name", null);
  }
}

async function handleChats(
  supabase: ReturnType<typeof createClient>,
  data: unknown,
  instance: { id: string; tenant_id: string },
): Promise<void> {
  const chats = Array.isArray(data) ? data : [data];
  for (const chat of chats) {
    const c = chat as Record<string, unknown>;
    const jid = normalizeJid((c.id as string) || "");
    if (!jid || !isValidJid(jid)) continue;

    const isGroup = jid.endsWith("@g.us");
    // Para grupos: subject é o nome do grupo no payload chats.upsert/update
    const name = isGroup
      ? ((c.subject as string) || (c.name as string))
      : ((c.name as string) || null);

    const updateData: Record<string, unknown> = { is_group: isGroup };
    if (name) updateData.contact_name = name;

    await supabase
      .from("whatsapp_chats")
      .update(updateData)
      .eq("whatsapp_instance_id", instance.id)
      .eq("remote_jid", jid);
  }
}

// ── Main Handler ───────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // SEMPRE retornar 200 para Evolution não retentar
  try {
    const body = await req.json();
    console.log(`[webhook] event=${body.event} instance=${body.instance} data_len=${JSON.stringify(body.data || {}).length}`);

    const supabase = createClient(supabaseUrl, supabaseKey);

    const rawEvent: string = body.event || "";
    const event = rawEvent.toLowerCase().replace(/_/g, ".");
    const instanceName: string = body.instance || body.instanceName || body.sender || "";
    const data = body.data || body;

    if (!instanceName) {
      console.log("[webhook] sem nome de instância, ignorando");
      return new Response(JSON.stringify({ ok: true, skipped: "no instance name" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: instanceRow } = await supabase
      .from("whatsapp_instances")
      .select("id, evolution_url, evolution_api_key, tenant_id")
      .eq("instance_name", instanceName)
      .single();

    if (!instanceRow) {
      console.log(`[webhook] instância não encontrada: ${instanceName}`);
      return new Response(JSON.stringify({ ok: true, skipped: "instance not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const instance = {
      ...instanceRow,
      evolution_url: (instanceRow as Record<string, string>).evolution_url || "",
      evolution_api_key: (instanceRow as Record<string, string>).evolution_api_key || "",
      instance_name: instanceName,
    };

    if (event === "messages.upsert") {
      await handleMessagesUpsert(supabase, data, instance, instanceName);
    } else if (event === "messages.update" || event === "messages.edited") {
      await handleMessagesUpdate(supabase, data);
    } else if (event === "connection.update") {
      await handleConnectionUpdate(supabase, data, instance);
    } else if (event === "contacts.upsert" || event === "contacts.update") {
      await handleContacts(supabase, data, instance);
    } else if (event === "chats.upsert" || event === "chats.update") {
      await handleChats(supabase, data, instance);
    } else {
      console.log(`[webhook] evento ignorado: ${event}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[webhook] ERROR:", err);
    // SEMPRE 200 — Evolution não deve retentar
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
