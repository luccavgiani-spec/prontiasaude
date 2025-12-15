import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getWebhookCorsHeaders } from '../common/cors.ts';

const corsHeaders = getWebhookCorsHeaders(); // Webhooks need wildcard CORS

// Helper function to map SKU to service name
function mapSkuToName(sku: string): string {
  const SERVICE_NAMES: Record<string, string> = {
    'BIR7668': 'Personal Trainer',
    'VPN5132': 'Nutricionista',
    'TQP5720': 'Cardiologista',
    'HGG3503': 'Dermatologista',
    'VHH8883': 'Endocrinologista',
    'TSB0751': 'Gastroenterologista',
    'CCP1566': 'Ginecologista',
    'FKS5964': 'Oftalmologista',
    'TVQ5046': 'Ortopedista',
    'HMG9544': 'Pediatra',
    'HME8366': 'Otorrinolaringologista',
    'DYY8522': 'Médico da Família',
    'QOP1101': 'Psiquiatra',
    'LZF3879': 'Nutrólogo',
    'YZD9932': 'Geriatria',
    'UDH3250': 'Reumatologista',
    'PKS9388': 'Neurologista',
    'MYX5186': 'Infectologista',
    'ZXW2165': 'Psicólogo - 1 sessão',
    'HXR8516': 'Psicólogo - 4 sessões',
    'YME9025': 'Psicólogo - 8 sessões',
    'OVM9892': 'Laudo Psicológico',
  };
  
  if (sku.startsWith('IND_')) return 'Plano Individual';
  if (sku.startsWith('FAM_') || sku === 'FAMILY') return 'Plano Familiar';
  
  return SERVICE_NAMES[sku] || sku;
}

