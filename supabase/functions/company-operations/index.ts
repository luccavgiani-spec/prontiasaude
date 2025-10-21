import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CompanyData {
  razao_social: string;
  cnpj: string;
  cep: string;
  logradouro?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  numero?: string;
  complemento?: string;
  n_funcionarios: number;
  contato_nome?: string;
  contato_email?: string;
  contato_telefone?: string;
  status?: 'ATIVA' | 'INATIVA';
}

function generateTemporaryPassword(length: number = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
  let password = '';
  
  // Garantir pelo menos 1 maiúscula, 1 número, 1 especial
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
  password += '0123456789'[Math.floor(Math.random() * 10)];
  password += '!@#$%'[Math.floor(Math.random() * 5)];
  
  for (let i = 3; i < length; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
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
      .single();

    if (!roleData) {
      throw new Error('Forbidden: Admin access required');
    }

    const url = new URL(req.url);
    const path = url.pathname.split('/').filter(Boolean);
    const operation = path[path.length - 1];

    // CREATE COMPANY
    if (req.method === 'POST' && operation === 'create') {
      const body = await req.json();
      const { company, temporaryPassword } = body as { company: CompanyData; temporaryPassword?: string };

      // Gerar senha se não fornecida
      const password = temporaryPassword || generateTemporaryPassword(12);

      // Criar usuário no Supabase Auth
      const email = `${company.cnpj.replace(/\D/g, '')}@empresa.prontia.com`;
      const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          cnpj: company.cnpj,
          razao_social: company.razao_social,
        }
      });

      if (authError || !authData.user) {
        throw new Error(`Failed to create user: ${authError?.message}`);
      }

      // Criar registro na tabela companies
      const { data: companyData, error: companyError } = await supabaseClient
        .from('companies')
        .insert({
          ...company,
          created_by: user.id,
          updated_by: user.id,
        })
        .select()
        .single();

      if (companyError) {
        // Rollback: deletar usuário criado
        await supabaseClient.auth.admin.deleteUser(authData.user.id);
        throw new Error(`Failed to create company: ${companyError.message}`);
      }

      // Criar role 'company'
      const { error: roleError } = await supabaseClient
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: 'company',
        });

      if (roleError) {
        // Rollback
        await supabaseClient.from('companies').delete().eq('id', companyData.id);
        await supabaseClient.auth.admin.deleteUser(authData.user.id);
        throw new Error(`Failed to create role: ${roleError.message}`);
      }

      // Criar credentials
      const { error: credError } = await supabaseClient
        .from('company_credentials')
        .insert({
          company_id: companyData.id,
          user_id: authData.user.id,
          must_change_password: true,
        });

      if (credError) {
        // Rollback
        await supabaseClient.from('user_roles').delete().eq('user_id', authData.user.id);
        await supabaseClient.from('companies').delete().eq('id', companyData.id);
        await supabaseClient.auth.admin.deleteUser(authData.user.id);
        throw new Error(`Failed to create credentials: ${credError.message}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          company: companyData,
          credentials: {
            cnpj: company.cnpj,
            password,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }
      );
    }

    // LIST COMPANIES
    if (req.method === 'GET' && operation === 'list') {
      const page = parseInt(url.searchParams.get('page') || '1');
      const limit = parseInt(url.searchParams.get('limit') || '10');
      const search = url.searchParams.get('search') || '';
      const offset = (page - 1) * limit;

      let query = supabaseClient
        .from('companies')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (search) {
        query = query.or(`razao_social.ilike.%${search}%,cnpj.ilike.%${search}%`);
      }

      const { data, error, count } = await query;

      if (error) {
        throw new Error(`Failed to list companies: ${error.message}`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          companies: data,
          pagination: {
            page,
            limit,
            total: count || 0,
            pages: Math.ceil((count || 0) / limit),
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // UPDATE COMPANY
    if (req.method === 'PUT') {
      const companyId = path[path.length - 1];
      const updates = await req.json();

      const { data, error } = await supabaseClient
        .from('companies')
        .update({
          ...updates,
          updated_by: user.id,
        })
        .eq('id', companyId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update company: ${error.message}`);
      }

      return new Response(
        JSON.stringify({ success: true, company: data }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // RESET PASSWORD
    if (req.method === 'POST' && path[path.length - 1] === 'reset-password') {
      const companyId = path[path.length - 2];
      
      // Buscar credentials
      const { data: credData, error: credError } = await supabaseClient
        .from('company_credentials')
        .select('user_id')
        .eq('company_id', companyId)
        .single();

      if (credError || !credData) {
        throw new Error('Company credentials not found');
      }

      // Gerar nova senha
      const newPassword = generateTemporaryPassword(12);

      // Atualizar senha no Auth
      const { error: authError } = await supabaseClient.auth.admin.updateUserById(
        credData.user_id,
        { password: newPassword }
      );

      if (authError) {
        throw new Error(`Failed to reset password: ${authError.message}`);
      }

      // Atualizar flag must_change_password
      const { error: updateError } = await supabaseClient
        .from('company_credentials')
        .update({ must_change_password: true })
        .eq('company_id', companyId);

      if (updateError) {
        throw new Error(`Failed to update credentials: ${updateError.message}`);
      }

      // Buscar CNPJ da empresa
      const { data: companyData } = await supabaseClient
        .from('companies')
        .select('cnpj')
        .eq('id', companyId)
        .single();

      return new Response(
        JSON.stringify({
          success: true,
          credentials: {
            cnpj: companyData?.cnpj || '',
            password: newPassword,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid operation' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error) {
    console.error('Error in company-operations:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
