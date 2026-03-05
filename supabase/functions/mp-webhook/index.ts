import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getWebhookCorsHeaders } from '../common/cors.ts';

const corsHeaders = getWebhookCorsHeaders(); // Webhooks need wildcard CORS

// ✅ URL FIXA do projeto original - NÃO usar Deno.env.get('SUPABASE_URL')
// Isso evita o problema de split-brain onde o webhook roda em um projeto diferente
const ORIGINAL_SUPABASE_URL = 'https://ploqujuhpwutpcibedbr.supabase.co';
const ORIGINAL_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3F1anVocHd1dHBjaWJlZGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NjYxODQsImV4cCI6MjA3MjM0MjE4NH0.WD3MXt1Y4sYxkaCPGgD0s8LdhPx_7eEQ1ewaFhnQ8-I';

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
    'URO1099': 'Urologista',
    'IMU4471': 'Imunologista',
    'PRC6621': 'Proctologista',
    'PNE7783': 'Pneumologista',
    'ZXW2165': 'Psicólogo - 1 sessão',
    'HXR8516': 'Psicólogo - 4 sessões',
    'YME9025': 'Psicólogo - 8 sessões',
    'OVM9892': 'Laudo Psicológico',
  };

  if (sku.startsWith('IND_')) return 'Plano Individual';
  if (sku.startsWith('FAM_') || sku === 'FAMILY') return 'Plano Familiar';

  return SERVICE_NAMES[sku] || sku;
}

