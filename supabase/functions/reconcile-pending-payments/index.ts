import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ✅ URL FIXA do projeto original para evitar split-brain
// NÃO usar Deno.env.get('SUPABASE_URL') pois pode apontar para projeto errado
const ORIGINAL_SUPABASE_URL = 'https://ploqujuhpwutpcibedbr.supabase.co';
const ORIGINAL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3F1anVocHd1dHBjaWJlZGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NjYxODQsImV4cCI6MjA3MjM0MjE4NH0.WD3MXt1Y4sYxkaCPGgD0s8LdhPx_7eEQ1ewaFhnQ8-I';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReconciliationResult {
  order_id: string;
  payment_id: string;
  mp_status: string;
  action: string;
  redirect_url?: string;
  success: boolean;
  error?: string;
}

interface ReconciliationSummary {
  total_processed: number;
  approved_and_redirected: number;
  still_pending: number;
  rejected_or_cancelled: number;
  errors: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('[reconcile-pending-payments] ==============================');
  console.log('[reconcile-pending-payments] 🔄 Iniciando reconciliação em lote');

  try {
    // Parse request body
    const body = await req.json().catch(() => ({}));
    const limit = Math.min(body.limit || 50, 100); // Max 100 per batch
    const daysBack = body.days_back || 7;
    const dryRun = body.dry_run || false;

    console.log('[reconcile-pending-payments] Parâmetros:', { limit, daysBack, dryRun });

    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    if (!MP_ACCESS_TOKEN) {
      throw new Error('MP_ACCESS_TOKEN não configurado');
    }

    // ✅ CORREÇÃO: Usar URL e KEY fixa do projeto original para evitar split-brain
    const ORIGINAL_SERVICE_ROLE_KEY = Deno.env.get('ORIGINAL_SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(
      ORIGINAL_SUPABASE_URL,
      ORIGINAL_SERVICE_ROLE_KEY
    );

    // 1. Buscar pending_payments não processados
    // ✅ MELHORIA: Também buscar status='pending' para verificar se já foram aprovados no MP
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    console.log('[reconcile-pending-payments] Buscando pagamentos desde:', cutoffDate.toISOString());

    // Buscar pagamentos que:
    // - status = 'pending' (podem ter sido aprovados no MP mas não processados)
    // - OU status = 'approved' E processed = false (aprovados mas falharam no processamento)
    const { data: pendingPayments, error: fetchError } = await supabase
      .from('pending_payments')
      .select('*')
      .or('status.eq.pending,and(status.eq.approved,processed.eq.false)')
      .eq('processed', false) // Garantir que são não processados
      .gte('created_at', cutoffDate.toISOString())
      .not('payment_id', 'is', null)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (fetchError) {
      console.error('[reconcile-pending-payments] Erro ao buscar pagamentos:', fetchError);
      throw fetchError;
    }

    console.log('[reconcile-pending-payments] Pagamentos encontrados:', pendingPayments?.length || 0);

    if (!pendingPayments || pendingPayments.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Nenhum pagamento pendente para reconciliar',
        summary: {
          total_processed: 0,
          approved_and_redirected: 0,
          still_pending: 0,
          rejected_or_cancelled: 0,
          errors: 0
        },
        results: []
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2. Verificar quais já têm appointment
    const orderIds = pendingPayments.map(p => p.order_id).filter(Boolean);
    
    const { data: existingAppointments } = await supabase
      .from('appointments')
      .select('order_id')
      .in('order_id', orderIds);

    const existingOrderIds = new Set((existingAppointments || []).map(a => a.order_id));
    
    // Filtrar apenas os que NÃO têm appointment
    const paymentsToProcess = pendingPayments.filter(p => 
      !p.order_id || !existingOrderIds.has(p.order_id)
    );

    console.log('[reconcile-pending-payments] Pagamentos sem appointment:', paymentsToProcess.length);

    // 3. Processar cada pagamento
    const results: ReconciliationResult[] = [];
    const summary: ReconciliationSummary = {
      total_processed: 0,
      approved_and_redirected: 0,
      still_pending: 0,
      rejected_or_cancelled: 0,
      errors: 0
    };

    for (const payment of paymentsToProcess) {
      summary.total_processed++;
      
      const result: ReconciliationResult = {
        order_id: payment.order_id || '',
        payment_id: payment.payment_id || '',
        mp_status: 'unknown',
        action: 'none',
        success: false
      };

      try {
        console.log(`[reconcile-pending-payments] Processando payment_id: ${payment.payment_id}, status local: ${payment.status}`);

        // Consultar status ATUAL no Mercado Pago
        const mpResponse = await fetch(
          `https://api.mercadopago.com/v1/payments/${payment.payment_id}`,
          {
            headers: {
              'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
            }
          }
        );

        if (!mpResponse.ok) {
          console.error(`[reconcile-pending-payments] Erro MP API: ${mpResponse.status}`);
          result.error = `MP API error: ${mpResponse.status}`;
          summary.errors++;
          results.push(result);
          continue;
        }

        const mpPayment = await mpResponse.json();
        result.mp_status = mpPayment.status;

        console.log(`[reconcile-pending-payments] Status MP: ${mpPayment.status} (status local: ${payment.status})`);

        // ✅ MELHORIA: Se status local é 'pending' mas MP mostra 'approved', atualizar status local
        if (payment.status === 'pending' && mpPayment.status === 'approved') {
          console.log(`[reconcile-pending-payments] 🔄 Atualizando status local de 'pending' para 'approved'`);
          await supabase
            .from('pending_payments')
            .update({ status: 'approved' })
            .eq('id', payment.id);
        }

        // Processar conforme status
        if (mpPayment.status === 'approved') {
          // Tentar extrair schedulePayload do metadata ou payment_data local
          const schedulePayload = 
            mpPayment.metadata?.schedulePayload || 
            mpPayment.metadata?.schedule_payload ||
            (payment.payment_data as any)?.schedulePayload;

          // ✅ NOVO: Verificar se é SKU de PLANO
          const sku = schedulePayload?.sku || payment.sku || '';
          const isPlanPurchase = /^(IND_|FAM_)/.test(sku);

          if (isPlanPurchase && !dryRun) {
            // ==========================================
            // FLUXO ESPECIAL PARA PLANOS
            // ==========================================
            console.log(`[reconcile-pending-payments] 🎯 SKU de PLANO detectado: ${sku}`);
            
            // Calcular expiração do plano
            const planExpiresAt = new Date();
            if (sku.includes('_12M')) {
              planExpiresAt.setFullYear(planExpiresAt.getFullYear() + 1);
            } else {
              planExpiresAt.setMonth(planExpiresAt.getMonth() + 1);
            }
            
            // ✅ CORREÇÃO: Buscar patient_id E user_id pelo email
            const patientEmail = (schedulePayload?.email || payment.patient_email)?.toLowerCase()?.trim();
            let patientId = null;
            let userId = null;
            let patientData = null;
            
            if (patientEmail) {
              const { data: patient } = await supabase
                .from('patients')
                .select('id, user_id, first_name, last_name, cpf, phone_e164, gender, birth_date')  // ✅ Incluir user_id
                .eq('email', patientEmail)
                .maybeSingle();
              patientId = patient?.id || null;
              userId = patient?.user_id || null;  // ✅ NOVO: Capturar user_id
              patientData = patient;
            }
            
            console.log(`[reconcile-pending-payments] 👤 Patient lookup:`, { patientEmail, patientId, userId });
            
            // Verificar se já existe plano ativo
            const { data: existingPlan } = await supabase
              .from('patient_plans')
              .select('id')
              .eq('email', patientEmail)
              .eq('plan_code', sku)
              .eq('status', 'active')
              .maybeSingle();
            
            if (!existingPlan) {
              // Criar novo patient_plans
              const { error: planError } = await supabase
                .from('patient_plans')
                .insert({
                  email: patientEmail,
                  patient_id: patientId,
                  user_id: userId,  // ✅ CORREÇÃO: Incluir user_id
                  plan_code: sku,
                  plan_expires_at: planExpiresAt.toISOString().split('T')[0],
                  start_date: new Date().toISOString().split('T')[0],
                  status: 'active',
                  activated_at: new Date().toISOString(),
                  activated_by: 'reconcile-pending-payments',
                  payment_method: mpPayment.payment_type_id || 'unknown'
                });
              
              if (planError) {
                console.error(`[reconcile-pending-payments] ❌ Erro ao criar plano:`, planError);
                result.error = `Erro ao criar plano: ${planError.message}`;
                summary.errors++;
              } else {
                console.log(`[reconcile-pending-payments] ✅ Plano criado com sucesso!`);
                result.action = 'plan_created';
                result.redirect_url = '/area-do-paciente';
                result.success = true;
                summary.approved_and_redirected++;
                
                // ✅ CADASTRAR NA CLICKLIFE (igual ao mp-webhook)
                if (patientData?.cpf) {
                  console.log(`[reconcile-pending-payments] 🏥 Cadastrando paciente na ClickLife...`);
                  
                  const CLICKLIFE_API = Deno.env.get('CLICKLIFE_API_BASE');
                  const INTEGRATOR_TOKEN = Deno.env.get('CLICKLIFE_AUTH_TOKEN');
                  const PATIENT_PASSWORD = Deno.env.get('CLICKLIFE_PATIENT_DEFAULT_PASSWORD');
                  
                  if (CLICKLIFE_API && INTEGRATOR_TOKEN && PATIENT_PASSWORD) {
                    // Determinar planoId correto baseado no SKU
                    // FAMILIAR COM_ESP → 1238 | FAMILIAR SEM_ESP → 1237
                    // INDIVIDUAL COM_ESP → 864 | INDIVIDUAL SEM_ESP → 863
                    const isFamiliar = sku.includes('FAM');
                    const clickLifePlanoId = isFamiliar
                      ? (sku.includes('COM_ESP') ? 1238 : 1237)
                      : (sku.includes('COM_ESP') ? 864 : 
                         sku.includes('SEM_ESP') ? 863 : 
                         sku.startsWith('EMPRESA_') ? 864 : 864);
                    
                    const nomeCompleto = `${patientData.first_name || ''} ${patientData.last_name || ''}`.trim();
                    
                    // Formatar telefone
                    let telefoneLimpo = (patientData.phone_e164 || '').replace(/\D/g, '');
                    if (telefoneLimpo.startsWith('55')) {
                      telefoneLimpo = telefoneLimpo.substring(2);
                    }
                    
                    // Formatar data de nascimento (YYYY-MM-DD → DD-MM-YYYY)
                    let birthDateFormatted = '01-01-1990';
                    if (patientData.birth_date && patientData.birth_date !== '1990-01-01') {
                      const parts = patientData.birth_date.split('-');
                      if (parts.length === 3) {
                        birthDateFormatted = `${parts[2]}-${parts[1]}-${parts[0]}`;
                      }
                    }
                    
                    const registerPayload = {
                      nome: nomeCompleto || 'Paciente',
                      cpf: patientData.cpf.replace(/\D/g, ''),
                      email: patientEmail,
                      senha: PATIENT_PASSWORD,
                      datanascimento: birthDateFormatted,
                      sexo: patientData.gender || 'F',
                      telefone: telefoneLimpo,
                      logradouro: 'Rua Exemplo',
                      numero: '123',
                      bairro: 'Centro',
                      cep: '01000000',
                      cidade: 'São Paulo',
                      estado: 'SP',
                      empresaid: 9083,
                      planoid: clickLifePlanoId
                    };
                    
                    try {
                      // Cadastrar
                      const registerRes = await fetch(`${CLICKLIFE_API}/usuarios/usuarios`, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'authtoken': INTEGRATOR_TOKEN
                        },
                        body: JSON.stringify(registerPayload)
                      });
                      
                      const registerData = await registerRes.json();
                      
                      // Ativar
                      if (registerRes.ok || registerData.mensagem?.toLowerCase().includes('já cadastrado')) {
                        const activatePayload = {
                          authtoken: INTEGRATOR_TOKEN,
                          cpf: patientData.cpf.replace(/\D/g, ''),
                          empresaid: 9083,
                          planoid: clickLifePlanoId,
                          proposito: 'Ativar'
                        };
                        
                        const activateRes = await fetch(`${CLICKLIFE_API}/usuarios/ativacao`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'authtoken': INTEGRATOR_TOKEN
                          },
                          body: JSON.stringify(activatePayload)
                        });
                        
                        const activateData = await activateRes.json();
                        
                        if (activateRes.ok) {
                          console.log(`[reconcile-pending-payments] ✅ Paciente cadastrado/ativado na ClickLife`);
                          
                          await supabase
                            .from('patients')
                            .update({ clicklife_registered_at: new Date().toISOString() })
                            .eq('id', patientId);
                          
                          // Registrar auditoria
                          await supabase.from('clicklife_registrations').insert({
                            cpf: patientData.cpf,
                            patient_id: patientId,
                            status: 'success',
                            error_message: null,
                            registration_data: {
                              patient_email: patientEmail,
                              patient_name: nomeCompleto,
                              order_id: payment.order_id,
                              payment_id: payment.payment_id,
                              sku: sku,
                              service_name: `Plano ${sku}`,
                              clicklife_empresa_id: 9083,
                              clicklife_plano_id: clickLifePlanoId,
                              success: true,
                              source: 'reconcile-pending-payments'
                            }
                          });
                        } else {
                          console.warn(`[reconcile-pending-payments] ⚠️ Erro na ativação ClickLife:`, activateData);
                        }
                      }
                    } catch (clicklifeErr) {
                      console.error(`[reconcile-pending-payments] ❌ Erro ClickLife:`, clicklifeErr);
                    }
                  }
                }
              }
            } else {
              console.log(`[reconcile-pending-payments] ⚠️ Plano já existe`);
              result.action = 'plan_already_exists';
              result.success = true;
              summary.approved_and_redirected++;
            }
            
            // Atualizar pending_payments
            await supabase
              .from('pending_payments')
              .update({
                status: 'approved',
                processed: true,
                processed_at: new Date().toISOString()
              })
              .eq('id', payment.id);

          } else if (schedulePayload && !dryRun && !isPlanPurchase) {
            // ==========================================
            // FLUXO NORMAL PARA SERVIÇOS
            // ==========================================
            console.log(`[reconcile-pending-payments] Chamando schedule-redirect com order_id: ${payment.order_id}`);
            
            const enrichedPayload = {
              ...schedulePayload,
              order_id: payment.order_id,
              payment_id: payment.payment_id
            };
            
            // ✅ CORREÇÃO: Usar URL fixa do projeto original (evita split-brain)
            const scheduleResponse = await fetch(
              `${ORIGINAL_SUPABASE_URL}/functions/v1/schedule-redirect`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${ORIGINAL_ANON_KEY}`,
                  'apikey': ORIGINAL_ANON_KEY
                },
                body: JSON.stringify(enrichedPayload)
              }
            );

            const scheduleResult = await scheduleResponse.json();
            console.log(`[reconcile-pending-payments] schedule-redirect result:`, scheduleResult);

            if (scheduleResult.ok || scheduleResult.url) {
              result.action = 'appointment_created';
              result.redirect_url = scheduleResult.url;
              result.success = true;
              summary.approved_and_redirected++;

              // Atualizar pending_payments
              await supabase
                .from('pending_payments')
                .update({
                  status: 'approved',
                  processed: true,
                  processed_at: new Date().toISOString()
                })
                .eq('id', payment.id);

            } else {
              result.action = 'schedule_failed';
              result.error = scheduleResult.error || 'Falha ao criar appointment';
              summary.errors++;
            }
          } else if (dryRun) {
            result.action = isPlanPurchase ? 'would_create_plan' : 'would_create_appointment';
            result.success = true;
            summary.approved_and_redirected++;
          } else {
            // Aprovado mas sem schedulePayload
            console.warn(`[reconcile-pending-payments] Aprovado sem schedulePayload`);
            result.action = 'approved_no_payload';
            result.error = 'schedulePayload não encontrado';
            summary.errors++;

            // Mesmo assim, marcar como processado para não ficar em loop
            if (!dryRun) {
              await supabase
                .from('pending_payments')
                .update({
                  status: 'approved',
                  processed: true,
                  processed_at: new Date().toISOString()
                })
                .eq('id', payment.id);
            }
          }

        } else if (mpPayment.status === 'pending' || mpPayment.status === 'in_process') {
          result.action = 'still_pending';
          result.success = true;
          summary.still_pending++;
          // Não fazer nada, deixar pendente

        } else if (['rejected', 'cancelled', 'refunded', 'charged_back'].includes(mpPayment.status)) {
          result.action = 'marked_rejected';
          result.success = true;
          summary.rejected_or_cancelled++;

          // Atualizar status para refletir rejeição
          if (!dryRun) {
            await supabase
              .from('pending_payments')
              .update({
                status: mpPayment.status,
                processed: true,
                processed_at: new Date().toISOString()
              })
              .eq('id', payment.id);
          }
        } else {
          result.action = 'unknown_status';
          result.error = `Status desconhecido: ${mpPayment.status}`;
          summary.errors++;
        }

      } catch (error) {
        console.error(`[reconcile-pending-payments] Erro processando ${payment.payment_id}:`, error);
        result.error = error instanceof Error ? error.message : 'Erro desconhecido';
        summary.errors++;
      }

      results.push(result);
    }

    // ======================================================
    // BLOCO 2: Reconciliar patient_subscriptions pendentes
    // ======================================================
    console.log('[reconcile-pending-payments] 🔄 Iniciando reconciliação de subscriptions...');

    const subscriptionSummary = {
      total: 0,
      activated: 0,
      still_pending: 0,
      errors: 0
    };

    const { data: pendingSubs, error: subsError } = await supabase
      .from('patient_subscriptions')
      .select('*')
      .eq('mp_status', 'pending_first_payment')
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: true })
      .limit(limit);

    if (subsError) {
      console.error('[reconcile-pending-payments] Erro ao buscar subscriptions:', subsError);
    }

    console.log('[reconcile-pending-payments] Subscriptions pendentes encontradas:', pendingSubs?.length || 0);

    for (const sub of (pendingSubs || [])) {
      subscriptionSummary.total++;
      try {
        console.log(`[reconcile-pending-payments] Verificando subscription MP: ${sub.mp_subscription_id}`);

        // 1. Consultar preapproval no MP
        const preapprovalRes = await fetch(
          `https://api.mercadopago.com/preapproval/${sub.mp_subscription_id}`,
          { headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` } }
        );

        if (!preapprovalRes.ok) {
          console.error(`[reconcile-pending-payments] Erro MP preapproval: ${preapprovalRes.status}`);
          subscriptionSummary.errors++;
          continue;
        }

        const preapproval = await preapprovalRes.json();
        console.log(`[reconcile-pending-payments] Preapproval status: ${preapproval.status}, charged_quantity: ${preapproval.summarized?.charged_quantity}`);

        // 2. Consultar authorized_payments para verificar pagamento aprovado
        const authPaymentsRes = await fetch(
          `https://api.mercadopago.com/authorized_payments/search?preapproval_id=${sub.mp_subscription_id}`,
          { headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` } }
        );

        let firstPaymentApproved = false;
        if (authPaymentsRes.ok) {
          const authPayments = await authPaymentsRes.json();
          const approvedPayment = (authPayments.results || []).find(
            (p: any) => p.status === 'approved'
          );
          if (approvedPayment) {
            firstPaymentApproved = true;
            console.log(`[reconcile-pending-payments] ✅ Pagamento aprovado encontrado: ${approvedPayment.id}`);
          }
        }

        // Também considerar charged_quantity > 0 como aprovado
        if (!firstPaymentApproved && preapproval.summarized?.charged_quantity > 0) {
          firstPaymentApproved = true;
          console.log(`[reconcile-pending-payments] ✅ charged_quantity > 0, considerando aprovado`);
        }

        if (firstPaymentApproved && !dryRun) {
          // ATIVAR PLANO
          const subEmail = sub.email?.toLowerCase()?.trim();
          const planCode = sub.plan_code;

          // Verificar se já existe plano ativo
          const { data: existingPlan } = await supabase
            .from('patient_plans')
            .select('id')
            .eq('email', subEmail)
            .eq('plan_code', planCode)
            .eq('status', 'active')
            .maybeSingle();

          if (!existingPlan) {
            // Buscar patient
            let patientId = null;
            let userId = sub.user_id || null;
            let patientData = null;

            if (subEmail) {
              const { data: patient } = await supabase
                .from('patients')
                .select('id, user_id, first_name, last_name, cpf, phone_e164, gender, birth_date')
                .eq('email', subEmail)
                .maybeSingle();
              patientId = patient?.id || null;
              userId = userId || patient?.user_id || null;
              patientData = patient;
            }

            // Calcular expiração
            const planExpiresAt = new Date();
            planExpiresAt.setMonth(planExpiresAt.getMonth() + 1); // Subscriptions são mensais

            const { error: planError } = await supabase
              .from('patient_plans')
              .insert({
                email: subEmail,
                patient_id: patientId,
                user_id: userId,
                plan_code: planCode,
                plan_expires_at: planExpiresAt.toISOString().split('T')[0],
                start_date: new Date().toISOString().split('T')[0],
                status: 'active',
                is_recurring: true,
                mp_subscription_id: sub.mp_subscription_id,
                subscription_id: sub.id,
                activated_at: new Date().toISOString(),
                activated_by: 'reconcile-subscriptions',
                payment_method: 'credit_card'
              });

            if (planError) {
              console.error(`[reconcile-pending-payments] ❌ Erro ao criar plano de subscription:`, planError);
              subscriptionSummary.errors++;
            } else {
              console.log(`[reconcile-pending-payments] ✅ Plano de subscription ativado para ${subEmail}`);
              subscriptionSummary.activated++;

              // Atualizar mp_status na subscription
              await supabase
                .from('patient_subscriptions')
                .update({ mp_status: 'authorized', updated_at: new Date().toISOString() })
                .eq('id', sub.id);

              // ClickLife registration (mesmo fluxo)
              if (patientData?.cpf) {
                const CLICKLIFE_API = Deno.env.get('CLICKLIFE_API_BASE');
                const INTEGRATOR_TOKEN = Deno.env.get('CLICKLIFE_AUTH_TOKEN');
                const PATIENT_PASSWORD = Deno.env.get('CLICKLIFE_PATIENT_DEFAULT_PASSWORD');

                if (CLICKLIFE_API && INTEGRATOR_TOKEN && PATIENT_PASSWORD) {
                  const isFamiliar = planCode.includes('FAM');
                  const clickLifePlanoId = isFamiliar
                    ? (planCode.includes('COM_ESP') ? 1238 : 1237)
                    : (planCode.includes('COM_ESP') ? 864 : 863);

                  const nomeCompleto = `${patientData.first_name || ''} ${patientData.last_name || ''}`.trim();
                  let telefoneLimpo = (patientData.phone_e164 || '').replace(/\D/g, '');
                  if (telefoneLimpo.startsWith('55')) telefoneLimpo = telefoneLimpo.substring(2);

                  let birthDateFormatted = '01-01-1990';
                  if (patientData.birth_date && patientData.birth_date !== '1990-01-01') {
                    const parts = patientData.birth_date.split('-');
                    if (parts.length === 3) birthDateFormatted = `${parts[2]}-${parts[1]}-${parts[0]}`;
                  }

                  try {
                    const registerRes = await fetch(`${CLICKLIFE_API}/usuarios/usuarios`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'authtoken': INTEGRATOR_TOKEN },
                      body: JSON.stringify({
                        nome: nomeCompleto || 'Paciente',
                        cpf: patientData.cpf.replace(/\D/g, ''),
                        email: subEmail,
                        senha: PATIENT_PASSWORD,
                        datanascimento: birthDateFormatted,
                        sexo: patientData.gender || 'F',
                        telefone: telefoneLimpo,
                        logradouro: 'Rua Exemplo', numero: '123', bairro: 'Centro',
                        cep: '01000000', cidade: 'São Paulo', estado: 'SP',
                        empresaid: 9083, planoid: clickLifePlanoId
                      })
                    });
                    const registerData = await registerRes.json();

                    if (registerRes.ok || registerData.mensagem?.toLowerCase().includes('já cadastrado')) {
                      await fetch(`${CLICKLIFE_API}/usuarios/ativacao`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'authtoken': INTEGRATOR_TOKEN },
                        body: JSON.stringify({
                          authtoken: INTEGRATOR_TOKEN,
                          cpf: patientData.cpf.replace(/\D/g, ''),
                          empresaid: 9083, planoid: clickLifePlanoId, proposito: 'Ativar'
                        })
                      });
                      console.log(`[reconcile-pending-payments] ✅ ClickLife sync para subscription`);

                      await supabase
                        .from('patients')
                        .update({ clicklife_registered_at: new Date().toISOString() })
                        .eq('id', patientId);
                    }
                  } catch (clErr) {
                    console.error(`[reconcile-pending-payments] ❌ ClickLife error:`, clErr);
                  }
                }
              }
            }
          } else {
            console.log(`[reconcile-pending-payments] ⚠️ Plano já existe para ${subEmail}`);
            subscriptionSummary.activated++;
            // Atualizar mp_status mesmo assim
            await supabase
              .from('patient_subscriptions')
              .update({ mp_status: 'authorized', updated_at: new Date().toISOString() })
              .eq('id', sub.id);
          }
        } else if (firstPaymentApproved && dryRun) {
          console.log(`[reconcile-pending-payments] [DRY RUN] Ativaria plano para ${sub.email}`);
          subscriptionSummary.activated++;
        } else if (['cancelled', 'paused'].includes(preapproval.status)) {
          console.log(`[reconcile-pending-payments] Subscription ${sub.mp_subscription_id} cancelada/pausada no MP`);
          if (!dryRun) {
            await supabase
              .from('patient_subscriptions')
              .update({ mp_status: preapproval.status, updated_at: new Date().toISOString() })
              .eq('id', sub.id);
          }
          subscriptionSummary.still_pending++;
        } else {
          console.log(`[reconcile-pending-payments] Subscription ainda pendente: ${sub.mp_subscription_id}`);
          subscriptionSummary.still_pending++;
        }
      } catch (err) {
        console.error(`[reconcile-pending-payments] Erro processando subscription ${sub.mp_subscription_id}:`, err);
        subscriptionSummary.errors++;
      }
    }

    console.log('[reconcile-pending-payments] Subscription summary:', subscriptionSummary);

    console.log('[reconcile-pending-payments] ==============================');
    console.log('[reconcile-pending-payments] ✅ Reconciliação concluída');
    console.log('[reconcile-pending-payments] Summary:', summary);
    console.log('[reconcile-pending-payments] Subscription summary:', subscriptionSummary);

    return new Response(JSON.stringify({
      success: true,
      dry_run: dryRun,
      summary,
      subscription_summary: subscriptionSummary,
      results
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[reconcile-pending-payments] ❌ Erro geral:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
