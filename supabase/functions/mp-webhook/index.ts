import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getWebhookCorsHeaders } from '../common/cors.ts';

const corsHeaders = getWebhookCorsHeaders(); // Webhooks need wildcard CORS

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

    // ✅ IDENTIFICAR SE É PLANO (assinatura recorrente)
    const isPlanPurchase = schedulePayload.sku?.match(/^(IND_|FAM_)/) || 
                           payment.metadata?.recurring === true ||
                           payment.auto_recurring !== undefined;

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
        
        // Buscar user_id do auth.users
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserByEmail(schedulePayload.email);
        
        if (authUser?.user) {
          // Criar registro básico do paciente
          const { error: patientError } = await supabaseAdmin
            .from('patients')
            .insert({
              id: authUser.user.id,
              email: schedulePayload.email,
              first_name: schedulePayload.nome?.split(' ')[0] || '',
              last_name: schedulePayload.nome?.split(' ').slice(1).join(' ') || '',
              cpf: schedulePayload.cpf || null,
              phone_e164: schedulePayload.telefone || null,
              profile_complete: false,
              intake_complete: false,
              clubeben_status: 'pending'
            });
          
          if (patientError) {
            console.error('[mp-webhook] ❌ Erro ao criar patient:', patientError);
          } else {
            console.log('[mp-webhook] ✅ Patient criado com sucesso');
            userId = authUser.user.id;
          }
        } else {
          console.warn('[mp-webhook] ⚠️ Auth user não encontrado para email:', schedulePayload.email);
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

    // ✅ EXCEÇÃO 2: ESPECIALISTAS SEM plano → WhatsApp manual
    if (isEspecialista && semPlanoAtivo && !fromClicklife) {
      const serviceName = SERVICE_NAMES[schedulePayload.sku] || schedulePayload.sku;
      const whatsappUrl = `https://wa.me/5511933359187?text=Olá!%20Acabei%20de%20comprar%20uma%20consulta%20de%20${encodeURIComponent(serviceName)}%20e%20gostaria%20de%20agendar.`;
      
      console.log(`[mp-webhook] ✓ ${serviceName} SEM plano ativo → WhatsApp Suporte`);
      console.log('[mp-webhook] WhatsApp URL:', whatsappUrl);

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
          redirect_type: 'whatsapp_specialist_no_plan'
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

      // Sincronizar ClubeBen (fire-and-forget)
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!
      );
      
      supabase.functions.invoke('clubeben-sync', {
        body: {
          user_email: schedulePayload.email,
          trigger_source: 'payment_approved'
        }
      }).catch(err => console.error('[mp-webhook] ClubeBen sync error (non-blocking):', err));

      console.log('[mp-webhook] ✅ Redirecionamento WhatsApp configurado');
      
      return new Response(JSON.stringify({ 
        success: true, 
        payment_id: payment.id,
        redirect_url: whatsappUrl,
        provider: 'whatsapp_manual'
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

      if (!scheduleError && scheduleData?.ok) {
        console.log(`[mp-webhook] ✅ Agendamento bem-sucedido na tentativa ${attempt}`);
        console.log('[mp-webhook] Appointment details:', {
          appointment_id: scheduleData.appointment_id,
          redirect_url: scheduleData.url,
          provider: scheduleData.provider
        });
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

    // ✅ Gravar métrica de venda e atualizar pending_payments
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await supabaseAdmin
      .from('metrics')
      .insert({
        metric_type: 'sale',
        amount_cents: Math.round(payment.transaction_amount * 100),
        plan_code: schedulePayload.sku || 'UNKNOWN',
        platform: scheduleData?.provider || 'unknown',
        status: scheduleError ? 'failed_schedule' : 'approved',
        patient_email: payment.payer?.email || schedulePayload.email,
        metadata: { 
          payment_id: payment.id, 
          mp_status: payment.status,
          order_id: payment.metadata?.order_id,
          schedule_error: scheduleError?.message || null
        }
      });

    console.log('[mp-webhook] ✅ Métrica de venda gravada');

    // ✅ Marcar pending_payment como processado
    if (payment.metadata?.order_id) {
      await supabaseAdmin
        .from('pending_payments')
        .update({ 
          processed: !scheduleError,
          processed_at: new Date().toISOString(),
          status: scheduleError ? 'failed' : 'approved'
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

    // ✅ Sincronizar com ClubeBen (fire-and-forget)
    if (schedulePayload.email || schedulePayload.cpf) {
      console.log('[mp-webhook] Iniciando sincronização ClubeBen');
      supabase.functions.invoke('clubeben-sync', {
        body: {
          user_email: schedulePayload.email,
          trigger_source: 'payment_approved'
        }
      }).catch(err => console.error('[mp-webhook] ClubeBen sync error (non-blocking):', err));
    }

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