// ✅ NOVO: Helper function to register patient in Communicare (após compra)
async function registerCommunicarePatientSimple(
  cpf: string,
  nome: string,
  email: string,
  telefone: string,
  sexo: string,
  birthDate?: string
): Promise<{ success: boolean; patientId?: number; error?: string }> {
  const PATIENTS_BASE = Deno.env.get('COMMUNICARE_PATIENTS_BASE') || 
                        'https://api-patients-production.communicare.com.br';
  const API_TOKEN = Deno.env.get('COMMUNICARE_API_TOKEN');

  if (!API_TOKEN) {
    console.log('[registerCommunicare] ⚠️ COMMUNICARE_API_TOKEN não configurado - pulando cadastro');
    return { success: false, error: 'COMMUNICARE_API_TOKEN não configurado' };
  }

  try {
    console.log('[registerCommunicare] 📝 Iniciando cadastro do paciente na Communicare');
    console.log('[registerCommunicare] CPF:', cpf.substring(0, 3) + '***');
    console.log('[registerCommunicare] birth_date recebido:', birthDate || 'NULL');

    const cpfClean = cpf.replace(/\D/g, '');
    const phoneClean = telefone.replace(/\D/g, '');
    
    // Extrair DDI e número (ex: +5511999999999 → ddi: 55, mobile: 11999999999)
    const ddi = phoneClean.startsWith('55') ? '55' : '55';
    const mobileNumber = phoneClean.replace(/^55/, '');
    
    // Converter birth_date de YYYY-MM-DD para DDMMYYYY (formato Communicare)
    let birthDateFormatted = "01011990"; // Fallback
    let usedFallback = true;
    
    if (birthDate && birthDate !== '1990-01-01') {
      try {
        const parts = birthDate.split('-');
        if (parts.length === 3) {
          const [year, month, day] = parts;
          // Validar que não é uma data genérica
          if (year !== '1990' || month !== '01' || day !== '01') {
            birthDateFormatted = `${day}${month}${year}`;
            usedFallback = false;
            console.log('[registerCommunicare] ✅ Data de nascimento REAL:', birthDate, '→', birthDateFormatted);
          }
        }
      } catch (e) {
        console.warn('[registerCommunicare] Erro ao converter birth_date:', e);
      }
    }
    
    if (usedFallback) {
      console.warn('[registerCommunicare] ⚠️ FALLBACK: Usando data genérica 01011990 (birth_date original:', birthDate, ')');
    }

    // Mapear gênero
    const genderFormatted = (sexo === 'M' || sexo === 'F') ? sexo : 'M';

    const patientPayload = {
      name: nome,
      cpf: cpfClean,
      mobileNumber: mobileNumber,
      email: email,
      ddi: ddi,
      birthDate: birthDateFormatted,
      gender: genderFormatted,
      workingArea: "Outro",
      jogPosition: "Outro",
    };
    
    console.log('[registerCommunicare] Payload:', JSON.stringify(patientPayload, null, 2));

    const res = await fetch(`${PATIENTS_BASE}/v1/patient`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api_token': API_TOKEN,
      },
      body: JSON.stringify(patientPayload)
    });
    
    const resText = await res.text();
    console.log('[registerCommunicare] Response status:', res.status);
    console.log('[registerCommunicare] Response body:', resText);
    
    // 201 = criado, 409 = já existe (ambos são sucesso)
    if (res.status === 201 || res.status === 409 || res.status === 200) {
      console.log('[registerCommunicare] ✅ Paciente criado ou já existente na Communicare');
      
      let patientId: number | undefined;
      
      try {
        const postData = JSON.parse(resText);
        patientId = postData.id || postData.patientId;
        
        if (patientId) {
          console.log('[registerCommunicare] ✓ patientId obtido:', patientId);
          return { success: true, patientId };
        }
      } catch (e) {
        console.log('[registerCommunicare] POST response não contém ID, consultando via GET...');
      }
      
      // Se não tiver ID no POST, fazer GET
      const getRes = await fetch(`${PATIENTS_BASE}/v1/patient?cpf=${cpfClean}`, {
        method: 'GET',
        headers: { 'api_token': API_TOKEN }
      });
      
      if (getRes.ok) {
        const getBody = await getRes.text();
        try {
          const getData = JSON.parse(getBody);
          if (Array.isArray(getData)) {
            patientId = getData[0]?.id;
          } else {
            patientId = getData.id;
          }
          
          if (patientId) {
            console.log('[registerCommunicare] ✓ patientId obtido via GET:', patientId);
            return { success: true, patientId };
          }
        } catch (e) {
          console.error('[registerCommunicare] Erro ao parsear GET response:', e);
        }
      }
      
      // Sucesso sem ID é ok (paciente criado)
      return { success: true };
    }
    
    console.error('[registerCommunicare] ❌ Erro ao criar paciente:', res.status, resText);
    return { success: false, error: `HTTP ${res.status}: ${resText}` };

  } catch (error) {
    console.error('[registerCommunicare] ❌ Exception:', error);
    return { success: false, error: error.message || 'Exception during Communicare registration' };
  }
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

    console.log('[registerClickLife] birth_date recebido:', birthDate || 'NULL');
    
    // Normalizar e converter data de nascimento para DD-MM-YYYY
    let birthDateFormatted = '01-01-1990'; // fallback
    let usedFallback = true;
    
    if (birthDate && birthDate !== '1990-01-01') {
      if (birthDate.includes('-')) {
        const parts = birthDate.split('-');
        if (parts.length === 3) {
          if (parts[0].length === 4) {
            // YYYY-MM-DD -> DD-MM-YYYY
            const [year, month, day] = parts;
            // Validar que não é data genérica
            if (year !== '1990' || month !== '01' || day !== '01') {
              birthDateFormatted = `${day}-${month}-${year}`;
              usedFallback = false;
              console.log('[registerClickLife] ✅ Data de nascimento REAL:', birthDate, '→', birthDateFormatted);
            }
          } else {
            // Já está em DD-MM-YYYY
            birthDateFormatted = birthDate;
            usedFallback = false;
          }
        }
      }
    }
    
    if (usedFallback) {
      console.warn('[registerClickLife] ⚠️ FALLBACK: Usando data genérica 01-01-1990 (birth_date original:', birthDate, ')');
    }

    const PATIENT_PASSWORD = Deno.env.get('CLICKLIFE_PATIENT_DEFAULT_PASSWORD');
    if (!PATIENT_PASSWORD) {
      console.error('[registerClickLife] ❌ CLICKLIFE_PATIENT_DEFAULT_PASSWORD não configurado');
      return { success: false, error: 'Variável de ambiente CLICKLIFE_PATIENT_DEFAULT_PASSWORD não configurada' };
    }
    
    // Payload de cadastro com campos corretos (igual ao activate-clicklife-manual)
    const registerPayload = {
      nome,
      cpf: cpf.replace(/\D/g, ''),
      email,
      senha: PATIENT_PASSWORD,
      datanascimento: birthDateFormatted,
      sexo: sexo || 'F',
      telefone: numero,
      logradouro: 'Rua Exemplo',
      numero: '123',
      bairro: 'Centro',
      cep: '01000000',
      cidade: 'São Paulo',
      estado: 'SP',
      empresaid: 9083,
      planoid: planoId
    };

    console.log('[registerClickLife] Payload de cadastro:', {
      ...registerPayload,
      senha: '***',
      cpf: registerPayload.cpf.substring(0, 3) + '***'
    });

    // 1. CADASTRAR PACIENTE
    const registerRes = await fetch(`${CLICKLIFE_API}/usuarios/usuarios`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authtoken': INTEGRATOR_TOKEN
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
      authtoken: INTEGRATOR_TOKEN,
      cpf: cpf.replace(/\D/g, ''),
      empresaid: 9083,
      planoid: planoId,
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

// ✅ NOVO: Helper para enviar evento purchase_confirmed via Meta CAPI com deduplicação
async function sendPurchaseConfirmedCAPI(
  supabaseAdmin: any,
  orderId: string | null,
  paymentId: string | number,
  value: number,
  schedulePayload: any
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  
  const eventId = String(paymentId);
  
  try {
    // 1. Verificar deduplicação (por order_id OU payment_id)
    let queryBuilder = supabaseAdmin
      .from('pending_payments')
      .select('purchase_confirmed_sent')
      .eq('purchase_confirmed_sent', true);
    
    if (orderId) {
      queryBuilder = queryBuilder.eq('order_id', orderId);
    } else {
      queryBuilder = queryBuilder.eq('payment_id', String(paymentId));
    }
    
    const { data: existing } = await queryBuilder.maybeSingle();
    
    if (existing?.purchase_confirmed_sent) {
      console.log('[CAPI] ⚠️ purchase_confirmed já enviado, pulando:', { orderId, paymentId });
      return { success: true, skipped: true };
    }

    // 2. Preparar payload CAPI
    const capiPayload = {
      event_name: 'purchase_confirmed',
      event_time: Math.floor(Date.now() / 1000),
      event_source_url: 'https://prontiasaude.com.br/pagamento',
      value: value,
      currency: 'BRL',
      order_id: orderId || eventId,
      fbp: schedulePayload?.fbp,
      fbc: schedulePayload?.fbc,
      client_user_agent: schedulePayload?.client_user_agent,
    };

    console.log('[CAPI] 📤 Enviando purchase_confirmed:', {
      event_id: eventId,
      order_id: capiPayload.order_id,
      value: capiPayload.value,
      has_fbp: !!capiPayload.fbp,
      has_fbc: !!capiPayload.fbc,
    });

    // 3. Chamar edge function meta-capi com SERVICE_ROLE_KEY
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    const res = await fetch(`${SUPABASE_URL}/functions/v1/meta-capi`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify(capiPayload),
    });

    const result = await res.json();
    
    if (!res.ok) {
      console.error('[CAPI] ❌ Erro ao enviar:', result);
      return { success: false, error: result.error || 'Meta CAPI error' };
    }

    console.log('[CAPI] ✅ purchase_confirmed enviado:', result);

    // 4. Marcar como enviado (deduplicação)
    if (orderId) {
      await supabaseAdmin
        .from('pending_payments')
        .update({ 
          purchase_confirmed_sent: true,
          purchase_confirmed_event_id: eventId
        })
        .eq('order_id', orderId);
    } else {
      await supabaseAdmin
        .from('pending_payments')
        .update({ 
          purchase_confirmed_sent: true,
          purchase_confirmed_event_id: eventId
        })
        .eq('payment_id', String(paymentId));
    }

    return { success: true };
    
  } catch (error) {
    console.error('[CAPI] ❌ Exception:', error);
    return { success: false, error: error.message || 'Exception' };
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let rawBody = '';
  let parsedPaymentId: string | null = null;
  let parsedAction: string | null = null;
  let auditId: string | null = null;

  // Criar cliente Supabase para auditoria (no início, antes de qualquer parsing)
  // ✅ CORRIGIDO: Usar URL e KEY fixa do projeto original para evitar split-brain
  const ORIGINAL_SERVICE_ROLE_KEY = Deno.env.get('ORIGINAL_SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAudit = createClient(
    ORIGINAL_SUPABASE_URL,
    ORIGINAL_SERVICE_ROLE_KEY
  );

  try {
    // ✅ AUDITORIA: Ler body como texto primeiro para registrar ANTES de qualquer parsing
    rawBody = await req.text();
    
    // Tentar parsear para extrair IDs
    let body: any = {};
    try {
      body = JSON.parse(rawBody);
      parsedPaymentId = body?.data?.id?.toString() || null;
      parsedAction = body?.action || body?.type || null;
    } catch (parseErr) {
      // Registrar erro de parsing na auditoria
      console.error('[mp-webhook] ❌ Erro ao parsear body:', parseErr);
      
      const { data: auditData } = await supabaseAudit.from('webhook_audit').insert({
        source: 'mercadopago',
        raw_body: rawBody.substring(0, 10000),
        processing_status: 'parse_error',
        error_message: parseErr instanceof Error ? parseErr.message : 'Parse error',
        processing_time_ms: Date.now() - startTime
      }).select('id').single();
      
      auditId = auditData?.id;
      
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ✅ AUDITORIA: Registrar webhook recebido IMEDIATAMENTE (antes de qualquer lógica)
    const { data: auditData } = await supabaseAudit.from('webhook_audit').insert({
      source: 'mercadopago',
      raw_body: rawBody.substring(0, 10000),
      parsed_payment_id: parsedPaymentId,
      parsed_action: parsedAction,
      processing_status: 'received'
    }).select('id').single();
    
    auditId = auditData?.id;
    console.log('[mp-webhook] 📋 Auditoria registrada:', auditId);
    
    console.log('[mp-webhook] ========================================');
    console.log('[mp-webhook] 📥 WEBHOOK RECEBIDO:', new Date().toISOString());
    console.log('[mp-webhook] Action:', body.action);
    console.log('[mp-webhook] Payment ID:', body.data?.id);
    console.log('[mp-webhook] Type:', body.type);
    console.log('[mp-webhook] ========================================');

    // ✅ NOVO: Detectar e processar eventos de SUBSCRIPTION (assinaturas recorrentes)
    const subscriptionEventTypes = [
      'subscription_preapproval',
      'subscription_authorized_payment',
      'subscription_preapproval_plan'
    ];
    
    if (subscriptionEventTypes.includes(body.type)) {
      console.log('[mp-webhook] 🔄 EVENTO DE SUBSCRIPTION DETECTADO:', body.type);
      console.log('[mp-webhook] Subscription ID:', body.data?.id);
      console.log('[mp-webhook] Action:', body.action);
      
      // Processar subscription usando a lógica do mp-subscription-webhook
      try {
        const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
        
        // Buscar detalhes da subscription no Mercado Pago
        const mpResponse = await fetch(`https://api.mercadopago.com/preapproval/${body.data.id}`, {
          headers: {
            'Authorization': `Bearer ${MP_ACCESS_TOKEN}`
          }
        });

        if (!mpResponse.ok) {
          console.error('[mp-webhook] Erro ao buscar subscription:', mpResponse.status);
          return new Response(JSON.stringify({ success: true, message: 'Subscription fetch failed' }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const subscriptionData = await mpResponse.json();
        console.log('[mp-webhook] Subscription data:', {
          id: subscriptionData.id,
          status: subscriptionData.status,
          payer_email: subscriptionData.payer_email,
          next_payment_date: subscriptionData.next_payment_date
        });

        // Criar cliente Supabase com URL fixa
        const ORIGINAL_SERVICE_ROLE_KEY = Deno.env.get('ORIGINAL_SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabaseAdmin = createClient(ORIGINAL_SUPABASE_URL, ORIGINAL_SERVICE_ROLE_KEY);

        // Buscar subscription no banco pelo mp_subscription_id
        const { data: dbSubscription } = await supabaseAdmin
          .from('patient_subscriptions')
          .select('*, patient_plans!patient_plans_subscription_id_fkey(*)')
          .eq('mp_subscription_id', String(subscriptionData.id))
          .maybeSingle();

        const action = body.action;
        
        // Processar ações de subscription
        if (action === 'updated' || action === 'created') {
          if (dbSubscription) {
            await supabaseAdmin
              .from('patient_subscriptions')
              .update({
                mp_status: subscriptionData.status,
                next_payment_date: subscriptionData.next_payment_date,
                updated_at: new Date().toISOString()
              })
              .eq('id', dbSubscription.id);
            console.log('[mp-webhook] ✅ Subscription atualizada:', dbSubscription.id);
          }
        } else if (body.type === 'subscription_authorized_payment') {
          // Pagamento recorrente aprovado - renovar plano
          console.log('[mp-webhook] 🎉 Pagamento recorrente APROVADO!');
          
          if (dbSubscription) {
            const frequency = subscriptionData.auto_recurring?.frequency || dbSubscription.frequency || 1;
            const frequencyType = subscriptionData.auto_recurring?.frequency_type || dbSubscription.frequency_type || 'months';

            // Calcular nova data de expiração
            const currentExpiry = dbSubscription.patient_plans?.[0]?.plan_expires_at 
              ? new Date(dbSubscription.patient_plans[0].plan_expires_at)
              : new Date();
            
            const newExpiry = new Date(currentExpiry);
            if (frequencyType === 'months') {
              newExpiry.setMonth(newExpiry.getMonth() + frequency);
            } else {
              newExpiry.setDate(newExpiry.getDate() + frequency);
            }

            // Atualizar patient_subscriptions
            await supabaseAdmin
              .from('patient_subscriptions')
              .update({
                mp_status: 'authorized',
                last_payment_date: new Date().toISOString(),
                next_payment_date: subscriptionData.next_payment_date || newExpiry.toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', dbSubscription.id);

            // Atualizar patient_plans com nova data de expiração
            if (dbSubscription.patient_plans?.[0]) {
              await supabaseAdmin
                .from('patient_plans')
                .update({
                  plan_expires_at: newExpiry.toISOString().split('T')[0],
                  status: 'active',
                  updated_at: new Date().toISOString()
                })
                .eq('id', dbSubscription.patient_plans[0].id);

              console.log('[mp-webhook] ✅ Plano RENOVADO até:', newExpiry.toISOString());
            }

            // Registrar métrica de renovação
            await supabaseAdmin.from('metrics').insert({
              metric_type: 'subscription_renewed',
              patient_email: dbSubscription.email,
              plan_code: dbSubscription.plan_code,
              amount_cents: dbSubscription.amount_cents,
              status: 'approved',
              metadata: {
                mp_subscription_id: subscriptionData.id,
                new_expiry: newExpiry.toISOString(),
                frequency: frequency,
                frequency_type: frequencyType
              }
            });
          }
        } else if (action === 'cancelled') {
          // Subscription cancelada
          console.log('[mp-webhook] ⛔ Subscription CANCELADA');
          
          if (dbSubscription) {
            await supabaseAdmin
              .from('patient_subscriptions')
              .update({
                mp_status: 'cancelled',
                updated_at: new Date().toISOString()
              })
              .eq('id', dbSubscription.id);

            // Marcar plano como não-recorrente
            if (dbSubscription.patient_plans?.[0]) {
              await supabaseAdmin
                .from('patient_plans')
                .update({
                  subscription_status: 'cancelled',
                  updated_at: new Date().toISOString()
                })
                .eq('id', dbSubscription.patient_plans[0].id);
            }
          }
        }

        // Atualizar auditoria
        if (auditId) {
          await supabaseAudit.from('webhook_audit').update({
            processing_status: 'processed',
            processing_time_ms: Date.now() - startTime
          }).eq('id', auditId);
        }

        return new Response(JSON.stringify({ 
          success: true, 
          message: 'Subscription event processed',
          subscription_id: subscriptionData.id 
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } catch (subError) {
        console.error('[mp-webhook] Erro ao processar subscription:', subError);
        return new Response(JSON.stringify({ success: true, message: 'Subscription processing error' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== FLUXO DE PAGAMENTOS NORMAIS ====================
    
    // Aceitar múltiplos formatos de action do Mercado Pago
    const action = (body.action || '').toLowerCase();
    const validActions = ['payment.updated', 'payment.created', 'updated', 'created'];

    if (!validActions.includes(action)) {
      console.log('[mp-webhook] Ignorando action não relacionada a pagamentos:', body.action);
      
      // Atualizar auditoria
      if (auditId) {
        await supabaseAudit.from('webhook_audit').update({
          processing_status: 'ignored',
          processing_time_ms: Date.now() - startTime
        }).eq('id', auditId);
      }
      
      return new Response(JSON.stringify({ success: true, message: 'Action ignored' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('[mp-webhook] ✅ Action aceita:', body.action);

    const paymentId = body.data?.id;
    if (!paymentId) {
      console.error('[mp-webhook] Payment ID não encontrado');
      
      // Atualizar auditoria
      if (auditId) {
        await supabaseAudit.from('webhook_audit').update({
          processing_status: 'error',
          error_message: 'Payment ID não encontrado',
          processing_time_ms: Date.now() - startTime
        }).eq('id', auditId);
      }
      
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
        // ✅ CORRIGIDO: Usar URL e KEY fixa do projeto original
        const ORIGINAL_SRK = Deno.env.get('ORIGINAL_SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabaseAdmin = createClient(
          ORIGINAL_SUPABASE_URL,
          ORIGINAL_SRK
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

      // ✅ CORRIGIDO: Usar URL fixa E service role key do projeto original (com fallback)
      const ORIGINAL_SRK_PLAN = Deno.env.get('ORIGINAL_SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabaseAdmin = createClient(
        ORIGINAL_SUPABASE_URL,
        ORIGINAL_SRK_PLAN
      );

      // ✅ GARANTIR que o registro do paciente existe COM email e user_id
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
          
          // ✅ CORREÇÃO: Marcar como processado mesmo quando encontra duplicado
          await supabaseAdmin
            .from('pending_payments')
            .update({ 
              processed: true, 
              processed_at: new Date().toISOString(),
              status: 'approved'
            })
            .eq('order_id', orderId);
          console.log('[mp-webhook] ✅ pending_payment marcado como processed=true (duplicação plano)');
          
          return new Response(
            JSON.stringify({ ok: true, message: 'Order already processed', appointment_id: existingAppointment.appointment_id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }
      }
      
      // 🔍 BUSCAR user_id via auth.users pelo email (para garantir vinculação correta)
      const { data: authUsers } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1 });
      let authUserId: string | null = null;
      
      // Buscar usuário pelo email em auth.users
      const { data: usersByEmail } = await supabaseAdmin.rpc('current_user_email'); // fallback
      
      // Busca direta pelo email no auth
      try {
        const { data: authUserData } = await supabaseAdmin.auth.admin.getUserById('');
        // Fallback: buscar via query em patients que já tem o id do auth
      } catch (_) {}

      // ✅ CORREÇÃO: Buscar id, user_id e email do paciente
      const { data: existingPatient } = await supabaseAdmin
        .from('patients')
        .select('id, user_id, email')  // ✅ Incluir user_id
        .eq('email', schedulePayload.email)
        .maybeSingle();

      let patientId: string | null = null;
      
      if (existingPatient) {
        patientId = existingPatient.id;           // ✅ UUID da tabela patients
        userId = existingPatient.user_id || null; // ✅ CORREÇÃO: UUID de auth.users (não patients.id!)
        console.log('[mp-webhook] ✅ Patient já existe:', { patientId, userId });
        
        // ✅ GARANTIR que email está preenchido no paciente
        if (!existingPatient.email) {
          await supabaseAdmin
            .from('patients')
            .update({ email: schedulePayload.email })
            .eq('id', patientId);
          console.log('[mp-webhook] ✅ Email atualizado no patient existente');
        }
      } else {
        console.log('[mp-webhook] 🆕 Criando registro de paciente para:', schedulePayload.email);
        
        // Criar registro básico do paciente
        const { data: newPatient, error: patientError } = await supabaseAdmin
          .from('patients')
          .insert({
            email: schedulePayload.email,
            first_name: schedulePayload.nome?.split(' ')[0] || '',
            last_name: schedulePayload.nome?.split(' ').slice(1).join(' ') || '',
            cpf: schedulePayload.cpf || null,
            phone_e164: schedulePayload.telefone || null,
            profile_complete: false,
            clubeben_status: 'pending'
          })
          .select('id, user_id')  // ✅ Retornar user_id também
          .single();
        
        if (patientError) {
          console.error('[mp-webhook] ❌ Erro ao criar patient:', patientError);
        } else if (newPatient) {
          console.log('[mp-webhook] ✅ Patient criado com sucesso:', newPatient.id);
          patientId = newPatient.id;
          userId = newPatient.user_id || null;  // ✅ Capturar user_id do novo paciente
          
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

      // ✅ CRIAR patient_plans COM user_id E patient_id CORRETOS
      console.log('[mp-webhook] 📝 Criando plano:', { userId, patientId, email: schedulePayload.email });
      
      const { error: planError } = await supabaseAdmin
        .from('patient_plans')
        .insert({
          user_id: userId,       // ✅ UUID de auth.users (pode ser null se não registrado)
          patient_id: patientId, // ✅ UUID de patients
          email: schedulePayload.email,
          plan_code: schedulePayload.sku,
          plan_expires_at: planExpiresAt.toISOString(),
          status: 'active',
          activated_at: new Date().toISOString(),
          activated_by: 'mp-webhook'
        });

      // ✅ CORREÇÃO: Se falhou ao criar plano, NÃO marcar como processado (deixar para reconciliação)
      if (planError) {
        console.error('[mp-webhook] ❌ Erro ao criar patient_plan:', planError);
        console.error('[mp-webhook] ⚠️ NÃO marcando como processado - reconciliação automática corrigirá');
        
        // Retornar sucesso para MP não reenviar, mas NÃO marcar processed=true
        return new Response(JSON.stringify({ 
          success: true, 
          payment_id: payment.id,
          warning: 'Plan creation failed, will be processed by reconciliation'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      console.log('[mp-webhook] ✅ Plano criado:', {
        user_id: userId,
        patient_id: patientId,
        email: schedulePayload.email,
        plan_code: schedulePayload.sku,
        expires_at: planExpiresAt.toISOString()
      });

      // Gravar métrica de venda de plano
      await supabaseAdmin.from('metrics').insert({
        metric_type: 'sale',
        sku: schedulePayload.sku,
        metric_value: Math.round(payment.transaction_amount * 100),
        platform: 'mercadopago',
        metadata: { 
          payment_id: payment.id, 
          mp_status: payment.status,
          order_id: payment.metadata?.order_id,
          purchase_type: 'plan'
        }
      });

      // ✅ CAPI: Enviar purchase_confirmed para Meta
      await sendPurchaseConfirmedCAPI(
        supabaseAdmin,
        payment.metadata?.order_id || null,
        payment.id,
        payment.transaction_amount,
        schedulePayload
      );

      // ✅ CORREÇÃO: Só marcar como processado APÓS confirmar criação do plano
      if (payment.metadata?.order_id) {
        await supabaseAdmin
          .from('pending_payments')
          .update({ 
            processed: true,
            processed_at: new Date().toISOString(),
            status: 'approved'
          })
          .eq('order_id', payment.metadata.order_id);
        console.log('[mp-webhook] ✅ pending_payment marcado como processed=true');
      }

      // ✅ Sincronizar ClubeBen (fire-and-forget) com AMBOS os parâmetros
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!
      );
      
      console.log('[mp-webhook] 🔄 Disparando ClubeBen sync com user_id:', userId, 'email:', schedulePayload.email);
      
      supabase.functions.invoke('clubeben-sync', {
        body: {
          user_email: schedulePayload.email,
          user_id: userId,
          trigger_source: 'plan_purchase_mp_webhook'
        }
      }).catch(err => console.error('[mp-webhook] ClubeBen sync error (non-blocking):', err));

      console.log('[mp-webhook] ✅ Plano processado com sucesso');
      
      // ✅ CADASTRAR NA CLICKLIFE AO COMPRAR PLANO
      // Buscar dados completos do paciente para cadastro ClickLife
      const { data: patientDataForClickLife } = await supabaseAdmin
        .from('patients')
        .select('cpf, first_name, last_name, phone_e164, gender, birth_date')
        .eq('email', schedulePayload.email?.toLowerCase()?.trim())
        .maybeSingle();
      
      if (patientDataForClickLife?.cpf) {
        console.log('[mp-webhook] 🏥 Cadastrando paciente na ClickLife (compra de plano)...');
        
        // Determinar planoId correto baseado no SKU
        // FAMILIAR COM_ESP → 1238 | FAMILIAR SEM_ESP → 1237
        // INDIVIDUAL COM_ESP → 864 | INDIVIDUAL SEM_ESP → 863
        // EMPRESA_ → 864
        const isFamiliar = schedulePayload.sku.includes('FAM');
        const clickLifePlanoId = isFamiliar
          ? (schedulePayload.sku.includes('COM_ESP') ? 1238 : 1237)
          : (schedulePayload.sku.includes('COM_ESP') ? 864 : 
             schedulePayload.sku.includes('SEM_ESP') ? 863 : 
             schedulePayload.sku.startsWith('EMPRESA_') ? 864 : 864);
        
        const nomeCompleto = `${patientDataForClickLife.first_name || ''} ${patientDataForClickLife.last_name || ''}`.trim();
        
        const clicklifeResult = await registerClickLifePatientSimple(
          patientDataForClickLife.cpf,
          nomeCompleto || schedulePayload.nome || 'Paciente',
          schedulePayload.email,
          patientDataForClickLife.phone_e164 || schedulePayload.telefone || '',
          clickLifePlanoId,
          patientDataForClickLife.gender || 'F',
          patientDataForClickLife.birth_date
        );
        
        if (clicklifeResult.success) {
          console.log('[mp-webhook] ✅ Paciente cadastrado na ClickLife (plano) com planoId:', clickLifePlanoId);
          await supabaseAdmin
            .from('patients')
            .update({ clicklife_registered_at: new Date().toISOString() })
            .eq('email', schedulePayload.email?.toLowerCase()?.trim());
        } else {
          console.warn('[mp-webhook] ⚠️ Falha no cadastro ClickLife (plano):', clicklifeResult.error);
        }
        
        // Registrar na tabela de auditoria (usando schema correto)
        try {
          await supabaseAdmin.from('clicklife_registrations').insert({
            cpf: patientDataForClickLife.cpf,
            patient_id: patientId || null,
            status: clicklifeResult.success ? 'success' : 'failed',
            error_message: clicklifeResult.error || null,
            registration_data: {
              patient_email: schedulePayload.email,
              patient_name: nomeCompleto,
              order_id: payment.metadata?.order_id,
              payment_id: String(payment.id),
              sku: schedulePayload.sku,
              service_name: `Plano ${schedulePayload.sku}`,
              clicklife_empresa_id: 9083,
              clicklife_plano_id: clickLifePlanoId,
              success: clicklifeResult.success,
              response: clicklifeResult
            }
          });
          console.log('[mp-webhook] 📝 Registro de auditoria ClickLife salvo (plano)');
        } catch (auditError) {
          console.error('[mp-webhook] ⚠️ Erro ao salvar auditoria ClickLife:', auditError);
        }
      } else {
        console.warn('[mp-webhook] ⚠️ Paciente sem CPF, não foi possível cadastrar na ClickLife');
      }
      
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
      'QOP1101', 'LZF3879', 'YZD9932', 'UDH3250', 'PKS9388', 'MYX5186',
      'URO1099', 'IMU4471', 'PRC6621', 'PNE7783'
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
      'URO1099': 'Urologista',
      'IMU4471': 'Imunologista',
      'PRC6621': 'Proctologista',
      'PNE7783': 'Pneumologista',
      'ZXW2165': 'Psicólogo - 1 sessão',
      'HXR8516': 'Psicólogo - 4 sessões',
      'YME9025': 'Psicólogo - 8 sessões',
    };

    const isEspecialista = ESPECIALISTA_SKUS.includes(schedulePayload.sku);
    const isPsicologo = PSICOLOGO_SKUS.includes(schedulePayload.sku);
    const semPlanoAtivo = !schedulePayload.plano_ativo;
    const fromClicklife = schedulePayload.source === 'clicklife';

    // ✅ EXCEÇÃO 1: PSICÓLOGOS SEM plano → WhatsApp para agendamento
    if (isPsicologo && semPlanoAtivo && !fromClicklife) {
      const serviceName = SERVICE_NAMES[schedulePayload.sku] || schedulePayload.sku;
      const mensagem = "Olá! Comprei uma consulta de psicólogo e gostaria de agendar!";
      const whatsappUrl = `https://wa.me/5511933359187?text=${encodeURIComponent(mensagem)}`;
      
      console.log(`[mp-webhook] 🧠 ${serviceName} SEM plano ativo → WhatsApp`);
      console.log('[mp-webhook] URL:', whatsappUrl);

      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // ✅ VERIFICAÇÃO DE DUPLICAÇÃO: Checar se já existe appointment com este order_id
      const orderId = payment.metadata?.order_id;
      if (orderId) {
        const { data: existingAppointment } = await supabaseAdmin
          .from('appointments')
          .select('id, appointment_id, redirect_url')
          .eq('order_id', orderId)
          .maybeSingle();
        
        if (existingAppointment) {
          console.log('[mp-webhook] ⚠️ Appointment duplicado detectado (psicólogo)! Order já processado:', orderId);
          return new Response(
            JSON.stringify({ 
              ok: true, 
              message: 'Order already processed', 
              appointment_id: existingAppointment.appointment_id,
              redirect_url: existingAppointment.redirect_url 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }
      }

      const appointmentId = `APT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await supabaseAdmin.from('appointments').insert({
        appointment_id: appointmentId,
        email: schedulePayload.email,
        service_code: schedulePayload.sku,
        service_name: serviceName,
        start_at_local: new Date().toISOString(),
        duration_min: 30,
        status: 'pending_schedule',
        provider: 'whatsapp_psicologo',
        redirect_url: whatsappUrl,
        order_id: orderId
      });

      await supabaseAdmin.from('metrics').insert({
        metric_type: 'sale',
        plan_code: schedulePayload.sku,
        platform: 'whatsapp_psicologo',
        metadata: { 
          payment_id: payment.id, 
          mp_status: payment.status,
          order_id: payment.metadata?.order_id,
          redirect_type: 'psicologo_sem_plano_whatsapp'
        }
      });

      // ✅ CAPI: Enviar purchase_confirmed para Meta
      await sendPurchaseConfirmedCAPI(
        supabaseAdmin,
        payment.metadata?.order_id || null,
        payment.id,
        payment.transaction_amount,
        schedulePayload
      );

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

      console.log('[mp-webhook] ✅ Redirecionamento WhatsApp configurado (psicólogo SEM plano)');

      return new Response(JSON.stringify({ 
        success: true, 
        payment_id: payment.id,
        redirect_url: whatsappUrl,
        provider: 'whatsapp_psicologo'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ✅ EXCEÇÃO 2: ESPECIALISTAS SEM plano → Cadastrar ClickLife + WhatsApp manual
    if (isEspecialista && semPlanoAtivo && !fromClicklife) {
      const serviceName = SERVICE_NAMES[schedulePayload.sku] || schedulePayload.sku;
      
      console.log(`[mp-webhook] ✓ ${serviceName} SEM plano ativo → Cadastrar ClickLife + WhatsApp`);

      // ✅ CORRIGIDO: Usar URL e KEY fixa do projeto original
      const ORIGINAL_SRK = Deno.env.get('ORIGINAL_SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabaseAdmin = createClient(
        ORIGINAL_SUPABASE_URL,
        ORIGINAL_SRK
      );

      // ✅ BUSCAR/CRIAR dados completos do paciente
      let patientData = (await supabaseAdmin
        .from('patients')
        .select('first_name, last_name, cpf, phone_e164, gender, birth_date, email')
        .eq('email', schedulePayload.email)
        .maybeSingle()).data;

      if (!patientData) {
        console.log('[mp-webhook] 📝 Paciente não encontrado - criando registro no banco');
        
        // ✅ CORRIGIDO: NÃO usar fallback '1990-01-01' ao criar paciente
        // O birth_date será preenchido depois quando o usuário completar o perfil
        const newPatientData = {
          email: schedulePayload.email,
          cpf: schedulePayload.cpf?.replace(/\D/g, '') || payment.payer?.identification?.number?.replace(/\D/g, ''),
          first_name: schedulePayload.nome?.split(' ')[0] || payment.payer?.first_name || 'Nome',
          last_name: schedulePayload.nome?.split(' ').slice(1).join(' ') || payment.payer?.last_name || 'Sobrenome',
          phone_e164: schedulePayload.telefone || payment.payer?.phone?.area_code + payment.payer?.phone?.number,
          gender: schedulePayload.sexo || 'F',
          birth_date: (schedulePayload.birth_date && schedulePayload.birth_date !== '1990-01-01') 
            ? schedulePayload.birth_date 
            : null, // ✅ NULL em vez de fallback genérico
          profile_complete: false,
          source: 'pix_payment'
        };
        
        console.log('[mp-webhook] 📝 Criando paciente com birth_date:', newPatientData.birth_date || 'NULL (sem fallback)');
        
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
        
        // ✅ REGISTRAR NA TABELA DE AUDITORIA (usando schema correto)
        const serviceName = SERVICE_NAMES[schedulePayload.sku] || schedulePayload.sku;
        try {
          // Buscar patient_id pelo email
          let auditPatientId = null;
          const { data: auditPatient } = await supabaseAdmin
            .from('patients')
            .select('id')
            .eq('email', patientData.email || schedulePayload.email)
            .maybeSingle();
          auditPatientId = auditPatient?.id || null;
          
          await supabaseAdmin.from('clicklife_registrations').insert({
            cpf: patientData.cpf,
            patient_id: auditPatientId,
            status: clicklifeResult.success ? 'success' : 'failed',
            error_message: clicklifeResult.error || null,
            registration_data: {
              patient_email: patientData.email || schedulePayload.email,
              patient_name: nomeCompleto,
              order_id: payment.metadata?.order_id,
              payment_id: String(payment.id),
              sku: schedulePayload.sku,
              service_name: serviceName,
              clicklife_empresa_id: 9083,
              clicklife_plano_id: 864,
              success: clicklifeResult.success,
              response: clicklifeResult
            }
          });
          console.log('[mp-webhook] 📝 Registro de auditoria ClickLife salvo');
        } catch (auditError) {
          console.error('[mp-webhook] ⚠️ Erro ao salvar auditoria ClickLife:', auditError);
        }
        
        if (clicklifeResult.success) {
          console.log('[mp-webhook] ✅ Paciente cadastrado na ClickLife com sucesso');
          
          // ✅ Atualizar timestamp de registro ClickLife
          await supabaseAdmin
            .from('patients')
            .update({ clicklife_registered_at: new Date().toISOString() })
            .eq('email', patientData.email || schedulePayload.email);
        } else {
          console.warn('[mp-webhook] ⚠️ Falha no cadastro ClickLife (continuando para WhatsApp):', clicklifeResult.error);
        }
        
        // ✅ NOVO: CADASTRO SIMULTÂNEO NA COMMUNICARE (especialista sem plano)
        console.log('[mp-webhook] 🏥 Cadastro Communicare (especialista sem plano)...');
        
        const communicareResult = await registerCommunicarePatientSimple(
          patientData.cpf || '',
          nomeCompleto,
          patientData.email || schedulePayload.email,
          patientData.phone_e164 || '',
          patientData.gender || 'F',
          patientData.birth_date
        );
        
        if (communicareResult.success) {
          console.log('[mp-webhook] ✅ Paciente cadastrado na Communicare com sucesso');
          
          const updateData: any = { 
            communicare_registered_at: new Date().toISOString() 
          };
          if (communicareResult.patientId) {
            updateData.communicare_patient_id = String(communicareResult.patientId);
          }
          
          await supabaseAdmin
            .from('patients')
            .update(updateData)
            .eq('email', patientData.email || schedulePayload.email);
        } else {
          console.warn('[mp-webhook] ⚠️ Falha no cadastro Communicare:', communicareResult.error);
        }
      } else {
        // Registrar falha quando não há dados do paciente (usando schema correto)
        try {
          await supabaseAdmin.from('clicklife_registrations').insert({
            cpf: schedulePayload.cpf?.replace(/\D/g, '') || 'UNKNOWN',
            patient_id: null,
            status: 'failed',
            error_message: 'Patient data not available - patientData is null',
            registration_data: {
              patient_email: schedulePayload.email,
              patient_name: schedulePayload.nome || 'Desconhecido',
              order_id: payment.metadata?.order_id,
              payment_id: String(payment.id),
              sku: schedulePayload.sku,
              service_name: SERVICE_NAMES[schedulePayload.sku] || schedulePayload.sku,
              clicklife_empresa_id: 9083,
              clicklife_plano_id: 864,
              success: false,
              schedulePayload: schedulePayload,
              payerInfo: payment.payer
            }
          });
        } catch (auditError) {
          console.error('[mp-webhook] ⚠️ Erro ao salvar auditoria ClickLife:', auditError);
        }
      }

      // ✅ VERIFICAÇÃO DE DUPLICAÇÃO: Checar se já existe appointment com este order_id
      const orderId = payment.metadata?.order_id;
      if (orderId) {
        const { data: existingAppointment } = await supabaseAdmin
          .from('appointments')
          .select('id, appointment_id, redirect_url')
          .eq('order_id', orderId)
          .maybeSingle();
        
        if (existingAppointment) {
          console.log('[mp-webhook] ⚠️ Appointment duplicado detectado (especialista)! Order já processado:', orderId);
          
          // ✅ CORREÇÃO: Marcar como processado mesmo quando encontra duplicado
          await supabaseAdmin
            .from('pending_payments')
            .update({ 
              processed: true, 
              processed_at: new Date().toISOString(),
              status: 'approved'
            })
            .eq('order_id', orderId);
          console.log('[mp-webhook] ✅ pending_payment marcado como processed=true (duplicação especialista)');
          
          return new Response(
            JSON.stringify({ 
              ok: true, 
              message: 'Order already processed', 
              appointment_id: existingAppointment.appointment_id,
              redirect_url: existingAppointment.redirect_url 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }
      }

      // ✅ Continuar com WhatsApp como hoje
      const whatsappUrl = `https://wa.me/5511933359187?text=Olá!%20Acabei%20de%20comprar%20uma%20consulta%20de%20${encodeURIComponent(serviceName)}%20e%20gostaria%20de%20agendar.`;
      console.log('[mp-webhook] WhatsApp URL:', whatsappUrl);

      const appointmentId = `APT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const { error: appointmentError } = await supabaseAdmin.from('appointments').insert({
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
        order_id: orderId
      });

      if (appointmentError) {
        console.error('[mp-webhook] ❌ ERRO ao criar appointment (especialista):', appointmentError);
        // Retorna erro para permitir retry do webhook
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Failed to create appointment',
          details: appointmentError.message
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      console.log('[mp-webhook] ✅ Appointment criado com sucesso:', appointmentId);

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

      // ✅ CAPI: Enviar purchase_confirmed para Meta
      await sendPurchaseConfirmedCAPI(
        supabaseAdmin,
        payment.metadata?.order_id || null,
        payment.id,
        payment.transaction_amount,
        schedulePayload
      );

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
    // ✅ CORRIGIDO: Usar URL fixa do projeto original para evitar split-brain
    // NÃO usar mais supabase.functions.invoke, usar fetch direto
    
    // ✅ ENRIQUECER schedulePayload com dados completos do paciente
    const ORIGINAL_SRK = Deno.env.get('ORIGINAL_SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(
      ORIGINAL_SUPABASE_URL,
      ORIGINAL_SRK
    );

    let patientData = (await supabaseAdmin
      .from('patients')
      .select('first_name, last_name, cpf, phone_e164, gender, birth_date')
      .eq('email', schedulePayload.email)
      .maybeSingle()).data;

    if (!patientData) {
      console.log('[mp-webhook] 📝 Paciente não encontrado - criando registro no banco');
      
      // ✅ CORRIGIDO: NÃO usar fallback '1990-01-01' ao criar paciente
      // O birth_date será preenchido depois quando o usuário completar o perfil
      const newPatientData = {
        email: schedulePayload.email,
        cpf: schedulePayload.cpf?.replace(/\D/g, '') || payment.payer?.identification?.number?.replace(/\D/g, ''),
        first_name: schedulePayload.nome?.split(' ')[0] || payment.payer?.first_name || 'Nome',
        last_name: schedulePayload.nome?.split(' ').slice(1).join(' ') || payment.payer?.last_name || 'Sobrenome',
        phone_e164: schedulePayload.telefone || payment.payer?.phone?.area_code + payment.payer?.phone?.number,
        gender: schedulePayload.sexo || 'F', // Fallback para feminino
        birth_date: (schedulePayload.birth_date && schedulePayload.birth_date !== '1990-01-01') 
          ? schedulePayload.birth_date 
          : null, // ✅ NULL em vez de fallback genérico
        profile_complete: false,
        source: 'pix_payment'
      };
      
      console.log('[mp-webhook] 📝 Criando paciente (fluxo normal) com birth_date:', newPatientData.birth_date || 'NULL (sem fallback)');
      
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

    // ❌ CADASTRO UNIVERSAL REMOVIDO — causava ativações duplicadas com planoid fixo 864
    // Os cadastros corretos já são feitos nos fluxos específicos de plano (linha ~1083) e serviço avulso (linha ~1375)

    console.log('[mp-webhook] 📞 Chamando schedule-redirect para payment:', payment.id);

    // ✅ RETRY AUTOMÁTICO: Tentar 3 vezes com delay exponencial
    let scheduleData = null;
    let scheduleError = null;
    const maxScheduleRetries = 3;
    
    for (let attempt = 1; attempt <= maxScheduleRetries; attempt++) {
      console.log(`[mp-webhook] 🔄 Tentativa ${attempt}/${maxScheduleRetries} de agendar...`);
      
      // ✅ CORRIGIDO: Usar fetch direto para a URL fixa do projeto original
      // Isso evita o split-brain onde supabase.functions.invoke ia para o projeto errado
      try {
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
              sexo: schedulePayload.sexo,
              birth_date: schedulePayload.birth_date,
              especialidade: schedulePayload.especialidade || 'Clínico Geral',
              sku: schedulePayload.sku,
              horario_iso: schedulePayload.horario_iso || new Date().toISOString(),
              plano_ativo: schedulePayload.plano_ativo || false,
              order_id: payment.metadata?.order_id,
              payment_id: payment.id
            })
          }
        );

        if (scheduleResponse.ok) {
          scheduleData = await scheduleResponse.json();
          scheduleError = null;
        } else {
          const errorText = await scheduleResponse.text();
          scheduleError = { message: `HTTP ${scheduleResponse.status}: ${errorText}` };
          scheduleData = null;
        }
      } catch (fetchError) {
        scheduleError = { message: fetchError instanceof Error ? fetchError.message : 'Fetch error' };
        scheduleData = null;
      }

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
    
    // ✅ CORREÇÃO: Verificar e garantir que order_id foi persistido no appointment
    if (scheduledOk && scheduleData?.appointment_id && payment.metadata?.order_id) {
      try {
        const { data: verifyApt } = await supabaseAdmin
          .from('appointments')
          .select('order_id')
          .eq('appointment_id', scheduleData.appointment_id)
          .maybeSingle();
        
        if (!verifyApt?.order_id) {
          console.log('[mp-webhook] ⚠️ Appointment criado sem order_id, atualizando...');
          const { error: updateError } = await supabaseAdmin
            .from('appointments')
            .update({ 
              order_id: payment.metadata.order_id,
              updated_at: new Date().toISOString()
            })
            .eq('appointment_id', scheduleData.appointment_id);
          
          if (updateError) {
            console.error('[mp-webhook] ❌ Erro ao atualizar order_id:', updateError);
          } else {
            console.log('[mp-webhook] ✅ order_id vinculado ao appointment:', payment.metadata.order_id);
          }
        } else {
          console.log('[mp-webhook] ✓ order_id já presente no appointment');
        }
      } catch (verifyErr) {
        console.error('[mp-webhook] ⚠️ Erro ao verificar order_id no appointment:', verifyErr);
      }
    }
    
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

    // ✅ CAPI: Enviar purchase_confirmed para Meta (apenas para vendas aprovadas)
    if (scheduledOk) {
      await sendPurchaseConfirmedCAPI(
        supabaseAdmin,
        payment.metadata?.order_id || null,
        payment.id,
        payment.transaction_amount,
        schedulePayload
      );
    }

    console.log('[mp-webhook] ✅ Métrica de venda gravada');

    // ✅ CUPOM: Criar registro em coupon_uses se houver cupom aplicado
    // ✅ CORREÇÃO: Buscar dados do cupom em pending_payments como fallback quando metadata está incompleto
    let couponData = {
      coupon_id: payment.metadata?.coupon_id,
      coupon_code: payment.metadata?.coupon_code,
      amount_original: payment.metadata?.amount_original,
      discount_percentage: payment.metadata?.discount_percentage,
      owner_email: payment.metadata?.owner_email
    };

    // Se não tiver coupon_id no metadata, buscar no pending_payments
    if (!couponData.coupon_id && payment.metadata?.order_id) {
      console.log('[mp-webhook] 🔍 Buscando dados do cupom em pending_payments...');
      
      const { data: pending } = await supabaseAdmin
        .from('pending_payments')
        .select('coupon_code, coupon_owner_id, amount_original, discount_percent')
        .eq('order_id', payment.metadata.order_id)
        .maybeSingle();
      
      if (pending?.coupon_code) {
        console.log('[mp-webhook] ✅ Cupom encontrado em pending_payments:', pending.coupon_code);
        
        // Buscar coupon_id pelo código
        const { data: couponByCode } = await supabaseAdmin
          .from('user_coupons')
          .select('id, owner_user_id, pix_key')
          .eq('code', pending.coupon_code)
          .single();
        
        if (couponByCode) {
          couponData = {
            coupon_id: couponByCode.id,
            coupon_code: pending.coupon_code,
            amount_original: pending.amount_original,
            discount_percentage: pending.discount_percent,
            owner_email: '' // Será buscado abaixo
          };
          console.log('[mp-webhook] ✅ Dados do cupom recuperados do pending_payments');
        }
      }
    }

    if (couponData.coupon_id && couponData.coupon_code) {
      try {
        console.log('[mp-webhook] 🎟️ Cupom detectado, criando registro de uso...');
        
        // Buscar dados completos do cupom
        const { data: coupon } = await supabaseAdmin
          .from('user_coupons')
          .select('*')
          .eq('id', couponData.coupon_id)
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
          const amountOriginalCents = couponData.amount_original || Math.round(payment.transaction_amount * 100);
          const amountFinalCents = payment.metadata?.amount_discounted || Math.round(payment.transaction_amount * 100);
          const discountAmountCents = amountOriginalCents - amountFinalCents;
          
          // Buscar email do owner se não estiver nos metadados
          let ownerEmail = couponData.owner_email || '';
          if (!ownerEmail && coupon.owner_user_id) {
            const { data: ownerPatient } = await supabaseAdmin
              .from('patients')
              .select('email')
              .eq('id', coupon.owner_user_id)
              .maybeSingle();
            ownerEmail = ownerPatient?.email || '';
          }
          
          const { error: couponUseError } = await supabaseAdmin
            .from('coupon_uses')
            .insert({
              coupon_id: couponData.coupon_id,
              coupon_code: couponData.coupon_code,
              used_by_user_id: userId || null,
              used_by_name: buyerName,
              used_by_email: schedulePayload.email,
              service_sku: schedulePayload.sku,
              service_or_plan_name: mapSkuToName(schedulePayload.sku),
              owner_id: coupon.owner_user_id,
              owner_email: ownerEmail,
              owner_pix_key: coupon.pix_key,
              payment_id: String(payment.id),
              order_id: payment.metadata?.order_id || null,
              original_amount: amountOriginalCents / 100,
              discount_amount: discountAmountCents / 100,
              final_amount: amountFinalCents / 100,
              discount_percent: couponData.discount_percentage || 0
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

    // ✅ AUDITORIA: Atualizar status para "completed"
    if (auditId) {
      await supabaseAudit.from('webhook_audit').update({
        processing_status: 'completed',
        response_status: 200,
        processing_time_ms: Date.now() - startTime
      }).eq('id', auditId);
    }

    // Sempre retornar 200 OK para MP não retentar
    return new Response(JSON.stringify({ success: true, payment_id: paymentId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[mp-webhook] Error:', error);
    
    // ✅ AUDITORIA: Registrar erro
    if (auditId) {
      await supabaseAudit.from('webhook_audit').update({
        processing_status: 'error',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        response_status: 200,
        processing_time_ms: Date.now() - startTime
      }).eq('id', auditId);
    }
    
    // Sempre retornar 200 para MP não retentar
    return new Response(JSON.stringify({ success: true, error: 'Internal error' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
