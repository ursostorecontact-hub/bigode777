import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autenticado");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) throw new Error("Não autenticado");

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check admin role
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .single();

    if (!roleData || roleData.role !== "admin") {
      throw new Error("Apenas administradores podem criar usuários");
    }

    // Get caller's tenant
    const { data: callerMembership } = await adminClient
      .from("tenant_members")
      .select("tenant_id")
      .eq("user_id", caller.id)
      .limit(1)
      .single();

    const { email, password, full_name, role } = await req.json();
    if (!email || !password || !full_name) {
      throw new Error("Campos obrigatórios: email, password, full_name");
    }

    // Create user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError) throw createError;
    if (!newUser.user) throw new Error("Erro ao criar usuário");

    const newUserId = newUser.user.id;

    // Update role if not default
    if (role && role !== "salesperson") {
      await adminClient
        .from("user_roles")
        .update({ role })
        .eq("user_id", newUserId);
    }

    // Associate new user with caller's tenant
    if (callerMembership?.tenant_id) {
      const tenantId = callerMembership.tenant_id;

      // Update profile tenant_id
      await adminClient
        .from("profiles")
        .update({ tenant_id: tenantId })
        .eq("id", newUserId);

      // Add to tenant_members
      await adminClient
        .from("tenant_members")
        .insert({
          tenant_id: tenantId,
          user_id: newUserId,
          role: "member",
        });
    }

    return new Response(JSON.stringify({ id: newUserId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("create-user error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
