import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ✅ URL FIXA do projeto original onde as Edge Functions estão deployadas
// NÃO usar Deno.env.get('SUPABASE_URL') pois pode apontar para projeto errado (Lovable Cloud)
const ORIGINAL_SUPABASE_URL = 'https://ploqujuhpwutpcibedbr.supabase.co';
const ORIGINAL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3F1anVocHd1dHBjaWJlZGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NjYxODQsImV4cCI6MjA3MjM0MjE4NH0.WD3MXt1Y4sYxkaCPGgD0s8LdhPx_7eEQ1ewaFhnQ8-I';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ✅ Helper para determinar planoId correto baseado no SKU do plano
function getClickLifePlanIdFromSku(sku: string): number {
  // Planos com especialistas → 864
  if (sku.includes('COM_ESP')) return 864;
  // Planos empresariais → 864
  if (sku.startsWith('EMPRESA_')) return 864;
  // Planos sem especialistas → 863
  if (sku.includes('SEM_ESP')) return 863;
  // Default para serviços avulsos → 864
  return 864;
}

// ✅ Função para registrar paciente na ClickLife (mesma lógica do mp-webhook)
async function registerClickLifePatient(
  cpf: string,
  nome: string,
  email: string,
  telefone: string,
  planoId: number,
  sexo: string,
  dataNascimento?: string
): Promise<{ success: boolean; error?: string; clicklife_patient_id?: string }> {
  try {
    const CLICKLIFE_API_BASE = Deno.env.get('CLICKLIFE_API_BASE');
    const CLICKLIFE_AUTH_TOKEN = Deno.env.get('CLICKLIFE_AUTH_TOKEN');
    const CLICKLIFE_PATIENT_DEFAULT_PASSWORD = Deno.env.get('CLICKLIFE_PATIENT_DEFAULT_PASSWORD');

    if (!CLICKLIFE_API_BASE || !CLICKLIFE_AUTH_TOKEN) {
      console.warn('[registerClickLifePatient] ClickLife não configurado');
      return { success: false, error: 'ClickLife não configurado' };
    }

    // Formatar CPF (apenas números)
    const cpfNumeros = cpf.replace(/\D/g, '');

    // Formatar telefone (apenas números, sem 55)
    let telefoneFormatado = telefone.replace(/\D/g, '');
    if (telefoneFormatado.startsWith('55')) {
      telefoneFormatado = telefoneFormatado.substring(2);
    }

    // Formatar data de nascimento
    let dataNascFormatada = '';
    if (dataNascimento) {
      const d = new Date(dataNascimento);
      dataNascFormatada = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    const payload = {
      cpf: cpfNumeros,
      nome: nome,
      email: email,
      telefone: telefoneFormatado,
      senha: CLICKLIFE_PATIENT_DEFAULT_PASSWORD || 'Prontia@2025',
      sexo: sexo === 'M' ? 'M' : 'F',
      dataNascimento: dataNascFormatada || '1990-01-01',
      empresaId: 15, // Prontia
      planoId: planoId,
    };

    console.log('[registerClickLifePatient] Registrando na ClickLife:', { cpf: cpfNumeros, nome, email, planoId });

    const response = await fetch(`${CLICKLIFE_API_BASE}/pacientes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CLICKLIFE_AUTH_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log('[registerClickLifePatient] Response:', response.status, responseText);

    if (response.ok || response.status === 201) {
      try {
        const data = JSON.parse(responseText);
        return { 
          success: true, 
          clicklife_patient_id: data.id?.toString() || data.pacienteId?.toString() 
        };
      } catch {
        return { success: true };
      }
    }

    // Se retornou 409, paciente já existe (não é erro)
    if (response.status === 409) {
      console.log('[registerClickLifePatient] Paciente já existe na ClickLife (409)');
      return { success: true };
    }

    return { success: false, error: `Status ${response.status}: ${responseText}` };
  } catch (error) {
    console.error('[registerClickLifePatient] Erro:', error);
    return { success: false, error: error.message };
  }
}

Deno.serve(async (req) => {
  const requestId = `CPS-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ✅ PARSING SEGURO DO BODY (evita 500 "Unexpected end of JSON")
    const rawBody = await req.text();
    
    if (!rawBody || rawBody.trim() === '') {
      console.error(`[check-payment-status] ❌ Body vazio! Request ID: ${requestId}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Payload ausente',
        error_code: 'EMPTY_BODY',
        debug_hint: 'O corpo da requisição chegou vazio',
        request_id: requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    let body: { payment_id?: string; email?: string; order_id?: string };
    try {
      body = JSON.parse(rawBody);
    } catch (parseErr) {
      console.error(`[check-payment-status] ❌ JSON inválido! Request ID: ${requestId}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'JSON inválido',
        error_code: 'INVALID_JSON',
        debug_hint: `Erro ao fazer parse: ${parseErr}`,
        request_id: requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const { payment_id, email, order_id } = body;
    
    // ✅ Validar que temos ao menos payment_id ou order_id
    if (!payment_id && !order_id) {
      console.error(`[check-payment-status] ❌ Nenhum identificador fornecido! Request ID: ${requestId}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Necessário payment_id ou order_id',
        error_code: 'MISSING_IDENTIFIER',
        request_id: requestId
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    console.log('[check-payment-status] ==============================');
    console.log(`[check-payment-status] Request ID: ${requestId}`);
    console.log('[check-payment-status] 🔍 Verificando pagamento:', { payment_id, order_id, email });

    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    if (!MP_ACCESS_TOKEN) {
      throw new Error('MP_ACCESS_TOKEN não configurado');
    }

    // Se não temos payment_id, tentar buscar pelo order_id primeiro
    let actualPaymentId = payment_id;
    if (!actualPaymentId && order_id) {
      console.log('[check-payment-status] Buscando payment_id pelo order_id...');
      const ORIGINAL_SERVICE_ROLE_KEY = Deno.env.get('ORIGINAL_SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabaseTemp = createClient(ORIGINAL_SUPABASE_URL, ORIGINAL_SERVICE_ROLE_KEY);
      
      const { data: pendingPayment } = await supabaseTemp
        .from('pending_payments')
        .select('payment_id')
        .eq('order_id', order_id)
        .maybeSingle();
      
      if (pendingPayment?.payment_id) {
        actualPaymentId = pendingPayment.payment_id;
        console.log('[check-payment-status] ✅ payment_id encontrado:', actualPaymentId);
      }
    }
    
    if (!actualPaymentId) {
      console.error(`[check-payment-status] ❌ payment_id não encontrado para order_id: ${order_id}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'payment_id não encontrado',
        error_code: 'PAYMENT_NOT_FOUND',
        request_id: requestId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Consultar API do Mercado Pago
    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/${actualPaymentId}`,
      { headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` } }
    );

    if (!response.ok) {
      console.error('[check-payment-status] Erro ao buscar payment:', response.status);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Payment não encontrado no Mercado Pago',
        error_code: 'MP_FETCH_FAILED',
        request_id: requestId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const payment = await response.json();
    console.log('[check-payment-status] 📊 Status do payment:', payment.status);
    console.log('[check-payment-status] 📦 Metadata:', JSON.stringify(payment.metadata));

    // Se aprovado, processar criação de appointment
    if (payment.status === 'approved') {
      console.log('[check-payment-status] ✅ Pagamento APROVADO! Processando...');
      
      const schedulePayload = payment.metadata?.schedulePayload || payment.metadata?.schedule_payload;
      
      if (!schedulePayload) {
        console.error('[check-payment-status] ❌ schedulePayload NÃO encontrado no metadata!');
        console.error('[check-payment-status] Metadata keys:', Object.keys(payment.metadata || {}));
        return new Response(JSON.stringify({ 
          success: false,
          status: payment.status,
          approved: true,
          error: 'Dados de agendamento não encontrados no pagamento'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      console.log('[check-payment-status] 📋 schedulePayload encontrado:', JSON.stringify(schedulePayload));

      // ✅ CORREÇÃO: Usar URL e KEY fixa do projeto original (evita split-brain)
      const ORIGINAL_SERVICE_ROLE_KEY = Deno.env.get('ORIGINAL_SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      
      const supabase = createClient(
        ORIGINAL_SUPABASE_URL,
        ORIGINAL_SERVICE_ROLE_KEY
      );

      const supabaseAdmin = createClient(
        ORIGINAL_SUPABASE_URL,
        ORIGINAL_SERVICE_ROLE_KEY
      );

      const orderIdToCheck = payment.metadata?.order_id || order_id;

      // ✅ VERIFICAÇÃO DE DUPLICAÇÃO: Checar se já existe appointment com este order_id
      if (orderIdToCheck) {
        const { data: existingAppointment } = await supabaseAdmin
          .from('appointments')
          .select('appointment_id, redirect_url, provider')
          .eq('order_id', orderIdToCheck)
          .maybeSingle();
        
        if (existingAppointment) {
          console.log('[check-payment-status] ⚠️ Appointment já existe para order_id:', orderIdToCheck);
          console.log('[check-payment-status] Retornando dados existentes em vez de criar duplicado');
          
          // ✅ CORREÇÃO: Garantir que pending_payment seja marcado como processado
          try {
            const { error: updateError } = await supabaseAdmin
              .from('pending_payments')
              .update({ 
                processed: true, 
                processed_at: new Date().toISOString(),
                status: 'approved'
              })
              .eq('order_id', orderIdToCheck);
            
            if (updateError) {
              console.error('[check-payment-status] ⚠️ Erro ao atualizar pending_payment:', updateError);
            } else {
              console.log('[check-payment-status] ✅ pending_payment atualizado para processed=true');
            }
          } catch (updateErr) {
            console.error('[check-payment-status] ⚠️ Exceção ao atualizar pending_payment:', updateErr);
          }
          
          return new Response(JSON.stringify({ 
            success: true,
            status: payment.status,
            approved: true,
            redirect_url: existingAppointment.redirect_url,
            appointment_id: existingAppointment.appointment_id,
            existing: true
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // ✅ NOVO: Verificar se é SKU de PLANO (IND_* ou FAM_*)
      const sku = schedulePayload.sku || '';
      const isPlanPurchase = /^(IND_|FAM_)/.test(sku);

      if (isPlanPurchase) {
        console.log('[check-payment-status] 🎯 SKU de PLANO detectado:', sku);
        
        // Calcular expiração do plano (1 mês para mensal, 12 meses para anual)
        const planExpiresAt = new Date();
        if (sku.includes('_12M')) {
          planExpiresAt.setFullYear(planExpiresAt.getFullYear() + 1);
        } else {
          planExpiresAt.setMonth(planExpiresAt.getMonth() + 1);
        }
        
        // Buscar patient_id pelo email
        const patientEmail = schedulePayload.email?.toLowerCase()?.trim();
        let patientId = null;
        
        if (patientEmail) {
          const { data: patient } = await supabaseAdmin
            .from('patients')
            .select('id')
            .eq('email', patientEmail)
            .maybeSingle();
          patientId = patient?.id || null;
        }
        
        // Verificar se já existe um plano ativo
        const { data: existingPlan } = await supabaseAdmin
          .from('patient_plans')
          .select('id')
          .eq('email', patientEmail)
          .eq('plan_code', sku)
          .eq('status', 'active')
          .maybeSingle();
        
        let planCreatedSuccessfully = false;
        
        if (existingPlan) {
          console.log('[check-payment-status] ⚠️ Plano já existe e está ativo, atualizando expiração');
          
          const { error: updateError } = await supabaseAdmin
            .from('patient_plans')
            .update({
              plan_expires_at: planExpiresAt.toISOString().split('T')[0],
              updated_at: new Date().toISOString()
            })
            .eq('id', existingPlan.id);
          
          planCreatedSuccessfully = !updateError;
        } else {
          // Criar novo patient_plans
          const { error: planError } = await supabaseAdmin
            .from('patient_plans')
            .insert({
              email: patientEmail,
              patient_id: patientId,
              plan_code: sku,
              plan_expires_at: planExpiresAt.toISOString().split('T')[0],
              start_date: new Date().toISOString().split('T')[0],
              status: 'active',
              activated_at: new Date().toISOString(),
              activated_by: 'check-payment-status',
              payment_method: payment.payment_type_id || 'unknown'
            });
          
          if (planError) {
            console.error('[check-payment-status] ❌ Erro ao criar plano:', planError);
            planCreatedSuccessfully = false;
          } else {
            console.log('[check-payment-status] ✅ Plano criado com sucesso!');
            planCreatedSuccessfully = true;
          }
        }
        
        // ✅ CORREÇÃO: Verificar se o plano realmente foi criado antes de marcar como processado
        if (planCreatedSuccessfully) {
          // Verificar no banco se o plano existe (double-check)
          const { data: verifyPlan } = await supabaseAdmin
            .from('patient_plans')
            .select('id')
            .eq('email', patientEmail)
            .eq('plan_code', sku)
            .eq('status', 'active')
            .maybeSingle();
          
          if (!verifyPlan) {
            console.error('[check-payment-status] ❌ Verificação falhou: plano não encontrado após criação');
            return new Response(JSON.stringify({ 
              success: false,
              status: payment.status,
              approved: true,
              error: 'Plan verification failed - please refresh and try again'
            }), { 
              status: 200, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            });
          }
          
          // ✅ CADASTRAR NA CLICKLIFE AO CRIAR PLANO (redundância com mp-webhook)
          const { data: patientData } = await supabaseAdmin
            .from('patients')
            .select('cpf, first_name, last_name, phone_e164, gender, birth_date')
            .eq('email', patientEmail)
            .maybeSingle();
          
          if (patientData?.cpf) {
            const clickLifePlanoId = getClickLifePlanIdFromSku(sku);
            console.log('[check-payment-status] 🏥 Cadastrando na ClickLife com planoId:', clickLifePlanoId);
            
            const clicklifeResult = await registerClickLifePatient(
              patientData.cpf,
              `${patientData.first_name || ''} ${patientData.last_name || ''}`.trim(),
              patientEmail,
              patientData.phone_e164 || '',
              clickLifePlanoId,
              patientData.gender || 'F',
              patientData.birth_date
            );
            
            if (clicklifeResult.success) {
              console.log('[check-payment-status] ✅ Paciente cadastrado na ClickLife');
              await supabaseAdmin
                .from('patients')
                .update({ clicklife_registered_at: new Date().toISOString() })
                .eq('email', patientEmail);
            } else {
              console.warn('[check-payment-status] ⚠️ Falha no cadastro ClickLife:', clicklifeResult.error);
            }
          } else {
            console.warn('[check-payment-status] ⚠️ Paciente sem CPF, não foi possível cadastrar na ClickLife');
          }
          
          // Atualizar pending_payment como processado
          if (orderIdToCheck) {
            await supabaseAdmin
              .from('pending_payments')
              .update({ 
                processed: true, 
                processed_at: new Date().toISOString(), 
                status: 'approved' 
              })
              .eq('order_id', orderIdToCheck);
          }
          
          // Gravar métrica de venda para PLANO
          await supabaseAdmin.from('metrics').insert({
            metric_type: 'sale',
            sku: sku,
            metric_value: Math.round(payment.transaction_amount * 100),
            platform: 'plan_activation',
            metadata: { 
              payment_id: payment.id, 
              mp_status: payment.status,
              order_id: orderIdToCheck,
              source: 'check-payment-status',
              is_plan: true
            }
          });
          
          console.log('[check-payment-status] ✅ Plano processado, redirecionando para área do paciente');
          
          return new Response(JSON.stringify({ 
            success: true,
            status: 'approved',
            approved: true,
            redirect_url: '/area-do-paciente',
            is_plan: true,
            plan_code: sku
          }), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        } else {
          // Plano não foi criado - retornar erro para frontend tentar novamente
          console.error('[check-payment-status] ❌ Plano não foi criado, retornando erro');
          return new Response(JSON.stringify({ 
            success: false,
            status: payment.status,
            approved: true,
            error: 'Plan creation failed - system will retry automatically'
          }), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }
      }

      // ==========================================
      // FLUXO NORMAL PARA SERVIÇOS (NÃO É PLANO)
      // ==========================================
      console.log('[check-payment-status] 🎉 PIX/Cartão aprovado para SERVIÇO! Criando appointment...');

      // ✅ GUARD EXTRA: Verificar novamente se appointment já existe antes de chamar schedule-redirect
      // Isso evita race condition caso o webhook tenha criado entre a verificação inicial e aqui
      if (orderIdToCheck) {
        const { data: lastCheckApt } = await supabaseAdmin
          .from('appointments')
          .select('appointment_id, redirect_url, provider')
          .eq('order_id', orderIdToCheck)
          .maybeSingle();
        
        if (lastCheckApt) {
          console.log('[check-payment-status] ⚠️ Guard extra detectou appointment já existente');
          console.log('[check-payment-status] Retornando dados existentes:', lastCheckApt.appointment_id);
          
          // Garantir que pending_payment seja marcado como processado
          await supabaseAdmin
            .from('pending_payments')
            .update({ 
              processed: true, 
              processed_at: new Date().toISOString(),
              status: 'approved'
            })
            .eq('order_id', orderIdToCheck);
          
          return new Response(JSON.stringify({ 
            success: true,
            status: payment.status,
            approved: true,
            redirect_url: lastCheckApt.redirect_url,
            appointment_id: lastCheckApt.appointment_id,
            existing: true
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // ✅ CORREÇÃO: Chamar schedule-redirect via fetch direto com URL fixa do projeto original
      // NÃO usar supabase.functions.invoke() pois usa SUPABASE_URL que pode apontar para projeto errado
      const scheduleResponse = await fetch(
        `${ORIGINAL_SUPABASE_URL}/functions/v1/schedule-redirect`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${ORIGINAL_ANON_KEY}`,
            'apikey': ORIGINAL_ANON_KEY
          },
          body: JSON.stringify({
            cpf: schedulePayload.cpf,
            email: schedulePayload.email,
            nome: schedulePayload.nome,
            telefone: schedulePayload.telefone,
            especialidade: schedulePayload.especialidade || 'Clínico Geral',
            sku: schedulePayload.sku,
            horario_iso: schedulePayload.horario_iso || new Date().toISOString(),
            plano_ativo: schedulePayload.plano_ativo || false,
            order_id: orderIdToCheck,
            payment_id: payment.id,
            birth_date: schedulePayload.birth_date,
            sexo: schedulePayload.sexo
          })
        }
      );

      const scheduleData = scheduleResponse.ok ? await scheduleResponse.json() : null;
      const scheduleError = !scheduleResponse.ok ? { message: `HTTP ${scheduleResponse.status}` } : null;

      if (scheduleError) {
        console.error('[check-payment-status] Erro ao criar appointment:', scheduleError);
        return new Response(JSON.stringify({ 
          success: false,
          status: payment.status,
          error: 'Erro ao criar agendamento'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ✅ Se schedule-redirect retornou existing: true, não gravar métrica duplicada
      if (scheduleData?.existing) {
        console.log('[check-payment-status] ✅ Schedule-redirect retornou appointment existente, pulando métrica');
      } else {
        // Gravar métrica de venda para SERVIÇO (apenas se appointment foi recém-criado)
        try {
          await supabaseAdmin.from('metrics').insert({
            metric_type: 'sale',
            sku: schedulePayload.sku || 'UNKNOWN',
            metric_value: Math.round(payment.transaction_amount * 100),
            platform: scheduleData?.provider || 'unknown',
            metadata: { 
              payment_id: payment.id, 
              mp_status: payment.status,
              order_id: orderIdToCheck,
              source: 'check-payment-status'
            }
          });
        } catch (metricError) {
          // Se falhar por duplicação, apenas logar e continuar
          console.warn('[check-payment-status] ⚠️ Erro ao gravar métrica (pode ser duplicada):', metricError);
        }
      }

      // Marcar pending_payment como processado E status como approved
      if (orderIdToCheck) {
        await supabaseAdmin
          .from('pending_payments')
          .update({ 
            processed: true, 
            processed_at: new Date().toISOString(),
            status: 'approved'
          })
          .eq('order_id', orderIdToCheck);
      }

      console.log('[check-payment-status] ✅ Appointment criado:', scheduleData);

      return new Response(JSON.stringify({ 
        success: true,
        status: payment.status,
        approved: true,
        redirect_url: scheduleData?.url,
        appointment_id: scheduleData?.appointment_id
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Se ainda pending ou outro status
    return new Response(JSON.stringify({ 
      success: true,
      status: payment.status,
      approved: false
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`[check-payment-status] ❌ Error (Request ID: ${requestId}):`, error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      error_code: 'INTERNAL_ERROR',
      request_id: requestId
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
