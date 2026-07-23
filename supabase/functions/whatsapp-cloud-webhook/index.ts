import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const cloudToken = Deno.env.get("WHATSAPP_CLOUD_TOKEN") || "";
const verifyToken = Deno.env.get("WHATSAPP_CLOUD_VERIFY_TOKEN") || "";
const GRAPH_API = "https://graph.facebook.com/v20.0";

interface MediaResult {
  url: string | null;
  mimeType: string | null;
}

// Baixa mídia da Cloud API oficial: primeiro pega uma URL temporária pelo ID
// da mídia, depois baixa o arquivo em si (os dois passos exigem o mesmo
// token de acesso), e por fim salva no nosso storage — igual já fazemos
// pro WhatsApp não-oficial, só que essa é a rota oficial da Meta.
async function downloadAndStoreCloudMedia(
  supabase: ReturnType<typeof createClient>,
  mediaId: string,
  tenantId: string,
  hintMimeType?: string,
): Promise<MediaResult> {
  try {
    const metaRes = await fetch(`${GRAPH_API}/${mediaId}`, {
      headers: { Authorization: `Bearer ${cloudToken}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!metaRes.ok) {
      console.log(`[cloud-webhook] mídia metadata falhou ${metaRes.status} para ${mediaId}`);
      return { url: null, mimeType: null };
    }
    const meta = await metaRes.json();
    const fileUrl: string | undefined = meta?.url;
    const mimetype: string = (meta?.mime_type || hintMimeType || "application/octet-stream").split(";")[0].trim();
    if (!fileUrl) return { url: null, mimeType: null };

    const fileRes = await fetch(fileUrl, {
      headers: { Authorization: `Bearer ${cloudToken}` },
      signal: AbortSignal.timeout(20000),
    });
    if (!fileRes.ok) {
      console.log(`[cloud-webhook] download do arquivo falhou ${fileRes.status} para ${mediaId}`);
      return { url: null, mimeType: mimetype };
    }
    const arrayBuffer = await fileRes.arrayBuffer();

    const extMap: Record<string, string> = {
      "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac",
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
      "video/mp4": "mp4",
      "application/pdf": "pdf",
    };
    const ext = extMap[mimetype] || mimetype.split("/").pop() || "bin";
    const filePath = `cloud-webhook/${tenantId}/${Date.now()}_${mediaId.slice(-8)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("whatsapp-media")
      .upload(filePath, arrayBuffer, { contentType: mimetype, upsert: true });

    if (uploadError) {
      console.error("[cloud-webhook] upload error:", uploadError);
      return { url: null, mimeType: mimetype };
    }

    const { data: publicUrlData } = supabase.storage.from("whatsapp-media").getPublicUrl(filePath);
    return { url: publicUrlData?.publicUrl || null, mimeType: mimetype };
  } catch (err) {
    console.error(`[cloud-webhook] downloadAndStoreCloudMedia erro para ${mediaId}:`, err);
    return { url: null, mimeType: null };
  }
}

// A origem do anúncio (click-to-WhatsApp) vem oficialmente no campo "referral"
// da mensagem — muito mais confiável que tentar adivinhar, já que é a própria
// Meta quem manda essa informação.
function labelFromCloudReferral(referral: Record<string, unknown> | undefined): string | null {
  if (!referral) return null;
  const sourceUrl = ((referral.source_url as string) || "").toLowerCase();
  if (sourceUrl.includes("instagram")) return "Instagram Ads";
  if (sourceUrl.includes("facebook") || sourceUrl.includes("fb.")) return "Facebook Ads";
  return "Anúncio (Meta)";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // ── Verificação do webhook (handshake exigido pela Meta) ─────────────────
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === verifyToken) {
      return new Response(challenge || "", { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  // SEMPRE retornar 200 pra Meta não ficar retentando
  try {
    const body = await req.json();
    console.log("[cloud-webhook] payload recebido:", JSON.stringify(body).slice(0, 2000));
    const supabase = createClient(supabaseUrl, supabaseKey);

    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value || {};
        const phoneNumberId: string = value.metadata?.phone_number_id || "";
        if (!phoneNumberId) continue;

        const { data: instanceRow } = await supabase
          .from("whatsapp_instances")
          .select("id, tenant_id, instance_name")
          .eq("cloud_phone_number_id", phoneNumberId)
          .eq("provider", "cloud_api")
          .maybeSingle();

        if (!instanceRow) {
          console.log(`[cloud-webhook] instância não encontrada pro phone_number_id=${phoneNumberId}`);
          continue;
        }

        // Atualiza status de mensagens já enviadas (sent/delivered/read/failed)
        const statuses = value.statuses || [];
        for (const st of statuses) {
          const statusMap: Record<string, string> = {
            sent: "sent", delivered: "delivered", read: "read", failed: "failed",
          };
          const newStatus = statusMap[st.status] || "sent";
          await supabase.from("whatsapp_messages").update({ status: newStatus }).eq("evolution_message_id", st.id);
        }

        // Mensagens recebidas
        const messages = value.messages || [];
        const contacts = value.contacts || [];
        for (const msg of messages) {
          const waId: string = msg.from;
          const messageId: string = msg.id;
          const contactPhone = waId;
          const remoteJid = `${waId}@s.whatsapp.net`;
          const pushName = contacts.find((c: Record<string, unknown>) => c.wa_id === waId)?.profile?.name || null;

          console.log(`[cloud-webhook] msg: from=${waId} type=${msg.type} id=${messageId}`);

          let content = "";
          let messageType = "text";
          let needsMedia = false;
          let mediaId: string | null = null;
          let hintMimeType: string | undefined;
          let mediaCaption: string | null = null;
          let mediaFilename: string | null = null;

          if (msg.type === "text") {
            content = msg.text?.body || "";
          } else if (msg.type === "image") {
            messageType = "image";
            mediaId = msg.image?.id;
            mediaCaption = msg.image?.caption || null;
            content = mediaCaption || "📷 Imagem";
            needsMedia = true;
            hintMimeType = msg.image?.mime_type;
          } else if (msg.type === "video") {
            messageType = "video";
            mediaId = msg.video?.id;
            mediaCaption = msg.video?.caption || null;
            content = mediaCaption || "🎥 Vídeo";
            needsMedia = true;
            hintMimeType = msg.video?.mime_type;
          } else if (msg.type === "audio") {
            messageType = "audio";
            mediaId = msg.audio?.id;
            content = "🎵 Áudio";
            needsMedia = true;
            hintMimeType = msg.audio?.mime_type;
          } else if (msg.type === "document") {
            messageType = "document";
            mediaId = msg.document?.id;
            mediaFilename = msg.document?.filename || null;
            mediaCaption = msg.document?.caption || null;
            content = mediaFilename || mediaCaption || "📄 Documento";
            needsMedia = true;
            hintMimeType = msg.document?.mime_type;
          } else if (msg.type === "sticker") {
            messageType = "sticker";
            mediaId = msg.sticker?.id;
            content = "🎨 Sticker";
            needsMedia = true;
            hintMimeType = msg.sticker?.mime_type;
          } else if (msg.type === "location") {
            messageType = "location";
            content = JSON.stringify({
              lat: msg.location?.latitude,
              lng: msg.location?.longitude,
              name: msg.location?.name || null,
            });
          } else {
            messageType = "unsupported";
            content = "Mensagem não suportada";
          }

          let mediaUrl: string | null = null;
          let mediaMimeType: string | null = null;
          if (needsMedia && mediaId) {
            const result = await downloadAndStoreCloudMedia(supabase, mediaId, instanceRow.tenant_id, hintMimeType);
            mediaUrl = result.url;
            mediaMimeType = result.mimeType;
          }

          // Detecta se essa conversa é nova, pra saber se precisa criar lead
          // sem dono (Fila de Leads) — mesma regra do WhatsApp não-oficial.
          const { data: existingChatCheck } = await supabase
            .from("whatsapp_chats")
            .select("id")
            .eq("whatsapp_instance_id", instanceRow.id)
            .eq("remote_jid", remoteJid)
            .maybeSingle();
          const isNewChat = !existingChatCheck;

          // Origem oficial do anúncio (click-to-WhatsApp), direto da Meta.
          const referral = msg.referral as Record<string, unknown> | undefined;
          const adLabel = labelFromCloudReferral(referral);

          const previewText = messageType === "location" ? "📍 Localização" : content;

          const upsertData: Record<string, unknown> = {
            whatsapp_instance_id: instanceRow.id,
            remote_jid: remoteJid,
            contact_phone: contactPhone,
            last_message: previewText,
            last_message_at: new Date().toISOString(),
            tenant_id: instanceRow.tenant_id,
            is_group: false,
            contact_name: pushName || contactPhone,
          };
          if (pushName) upsertData.push_name = pushName;
          if (referral && isNewChat) {
            upsertData.ad_title = (referral.headline as string) || null;
            upsertData.ad_source_url = (referral.source_url as string) || null;
          }

          const { data: chat, error: chatError } = await supabase
            .from("whatsapp_chats")
            .upsert(upsertData, { onConflict: "whatsapp_instance_id,remote_jid" })
            .select()
            .single();

          let targetChat = chat;
          if (chatError) {
            console.error("[cloud-webhook] chat upsert error:", chatError);
            const { data: existing } = await supabase
              .from("whatsapp_chats")
              .select("*")
              .eq("whatsapp_instance_id", instanceRow.id)
              .eq("remote_jid", remoteJid)
              .single();
            targetChat = existing;
          }
          if (!targetChat) {
            console.error("[cloud-webhook] não foi possível obter chat para", remoteJid);
            continue;
          }
          const chatId = targetChat.id as string;

          // Conversa nova: cria lead sem dono pra cair na Fila de Leads.
          if (isNewChat) {
            const { data: newLead } = await supabase
              .from("leads")
              .insert({
                name: pushName || contactPhone,
                phone: contactPhone,
                source: adLabel,
                ad_title: (referral?.headline as string) || null,
                ad_source_url: (referral?.source_url as string) || null,
                status: "novo",
                pipeline_stage: "novo",
                tenant_id: instanceRow.tenant_id,
                assigned_to: null,
              })
              .select("id")
              .single();

            if (newLead) {
              // Avisa quem estiver com a Fila de Leads aberta (fire-and-forget)
              fetch(`${supabaseUrl}/functions/v1/whatsapp-auto-setup`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseKey}` },
                body: JSON.stringify({ lead_id: newLead.id, internal: true, tenantId: instanceRow.tenant_id }),
              }).catch(() => {});
            }
          }

          const { error: msgError } = await supabase.from("whatsapp_messages").insert({
            chat_id: chatId,
            from_me: false,
            remote_jid: remoteJid,
            message_type: messageType,
            content,
            media_url: mediaUrl,
            media_mime_type: mediaMimeType,
            media_filename: mediaFilename,
            media_caption: mediaCaption,
            status: "received",
            evolution_message_id: messageId,
            tenant_id: instanceRow.tenant_id,
          });
          if (msgError) console.error("[cloud-webhook] insert message error:", msgError);

          if (!msgError) {
            fetch(`${supabaseUrl}/functions/v1/ai-sales-agent`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseKey}` },
              body: JSON.stringify({ chatId, tenantId: instanceRow.tenant_id, trigger_type: "auto", internal: true }),
            }).catch(() => {});
          }
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[cloud-webhook] ERROR:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
