import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';
import { getCorsHeaders } from '../common/cors.ts';
import { validateCPF, cleanCPF } from '../common/cpf-validator.ts';

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
  const requestOrigin = req.headers.get('Origin');
  const corsHeaders = getCorsHeaders(requestOrigin);
  
  const requestId = crypto.randomUUID().slice(0, 8);
  console.log(`[${requestId}] ⬇️ Request received:`, {
    method: req.method,
    url: req.url,
    origin: requestOrigin,
    headers: {
      authorization: req.headers.get('Authorization') ? '✅ Present' : '❌ Missing',
      contentType: req.headers.get('Content-Type')
    }
  });

  if (req.method === 'OPTIONS') {
    console.log(`[${requestId}] ✅ CORS preflight handled`);
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

    // Operação ACTIVATE-EMPLOYEE-PLAN não exige role específica, apenas autenticação
    const publicAuthOps = ['activate-employee-plan'];
    const isPublicAuthOp = publicAuthOps.includes(operation);

    // Verificar se usuário é admin OU company (apenas se não for operação pública)
    let isAdmin = false;
    let isCompany = false;
    
    if (!isPublicAuthOp) {
      const { data: roleData } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'company'])
        .maybeSingle();

      if (!roleData) {
        throw new Error('Forbidden: Access denied');
      }

      isAdmin = roleData.role === 'admin';
      isCompany = roleData.role === 'company';
    }

    // ============= CONTROLES DE ACESSO POR OPERAÇÃO =============
    
    // Operações ADMIN-ONLY: criar empresas, listar empresas, atualizar empresas, resetar senhas
    const adminOnlyOps = ['create', 'list', 'reset-password'];
    const isAdminOnlyOp = adminOnlyOps.includes(operation) || (req.method === 'PUT' && !operation.includes('create-employee') && !operation.includes('invite-employee'));

    if (isAdminOnlyOp && !isAdmin) {
      throw new Error('Forbidden: Admin access required for this operation');
    }

    // Operação INVITE EMPLOYEE: permitir admin OU company (com validação de ownership)
    if (req.method === 'POST' && operation === 'invite-employee') {
      console.log('[invite-employee] Starting invitation process', { 
        company_id: bodyData.company_id, 
        email: bodyData.email 
      });
      
      if (!isAdmin && !isCompany) {
        throw new Error('Forbidden: Admin or Company access required');
      }
      
      // Se for company, validar que está criando funcionário para sua própria empresa
      if (isCompany) {
        const { data: companyCredential, error: credError } = await supabaseClient
          .from('company_credentials')
          .select('company_id')
          .eq('user_id', user.id)
          .single();
        
        if (credError || !companyCredential) {
          throw new Error('Forbidden: Company credentials not found');
        }
        
        if (companyCredential.company_id !== bodyData.company_id) {
          throw new Error('Forbidden: Can only invite employees for your own company');
        }
      }

      const { company_id, email } = bodyData;
      
      if (!company_id || !email) {
        return new Response(JSON.stringify({ 
          error: 'Missing required fields: company_id, email',
          code: 'MISSING_FIELDS'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        });
      }
      
      // Verificar se empresa existe
      const { data: company, error: companyError } = await supabaseClient
        .from('companies')
        .select('id, razao_social, plano_id_externo, empresa_id_externo')
        .eq('id', company_id)
        .single();
        
      if (companyError || !company) {
        return new Response(JSON.stringify({ 
          error: 'Company not found',
          code: 'COMPANY_NOT_FOUND'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        });
      }
      
      console.log('[invite-employee] Company found:', company.razao_social);
      
      // ✅ PERMITIR CONVITES PARA USUÁRIOS EXISTENTES (Opção B)
      // O fluxo de /completar-perfil vai vincular usuários existentes à empresa
      console.log('[invite-employee] Processing invite for:', email);
      
      // Verificar se já existe convite
      let { data: existingInvite, error: inviteCheckError } = await supabaseClient
        .from('pending_employee_invites')
        .select('id, status, token')
        .eq('company_id', company_id)
        .eq('email', email)
        .maybeSingle();
      
      let invite: any;
      let invite_token: string;
      
      // CENÁRIO 1: Convite cancelado ou expirado → DELETAR e criar novo
      if (existingInvite && ['cancelled', 'expired'].includes(existingInvite.status)) {
        console.log(`[invite-employee] Deleting old ${existingInvite.status} invite and creating new one for:`, email);
        
        const { error: deleteError } = await supabaseClient
          .from('pending_employee_invites')
          .delete()
          .eq('id', existingInvite.id);
        
        if (deleteError) {
          console.error('[invite-employee] Error deleting old invite:', deleteError);
          return new Response(JSON.stringify({ 
            error: 'Erro ao remover convite anterior',
            code: 'DELETE_ERROR',
            details: deleteError.message
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          });
        }
        
        console.log('[invite-employee] ✅ Old invite deleted, will create new one');
        existingInvite = null; // Resetar para criar novo convite
        
      // CENÁRIO 2: Convite pendente → ERRO
      } else if (existingInvite && existingInvite.status === 'pending') {
        console.log('[invite-employee] Pending invite already exists:', email);
        return new Response(JSON.stringify({ 
          error: 'Já existe um convite pendente para este email. Use a opção "Reenviar" na tabela.',
          code: 'INVITE_PENDING'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409
        });
        
      // CENÁRIO 3: Convite completado → ERRO
      } else if (existingInvite && existingInvite.status === 'completed') {
        console.log('[invite-employee] Employee already registered:', email);
        return new Response(JSON.stringify({ 
          error: 'Este funcionário já completou o cadastro. Verifique a aba "Funcionários".',
          code: 'EMPLOYEE_REGISTERED'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 409
        });
        
      // CENÁRIO 4: Sem convite → CRIAR NOVO
      } else {
        console.log('[invite-employee] Creating new invite for:', email);
        
        invite_token = crypto.randomUUID();
        
        const { data: newInvite, error: inviteError } = await supabaseClient
          .from('pending_employee_invites')
          .insert({
            company_id,
            email,
            token: invite_token,
            status: 'pending',
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          })
          .select()
          .single();
          
        if (inviteError) {
          console.error('[invite-employee] Error inserting invite:', inviteError);
          return new Response(JSON.stringify({ 
            error: 'Erro ao criar convite',
            code: 'INSERT_ERROR',
            details: inviteError.message
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500
          });
        }
        
        invite = newInvite;
        console.log('[invite-employee] ✅ New invite created successfully');
      }
      
      console.log('[invite-employee] Invite created successfully, sending email...');
      
      // Enviar email
      const inviteLink = `https://prontiasaude.com.br/completar-perfil?token=${invite?.token || invite_token}`;
      
      try {
        const emailResult = await supabaseClient.functions.invoke('send-form-emails', {
          body: {
            type: 'employee-invite',
            data: {
              email,
              companyName: company.razao_social,
              inviteLink: inviteLink
            }
          }
        });
        
        if (emailResult.error) {
          console.error('[invite-employee] Email failed:', emailResult.error);
        } else {
          console.log('[invite-employee] ✅ Invite email sent successfully');
        }
      } catch (emailError) {
        console.error('[invite-employee] Exception sending email:', emailError);
      }
      
      console.log('[invite-employee] ✅ Process completed successfully for:', email);
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Convite enviado com sucesso',
        invite 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201
      });
    }

    // Operação RESEND INVITE: permitir admin OU company (com validação de ownership)
    if (req.method === 'POST' && operation === 'resend-invite') {
      const { invite_id } = bodyData;
      
      if (!invite_id) {
        throw new Error('Missing required field: invite_id');
      }
      
      // Buscar convite
      const { data: invite, error: fetchError } = await supabaseClient
        .from('pending_employee_invites')
        .select(`
          *,
          companies (razao_social)
        `)
        .eq('id', invite_id)
        .single();
        
      if (fetchError || !invite) {
        throw new Error('Convite não encontrado');
      }
      
      // Verificar propriedade (empresa só pode reenviar seus próprios convites)
      if (isCompany) {
        const { data: companyData } = await supabaseClient
          .from('company_credentials')
          .select('company_id')
          .eq('user_id', user.id)
          .single();
          
        if (companyData?.company_id !== invite.company_id) {
          throw new Error('Não autorizado');
        }
      }
      
      // Reenviar email
      const inviteLink = `https://prontiasaude.com.br/completar-perfil?token=${invite.token}`;
      const companyName = (invite.companies as any)?.razao_social || 'Empresa';
      
      try {
        await supabaseClient.functions.invoke('send-form-emails', {
          body: {
            type: 'employee-invite',
            data: {
              email: invite.email,
              empresa: companyName,
              invite_link: inviteLink
            }
          }
        });
        
        console.log('[resend-invite] ✅ Invite resent successfully');
      } catch (emailError) {
        console.error('[resend-invite] Email error:', emailError);
        throw new Error('Erro ao reenviar convite');
      }
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Operação EXTEND INVITE: permitir admin OU company (com validação de ownership)
    if (req.method === 'POST' && operation === 'extend-invite') {
      const { invite_id, days = 7 } = bodyData;
      
      if (!invite_id) {
        throw new Error('Missing required field: invite_id');
      }
      
      // Verificar propriedade
      const { data: invite } = await supabaseClient
        .from('pending_employee_invites')
        .select('company_id')
        .eq('id', invite_id)
        .single();
      
      if (isCompany) {
        const { data: companyData } = await supabaseClient
          .from('company_credentials')
          .select('company_id')
          .eq('user_id', user.id)
          .single();
          
        if (companyData?.company_id !== invite?.company_id) {
          throw new Error('Não autorizado');
        }
      }
      
      // Calcular nova data
      const newExpiryDate = new Date();
      newExpiryDate.setDate(newExpiryDate.getDate() + days);
      
      const { error } = await supabaseClient
        .from('pending_employee_invites')
        .update({
          expires_at: newExpiryDate.toISOString(),
          status: 'pending' // Reativar se estava expirado
        })
        .eq('id', invite_id);
        
      if (error) throw error;
      
      return new Response(JSON.stringify({ 
        success: true, 
        new_expiry: newExpiryDate 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    // Operação ACTIVATE EMPLOYEE PLAN: público com autenticação, valida token do convite
    if (req.method === 'POST' && operation === 'activate-employee-plan') {
      const { invite_token } = bodyData;
      
      if (!invite_token) {
        return new Response(JSON.stringify({ 
          error: 'Token do convite é obrigatório',
          code: 'MISSING_TOKEN'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400
        });
      }
      
      console.log('[activate-employee-plan] Validating invite token for user:', user.email);
      
      // Buscar convite
      const { data: invite, error: inviteError } = await supabaseClient
        .from('pending_employee_invites')
        .select(`
          *,
          companies (
            id,
            razao_social,
            plano_id_externo,
            empresa_id_externo
          )
        `)
        .eq('token', invite_token)
        .eq('status', 'pending')
        .maybeSingle();
      
      if (inviteError || !invite) {
        console.error('[activate-employee-plan] Invite not found or error:', inviteError);
        return new Response(JSON.stringify({ 
          error: 'Convite inválido ou já utilizado',
          code: 'INVALID_INVITE'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404
        });
      }
      
      // Validar expiração
      if (new Date(invite.expires_at) < new Date()) {
        console.error('[activate-employee-plan] Invite expired');
        return new Response(JSON.stringify({ 
          error: 'Convite expirado. Solicite um novo à sua empresa.',
          code: 'INVITE_EXPIRED'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 410
        });
      }
      
      // Validar que o email do convite corresponde ao usuário autenticado (case-insensitive)
      if (invite.email?.toLowerCase() !== user.email?.toLowerCase()) {
        console.error('[activate-employee-plan] Email mismatch:', { invite_email: invite.email, user_email: user.email });
        return new Response(JSON.stringify({ 
          error: 'Este convite não é para o seu email',
          code: 'EMAIL_MISMATCH'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 403
        });
      }
      
      console.log('[activate-employee-plan] Invite validated, creating plan...');
      
      // Gerar código do plano empresarial
      const companyPlanCode = `EMPRESA_${invite.companies.razao_social
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '_')
        .substring(0, 30)}`;
      
      const planExpiryDate = new Date();
      planExpiryDate.setFullYear(planExpiryDate.getFullYear() + 100);
      
      try {
        // Verificar se já existe plano empresarial ativo
        const { data: existingPlan } = await supabaseClient
          .from('patient_plans')
          .select('id, plan_code')
          .eq('user_id', user.id)
          .eq('plan_code', companyPlanCode)
          .eq('status', 'active')
          .maybeSingle();
        
        if (existingPlan) {
          console.log('[activate-employee-plan] Plan already exists, skipping creation');
        } else {
          // Desativar outros planos ativos
          await supabaseClient
            .from('patient_plans')
            .update({ status: 'cancelled' })
            .eq('user_id', user.id)
            .eq('status', 'active');
          
          // Criar novo plano empresarial (usando service_role_key, bypass RLS)
          const { error: planError } = await supabaseClient.from('patient_plans').insert({
            email: user.email,
            user_id: user.id,
            plan_code: companyPlanCode,
            plan_expires_at: planExpiryDate.toISOString(),
            status: 'active'
          });
          
          if (planError) {
            console.error('[activate-employee-plan] Error creating plan:', planError);
            return new Response(JSON.stringify({ 
              error: `Falha ao ativar plano: ${planError.message}`,
              code: 'PLAN_CREATION_ERROR'
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 500
            });
          }
          
          console.log('[activate-employee-plan] Plan created successfully:', companyPlanCode);
        }
        
        // Criar vínculo em company_employees (usando service_role, bypass RLS)
        const employeeData = bodyData.employee_data;
        if (employeeData) {
          console.log('[activate-employee-plan] Creating employee record...');
          
          const { error: employeeError } = await supabaseClient
            .from('company_employees')
            .insert({
              user_id: user.id,
              company_id: invite.company_id,
              nome: employeeData.nome,
              cpf: employeeData.cpf,
              email: user.email,
              telefone: employeeData.telefone,
              datanascimento: employeeData.birth_date,
              sexo: employeeData.gender,
              logradouro: employeeData.address_line,
              numero: employeeData.address_number,
              complemento: employeeData.address_complement || '',
              bairro: '',
              cep: employeeData.cep,
              cidade: employeeData.city,
              estado: employeeData.state,
              empresa_id_externo: invite.companies.empresa_id_externo,
              plano_id_externo: invite.companies.plano_id_externo,
              has_active_plan: true
            });

          if (employeeError) {
            console.error('[activate-employee-plan] Error creating employee record:', employeeError);
            // Não falhar - plano já foi criado, apenas log
          } else {
            console.log('[activate-employee-plan] Employee record created successfully');
          }
        }
        
        // Marcar convite como completo
        await supabaseClient
          .from('pending_employee_invites')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', invite.id);
        
        console.log('[activate-employee-plan] Invite marked as completed');
        
        return new Response(JSON.stringify({ 
          success: true,
          message: 'Plano ativado com sucesso',
          plan_code: companyPlanCode
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        });
      } catch (error: any) {
        console.error('[activate-employee-plan] Exception:', error);
        return new Response(JSON.stringify({ 
          error: error.message || 'Erro ao ativar plano',
          code: 'INTERNAL_ERROR'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500
        });
      }
    }

    // Operação CREATE EMPLOYEE: permitir admin OU company (com validação de ownership)
    if (req.method === 'POST' && operation === 'create-employee') {
      if (!isAdmin && !isCompany) {
        throw new Error('Forbidden: Admin or Company access required');
      }
      
      // Se for company, validar que está criando funcionário para sua própria empresa
      if (isCompany) {
        // Usar bodyData já parseado (não chamar req.json() novamente)
        
        // Buscar company_id associado a este user_id
        const { data: companyCredential, error: credError } = await supabaseClient
          .from('company_credentials')
          .select('company_id')
          .eq('user_id', user.id)
          .single();
        
        if (credError || !companyCredential) {
          throw new Error('Forbidden: Company credentials not found');
        }
        
        if (companyCredential.company_id !== bodyData.company_id) {
          throw new Error('Forbidden: Can only create employees for your own company');
        }
      }
    }

    // CREATE COMPANY
    if (req.method === 'POST' && operation === 'create') {
      // ✅ CORREÇÃO: Usar bodyData já parseado (evita erro "Body already consumed")
      const { company, temporaryPassword } = bodyData as { company: CompanyData; temporaryPassword?: string };

      // Gerar senha se não fornecida
      const password = temporaryPassword || generateTemporaryPassword(12);

      // Criar usuário no Supabase Auth
      console.log('[CREATE] Creating Supabase Auth user...');
      
      const email = `${company.cnpj.replace(/\D/g, '')}@empresa.prontia.com`;
      
      // Verificar se usuário com este email já existe
      // ✅ CORREÇÃO: Tentar criar diretamente e tratar erro email_exists (evita limite de 50 usuários)
      let existingUser = null;
      
      // Primeiro tenta criar o usuário
      const { data: createData, error: createError } = await supabaseClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          cnpj: company.cnpj,
          razao_social: company.razao_social,
        }
      });
      
      let authData;
      let wasAuthUserCreated = false;
      
      if (createError) {
        // Se o erro for email_exists, buscar o usuário existente
        if (createError.message?.includes('email address has already been registered') || 
            createError.code === 'email_exists') {
          console.warn(`⚠️ [CREATE] User with email ${email} already exists, fetching existing user...`);
          
          // Buscar usuário existente usando getUserByEmail (se disponível) ou listUsers com filtro
          const { data: { users: existingUsers } } = await supabaseClient.auth.admin.listUsers();
          existingUser = existingUsers?.find(u => u.email === email);
          
          if (!existingUser) {
            throw new Error(`User with email ${email} exists but could not be fetched. Please contact support.`);
          }
          
          authData = { user: existingUser };
        } else {
          console.error('[CREATE] Failed to create auth user:', createError);
          throw new Error(`Failed to create authentication user: ${createError.message}`);
        }
      } else {
        authData = createData;
        wasAuthUserCreated = true;
      }

      const authUserId = authData.user?.id;
      if (!authUserId) {
        throw new Error('Failed to get user ID');
      }

      // Criar registro na tabela companies
      const { data: companyData, error: companyError } = await supabaseClient
        .from('companies')
        .insert({
          ...company,
        })
        .select()
        .single();

      if (companyError) {
        console.error('[CREATE] Failed to insert company:', companyError.message);
        // Rollback: só deletar usuário se foi criado nesta requisição
        if (wasAuthUserCreated) {
          await supabaseClient.auth.admin.deleteUser(authData.user.id);
        }
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
          cnpj: company.cnpj.replace(/\D/g, ''),
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

      // ✅ ENVIAR EMAIL AUTOMÁTICO com senha
      try {
        const emailResult = await supabaseClient.functions.invoke('send-form-emails', {
          body: {
            type: 'company-credentials',
            data: {
              email: company.contato_email || email,
              cnpj: company.cnpj,
              razao_social: company.razao_social,
              password: password,
              login_url: 'https://prontiasaude.com.br/empresa/login'
            }
          }
        });
        
        if (emailResult.error) {
          console.error('[company-operations] Email failed:', emailResult.error);
        } else {
          console.log('[company-operations] ✅ Credentials email sent successfully');
        }
      } catch (emailError) {
        console.error('[company-operations] Exception sending email:', emailError);
        // Não bloqueia a criação da empresa
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
      // ✅ CORREÇÃO: Usar bodyData já parseado (evita erro "Body already consumed")
      const updates = bodyData;

      // ✅ CORREÇÃO: Removido updated_by (coluna não existe no schema)
      const { data, error } = await supabaseClient
        .from('companies')
        .update({
          ...updates,
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
      // CORREÇÃO: Usar user_id ao invés de id para upsert correto
      const { error: patientError } = await supabaseClient
        .from('patients')
        .upsert({
          user_id: authUser.user.id,
          first_name: employeeData.nome.split(' ')[0],
          last_name: employeeData.nome.split(' ').slice(1).join(' ') || '',
          cpf: cpfClean,
          phone_e164: employeeData.telefone,
          birth_date: employeeData.datanascimento,
          gender: employeeData.sexo === 'M' ? 'male' : 'female',
          cep: employeeData.cep.replace(/\D/g, ''),
          address_line: employeeData.logradouro,
          address_number: employeeData.numero,
          complement: employeeData.complemento || null,
          neighborhood: employeeData.bairro || null,
          city: employeeData.cidade,
          state: employeeData.estado,
          source: 'empresa',
          profile_complete: true,
          terms_accepted_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

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

      // ✅ ENVIAR EMAIL AUTOMÁTICO de boas-vindas com link de senha
      try {
        const { data: resetLinkData, error: linkError } = await supabaseClient.auth.admin.generateLink({
          type: 'recovery',
          email: employeeData.email,
        });
        
        if (linkError || !resetLinkData?.properties?.action_link) {
          console.error('[company-operations] Failed to generate reset link:', linkError);
          throw new Error('Failed to generate password reset link');
        }
        
        const emailResult = await supabaseClient.functions.invoke('send-form-emails', {
          body: {
            type: 'employee-welcome',
            data: {
              email: employeeData.email,
              nome: employeeData.nome,
              empresa: companyData.razao_social || 'Sua empresa',
              cpf: employeeData.cpf,
              reset_link: resetLinkData.properties.action_link,
              login_url: 'https://prontiasaude.com.br/entrar'
            }
          }
        });
        
        if (emailResult.error) {
          console.error('[company-operations] Employee welcome email failed:', emailResult.error);
        } else {
          console.log('[company-operations] ✅ Employee welcome email sent successfully');
        }
      } catch (emailError) {
        console.error('[company-operations] Exception sending employee email:', emailError);
        // Não bloqueia criação do funcionário
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
      console.log('[company-operations] 🔄 Password reset requested for company:', companyId);
      
      // Buscar credentials
      const { data: credData, error: credError } = await supabaseClient
        .from('company_credentials')
        .select('user_id, company_id')
        .eq('company_id', companyId)
        .single();

      if (credError || !credData) {
        console.error('[company-operations] ❌ Company credentials not found:', credError?.message);
        throw new Error('Company credentials not found');
      }

      console.log('[company-operations] 📋 Company credentials found:', {
        company_id: credData.company_id,
        user_id: credData.user_id
      });

      // Gerar nova senha
      const newPassword = generateTemporaryPassword(12);
      console.log('[company-operations] 🔑 New temporary password generated:', newPassword.substring(0, 4) + '****');

      // Atualizar senha no Auth
      try {
        const { error: authError } = await supabaseClient.auth.admin.updateUserById(
          credData.user_id,
          { password: newPassword }
        );

        if (authError) {
          console.error('[company-operations] ❌ Auth password update failed:', authError.message);
          throw new Error(`Failed to reset password: ${authError.message}`);
        }

        console.log('[company-operations] ✅ Auth password updated successfully for user:', credData.user_id);
      } catch (authException) {
        console.error('[company-operations] ❌ Exception updating auth password:', authException);
        throw authException;
      }

      // Atualizar flag must_change_password e resetar failed attempts
      const { error: updateError } = await supabaseClient
        .from('company_credentials')
        .update({ 
          must_change_password: true,
          failed_login_attempts: 0,
          last_failed_login_at: null
        })
        .eq('company_id', companyId);

      if (updateError) {
        console.error('[company-operations] ❌ Failed to update credentials flags:', updateError.message);
        throw new Error(`Failed to update credentials: ${updateError.message}`);
      }

      console.log('[company-operations] ✅ Credentials flags updated (must_change_password=true, failed_attempts reset)');

      // Buscar CNPJ da empresa
      const { data: companyData } = await supabaseClient
        .from('companies')
        .select('cnpj, razao_social')
        .eq('id', companyId)
        .single();

      console.log('[company-operations] ✅ Password reset completed successfully:', {
        company: companyData?.razao_social,
        cnpj: companyData?.cnpj,
        password_preview: newPassword.substring(0, 4) + '****'
      });

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

    // DIAGNÓSTICO DE LOGIN (Admin only)
    if (req.method === 'POST' && operation === 'check-login-status') {
      if (!isAdmin) {
        throw new Error('Forbidden: Admin access required');
      }

      const { cnpj } = bodyData;
      if (!cnpj) {
        throw new Error('CNPJ é obrigatório');
      }

      const cleanCNPJ = cnpj.replace(/\D/g, '');
      const email = `${cleanCNPJ}@empresa.prontia.com`;

      console.log('[company-operations] 🔍 Diagnóstico de login para CNPJ:', cnpj);

      // 1. Verificar se empresa existe
      const { data: company, error: companyError } = await supabaseClient
        .from('companies')
        .select('id, razao_social, cnpj, status')
        .eq('cnpj', cleanCNPJ)
        .maybeSingle();

      if (companyError) {
        console.error('[company-operations] Erro ao buscar empresa:', companyError.message);
      }

      // 2. Verificar se usuário existe no Auth
      const { data: authUser, error: authError } = await supabaseClient.auth.admin.listUsers();
      const userExists = authUser?.users?.find(u => u.email === email);

      // 3. Verificar role
      let hasCompanyRole = false;
      if (userExists) {
        const { data: roleData } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', userExists.id)
          .eq('role', 'company')
          .maybeSingle();
        
        hasCompanyRole = !!roleData;
      }

      // 4. Verificar credentials
      let credentialsData = null;
      if (company?.id) {
        const { data: creds } = await supabaseClient
          .from('company_credentials')
          .select('*')
          .eq('company_id', company.id)
          .maybeSingle();
        
        credentialsData = creds;
      }

      const diagnostics = {
        cnpj_pesquisado: cnpj,
        cnpj_limpo: cleanCNPJ,
        email_gerado: email,
        empresa_existe: !!company,
        empresa_dados: company ? {
          id: company.id,
          razao_social: company.razao_social,
          status: company.status
        } : null,
        usuario_auth_existe: !!userExists,
        usuario_auth_id: userExists?.id || null,
        tem_role_company: hasCompanyRole,
        credentials: credentialsData ? {
          must_change_password: credentialsData.must_change_password,
          failed_login_attempts: credentialsData.failed_login_attempts,
          last_login_at: credentialsData.last_login_at,
          last_failed_login_at: credentialsData.last_failed_login_at
        } : null,
        problemas_identificados: []
      };

      // Identificar problemas
      if (!company) {
        diagnostics.problemas_identificados.push('❌ Empresa não encontrada no banco de dados');
      }
      if (!userExists) {
        diagnostics.problemas_identificados.push('❌ Usuário não existe no Supabase Auth');
      }
      if (userExists && !hasCompanyRole) {
        diagnostics.problemas_identificados.push('❌ Usuário existe mas não tem role "company"');
      }
      if (!credentialsData) {
        diagnostics.problemas_identificados.push('❌ Registro de credentials não encontrado');
      }
      if (credentialsData && credentialsData.failed_login_attempts >= 5) {
        diagnostics.problemas_identificados.push('⚠️ Conta pode estar bloqueada (5+ tentativas falhadas)');
      }

      if (diagnostics.problemas_identificados.length === 0) {
        diagnostics.problemas_identificados.push('✅ Nenhum problema evidente detectado');
      }

      console.log('[company-operations] Diagnóstico completo:', diagnostics);

      return new Response(
        JSON.stringify({
          success: true,
          diagnostics
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // FIX EMAIL (Admin only)
    if (req.method === 'POST' && operation === 'fix-email') {
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      try {
        const { company_id } = bodyData;

        console.log(`[FIX-EMAIL] Starting email correction for company_id: ${company_id}`);

        // Fetch company data
        const { data: company, error: companyError } = await supabaseClient
          .from('companies')
          .select('cnpj, razao_social')
          .eq('id', company_id)
          .single();

        if (companyError || !company) {
          console.error('[FIX-EMAIL] Company not found:', companyError);
          return new Response(
            JSON.stringify({ error: 'Company not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fetch credentials
        const { data: credentials, error: credError } = await supabaseClient
          .from('company_credentials')
          .select('user_id')
          .eq('company_id', company_id)
          .single();

        if (credError || !credentials) {
          console.error('[FIX-EMAIL] Credentials not found:', credError);
          return new Response(
            JSON.stringify({ error: 'Company credentials not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Get current user email
        const { data: { user: currentUser }, error: userError } = await supabaseClient.auth.admin.getUserById(
          credentials.user_id
        );

        if (userError || !currentUser) {
          console.error('[FIX-EMAIL] User not found:', userError);
          return new Response(
            JSON.stringify({ error: 'User not found in auth.users' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const oldEmail = currentUser.email;

        // Generate correct email
        const cleanCNPJ = company.cnpj.replace(/\D/g, '');
        const correctEmail = `${cleanCNPJ}@empresa.prontia.com`;

        console.log(`[FIX-EMAIL] Updating email from ${oldEmail} to ${correctEmail}`);

        // Update email in auth.users
        const { error: updateError } = await supabaseClient.auth.admin.updateUserById(
          credentials.user_id,
          { 
            email: correctEmail,
            email_confirm: true
          }
        );

        if (updateError) {
          console.error('[FIX-EMAIL] Failed to update email:', updateError);
          return new Response(
            JSON.stringify({ error: 'Failed to update email', details: updateError.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        console.log(`[FIX-EMAIL] Email successfully updated for ${company.razao_social}`);

        return new Response(
          JSON.stringify({
            success: true,
            company: company.razao_social,
            cnpj: company.cnpj,
            old_email: oldEmail,
            new_email: correctEmail,
            message: 'Email corrigido com sucesso'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        console.error('[FIX-EMAIL] Exception:', error);
        return new Response(
          JSON.stringify({ error: 'Internal server error', details: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid operation' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );

  } catch (error: any) {
    console.error(`[${requestId}] ❌ Error:`, {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n')[0]
    });
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        requestId,
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: error.message.includes('Forbidden') ? 403 : 500 
      }
    );
  }
});