// Helper function to register patient in ClickLife (simplified version)
async function registerClickLifePatientSimple(
  cpf: string,
  nome: string,
  email: string,
  telefone: string,
  planoId: number,
  sexo: string,
  birthDate?: string
): Promise<{ success: boolean; error?: string }> {
  const CLICKLIFE_API = Deno.env.get('CLICKLIFE_API_BASE');
  const INTEGRATOR_TOKEN = Deno.env.get('CLICKLIFE_AUTH_TOKEN');

  if (!CLICKLIFE_API || !INTEGRATOR_TOKEN) {
    return { success: false, error: 'ClickLife credentials not configured' };
  }

  try {
    console.log('[registerClickLife] 📝 Iniciando cadastro do paciente na ClickLife');
    console.log('[registerClickLife] CPF:', cpf.substring(0, 3) + '***');

    // Normalizar telefone
    let telefoneLimpo = telefone.replace(/\D/g, '');
    if (telefoneLimpo.startsWith('55')) {
      telefoneLimpo = telefoneLimpo.substring(2);
    }
    const ddd = telefoneLimpo.substring(0, 2);
    const numero = telefoneLimpo.substring(2);

    // Normalizar e converter data de nascimento para DD-MM-YYYY
    let birthDateFormatted = '01-01-1990'; // fallback
    if (birthDate) {
      if (birthDate.includes('-')) {
        const parts = birthDate.split('-');
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            // YYYY-MM-DD -> DD-MM-YYYY
            birthDateFormatted = `${parts[2]}-${parts[1]}-${parts[0]}`;
          } else {
            // Já está em DD-MM-YYYY
            birthDateFormatted = birthDate;
          }
        }
      }
    }

    const registerPayload = {
      cpf: cpf.replace(/\D/g, ''),
      nome,
      email,
      ddd,
      telefone: numero,
      sexo: sexo || 'F',
      plano_id: planoId,
      data_nascimento: birthDateFormatted,
      password: Deno.env.get('CLICKLIFE_PATIENT_DEFAULT_PASSWORD') || 'Pr0ntia!2025'
    };

    console.log('[registerClickLife] Payload de cadastro:', {
      ...registerPayload,
      password: '***',
      cpf: registerPayload.cpf.substring(0, 3) + '***'
    });

    // 1. CADASTRAR PACIENTE
    const registerRes = await fetch(`${CLICKLIFE_API}/usuarios/usuarios`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'integrator-token': INTEGRATOR_TOKEN
      },
      body: JSON.stringify(registerPayload)
    });

    const registerData = await registerRes.json();
    console.log('[registerClickLife] Resposta do cadastro:', registerData);

    // Tolerar erros de "já cadastrado"
    if (!registerRes.ok && registerData.mensagem?.toLowerCase().includes('já cadastrado')) {
      console.log('[registerClickLife] ⚠️ Paciente já cadastrado (continuando)');
    } else if (!registerRes.ok) {
      console.error('[registerClickLife] ❌ Erro no cadastro:', registerData);
      return { success: false, error: registerData.mensagem || 'Erro ao cadastrar paciente' };
    }

    // 2. ATIVAR PACIENTE
    console.log('[registerClickLife] 🔐 Ativando paciente...');
    
    const activatePayload = {
      cpf: cpf.replace(/\D/g, ''),
      plano_id: planoId
    };

    const activateRes = await fetch(`${CLICKLIFE_API}/usuarios/ativacao`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'integrator-token': INTEGRATOR_TOKEN
      },
      body: JSON.stringify(activatePayload)
    });

    const activateData = await activateRes.json();
    console.log('[registerClickLife] Resposta da ativação:', activateData);

    if (!activateRes.ok) {
      console.error('[registerClickLife] ❌ Erro na ativação:', activateData);
      return { success: false, error: activateData.mensagem || 'Erro ao ativar paciente' };
    }

    console.log('[registerClickLife] ✅ Paciente cadastrado e ativado com sucesso');
    return { success: true };

  } catch (error) {
    console.error('[registerClickLife] ❌ Exception:', error);
    return { success: false, error: error.message || 'Exception during registration' };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    console.log('[mp-webhook] ========================================');
    console.log('[mp-webhook] 📥 WEBHOOK RECEBIDO:', new Date().toISOString());
    console.log('[mp-webhook] Action:', body.action);
    console.log('[mp-webhook] Payment ID:', body.data?.id);
    console.log('[mp-webhook] Type:', body.type);
    console.log('[mp-webhook] ========================================');

    // Aceitar múltiplos formatos de action do Mercado Pago
    const action = (body.action || '').toLowerCase();
    const validActions = ['payment.updated', 'payment.created', 'updated', 'created'];

    if (!validActions.includes(action)) {
      console.log('[mp-webhook] Ignorando action não relacionada a pagamentos:', body.action);
      return new Response(JSON.stringify({ success: true, message: 'Action ignored' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[mp-webhook] ✅ Action aceita:', body.action);

    const paymentId = body.data?.id;
    if (!paymentId) {
      console.error('[mp-webhook] Payment ID não encontrado');
      return new Response(JSON.stringify({ success: true, message: 'No payment ID' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Buscar detalhes do pagamento no Mercado Pago
    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    if (!MP_ACCESS_TOKEN) {
      console.error('[mp-webhook] MP_ACCESS_TOKEN não configurado');
      return new Response(JSON.stringify({ success: false, error: 'Token não configurado' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[mp-webhook] Buscando payment:', paymentId);
    
    // Retry logic para race conditions
    let paymentRes;
    let attempts = 0;
    const maxRetries = 3;

    while (attempts < maxRetries) {
      paymentRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` }
      });

      if (paymentRes.ok) {
        console.log('[mp-webhook] ✅ Payment encontrado na tentativa', attempts + 1);
        break;
      }

      if (paymentRes.status === 404 && attempts < maxRetries - 1) {
        console.log(`[mp-webhook] Payment não encontrado, tentativa ${attempts + 1}/${maxRetries}, aguardando 3s...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        attempts++;
      } else {
        break;
      }
    }

    if (!paymentRes.ok) {
      const errorText = await paymentRes.text();
      console.error('[mp-webhook] Erro ao buscar payment após', attempts + 1, 'tentativas:', paymentRes.status, errorText);
      return new Response(JSON.stringify({ success: true, message: 'Payment fetch failed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const payment = await paymentRes.json();
    console.log('[mp-webhook] Payment status:', payment.status, 'Payment ID:', payment.id);

    // Processar apenas pagamentos aprovados
    if (payment.status !== 'approved') {
      console.log('[mp-webhook] Payment status não é approved:', payment.status);
      
      // Gravar métrica de tentativa PIX pending para tracking
      if (payment.status === 'pending' && payment.payment_type_id === 'pix') {
        const supabaseAdmin = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        
        await supabaseAdmin.from('metrics').insert({
          metric_type: 'payment_attempt',
          status: 'pending',
          amount_cents: Math.round(payment.transaction_amount * 100),
          plan_code: schedulePayload?.sku || 'UNKNOWN',
          patient_email: payment.payer?.email || schedulePayload?.email,
          metadata: { 
            payment_id: payment.id, 
            payment_type: 'pix',
            order_id: payment.metadata?.order_id 
          }
        });
        
        // Salvar em pending_payments para tracking manual
        await supabaseAdmin.from('pending_payments').insert({
          payment_id: payment.id,
          order_id: payment.metadata?.order_id,
          email: schedulePayload?.email || payment.payer?.email,
          status: 'pending',
          sku: schedulePayload?.sku,
          amount_cents: Math.round(payment.transaction_amount * 100)
        });
        
        console.log('[mp-webhook] ⏳ PIX pending registrado, aguardando aprovação');
      }
      
      return new Response(JSON.stringify({ success: true, message: 'Not approved yet' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Extrair schedulePayload do metadata
    const schedulePayload = payment.metadata?.schedulePayload || payment.metadata?.schedule_payload;
    if (!schedulePayload) {
      console.error('[mp-webhook] schedulePayload não encontrado no metadata');
      return new Response(JSON.stringify({ success: true, message: 'No schedule payload' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[mp-webhook] Processing payment for SKU:', schedulePayload.sku);
    console.log('[mp-webhook] Source:', schedulePayload.source);

    // ✅ IDENTIFICAR SE É PLANO (apenas SKUs IND_* e FAM_*)
    const isPlanPurchase = schedulePayload.sku?.startsWith('IND_') || 
                           schedulePayload.sku?.startsWith('FAM_');

    // ✅ FLUXO ESPECÍFICO PARA COMPRA DE PLANO
    if (isPlanPurchase) {
      console.log('[mp-webhook] 🎯 PLANO DETECTADO - Processando assinatura');
      console.log('[mp-webhook] SKU:', schedulePayload.sku);
      console.log('[mp-webhook] Email:', schedulePayload.email);

      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // ✅ GARANTIR que o registro do paciente existe
      let userId: string | null = null;
      
      // 🔍 VERIFICAR DUPLICAÇÃO: Checar se já existe um appointment com este order_id
      const orderId = payment.metadata?.order_id;
      if (orderId) {
        const { data: existingAppointment } = await supabaseAdmin
          .from('appointments')
          .select('id, appointment_id')
          .eq('order_id', orderId)
          .maybeSingle();
        
        if (existingAppointment) {
          console.log('[mp-webhook] ⚠️ Appointment duplicado detectado! Order já processado:', orderId);
          return new Response(
            JSON.stringify({ ok: true, message: 'Order already processed', appointment_id: existingAppointment.appointment_id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }
      }
      
      const { data: existingPatient } = await supabaseAdmin
        .from('patients')
        .select('id')
        .eq('email', schedulePayload.email)
        .maybeSingle();

      if (existingPatient) {
        userId = existingPatient.id;
        console.log('[mp-webhook] ✅ Patient já existe:', userId);
      } else {
        console.log('[mp-webhook] 🆕 Criando registro de paciente para:', schedulePayload.email);
        
        // Criar registro básico do paciente (sem id - Supabase gera automaticamente)
        const { data: newPatient, error: patientError } = await supabaseAdmin
          .from('patients')
          .insert({
            email: schedulePayload.email,
            first_name: schedulePayload.nome?.split(' ')[0] || '',
            last_name: schedulePayload.nome?.split(' ').slice(1).join(' ') || '',
            cpf: schedulePayload.cpf || null,
            phone_e164: schedulePayload.telefone || null,
            profile_complete: false,
            intake_complete: false,
            clubeben_status: 'pending'
          })
          .select('id')
          .single();
        
        if (patientError) {
          console.error('[mp-webhook] ❌ Erro ao criar patient:', patientError);
        } else if (newPatient) {
          console.log('[mp-webhook] ✅ Patient criado com sucesso');
          userId = newPatient.id;
          
          // ✅ Se temos contact_id no schedulePayload, atualizar
          if (schedulePayload.contact_id) {
            await supabaseAdmin
              .from('patients')
              .update({ manychat_contact_id: schedulePayload.contact_id })
              .eq('id', newPatient.id);
            
            console.log('[mp-webhook] ✅ manychat_contact_id atualizado (plano)');
          }
        }
      }

      // Calcular data de expiração baseado no auto_recurring
      let planExpiresAt = new Date();
      if (payment.auto_recurring?.frequency_type === 'months') {
        planExpiresAt.setMonth(planExpiresAt.getMonth() + (payment.auto_recurring.frequency || 1));
      } else if (payment.auto_recurring?.frequency_type === 'days') {
        planExpiresAt.setDate(planExpiresAt.getDate() + (payment.auto_recurring.frequency || 30));
      } else {
        // Fallback: 1 mês
        planExpiresAt.setMonth(planExpiresAt.getMonth() + 1);
      }

      // Criar registro em patient_plans
      const { error: planError } = await supabaseAdmin
        .from('patient_plans')
        .insert({
          user_id: userId,
          email: schedulePayload.email,
          plan_code: schedulePayload.sku,
          plan_expires_at: planExpiresAt.toISOString(),
          status: 'active'
        });

      if (planError) {
        console.error('[mp-webhook] ❌ Erro ao criar patient_plan:', planError);
      } else {
        console.log('[mp-webhook] ✅ Plano criado:', {
          email: schedulePayload.email,
          plan_code: schedulePayload.sku,
          expires_at: planExpiresAt.toISOString()
        });
      }

      // Gravar métrica de venda de plano
      await supabaseAdmin.from('metrics').insert({
        metric_type: 'sale',
        amount_cents: Math.round(payment.transaction_amount * 100),
        plan_code: schedulePayload.sku,
        platform: 'mercadopago',
        status: 'approved',
        patient_email: schedulePayload.email,
        metadata: { 
          payment_id: payment.id, 
          mp_status: payment.status,
          order_id: payment.metadata?.order_id,
          purchase_type: 'plan'
        }
      });

      // Marcar pending_payment como processado
      if (payment.metadata?.order_id) {
        await supabaseAdmin
          .from('pending_payments')
          .update({ 
            processed: true,
            processed_at: new Date().toISOString(),
            status: 'approved'
          })
          .eq('order_id', payment.metadata.order_id);
      }

      // Sincronizar ClubeBen (fire-and-forget)
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!
      );
      
      supabase.functions.invoke('clubeben-sync', {
        body: {
          user_email: schedulePayload.email,
          trigger_source: 'plan_purchase'
        }
      }).catch(err => console.error('[mp-webhook] ClubeBen sync error (non-blocking):', err));

      console.log('[mp-webhook] ✅ Plano processado com sucesso');
      
      // ✅ Criar appointment para permitir polling do PaymentModal (PIX)
      if (payment.metadata?.order_id) {
        const appointmentId = `PLN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        const { error: aptError } = await supabaseAdmin
          .from('appointments')
          .insert({
            appointment_id: appointmentId,
            order_id: payment.metadata.order_id,
            email: schedulePayload.email,
            service_code: schedulePayload.sku,
            service_name: `Plano ${schedulePayload.sku}`,
            start_at_local: new Date().toISOString(),
            duration_min: 0,
            redirect_url: '/area-do-paciente',
            provider: 'plan_purchase',
            status: 'approved'
          });
        
        if (aptError) {
          console.error('[mp-webhook] ❌ Erro ao criar appointment:', aptError);
        } else {
          console.log('[mp-webhook] ✅ Appointment criado para polling:', appointmentId);
        }
      }
      
      // Retornar URL de redirecionamento para área do paciente
      return new Response(JSON.stringify({ 
        success: true, 
        payment_id: payment.id,
        redirect_url: '/area-do-paciente',
        provider: 'plan_purchase'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ✅ EXCEÇÃO: Especialistas ou Psicólogos SEM PLANO ATIVO → WhatsApp (EXCETO se vier da ClickLife)
    const ESPECIALISTA_SKUS = [
      'BIR7668', 'VPN5132', 'TQP5720', 'HGG3503', 'VHH8883', 'TSB0751',
      'CCP1566', 'FKS5964', 'TVQ5046', 'HMG9544', 'HME8366', 'DYY8522',
      'QOP1101', 'LZF3879', 'YZD9932', 'UDH3250', 'PKS9388', 'MYX5186'
    ];
    
    const PSICOLOGO_SKUS = ['ZXW2165', 'HXR8516', 'YME9025'];
    
    const SERVICE_NAMES: Record<string, string> = {
      'BIR7668': 'Personal Trainer',
      'VPN5132': 'Nutricionista',
      'TQP5720': 'Cardiologista',
      'HGG3503': 'Dermatologista',
      'VHH8883': 'Endocrinologista',
      'TSB0751': 'Gastroenterologista',
      'CCP1566': 'Ginecologista',
      'FKS5964': 'Oftalmologista',
      'TVQ5046': 'Ortopedista',
      'HMG9544': 'Pediatra',
      'HME8366': 'Otorrinolaringologista',
      'DYY8522': 'Médico da Família',
      'QOP1101': 'Psiquiatra',
      'LZF3879': 'Nutrólogo',
      'YZD9932': 'Geriatria',
      'UDH3250': 'Reumatologista',
      'PKS9388': 'Neurologista',
      'MYX5186': 'Infectologista',
      'ZXW2165': 'Psicólogo - 1 sessão',
      'HXR8516': 'Psicólogo - 4 sessões',
      'YME9025': 'Psicólogo - 8 sessões',
    };

    const isEspecialista = ESPECIALISTA_SKUS.includes(schedulePayload.sku);
    const isPsicologo = PSICOLOGO_SKUS.includes(schedulePayload.sku);
    const semPlanoAtivo = !schedulePayload.plano_ativo;
    const fromClicklife = schedulePayload.source === 'clicklife';

    // ✅ EXCEÇÃO 1: PSICÓLOGOS SEM plano → Agendar.cc
    if (isPsicologo && semPlanoAtivo && !fromClicklife) {
      const serviceName = SERVICE_NAMES[schedulePayload.sku] || schedulePayload.sku;
      const agendarUrl = 'https://prontiasaude.agendar.cc/';
      
      console.log(`[mp-webhook] 🧠 ${serviceName} SEM plano ativo → Agendar.cc`);
      console.log('[mp-webhook] URL:', agendarUrl);

      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      const appointmentId = `APT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await supabaseAdmin.from('appointments').insert({
        appointment_id: appointmentId,
        email: schedulePayload.email,
        service_code: schedulePayload.sku,
        service_name: serviceName,
        start_at_local: new Date().toISOString(),
        duration_min: 30,
        status: 'pending_schedule',
        provider: 'agendar_cc',
        redirect_url: agendarUrl,
        teams_join_url: agendarUrl,
        order_id: payment.metadata?.order_id
      });

      await supabaseAdmin.from('metrics').insert({
        metric_type: 'sale',
        amount_cents: Math.round(payment.transaction_amount * 100),
        plan_code: schedulePayload.sku,
        platform: 'agendar_cc',
        status: 'approved',
        patient_email: schedulePayload.email,
        metadata: { 
          payment_id: payment.id, 
          mp_status: payment.status,
          order_id: payment.metadata?.order_id,
          redirect_type: 'psicologo_sem_plano_agendar_cc'
        }
      });

      if (payment.metadata?.order_id) {
        await supabaseAdmin
          .from('pending_payments')
          .update({ 
            processed: true,
            processed_at: new Date().toISOString(),
            status: 'approved'
          })
          .eq('order_id', payment.metadata.order_id);
      }

      console.log('[mp-webhook] ✅ Redirecionamento agendar.cc configurado (SEM plano)');

      return new Response(JSON.stringify({ 
        success: true, 
        payment_id: payment.id,
        redirect_url: agendarUrl,
        provider: 'agendar_cc'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ✅ EXCEÇÃO 2: ESPECIALISTAS SEM plano → Cadastrar ClickLife + WhatsApp manual
    if (isEspecialista && semPlanoAtivo && !fromClicklife) {
      const serviceName = SERVICE_NAMES[schedulePayload.sku] || schedulePayload.sku;
      
      console.log(`[mp-webhook] ✓ ${serviceName} SEM plano ativo → Cadastrar ClickLife + WhatsApp`);

      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // ✅ BUSCAR/CRIAR dados completos do paciente
      let patientData = (await supabaseAdmin
        .from('patients')
        .select('first_name, last_name, cpf, phone_e164, gender, birth_date, email')
        .eq('email', schedulePayload.email)
        .maybeSingle()).data;

      if (!patientData) {
        console.log('[mp-webhook] 📝 Paciente não encontrado - criando registro no banco');
        
        const newPatientData = {
          email: schedulePayload.email,
          cpf: schedulePayload.cpf?.replace(/\D/g, '') || payment.payer?.identification?.number?.replace(/\D/g, ''),
          first_name: schedulePayload.nome?.split(' ')[0] || payment.payer?.first_name || 'Nome',
          last_name: schedulePayload.nome?.split(' ').slice(1).join(' ') || payment.payer?.last_name || 'Sobrenome',
          phone_e164: schedulePayload.telefone || payment.payer?.phone?.area_code + payment.payer?.phone?.number,
          gender: schedulePayload.sexo || 'F',
          birth_date: schedulePayload.birth_date || '1990-01-01',
          profile_complete: false,
          source: 'pix_payment'
        };
        
        const { data: createdPatient, error: createError } = await supabaseAdmin
          .from('patients')
          .upsert(newPatientData)
          .select('first_name, last_name, cpf, phone_e164, gender, birth_date, email')
          .single();
        
        if (createError) {
          console.error('[mp-webhook] ❌ Erro ao criar paciente:', createError);
        } else {
          console.log('[mp-webhook] ✅ Paciente criado com sucesso');
          patientData = createdPatient;
        }
      }

      // ✅ CADASTRAR na ClickLife ANTES do WhatsApp
      let clicklifeResult = { success: false, error: 'Patient data not available' };
      
      if (patientData) {
        console.log('[mp-webhook] 📝 Cadastrando especialista sem plano na ClickLife...');
        console.log('[mp-webhook] Dados do paciente:', {
          cpf: patientData.cpf?.substring(0, 3) + '***',
          nome: `${patientData.first_name} ${patientData.last_name}`,
          email: patientData.email,
          phone: patientData.phone_e164,
          gender: patientData.gender,
          birth_date: patientData.birth_date
        });
        
        const nomeCompleto = `${patientData.first_name} ${patientData.last_name}`;
        
        clicklifeResult = await registerClickLifePatientSimple(
          patientData.cpf || '',
          nomeCompleto,
          patientData.email || schedulePayload.email,
          patientData.phone_e164 || '',
          864, // planoId para consultas avulsas
          patientData.gender || 'F',
          patientData.birth_date
        );
        
        // ✅ REGISTRAR NA TABELA DE AUDITORIA
        const serviceName = SERVICE_NAMES[schedulePayload.sku] || schedulePayload.sku;
        try {
          await supabaseAdmin.from('clicklife_registrations').insert({
            patient_email: patientData.email || schedulePayload.email,
            patient_cpf: patientData.cpf,
            patient_name: nomeCompleto,
            appointment_id: null, // será preenchido depois
            order_id: payment.metadata?.order_id,
            payment_id: String(payment.id),
            sku: schedulePayload.sku,
            service_name: serviceName,
            clicklife_empresa_id: 9083,
            clicklife_plano_id: 864,
            success: clicklifeResult.success,
            error_message: clicklifeResult.error || null,
            response_data: clicklifeResult
          });
          console.log('[mp-webhook] 📝 Registro de auditoria ClickLife salvo');
        } catch (auditError) {
          console.error('[mp-webhook] ⚠️ Erro ao salvar auditoria ClickLife:', auditError);
        }
        
        if (clicklifeResult.success) {
          console.log('[mp-webhook] ✅ Paciente cadastrado na ClickLife com sucesso');
        } else {
          console.warn('[mp-webhook] ⚠️ Falha no cadastro ClickLife (continuando para WhatsApp):', clicklifeResult.error);
        }
      } else {
        // Registrar falha quando não há dados do paciente
        try {
          await supabaseAdmin.from('clicklife_registrations').insert({
            patient_email: schedulePayload.email,
            patient_cpf: null,
            patient_name: schedulePayload.nome || 'Desconhecido',
            order_id: payment.metadata?.order_id,
            payment_id: String(payment.id),
            sku: schedulePayload.sku,
            service_name: SERVICE_NAMES[schedulePayload.sku] || schedulePayload.sku,
            clicklife_empresa_id: 9083,
            clicklife_plano_id: 864,
            success: false,
            error_message: 'Patient data not available - patientData is null',
            response_data: { schedulePayload, payerInfo: payment.payer }
          });
        } catch (auditError) {
          console.error('[mp-webhook] ⚠️ Erro ao salvar auditoria ClickLife:', auditError);
        }
      }

      // ✅ Continuar com WhatsApp como hoje
      const whatsappUrl = `https://wa.me/5511933359187?text=Olá!%20Acabei%20de%20comprar%20uma%20consulta%20de%20${encodeURIComponent(serviceName)}%20e%20gostaria%20de%20agendar.`;
      console.log('[mp-webhook] WhatsApp URL:', whatsappUrl);

      const appointmentId = `APT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await supabaseAdmin.from('appointments').insert({
        appointment_id: appointmentId,
        email: schedulePayload.email,
        service_code: schedulePayload.sku,
        service_name: serviceName,
        start_at_local: new Date().toISOString(),
        duration_min: 30,
        status: 'pending_schedule',
        provider: 'whatsapp_manual',
        redirect_url: whatsappUrl,
        teams_join_url: whatsappUrl,
        order_id: payment.metadata?.order_id
      });

      await supabaseAdmin.from('metrics').insert({
        metric_type: 'sale',
        amount_cents: Math.round(payment.transaction_amount * 100),
        plan_code: schedulePayload.sku,
        platform: 'whatsapp_manual',
        status: 'approved',
        patient_email: schedulePayload.email,
        metadata: { 
          payment_id: payment.id, 
          mp_status: payment.status,
          order_id: payment.metadata?.order_id,
          redirect_type: 'whatsapp_specialist_no_plan',
          clicklife_registered: clicklifeResult.success,
          clicklife_error: clicklifeResult.error || null
        }
      });

      // Marcar como processado
      if (payment.metadata?.order_id) {
        await supabaseAdmin
          .from('pending_payments')
          .update({ 
            processed: true,
            processed_at: new Date().toISOString(),
            status: 'approved'
          })
          .eq('order_id', payment.metadata.order_id);
      }

      console.log('[mp-webhook] ✅ Cadastro ClickLife + Redirecionamento WhatsApp configurado');
      
      return new Response(JSON.stringify({ 
        success: true, 
        payment_id: payment.id,
        redirect_url: whatsappUrl,
        provider: 'whatsapp_manual',
        clicklife_registered: clicklifeResult.success
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fluxo normal: Chamar schedule-redirect
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    // ✅ ENRIQUECER schedulePayload com dados completos do paciente
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let patientData = (await supabaseAdmin
      .from('patients')
      .select('first_name, last_name, cpf, phone_e164, gender, birth_date')
      .eq('email', schedulePayload.email)
      .maybeSingle()).data;

    if (!patientData) {
      console.log('[mp-webhook] 📝 Paciente não encontrado - criando registro no banco');
      
      // Preparar dados do novo paciente (sem id - Supabase gera automaticamente)
      const newPatientData = {
        email: schedulePayload.email,
        cpf: schedulePayload.cpf?.replace(/\D/g, '') || payment.payer?.identification?.number?.replace(/\D/g, ''),
        first_name: schedulePayload.nome?.split(' ')[0] || payment.payer?.first_name || 'Nome',
        last_name: schedulePayload.nome?.split(' ').slice(1).join(' ') || payment.payer?.last_name || 'Sobrenome',
        phone_e164: schedulePayload.telefone || payment.payer?.phone?.area_code + payment.payer?.phone?.number,
        gender: schedulePayload.sexo || 'F', // Fallback para feminino
        birth_date: schedulePayload.birth_date || '1990-01-01', // Fallback genérico
        profile_complete: false,
        source: 'pix_payment'
      };
      
      console.log('[mp-webhook] Dados do novo paciente:', {
        email: newPatientData.email,
        cpf: newPatientData.cpf?.substring(0, 3) + '***',
        nome: `${newPatientData.first_name} ${newPatientData.last_name}`,
        gender: newPatientData.gender,
        birth_date: newPatientData.birth_date
      });
      
      const { data: createdPatient, error: createError } = await supabaseAdmin
        .from('patients')
        .upsert(newPatientData)
        .select('first_name, last_name, cpf, phone_e164, gender, birth_date')
        .single();
      
      if (createError) {
        console.error('[mp-webhook] ❌ Erro ao criar paciente:', createError);
      } else {
        console.log('[mp-webhook] ✅ Paciente criado com sucesso');
        patientData = createdPatient;
        
        // ✅ Se temos contact_id no schedulePayload, atualizar o patient recém-criado
        if (schedulePayload.contact_id && createdPatient) {
          await supabaseAdmin
            .from('patients')
            .update({ manychat_contact_id: schedulePayload.contact_id })
            .eq('email', schedulePayload.email);
          
          console.log('[mp-webhook] ✅ manychat_contact_id atualizado no patient recém-criado');
        }
      }
    }

    if (patientData) {
      console.log('[mp-webhook] ✅ Enriquecendo payload com dados do paciente');
      
      // Enriquecer schedulePayload com dados completos
      schedulePayload.nome = `${patientData.first_name} ${patientData.last_name}`;
      schedulePayload.cpf = patientData.cpf;
      schedulePayload.telefone = patientData.phone_e164;
      schedulePayload.sexo = patientData.gender;
      schedulePayload.birth_date = patientData.birth_date;
      
      console.log('[mp-webhook] 📋 Payload enriquecido:', {
        nome: schedulePayload.nome,
        cpf: schedulePayload.cpf?.substring(0, 3) + '***',
        telefone: schedulePayload.telefone,
        sexo: schedulePayload.sexo,
        birth_date: schedulePayload.birth_date
      });
    } else {
      console.error('[mp-webhook] ❌ Falha ao obter dados do paciente');
    }

    // ✅ CADASTRO UNIVERSAL NA CLICKLIFE - TODAS AS COMPRAS
    // Executar antes do schedule-redirect para garantir que o paciente esteja cadastrado
    if (patientData && patientData.cpf) {
      console.log('[mp-webhook] 🏥 Cadastro universal na ClickLife...');
      
      const nomeCompleto = `${patientData.first_name} ${patientData.last_name}`;
      
      const clicklifeResult = await registerClickLifePatientSimple(
        patientData.cpf,
        nomeCompleto,
        patientData.email || schedulePayload.email,
        patientData.phone_e164 || '',
        864, // planoId padrão para consultas
        patientData.gender || 'F',
        patientData.birth_date
      );
      
      // Registrar na tabela de auditoria
      try {
        await supabaseAdmin.from('clicklife_registrations').insert({
          patient_email: patientData.email || schedulePayload.email,
          patient_cpf: patientData.cpf,
          patient_name: nomeCompleto,
          order_id: payment.metadata?.order_id,
          payment_id: String(payment.id),
          sku: schedulePayload.sku,
          service_name: mapSkuToName(schedulePayload.sku),
          clicklife_empresa_id: 9083,
          clicklife_plano_id: 864,
          success: clicklifeResult.success,
          error_message: clicklifeResult.error || null,
          response_data: clicklifeResult
        });
        console.log('[mp-webhook] 📝 Registro de auditoria ClickLife salvo (universal)');
      } catch (auditError) {
        console.error('[mp-webhook] ⚠️ Erro ao salvar auditoria ClickLife:', auditError);
      }
      
      if (clicklifeResult.success) {
        console.log('[mp-webhook] ✅ Paciente cadastrado na ClickLife com sucesso (universal)');
      } else {
        console.warn('[mp-webhook] ⚠️ Falha no cadastro ClickLife (universal):', clicklifeResult.error);
      }
    } else {
      console.log('[mp-webhook] ⚠️ Pulando cadastro ClickLife - dados incompletos do paciente');
    }

    console.log('[mp-webhook] 📞 Chamando schedule-redirect para payment:', payment.id);

    // ✅ RETRY AUTOMÁTICO: Tentar 3 vezes com delay exponencial
    let scheduleData = null;
    let scheduleError = null;
    const maxScheduleRetries = 3;
    
    for (let attempt = 1; attempt <= maxScheduleRetries; attempt++) {
      console.log(`[mp-webhook] 🔄 Tentativa ${attempt}/${maxScheduleRetries} de agendar...`);
      
      const result = await supabase.functions.invoke('schedule-redirect', {
        body: {
          cpf: schedulePayload.cpf,
          email: schedulePayload.email,
          nome: schedulePayload.nome,
          telefone: schedulePayload.telefone,
          sexo: schedulePayload.sexo,
          birth_date: schedulePayload.birth_date, // ✅ NOVO: Enviar data de nascimento
          especialidade: schedulePayload.especialidade || 'Clínico Geral',
          sku: schedulePayload.sku,
          horario_iso: schedulePayload.horario_iso || new Date().toISOString(),
          plano_ativo: schedulePayload.plano_ativo || false,
          order_id: payment.metadata?.order_id,
          payment_id: payment.id
        }
      });

      scheduleData = result.data;
      scheduleError = result.error;

      // ✅ Sucesso direto: schedule-redirect retornou URL ou appointment_id
      if (!scheduleError && (scheduleData?.url || scheduleData?.appointment_id)) {
        console.log(`[mp-webhook] ✅ Agendamento bem-sucedido na tentativa ${attempt}`);
        console.log('[mp-webhook] Appointment details:', {
          appointment_id: scheduleData.appointment_id,
          redirect_url: scheduleData.url,
          provider: scheduleData.provider
        });
        
        // ✅ RESOLVER CONTACT_ID (ETAPA 3 do plano)
        let contactId = schedulePayload.contact_id;
        let contactIdSource = 'schedulePayload';

        // Se não veio no payload, buscar no banco
        if (!contactId && schedulePayload.email) {
          // Buscar em patients
          const { data: patient } = await supabaseAdmin
            .from('patients')
            .select('manychat_contact_id')
            .eq('email', schedulePayload.email)
            .maybeSingle();
          
          if (patient?.manychat_contact_id) {
            contactId = patient.manychat_contact_id;
            contactIdSource = 'patients';
          }
        }

        // Se ainda não tem, buscar em manychat_contacts
        if (!contactId) {
          const email = schedulePayload.email?.trim().toLowerCase();
          const cpf = schedulePayload.cpf?.replace(/\D/g, '');
          
          // Normalizar telefone
          let phoneE164 = schedulePayload.telefone || '';
          if (phoneE164) {
            const digitsOnly = phoneE164.replace(/\D/g, '');
            if (digitsOnly.length >= 10) {
              phoneE164 = digitsOnly.startsWith('55') ? '+' + digitsOnly : '+55' + digitsOnly;
            }
          }

          // Tentar por email
          if (email && !contactId) {
            const { data: mc } = await supabaseAdmin
              .from('manychat_contacts')
              .select('contact_id')
              .eq('email', email)
              .maybeSingle();
            
            if (mc?.contact_id) {
              contactId = mc.contact_id;
              contactIdSource = 'manychat_contacts.email';
            }
          }

          // Tentar por CPF
          if (cpf && !contactId) {
            const { data: mc } = await supabaseAdmin
              .from('manychat_contacts')
              .select('contact_id')
              .eq('cpf', cpf)
              .maybeSingle();
            
            if (mc?.contact_id) {
              contactId = mc.contact_id;
              contactIdSource = 'manychat_contacts.cpf';
            }
          }

          // Tentar por telefone
          if (phoneE164 && !contactId) {
            const { data: mc } = await supabaseAdmin
              .from('manychat_contacts')
              .select('contact_id')
              .eq('phone_e164', phoneE164)
              .maybeSingle();
            
            if (mc?.contact_id) {
              contactId = mc.contact_id;
              contactIdSource = 'manychat_contacts.phone';
            }
          }
        }

        console.log('[mc-get-consultation-link] ✅ Agendamento criado:', {
          url: scheduleData.url,
          order_id: payment.metadata?.order_id,
          email: schedulePayload.email
        });
        
        console.log('[mc-webhook] 📲 Link salvo no banco para ManyChat buscar via mc-get-consultation-link');
        
        break;
      }

      if (attempt < maxScheduleRetries) {
        const delayMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`[mp-webhook] ⚠️ Falha na tentativa ${attempt}, aguardando ${delayMs}ms antes de retentar...`);
        console.log('[mp-webhook] Erro:', scheduleError?.message || 'Resposta inválida');
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        console.error(`[mp-webhook] ❌ FALHA após ${maxScheduleRetries} tentativas de agendamento`);
        console.error('[mp-webhook] Último erro:', scheduleError?.message || 'Resposta inválida');
      }
    }

    // ✅ Determinar sucesso do agendamento
    const scheduledOk = !scheduleError && (scheduleData?.url || scheduleData?.appointment_id);
    
    // ✅ Gravar métrica de venda
    await supabaseAdmin
      .from('metrics')
      .insert({
        metric_type: 'sale',
        amount_cents: Math.round(payment.transaction_amount * 100),
        plan_code: schedulePayload.sku || 'UNKNOWN',
        platform: scheduleData?.provider || 'unknown',
        status: scheduledOk ? 'approved' : 'failed_schedule',
        patient_email: payment.payer?.email || schedulePayload.email,
        metadata: { 
          payment_id: payment.id, 
          mp_status: payment.status,
          order_id: payment.metadata?.order_id,
          schedule_error: scheduledOk ? null : (scheduleError?.message || 'no_appointment_found')
        }
      });

    console.log('[mp-webhook] ✅ Métrica de venda gravada');

    // ✅ CUPOM: Criar registro em coupon_uses se houver cupom aplicado
    if (payment.metadata?.coupon_id && payment.metadata?.coupon_code) {
      try {
        console.log('[mp-webhook] 🎟️ Cupom detectado, criando registro de uso...');
        
        // Buscar dados completos do cupom
        const { data: coupon } = await supabaseAdmin
          .from('user_coupons')
          .select('*')
          .eq('id', payment.metadata.coupon_id)
          .single();

        if (coupon) {
          // Buscar nome de quem usou
          const { data: buyer } = await supabaseAdmin
            .from('patients')
            .select('first_name, last_name')
            .eq('email', schedulePayload.email)
            .maybeSingle();

          const buyerName = buyer 
            ? `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim()
            : schedulePayload.nome || 'Usuário';

          // Criar registro de uso do cupom
          const { error: couponUseError } = await supabaseAdmin
            .from('coupon_uses')
            .insert({
              coupon_id: payment.metadata.coupon_id,
              coupon_code: payment.metadata.coupon_code,
              used_by_user_id: userId || null,
              used_by_name: buyerName,
              used_by_email: schedulePayload.email,
              service_or_plan_id: schedulePayload.sku,
              service_or_plan_name: mapSkuToName(schedulePayload.sku),
              owner_user_id: coupon.owner_user_id,
              owner_email: payment.metadata.owner_email || '',
              owner_pix_key: coupon.pix_key,
              payment_id: String(payment.id),
              order_id: payment.metadata.order_id || null,
              used_at: new Date().toISOString(),
              amount_original: payment.metadata.amount_original || Math.round(payment.transaction_amount * 100),
              amount_discounted: payment.metadata.amount_discounted || Math.round(payment.transaction_amount * 100),
              discount_percentage: payment.metadata.discount_percentage || 0
            });

          if (couponUseError) {
            console.error('[mp-webhook] ❌ Erro ao criar coupon_use:', couponUseError);
          } else {
            console.log('[mp-webhook] ✅ Cupom registrado em coupon_uses');
          }
        }
      } catch (err) {
        console.error('[mp-webhook] ⚠️ Erro ao processar cupom:', err);
      }
    }

    // ✅ Marcar pending_payment como processado
    if (payment.metadata?.order_id) {
      await supabaseAdmin
        .from('pending_payments')
        .update({ 
          processed: scheduledOk,
          processed_at: new Date().toISOString(),
          status: scheduledOk ? 'approved' : 'failed'
        })
        .eq('order_id', payment.metadata.order_id);
      
      console.log('[mp-webhook] ✅ Pending payment atualizado:', payment.metadata.order_id);
    }

    console.log('[mp-webhook] ========================================');
    console.log('[mp-webhook] ✅ PROCESSAMENTO CONCLUÍDO');
    console.log('[mp-webhook] Payment ID:', payment.id);
    console.log('[mp-webhook] Status:', payment.status);
    console.log('[mp-webhook] Email:', schedulePayload.email);
    console.log('[mp-webhook] SKU:', schedulePayload.sku);
    console.log('[mp-webhook] Appointment ID:', scheduleData?.appointment_id || 'N/A');
    console.log('[mp-webhook] ========================================');

    // Sempre retornar 200 OK para MP não retentar
    return new Response(JSON.stringify({ success: true, payment_id: paymentId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[mp-webhook] Error:', error);
    // Sempre retornar 200 para MP não retentar
    return new Response(JSON.stringify({ success: true, error: 'Internal error' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
