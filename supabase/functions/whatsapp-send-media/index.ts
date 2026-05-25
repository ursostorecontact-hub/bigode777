import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function getMediaType(mimeType: string): "image" | "video" | "audio" | "document" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

function getExtension(mimeType: string, filename?: string): string {
  if (filename) {
    const parts = filename.split(".");
    if (parts.length > 1) return parts.pop()!.toLowerCase();
  }
  const extMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/webm": "webm",
    "application/pdf": "pdf",
  };
  return extMap[mimeType] || "bin";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Não autorizado" }, 401);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Não autorizado" }, 401);

    const body = await req.json() as {
      chat_id: string;
      media_base64: string;
      mime_type: string;
      caption?: string;
      filename?: string;
    };

    const { chat_id, media_base64, mime_type, caption, filename } = body;

    if (!chat_id) return json({ error: "chat_id é obrigatório" }, 400);
    if (!media_base64) return json({ error: "media_base64 é obrigatório" }, 400);
    if (!mime_type) return json({ error: "mime_type é obrigatório" }, 400);

    // Buscar chat + instância
    const { data: chat, error: chatErr } = await supabase
      .from("whatsapp_chats")
      .select("*, whatsapp_instances(*)")
      .eq("id", chat_id)
      .single();

    if (chatErr || !chat) return json({ error: "Chat não encontrado" }, 404);

    // Verificar acesso
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const isAdmin = roleData?.role === "admin" || roleData?.role === "manager";
    if (!isAdmin && chat.assigned_to !== user.id) {
      return json({ error: "Sem permissão para enviar neste chat" }, 403);
    }

    const instance = chat.whatsapp_instances as Record<string, string>;
    const evoUrl: string = instance.evolution_url || "";
    const evoKey: string = instance.evolution_api_key || "";
    const instanceName: string = instance.instance_name || "";
    const number = (chat.remote_jid as string).replace("@s.whatsapp.net", "");

    const mediaType = getMediaType(mime_type);
    const ext = getExtension(mime_type, filename);
    const storagePath = `${mediaType}/${Date.now()}_${crypto.randomUUID()}.${ext}`;

    // Upload para o Storage
    const mediaBuffer = Uint8Array.from(atob(media_base64), (c) => c.charCodeAt(0));
    const { error: uploadErr } = await supabase.storage
      .from("whatsapp-media")
      .upload(storagePath, mediaBuffer, { contentType: mime_type, upsert: false });

    if (uploadErr) {
      console.error("[send-media] upload error:", uploadErr);
      return json({ error: `Erro no upload: ${uploadErr.message}` }, 500);
    }

    const { data: publicUrlData } = supabase.storage.from("whatsapp-media").getPublicUrl(storagePath);
    const mediaUrl = publicUrlData?.publicUrl || "";

    // Enviar via Evolution API
    let evoData: Record<string, unknown> = {};
    let messageId: string | null = null;

    try {
      if (mediaType === "audio") {
        const res = await fetch(`${evoUrl}/message/sendWhatsAppAudio/${instanceName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evoKey },
          body: JSON.stringify({ number, audio: mediaUrl }),
          signal: AbortSignal.timeout(20000),
        });
        evoData = await res.json() as Record<string, unknown>;
      } else {
        const res = await fetch(`${evoUrl}/message/sendMedia/${instanceName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evoKey },
          body: JSON.stringify({
            number,
            mediatype: mediaType,
            media: mediaUrl,
            caption: caption || "",
            fileName: filename || undefined,
          }),
          signal: AbortSignal.timeout(20000),
        });
        evoData = await res.json() as Record<string, unknown>;
      }
      const key = evoData?.key as Record<string, string> | undefined;
      messageId = key?.id || null;
    } catch (e) {
      console.error("[send-media] evolution error:", e);
      // Continuar: salvar mensagem mesmo que Evolution falheFailed
    }

    // Salvar mensagem no banco
    const contentLabel = caption || (
      mediaType === "audio" ? "🎵 Áudio"
        : mediaType === "image" ? "📷 Imagem"
          : mediaType === "video" ? "🎥 Vídeo"
            : `📄 ${filename || "Arquivo"}`
    );

    const { data: msg, error: msgErr } = await supabase
      .from("whatsapp_messages")
      .insert({
        chat_id,
        tenant_id: chat.tenant_id,
        from_me: true,
        remote_jid: chat.remote_jid,
        message_type: mediaType,
        content: contentLabel,
        media_url: mediaUrl,
        media_mime_type: mime_type,
        media_filename: filename || null,
        media_caption: caption || null,
        status: "sent",
        evolution_message_id: messageId,
      })
      .select()
      .single();

    if (msgErr) console.error("[send-media] insert error:", msgErr);

    // Atualizar chat
    await supabase
      .from("whatsapp_chats")
      .update({ last_message: contentLabel, last_message_at: new Date().toISOString(), unread_count: 0 })
      .eq("id", chat_id);

    return json({ ok: true, message: msg, media_url: mediaUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[send-media] ERROR:", message);
    return json({ error: message }, 500);
  }
});
