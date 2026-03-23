import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';
import { getCorsHeaders } from '../common/cors.ts';

// URLs fixas dos dois ambientes
const CLOUD_URL = "https://yrsjluhhnhxogdgnbnya.supabase.co";
const PRODUCTION_URL = "https://ploqujuhpwutpcibedbr.supabase.co";

Deno.serve(async (req) => {
  const requestOrigin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(requestOrigin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ===== CLIENTES PARA AMBOS OS AMBIENTES =====
    // SUPABASE_SERVICE_ROLE_KEY é auto-injetado pelo Supabase para o projeto atual (produção)
    const prodServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    // ORIGINAL_SUPABASE_SERVICE_ROLE_KEY = chave legada do Cloud (opcional)
    const cloudServiceKey = Deno.env.get('ORIGINAL_SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const cloudClient = createClient(CLOUD_URL, cloudServiceKey);
    const prodClient = createClient(PRODUCTION_URL, prodServiceKey);

    // Usar Produção como cliente principal para verificação de auth
    const supabaseClient = prodClient;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing Authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Verificar se usuário é admin
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      throw new Error('Forbidden: Admin access required');
    }

    const url = new URL(req.url);
    
    // ===== CRÍTICO: Ler body UMA ÚNICA VEZ e reutilizar =====
    let bodyData: Record<string, any> = {};
    if (req.method === 'POST') {
      const bodyText = await req.text();
      bodyData = bodyText ? JSON.parse(bodyText) : {};
      console.log('[user-management] Body parsed once:', JSON.stringify(bodyData));
    }
    
    // Ler parâmetros do BODY (se POST) ou QUERY (se GET)
    let operation = 'list';
    let page = 1;
    let limit = 50;
    let search = '';
    let roleFilter: string | undefined;
    
    if (req.method === 'POST') {
      operation = bodyData.operation || 'list';
      page = bodyData.page || 1;
      limit = bodyData.limit || 50;
      search = bodyData.search || '';
      roleFilter = bodyData.role;
    } else {
      operation = url.searchParams.get('operation') || 'list';
      page = parseInt(url.searchParams.get('page') || '1');
      limit = parseInt(url.searchParams.get('limit') || '50');
      search = url.searchParams.get('search') || '';
      roleFilter = url.searchParams.get('role') || undefined;
    }

    // LIST USERS
    if (operation === 'list') {
      console.log('[user-management] Listing users with filters:', { page, limit, search, roleFilter });

      // ========== BUSCAR TODOS OS USUÁRIOS COM PAGINAÇÃO INTERNA ==========
      const allUsers = [];
      let currentPage = 1;
      let hasMore = true;
      
      while (hasMore) {
        const { data: batch, error } = await supabaseClient.auth.admin.listUsers({
          page: currentPage,
          perPage: 1000,
        });
        
        if (error) throw error;
        
        allUsers.push(...batch.users);
        hasMore = batch.users.length === 1000;
        currentPage++;
      }
      
      console.log(`[user-management] Fetched ${allUsers.length} total users from auth`);
      
      // Buscar TODOS os pacientes e roles
      const userIds = allUsers.map((u: any) => u.id);

      const { data: patients } = await supabaseClient
        .from('patients')
        .select('*')
        .in('id', userIds);

      const { data: roles } = await supabaseClient
        .from('user_roles')
        .select('*')
        .in('user_id', userIds);

      // Enriquecer usuários
      const enrichedUsers = allUsers.map((authUser: any) => {
        const patient = patients?.find(p => p.id === authUser.id);
        const userRoles = roles?.filter(r => r.user_id === authUser.id).map(r => r.role) || [];

        return {
          id: authUser.id,
          email: authUser.email,
          created_at: authUser.created_at,
          last_sign_in_at: authUser.last_sign_in_at,
          email_confirmed_at: authUser.email_confirmed_at,
          phone: authUser.phone,
          roles: userRoles,
          patient: patient || null,
        };
      });

      // Aplicar filtros
      let filteredUsers = enrichedUsers;
      
      // Filtro de busca
      if (search) {
        const searchLower = search.toLowerCase();
        filteredUsers = filteredUsers.filter((u: any) => {
          return (
            u.email?.toLowerCase().includes(searchLower) ||
            u.patient?.first_name?.toLowerCase().includes(searchLower) ||
            u.patient?.last_name?.toLowerCase().includes(searchLower) ||
            u.patient?.cpf?.includes(search)
          );
        });
      }
      
      // Filtro de role
      if (roleFilter) {
        filteredUsers = filteredUsers.filter((u: any) => u.roles.includes(roleFilter));
      }

      const totalUsers = filteredUsers.length;
      
      // Aplicar paginação DEPOIS de filtrar
      const start = (page - 1) * limit;
      const end = start + limit;
      const paginatedUsers = filteredUsers.slice(start, end);
      
      console.log(`[user-management] Returning ${paginatedUsers.length} users (page ${page}, total ${totalUsers})`);

      return new Response(
        JSON.stringify({
          success: true,
          users: paginatedUsers,
          pagination: {
            page,
            limit,
            total: totalUsers,
            hasMore: end < totalUsers,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    // GET USER DETAILS
    if (operation === 'get' && req.method === 'GET') {
      const userId = url.searchParams.get('user_id');
      if (!userId) throw new Error('user_id required');

      const { data: authUser, error: authError } = await supabaseClient.auth.admin.getUserById(userId);
      if (authError) throw authError;

      const { data: patient } = await supabaseClient
        .from('patients')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      const { data: roles } = await supabaseClient
        .from('user_roles')
        .select('*')
        .eq('user_id', userId);

      return new Response(
        JSON.stringify({
          success: true,
          user: {
            ...authUser.user,
            patient,
            roles: roles?.map(r => r.role) || [],
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // UPDATE USER ROLE (usa bodyData já parseado)
    if (operation === 'update_role' && req.method === 'POST') {
      const { user_id, role, action } = bodyData;
      
      if (!user_id || !role || !action) {
        throw new Error('user_id, role e action são obrigatórios');
      }
      
      console.log('[user-management] Updating role:', { user_id, role, action });
      
      if (action === 'add') {
        const { error } = await supabaseClient
          .from('user_roles')
          .insert({ user_id, role });
        
        if (error) throw error;
      } else if (action === 'remove') {
        const { error } = await supabaseClient
          .from('user_roles')
          .delete()
          .eq('user_id', user_id)
          .eq('role', role);
        
        if (error) throw error;
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE USER (via DELETE method)
    if (operation === 'delete' && req.method === 'DELETE') {
      const userId = url.searchParams.get('user_id');
      if (!userId) throw new Error('user_id required');

      console.log('[user-management] Deleting user via DELETE:', userId);

      const { error } = await supabaseClient.auth.admin.deleteUser(userId);
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DELETE USER (via POST method - usa bodyData já parseado)
    // Deleta de AMBOS os ambientes (Cloud e Produção)
    if ((operation === 'delete_user' || operation === 'delete') && req.method === 'POST') {
      const userId = bodyData.user_id;
      const userEmail = bodyData.email; // Opcional: passar email para busca alternativa
      
      if (!userId && !userEmail) throw new Error('user_id or email required');

      console.log('[user-management] Deleting user from BOTH environments:', { userId, userEmail });
      
      let deletedCloud = false;
      let deletedProd = false;
      
      // ===== DELETAR DO CLOUD =====
      if (userId) {
        try {
          const { error: cloudError } = await cloudClient.auth.admin.deleteUser(userId);
          if (cloudError) {
            console.log('[user-management] Cloud delete error (may not exist):', cloudError.message);
          } else {
            deletedCloud = true;
            console.log('[user-management] ✅ Deleted from Cloud');
          }
        } catch (err: any) {
          console.log('[user-management] Cloud delete exception:', err.message);
        }
      }
      
      // ===== DELETAR DA PRODUÇÃO =====
      // Buscar user_id na produção pelo email, já que os IDs são diferentes
      if (userEmail && prodServiceKey) {
        try {
          // Listar usuários para encontrar pelo email
          const { data: prodUsers } = await prodClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const prodUser = prodUsers?.users?.find(u => u.email?.toLowerCase() === userEmail.toLowerCase());
          
          if (prodUser) {
            const { error: prodError } = await prodClient.auth.admin.deleteUser(prodUser.id);
            if (prodError) {
              console.log('[user-management] Production delete error:', prodError.message);
            } else {
              deletedProd = true;
              console.log('[user-management] ✅ Deleted from Production (id:', prodUser.id, ')');
            }
          } else {
            console.log('[user-management] User not found in Production by email');
          }
        } catch (err: any) {
          console.log('[user-management] Production delete exception:', err.message);
        }
      }
      
      // ===== DELETAR REGISTROS PATIENTS DE AMBOS =====
      if (userEmail) {
        try {
          await cloudClient.from('patients').delete().eq('email', userEmail);
          await cloudClient.from('patient_plans').delete().eq('email', userEmail);
          console.log('[user-management] ✅ Deleted patients/plans from Cloud');
        } catch (err: any) {
          console.log('[user-management] Cloud patients delete error:', err.message);
        }
        
        if (prodServiceKey) {
          try {
            await prodClient.from('patients').delete().eq('email', userEmail);
            await prodClient.from('patient_plans').delete().eq('email', userEmail);
            console.log('[user-management] ✅ Deleted patients/plans from Production');
          } catch (err: any) {
            console.log('[user-management] Production patients delete error:', err.message);
          }
        }
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          deletedCloud, 
          deletedProd,
          message: `Deleted from Cloud: ${deletedCloud}, Production: ${deletedProd}`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid operation' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    console.error('[user-management] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
