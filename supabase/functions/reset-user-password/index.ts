const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    // Verify caller identity
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: authHeader, apikey: anonKey },
    });
    if (!userRes.ok) throw new Error("Não autenticado");
    const caller = await userRes.json();

    // Check admin role via REST
    const roleRes = await fetch(
      `${supabaseUrl}/rest/v1/user_roles?user_id=eq.${caller.id}&select=role`,
      { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } }
    );
    const roles = await roleRes.json();
    if (!roles?.length || roles[0].role !== "admin") {
      throw new Error("Apenas administradores podem redefinir senhas");
    }

    const { user_id, new_password } = await req.json();
    if (!user_id || !new_password) {
      throw new Error("Campos obrigatórios: user_id, new_password");
    }
    if (new_password.length < 6) {
      throw new Error("A senha deve ter no mínimo 6 caracteres");
    }
    if (user_id === caller.id) {
      throw new Error("Use a opção de alterar senha no seu perfil");
    }

    // Reset password using Supabase Admin API directly
    const updateRes = await fetch(`${supabaseUrl}/auth/v1/admin/users/${user_id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ password: new_password }),
    });

    if (!updateRes.ok) {
      const err = await updateRes.json();
      throw new Error(err.message || err.msg || "Erro ao redefinir senha");
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("reset-user-password error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
