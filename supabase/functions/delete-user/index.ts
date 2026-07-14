import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) return json({ error: "Não autenticado" }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check if caller is super_admin (query table directly — service_role has no auth.uid())
    const { data: callerSuperAdminRow } = await adminClient
      .from("super_admins")
      .select("id")
      .eq("email", caller.email!)
      .maybeSingle();
    const callerIsSuperAdmin = !!callerSuperAdminRow;

    // Only admin (or super_admin) can delete users
    if (!callerIsSuperAdmin) {
      const { data: callerRole } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", caller.id)
        .single();
      if (!callerRole || callerRole.role !== "admin") {
        return json({ error: "Apenas administradores podem remover usuários" }, 403);
      }
    }

    const { user_id } = await req.json();
    if (!user_id) return json({ error: "Campo obrigatório: user_id" }, 400);

    // No self-delete
    if (user_id === caller.id) {
      return json({ error: "Você não pode remover a si mesmo" }, 400);
    }

    // Get caller's tenant
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("tenant_id")
      .eq("id", caller.id)
      .single();

    // Get target's profile
    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("tenant_id")
      .eq("id", user_id)
      .single();
    if (!targetProfile) return json({ error: "Usuário não encontrado" }, 404);

    // Tenant scope: non-super_admin can only delete users from their own tenant
    if (!callerIsSuperAdmin && targetProfile.tenant_id !== callerProfile?.tenant_id) {
      return json({ error: "Você só pode remover usuários do seu tenant" }, 403);
    }

    // Prevent deleting a super_admin
    const { data: targetAuthResult } = await adminClient.auth.admin.getUserById(user_id);
    const targetEmail = targetAuthResult.user?.email;
    if (targetEmail) {
      const { data: targetSuperAdminRow } = await adminClient
        .from("super_admins")
        .select("id")
        .eq("email", targetEmail)
        .maybeSingle();
      if (targetSuperAdminRow) {
        return json({ error: "Não é possível remover um super administrador" }, 403);
      }
    }

    // Delete: profile and role first, then auth user
    await adminClient.from("user_roles").delete().eq("user_id", user_id);
    await adminClient.from("profiles").delete().eq("id", user_id);

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id);
    if (deleteError) throw deleteError;

    return json({ success: true });
  } catch (err: any) {
    console.error("delete-user error:", err.message);
    return json({ error: err.message }, 500);
  }
});
