import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EVOLUTION_API_URL_ENV = Deno.env.get("EVOLUTION_API_URL") || "";
const EVOLUTION_API_KEY_ENV = Deno.env.get("EVOLUTION_API_KEY") || "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate caller via their JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Não autorizado" }, 401);

    // Only admin/manager can delete instances
    const adminClient = createClient(supabaseUrl, serviceKey);
    const isAdmin = await adminClient.rpc("has_role", { _user_id: user.id, _role: "admin" });
    const isManager = await adminClient.rpc("has_role", { _user_id: user.id, _role: "manager" });
    if (!isAdmin.data && !isManager.data) {
      return json({ error: "Apenas administradores podem remover instâncias" }, 403);
    }

    const { instance_id } = await req.json();
    if (!instance_id) return json({ error: "instance_id é obrigatório" }, 400);

    // Fetch instance (scoped — admin can only delete from their tenant)
    const { data: profile } = await adminClient
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();
    const tenantId = profile?.tenant_id;

    const { data: instance, error: instErr } = await adminClient
      .from("whatsapp_instances")
      .select("id, instance_name, evolution_url, evolution_api_key, tenant_id")
      .eq("id", instance_id)
      .single();

    if (instErr || !instance) return json({ error: "Instância não encontrada" }, 404);

    // Enforce tenant scope (super_admin can delete any)
    const { data: isSuperAdmin } = await adminClient.rpc("is_super_admin", {});
    if (!isSuperAdmin && instance.tenant_id !== tenantId) {
      return json({ error: "Sem permissão para remover esta instância" }, 403);
    }

    console.log(`Deleting instance ${instance.instance_name} (${instance_id}) for tenant ${instance.tenant_id}`);

    const results: Record<string, unknown> = {};

    // ── Step 1: Delete leads created from this WhatsApp instance ──
    const { error: leadsErr, count: leadsDeleted } = await adminClient
      .from("leads")
      .delete({ count: "exact" })
      .eq("whatsapp_instance_id", instance_id);

    if (leadsErr) {
      console.error("Leads delete error (non-fatal):", leadsErr.message);
      results.leads_error = leadsErr.message;
    } else {
      results.leads_deleted = leadsDeleted ?? 0;
      console.log(`Deleted ${leadsDeleted} leads`);
    }

    // ── Step 2: Delete from Evolution API (best-effort, non-fatal) ──
    const evoUrl = instance.evolution_url || EVOLUTION_API_URL_ENV;
    const evoKey = instance.evolution_api_key || EVOLUTION_API_KEY_ENV;

    if (evoUrl && evoKey) {
      try {
        // Logout first (clears WhatsApp session)
        await fetch(`${evoUrl}/instance/logout/${instance.instance_name}`, {
          method: "DELETE",
          headers: { apikey: evoKey },
          signal: AbortSignal.timeout(8000),
        });
      } catch (e) {
        console.log("Logout error (non-fatal):", e);
      }

      try {
        const delRes = await fetch(`${evoUrl}/instance/delete/${instance.instance_name}`, {
          method: "DELETE",
          headers: { apikey: evoKey },
          signal: AbortSignal.timeout(10000),
        });
        results.evolution_deleted = delRes.ok;
        console.log(`Evolution API delete status: ${delRes.status}`);
      } catch (e: any) {
        console.error("Evolution delete error (non-fatal):", e.message);
        results.evolution_error = e.message;
      }
    } else {
      results.evolution_skipped = "No Evolution API credentials configured";
    }

    // ── Step 3: Delete instance from DB ──
    // FK CASCADE automatically removes: whatsapp_assignments, whatsapp_chats, whatsapp_messages
    const { error: deleteErr } = await adminClient
      .from("whatsapp_instances")
      .delete()
      .eq("id", instance_id);

    if (deleteErr) {
      console.error("Instance delete error:", deleteErr.message);
      return json({ error: `Erro ao deletar instância: ${deleteErr.message}` }, 500);
    }

    results.instance_deleted = true;
    console.log(`Instance ${instance.instance_name} fully deleted`);

    return json({ ok: true, ...results });
  } catch (err: any) {
    console.error("whatsapp-delete-instance error:", err.message);
    return json({ error: err.message }, 500);
  }
});
