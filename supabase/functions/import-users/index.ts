import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ImportUserPayload {
  email: string;
  encrypted_password: string | null;
  raw_user_meta_data?: Record<string, unknown>;
  email_confirmed_at?: string;
  created_at?: string;
}

interface ImportResult {
  email: string;
  status: "created" | "skipped" | "error";
  message: string;
  user_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify admin role from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("[import-users] Missing or invalid Authorization header");
      return new Response(JSON.stringify({ error: "Authorization header required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Cliente para validar o token do usuário (usa ANON_KEY + Authorization header)
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Validar o token do usuário
    const { data: { user: callingUser }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !callingUser) {
      console.error("[import-users] Auth error:", authError?.message);
      return new Response(JSON.stringify({ 
        error: "Invalid token", 
        details: authError?.message || "User not found" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[import-users] Authenticated user: ${callingUser.email} (${callingUser.id})`);

    // Cliente admin para operações privilegiadas (criar usuários, verificar roles, etc)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Check if user is admin usando o cliente admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id)
      .eq("role", "admin")
      .single();

    if (roleError || !roleData) {
      console.error("[import-users] Admin check failed:", roleError?.message);
      return new Response(JSON.stringify({ 
        error: "Admin access required",
        details: "User does not have admin role"
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[import-users] Admin verified: ${callingUser.email}`);

    const { users } = await req.json() as { users: ImportUserPayload[] };

    if (!users || !Array.isArray(users)) {
      return new Response(JSON.stringify({ error: "Invalid payload: users array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    console.log(`[import-users] Starting import of ${users.length} users`);

    const results: ImportResult[] = [];
    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of users) {
      try {
        // Check if email already exists in auth.users
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === user.email.toLowerCase());

        if (existingUser) {
          // User already exists - update patients.user_id if needed
          const { data: patient } = await supabaseAdmin
            .from("patients")
            .select("id, user_id")
            .eq("email", user.email.toLowerCase())
            .single();

          if (patient && !patient.user_id) {
            await supabaseAdmin
              .from("patients")
              .update({ user_id: existingUser.id })
              .eq("id", patient.id);

            results.push({
              email: user.email,
              status: "skipped",
              message: "Usuário já existe, patient.user_id atualizado",
              user_id: existingUser.id
            });
          } else {
            results.push({
              email: user.email,
              status: "skipped",
              message: "Usuário já existe em auth.users",
              user_id: existingUser.id
            });
          }
          skipped++;
          continue;
        }

        // Create user with preserved password hash
        const createUserData: {
          email: string;
          email_confirm: boolean;
          password?: string;
          password_hash?: string;
          user_metadata?: Record<string, unknown>;
        } = {
          email: user.email,
          email_confirm: true, // Auto-confirm since they were already confirmed
          user_metadata: user.raw_user_meta_data || {}
        };

        // If has encrypted_password (email/password user), use password_hash
        // If no encrypted_password (Google OAuth user), don't set password
        if (user.encrypted_password) {
          createUserData.password_hash = user.encrypted_password;
        } else {
          // For OAuth users, we need to set a random password (they won't use it)
          // They'll continue using Google OAuth to sign in
          const randomPassword = crypto.randomUUID() + "Aa1!";
          createUserData.password = randomPassword;
        }

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser(createUserData);

        if (createError) {
          console.error(`[import-users] Error creating user ${user.email}:`, createError);
          results.push({
            email: user.email,
            status: "error",
            message: createError.message
          });
          errors++;
          continue;
        }

        // Update patients.user_id
        const { data: patient } = await supabaseAdmin
          .from("patients")
          .select("id")
          .eq("email", user.email.toLowerCase())
          .single();

        if (patient) {
          await supabaseAdmin
            .from("patients")
            .update({ user_id: newUser.user.id })
            .eq("id", patient.id);
        }

        // Add user role
        await supabaseAdmin
          .from("user_roles")
          .insert({
            user_id: newUser.user.id,
            role: "user"
          });

        console.log(`[import-users] Created user ${user.email} with ID ${newUser.user.id}`);
        results.push({
          email: user.email,
          status: "created",
          message: user.encrypted_password ? "Criado com senha preservada" : "Criado (Google OAuth)",
          user_id: newUser.user.id
        });
        created++;

      } catch (err) {
        console.error(`[import-users] Error processing ${user.email}:`, err);
        results.push({
          email: user.email,
          status: "error",
          message: err instanceof Error ? err.message : "Unknown error"
        });
        errors++;
      }
    }

    console.log(`[import-users] Import complete: ${created} created, ${skipped} skipped, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          total: users.length,
          created,
          skipped,
          errors
        },
        results
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );

  } catch (error) {
    console.error("[import-users] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});
