import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EVOLUTION_SERVER_URL_OVERRIDE = Deno.env.get("EVOLUTION_SERVER_URL") || "";
function evoServerUrl(instanceUrl: string): string {
  return EVOLUTION_SERVER_URL_OVERRIDE || instanceUrl;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user is admin
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anonClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find messages with inaccessible media URLs:
    // - WhatsApp CDN URLs (mmg.whatsapp.net) — expire after a few days
    // - localhost/internal URLs — not accessible from the browser
    // - null media_url on media messages — media was never stored
    const { data: messages, error } = await supabase
      .from("whatsapp_messages")
      .select("id, evolution_message_id, message_type, media_url, chat_id")
      .in("message_type", ["audio", "image", "video", "document", "sticker"])
      .or(
        "media_url.is.null," +
        "media_url.like.%whatsapp.net%," +
        "media_url.like.%localhost%," +
        "media_url.like.%127.0.0.1%"
      )
      .not("evolution_message_id", "is", null)
      .limit(100);

    if (error) throw error;

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ ok: true, fixed: 0, message: "No expired media found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get instance info for each chat
    const chatIds = [...new Set(messages.map((m) => m.chat_id))];
    const { data: chats } = await supabase
      .from("whatsapp_chats")
      .select("id, whatsapp_instance_id")
      .in("id", chatIds);

    const instanceIds = [...new Set((chats || []).map((c) => c.whatsapp_instance_id))];
    const { data: instances } = await supabase
      .from("whatsapp_instances")
      .select("id, evolution_url, evolution_api_key, instance_name")
      .in("id", instanceIds);

    const instanceMap = new Map((instances || []).map((i) => [i.id, i]));
    const chatInstanceMap = new Map((chats || []).map((c) => [c.id, c.whatsapp_instance_id]));

    let fixed = 0;
    let failed = 0;

    const extMap: Record<string, string> = {
      "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a",
      "audio/aac": "aac", "audio/opus": "opus",
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
      "video/mp4": "mp4", "application/pdf": "pdf",
    };

    for (const msg of messages) {
      const instanceId = chatInstanceMap.get(msg.chat_id);
      const instance = instanceId ? instanceMap.get(instanceId) : null;
      if (!instance || !msg.evolution_message_id) {
        failed++;
        continue;
      }

      try {
        const mediaRes = await fetch(
          `${evoServerUrl(instance.evolution_url)}/chat/getBase64FromMediaMessage/${instance.instance_name}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: instance.evolution_api_key },
            body: JSON.stringify({ message: { key: { id: msg.evolution_message_id } } }),
          }
        );

        if (!mediaRes.ok) { failed++; continue; }

        const mediaData = await mediaRes.json();
        const base64 = mediaData?.base64;
        const mimetype = mediaData?.mimetype || `${msg.message_type}/*`;

        if (!base64) { failed++; continue; }

        const ext = extMap[mimetype] || msg.message_type;
        const filePath = `resync/${Date.now()}_${msg.evolution_message_id.slice(-8)}.${ext}`;

        const binaryStr = atob(base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) {
          bytes[i] = binaryStr.charCodeAt(i);
        }

        const { error: uploadError } = await supabase.storage
          .from("whatsapp-media")
          .upload(filePath, bytes.buffer, { contentType: mimetype, upsert: true });

        if (uploadError) { failed++; continue; }

        const { data: publicUrl } = supabase.storage
          .from("whatsapp-media")
          .getPublicUrl(filePath);

        if (publicUrl?.publicUrl) {
          await supabase
            .from("whatsapp_messages")
            .update({ media_url: publicUrl.publicUrl })
            .eq("id", msg.id);
          fixed++;
        }
      } catch {
        failed++;
      }
    }

    return new Response(JSON.stringify({ ok: true, fixed, failed, total: messages.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
