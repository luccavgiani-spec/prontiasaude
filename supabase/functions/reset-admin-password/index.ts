import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email e senha são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Usar service role key para operações admin
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log(`[reset-admin-password] Processando para email: ${email}`);

    // 1. Buscar usuário por email usando listUsers com filtro
    let userId: string | null = null;
    let userFound = false;
    let page = 1;
    const perPage = 1000;

    // Iterar pelas páginas de usuários
    while (!userFound) {
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({
        page: page,
        perPage: perPage
      });
      
      if (listError) {
        console.error('[reset-admin-password] Erro ao listar usuários:', listError);
        return new Response(
          JSON.stringify({ error: 'Erro ao acessar auth.users', details: listError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[reset-admin-password] Página ${page}: ${users?.length || 0} usuários`);

      if (!users || users.length === 0) {
        break;
      }

      const existingUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (existingUser) {
        userId = existingUser.id;
        userFound = true;
        console.log(`[reset-admin-password] Usuário encontrado na página ${page}: ${userId}`);
      } else if (users.length < perPage) {
        // Última página
        break;
      } else {
        page++;
      }
    }

    if (userId) {
      // Usuário existe - atualizar senha
      console.log(`[reset-admin-password] Atualizando senha para user_id: ${userId}`);
      
      const { error: updateError } = await supabase.auth.admin.updateUserById(
        userId,
        { 
          password: password,
          email_confirm: true 
        }
      );

      if (updateError) {
        console.error('[reset-admin-password] Erro ao atualizar senha:', updateError);
        return new Response(
          JSON.stringify({ error: 'Erro ao atualizar senha', details: updateError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[reset-admin-password] Senha atualizada com sucesso`);
    } else {
      // Usuário não existe - tentar criar
      console.log(`[reset-admin-password] Usuário não encontrado. Tentando criar...`);
      
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
      });

      if (createError) {
        // Se erro é "email_exists", tentar buscar novamente e atualizar
        if (createError.message?.includes('already been registered') || createError.code === 'email_exists') {
          console.log('[reset-admin-password] Email já existe mas não foi encontrado na listagem. Buscando via SQL...');
          
          // Buscar diretamente via RPC ou query (não é possível via SDK padrão)
          // Alternativa: usar signInWithPassword para obter o user_id
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: email,
            password: 'senha_temporaria_que_vai_falhar_123456'
          });
          
          // Mesmo que falhe, a resposta pode ter info do usuário
          // Se não funcionar, precisamos de abordagem diferente
          
          // Como fallback, vamos criar o role admin mesmo assim baseado no email
          console.log('[reset-admin-password] Buscando paciente por email para obter user_id...');
          
          const { data: patient } = await supabase
            .from('patients')
            .select('user_id')
            .eq('email', email.toLowerCase())
            .not('user_id', 'is', null)
            .maybeSingle();
          
          if (patient?.user_id) {
            userId = patient.user_id;
            console.log(`[reset-admin-password] User_id encontrado via paciente: ${userId}`);
            
            // Tentar atualizar senha
            const { error: retryUpdateError } = await supabase.auth.admin.updateUserById(
              userId,
              { 
                password: password,
                email_confirm: true 
              }
            );
            
            if (retryUpdateError) {
              console.error('[reset-admin-password] Erro ao atualizar senha (retry):', retryUpdateError);
              return new Response(
                JSON.stringify({ error: 'Erro ao atualizar senha', details: retryUpdateError.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
            
            console.log('[reset-admin-password] Senha atualizada com sucesso via fallback');
          } else {
            return new Response(
              JSON.stringify({ error: 'Usuário existe mas não foi possível localizá-lo para atualizar a senha' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          console.error('[reset-admin-password] Erro ao criar usuário:', createError);
          return new Response(
            JSON.stringify({ error: 'Erro ao criar usuário', details: createError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else {
        userId = newUser.user.id;
        console.log(`[reset-admin-password] Usuário criado: ${userId}`);

        // Criar registro de paciente se não existir
        const { data: existingPatient } = await supabase
          .from('patients')
          .select('id')
          .eq('email', email.toLowerCase())
          .maybeSingle();

        if (!existingPatient) {
          await supabase
            .from('patients')
            .insert({
              user_id: userId,
              email: email.toLowerCase(),
              first_name: 'Admin',
              last_name: 'Suporte',
              profile_complete: true,
            });
          console.log('[reset-admin-password] Paciente criado');
        } else {
          await supabase
            .from('patients')
            .update({ user_id: userId })
            .eq('id', existingPatient.id);
          console.log('[reset-admin-password] Paciente vinculado');
        }
      }
    }

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Não foi possível processar o usuário' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Garantir que o usuário tem role admin
    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    if (!existingRole) {
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: 'admin',
        });

      if (roleError) {
        console.warn('[reset-admin-password] Erro ao criar role admin:', roleError);
      } else {
        console.log('[reset-admin-password] Role admin criada');
      }
    } else {
      console.log('[reset-admin-password] Role admin já existe');
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Admin ativado com sucesso',
        user_id: userId
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[reset-admin-password] Erro inesperado:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
