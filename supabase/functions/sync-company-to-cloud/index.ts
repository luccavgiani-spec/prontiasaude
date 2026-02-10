// ============================================
// SYNC-COMPANY-TO-CLOUD
// Cria empresa no Cloud (Auth user + tabelas) para sincronização
// Deploy: automático via Lovable Cloud
// ============================================

import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body = await req.json();
    const { email, password, company_data, cnpj } = body;

    if (!email || !password || !company_data || !cnpj) {
      return new Response(JSON.stringify({ error: 'Missing required fields: email, password, company_data, cnpj' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      });
    }

    console.log(`[sync-company-to-cloud] Starting sync for CNPJ: ${cnpj}`);

    // 1. Criar Auth user no Cloud
    let userId: string;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        cnpj,
        razao_social: company_data.razao_social,
      }
    });

    if (authError) {
      if (authError.message?.includes('already been registered') || (authError as any).code === 'email_exists') {
        console.log('[sync-company-to-cloud] Auth user already exists, fetching...');
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const existing = users?.find(u => u.email === email);
        if (!existing) throw new Error('User exists but could not be fetched');
        userId = existing.id;

        // Update password
        await supabase.auth.admin.updateUser(userId, { password });
        console.log('[sync-company-to-cloud] Password updated for existing user');
      } else {
        throw new Error(`Failed to create auth user: ${authError.message}`);
      }
    } else {
      userId = authData.user!.id;
      console.log('[sync-company-to-cloud] ✅ Auth user created:', userId);
    }

    // 2. Inserir na tabela companies (upsert by cnpj)
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('id')
      .eq('cnpj', cnpj)
      .maybeSingle();

    let companyId: string;

    if (existingCompany) {
      companyId = existingCompany.id;
      console.log('[sync-company-to-cloud] Company already exists in Cloud:', companyId);
    } else {
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({
          razao_social: company_data.razao_social,
          cnpj,
          cep: company_data.cep || null,
          logradouro: company_data.logradouro || null,
          bairro: company_data.bairro || null,
          cidade: company_data.cidade || null,
          uf: company_data.uf || null,
          numero: company_data.numero || null,
          complemento: company_data.complemento || null,
          n_funcionarios: company_data.n_funcionarios || 0,
          contato_nome: company_data.contato_nome || null,
          contato_email: company_data.contato_email || null,
          contato_telefone: company_data.contato_telefone || null,
          status: company_data.status || 'ATIVA',
        })
        .select('id')
        .single();

      if (companyError) throw new Error(`Failed to create company: ${companyError.message}`);
      companyId = newCompany.id;
      console.log('[sync-company-to-cloud] ✅ Company created:', companyId);
    }

    // 3. Inserir user_roles (ignorar se já existe)
    const { data: existingRole } = await supabase
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role', 'company')
      .maybeSingle();

    if (!existingRole) {
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role: 'company' });
      if (roleError) throw new Error(`Failed to create role: ${roleError.message}`);
      console.log('[sync-company-to-cloud] ✅ Role created');
    } else {
      console.log('[sync-company-to-cloud] Role already exists');
    }

    // 4. Inserir company_credentials (ignorar se já existe)
    const { data: existingCred } = await supabase
      .from('company_credentials')
      .select('id')
      .eq('company_id', companyId)
      .maybeSingle();

    if (!existingCred) {
      const { error: credError } = await supabase
        .from('company_credentials')
        .insert({
          company_id: companyId,
          user_id: userId,
          cnpj,
          must_change_password: true,
        });
      if (credError) throw new Error(`Failed to create credentials: ${credError.message}`);
      console.log('[sync-company-to-cloud] ✅ Credentials created');
    } else {
      console.log('[sync-company-to-cloud] Credentials already exist');
    }

    console.log('[sync-company-to-cloud] ✅ Sync complete!');

    return new Response(JSON.stringify({
      success: true,
      user_id: userId,
      company_id: companyId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error: any) {
    console.error('[sync-company-to-cloud] ❌ Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
