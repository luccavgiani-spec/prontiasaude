import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';
import { getCorsHeaders } from '../common/cors.ts';

const corsHeaders = getCorsHeaders();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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
    const operation = url.searchParams.get('operation') || 'list';

    // LIST USERS
    if (operation === 'list') {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const search = url.searchParams.get('search') || '';
      const roleFilter = url.searchParams.get('role');
      const statusFilter = url.searchParams.get('status');
      const startDate = url.searchParams.get('start_date');
      const endDate = url.searchParams.get('end_date');
      
      console.log('[user-management] Listing users with filters:', { page, limit, search, roleFilter, statusFilter });

      // ========== NOVA ESTRATÉGIA: BUSCA SERVER-SIDE ==========
      let authUsers: any;
      let totalUsers = 0;

      if (search) {
        // Se há busca, buscar TODOS os usuários e filtrar
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
        
        // Buscar TODOS os pacientes
        const { data: allPatients } = await supabaseClient
          .from('patients')
          .select('*');
        
        // Filtrar por busca ANTES de paginar
        const searchLower = search.toLowerCase();
        const filtered = allUsers.filter(authUser => {
          const patient = allPatients?.find(p => p.id === authUser.id);
          return (
            authUser.email?.toLowerCase().includes(searchLower) ||
            patient?.first_name?.toLowerCase().includes(searchLower) ||
            patient?.last_name?.toLowerCase().includes(searchLower) ||
            patient?.cpf?.includes(search)
          );
        });
        
        totalUsers = filtered.length;
        
        // Aplicar paginação DEPOIS de filtrar
        const start = (page - 1) * limit;
        const end = start + limit;
        authUsers = { users: filtered.slice(start, end) };
        
      } else {
        // Sem busca: usar paginação normal
        const { data, error } = await supabaseClient.auth.admin.listUsers({
          page,
          perPage: limit,
        });
        
        if (error) throw error;
        
        authUsers = { users: data.users };
        totalUsers = data.users.length;
      }

      const userIds = authUsers.users.map((u: any) => u.id);

      // Get patient data
      const { data: patients } = await supabaseClient
        .from('patients')
        .select('*')
        .in('id', userIds);

      // Get roles
      const { data: roles } = await supabaseClient
        .from('user_roles')
        .select('*')
        .in('user_id', userIds);

      // Combine data
      const enrichedUsers = authUsers.users.map((authUser: any) => {
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

      // Apply role filter if needed
      let filteredUsers = enrichedUsers;
      if (roleFilter) {
        filteredUsers = filteredUsers.filter((u: any) => u.roles.includes(roleFilter));
      }

      return new Response(
        JSON.stringify({
          success: true,
          users: filteredUsers,
          pagination: {
            page,
            limit,
            total: totalUsers,
            hasMore: filteredUsers.length === limit,
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

    // UPDATE USER ROLE
    if (operation === 'update_role' && req.method === 'POST') {
      const { user_id, role, action } = await req.json();
      
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

    // DELETE USER
    if (operation === 'delete' && req.method === 'DELETE') {
      const userId = url.searchParams.get('user_id');
      if (!userId) throw new Error('user_id required');

      const { error } = await supabaseClient.auth.admin.deleteUser(userId);
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true }),
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
