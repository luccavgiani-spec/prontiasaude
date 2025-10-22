import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';
import { getCorsHeaders } from '../common/cors.ts';
import { validateCPF, cleanCPF } from '../common/cpf-validator.ts';

const corsHeaders = getCorsHeaders();

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

    // Verificar se usuário é admin OU company
    const { data: roleData } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'company'])
      .maybeSingle();

    if (!roleData) {
      throw new Error('Forbidden: Access denied');
    }

    const isAdmin = roleData.role === 'admin';
    const isCompany = roleData.role === 'company';

    const url = new URL(req.url);
    const path = url.pathname.split('/').filter(Boolean);
    
    // Ler operation do body para suportar invoke()
    let bodyData: any = {};
    if (req.method === 'POST' || req.method === 'PUT') {
      try {
        const text = await req.text();
        bodyData = text ? JSON.parse(text) : {};
      } catch {
        bodyData = {};
      }
    }
    
    const operation = bodyData.operation || path[path.length - 1];

    // ============= CONTROLES DE ACESSO POR OPERAÇÃO =============
    
    // Operações ADMIN-ONLY: criar empresas, listar empresas, atualizar empresas, resetar senhas
    const adminOnlyOps = ['create', 'list', 'reset-password'];
    const isAdminOnlyOp = adminOnlyOps.includes(operation) || (req.method === 'PUT' && !operation.includes('create-employee'));

    if (isAdminOnlyOp && !isAdmin) {
      throw new Error('Forbidden: Admin access required for this operation');
    }

    // Operação CREATE EMPLOYEE: permitir admin OU company (com validação de ownership)
    if (req.method === 'POST' && operation === 'create-employee') {
      if (!isAdmin && !isCompany) {
        throw new Error('Forbidden: Admin or Company access required');
      }
      
      // Se for company, validar que está criando funcionário para sua própria empresa
      if (isCompany) {
        const employeeData = await req.json();
        
        // Buscar company_id associado a este user_id
        const { data: companyCredential, error: credError } = await supabaseClient
          .from('company_credentials')
          .select('company_id')
          .eq('user_id', user.id)
          .single();
        
        if (credError || !companyCredential) {
          throw new Error('Forbidden: Company credentials not found');
        }
        
        if (companyCredential.company_id !== employeeData.company_id) {
          throw new Error('Forbidden: Can only create employees for your own company');
        }
        
        // IMPORTANTE: Re-stringificar o body para o handler poder ler novamente
        req = new Request(req.url, {
          method: req.method,
          headers: req.headers,
          body: JSON.stringify(employeeData)
        });
      }
    }

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

      // ✅ NOVO: Criar plano empresarial automaticamente
      const companyPlanCode = `EMPRESA_${company.razao_social.toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 30)}`;
      const planExpiryDate = new Date();
      planExpiryDate.setFullYear(planExpiryDate.getFullYear() + 100); // 100 anos (plano perpétuo)

      const { error: planError } = await supabaseClient
        .from('patient_plans')
        .insert({
          email: `empresa_${companyData.id}@prontiasaude.com.br`,
          plan_code: companyPlanCode,
          plan_expires_at: planExpiryDate.toISOString(),
          status: 'active',
          user_id: null,
        });

      if (planError) {
        console.error('[company-operations] Failed to create company plan:', planError.message);
        // Não bloqueia criação da empresa, apenas loga
      }

      console.log('[company-operations] Company plan created:', {
        company_id: companyData.id,
        plan_code: companyPlanCode,
        expires_at: planExpiryDate.toISOString()
      });

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

    // CREATE EMPLOYEE
    if (req.method === 'POST' && operation === 'create-employee') {
      const employeeData = bodyData;
      
      console.log('[company-operations] Creating employee for company:', employeeData.company_id);

      // Validações
      if (!employeeData.company_id || !employeeData.nome || !employeeData.cpf || !employeeData.email) {
        throw new Error('Missing required fields');
      }

      // Validate CPF format and checksum
      const cpfClean = cleanCPF(employeeData.cpf);
      if (!validateCPF(cpfClean)) {
        throw new Error('CPF inválido');
      }

      // Check for duplicate CPF
      const { data: existingEmployee, error: checkError } = await supabaseClient
        .from('company_employees')
        .select('id, nome')
        .eq('cpf', cpfClean)
        .maybeSingle();

      if (existingEmployee) {
        throw new Error(`CPF já cadastrado para ${existingEmployee.nome}`);
      }

      // Buscar empresa_id_externo, plano_id_externo E razao_social
      const { data: companyData, error: companyError } = await supabaseClient
        .from('companies')
        .select('empresa_id_externo, plano_id_externo, razao_social, id')
        .eq('id', employeeData.company_id)
        .single();

      if (companyError || !companyData) {
        throw new Error('Company not found');
      }

      // Gerar plan_code da empresa (mesmo padrão da criação)
      const companyPlanCode = `EMPRESA_${companyData.razao_social.toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 30)}`;

      // ✅ NOVO: Criar usuário Supabase Auth
      const tempPassword = crypto.randomUUID(); // Senha temporária aleatória
      const { data: authUser, error: authError } = await supabaseClient.auth.admin.createUser({
        email: employeeData.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: employeeData.nome,
          cpf: employeeData.cpf.replace(/\D/g, ''),
          company_id: employeeData.company_id,
          role: 'employee'
        }
      });

      if (authError || !authUser.user) {
        console.error('[company-operations] Auth user creation failed:', authError?.message);
        throw new Error(`Failed to create auth user: ${authError?.message}`);
      }

      // ✅ NOVO: Inserir funcionário com user_id (SEM senha)
      const { data: employee, error: employeeError } = await supabaseClient
        .from('company_employees')
        .insert({
          user_id: authUser.user.id,
          company_id: employeeData.company_id,
          nome: employeeData.nome,
          cpf: cpfClean,
          email: employeeData.email,
          telefone: employeeData.telefone,
          datanascimento: employeeData.datanascimento,
          sexo: employeeData.sexo,
          fotobase64: employeeData.fotobase64 || null,
          logradouro: employeeData.logradouro,
          numero: employeeData.numero,
          complemento: employeeData.complemento || null,
          bairro: employeeData.bairro,
          cep: employeeData.cep.replace(/\D/g, ''),
          cidade: employeeData.cidade,
          estado: employeeData.estado,
          empresa_id_externo: companyData.empresa_id_externo,
          plano_id_externo: companyData.plano_id_externo,
          has_active_plan: true,
        })
        .select()
        .single();

      if (employeeError) {
        // Rollback: deletar usuário Auth se inserção falhou
        await supabaseClient.auth.admin.deleteUser(authUser.user.id);
        console.error('[company-operations] Employee creation failed:', employeeError.message);
        throw new Error(`Failed to create employee: ${employeeError.message}`);
      }

      // ✅ NOVO: Criar patient record (para aparecer na /area-do-paciente)
      const { error: patientError } = await supabaseClient
        .from('patients')
        .upsert({
          id: authUser.user.id,
          first_name: employeeData.nome.split(' ')[0],
          last_name: employeeData.nome.split(' ').slice(1).join(' ') || '',
          cpf: cpfClean,
          phone_e164: employeeData.telefone,
          birth_date: employeeData.datanascimento,
          gender: employeeData.sexo === 'M' ? 'male' : 'female',
          cep: employeeData.cep.replace(/\D/g, ''),
          address_line: employeeData.logradouro,
          address_number: employeeData.numero,
          address_complement: employeeData.complemento || null,
          city: employeeData.cidade,
          state: employeeData.estado,
          source: 'empresa',
          profile_complete: true,
          intake_complete: false,
          terms_accepted_at: new Date().toISOString(),
        });

      if (patientError) {
        console.error('[company-operations] Patient creation failed:', patientError.message);
        // Não bloqueia, apenas loga
      }

      // ✅ NOVO: Vincular funcionário ao plano da empresa
      const planExpiryDate = new Date();
      planExpiryDate.setFullYear(planExpiryDate.getFullYear() + 100);

      const { error: planError } = await supabaseClient
        .from('patient_plans')
        .insert({
          email: employeeData.email,
          user_id: authUser.user.id,
          plan_code: companyPlanCode,
          plan_expires_at: planExpiryDate.toISOString(),
          status: 'active',
        });

      if (planError) {
        console.error('[company-operations] Failed to link employee to company plan:', planError.message);
        // Não bloqueia criação
      }

      // ✅ NOVO: Enviar email de redefinição de senha
      const { error: resetError } = await supabaseClient.auth.admin.generateLink({
        type: 'recovery',
        email: employeeData.email,
      });

      if (resetError) {
        console.error('[company-operations] Password reset email failed:', resetError.message);
      }

      console.log('[company-operations] Employee created successfully:', {
        employee_id: employee.id,
        user_id: authUser.user.id,
        plan_code: companyPlanCode
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          employee,
          message: 'Funcionário criado. Email de definição de senha enviado.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 }
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
    console.error('[company-operations] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
