import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Env vars têm prioridade sobre colunas da instância (evita SSL issues com IP interno)
const EVOLUTION_URL_OVERRIDE = Deno.env.get("EVOLUTION_API_URL") || "";
const EVOLUTION_KEY_OVERRIDE = Deno.env.get("EVOLUTION_API_KEY") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const respond = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return respond({ ok: false, error: "Unauthorized" }, 401);

  const supabase = createClient(supabaseUrl, supabaseKey);
  const token = authHeader.replace("Bearer ", "");

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return respond({ ok: false, error: "Unauthorized" }, 401);

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id, role")
    .eq("id", user.id)
    .single();

  if (!profile) return respond({ ok: false, error: "Profile not found" }, 403);
  if (!["admin", "manager"].includes(profile.role as string)) {
    return respond({ ok: false, error: "Forbidden: admin or manager required" }, 403);
  }

  const tenantId = profile.tenant_id as string;

  // ── Body ──────────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const instanceIdFilter = (body.instance_id as string) || null;

  // ── Buscar instâncias ─────────────────────────────────────────────────────
  let query = supabase
    .from("whatsapp_instances")
    .select("id, instance_name, evolution_url, evolution_api_key, status")
    .eq("tenant_id", tenantId);

  if (instanceIdFilter) {
    query = query.eq("id", instanceIdFilter);
  } else {
    query = query.eq("status", "connected");
  }

  const { data: instances, error: instError } = await query;
  if (instError || !instances) {
    console.error("[sync-groups] erro ao buscar instâncias:", instError);
    return respond({ ok: false, error: "Failed to fetch instances" });
  }

  // ── Processar cada instância ──────────────────────────────────────────────
  let instancesProcessed = 0;
  let groupsUpdated = 0;
  const errors: { instance_name: string; message: string }[] = [];

  for (const inst of instances) {
    const evoUrl = EVOLUTION_URL_OVERRIDE || (inst.evolution_url as string) || "";
    const evoKey = EVOLUTION_KEY_OVERRIDE || (inst.evolution_api_key as string) || "";
    const instanceName = inst.instance_name as string;

    if (!evoUrl || !evoKey) {
      errors.push({ instance_name: instanceName, message: "Evolution URL ou chave não configurados" });
      continue;
    }

    try {
      console.log(`[sync-groups] buscando grupos da instância ${instanceName}`);

      const res = await fetch(
        `${evoUrl}/group/fetchAllGroups/${instanceName}?getParticipants=false`,
        {
          method: "GET",
          headers: { apikey: evoKey },
          signal: AbortSignal.timeout(30000),
        }
      );

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const msg = `HTTP ${res.status}: ${text.slice(0, 120)}`;
        console.error(`[sync-groups] ${instanceName}: ${msg}`);
        errors.push({ instance_name: instanceName, message: msg });
        continue;
      }

      const groups = await res.json();
      if (!Array.isArray(groups)) {
        const msg = `Resposta inesperada da Evolution API: ${JSON.stringify(groups).slice(0, 80)}`;
        console.error(`[sync-groups] ${instanceName}: ${msg}`);
        errors.push({ instance_name: instanceName, message: msg });
        continue;
      }

      console.log(`[sync-groups] ${instanceName}: ${groups.length} grupos encontrados`);

      for (const group of groups) {
        const g = group as Record<string, unknown>;
        const jid = (g.id as string) || "";
        const subject = (g.subject as string) || "";
        const pictureUrl = (g.pictureUrl as string) || (g.profilePictureUrl as string) || null;

        if (!jid || !subject) continue;

        const updateData: Record<string, unknown> = { contact_name: subject };
        if (pictureUrl) {
          updateData.profile_pic_url = pictureUrl;
          updateData.profile_picture_url = pictureUrl;
        }

        // Nunca sobrescrever custom_name definido pelo usuário
        const { error: updateError } = await supabase
          .from("whatsapp_chats")
          .update(updateData)
          .eq("whatsapp_instance_id", inst.id)
          .eq("remote_jid", jid)
          .eq("is_group", true)
          .or("custom_name.is.null,custom_name.eq.");

        if (updateError) {
          console.error(`[sync-groups] erro ao atualizar ${jid}:`, updateError);
        } else {
          groupsUpdated++;
          console.log(`[sync-groups] atualizado: ${jid} → "${subject}"`);
        }
      }

      instancesProcessed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[sync-groups] erro na instância ${instanceName}:`, err);
      errors.push({ instance_name: instanceName, message });
    }
  }

  return respond({
    ok: true,
    instances_processed: instancesProcessed,
    groups_updated: groupsUpdated,
    errors,
  });
});
