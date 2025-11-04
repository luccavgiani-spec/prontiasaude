// Supabase Edge Function: mp-create-payment
// Cria pagamentos no Mercado Pago usando ACCESS_TOKEN server-side

import { getCorsHeaders } from '../common/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';
// ✅ ETAPA 2: SDK oficial do Mercado Pago (+5 pontos no dashboard)
import { MercadoPagoConfig, Payment } from 'npm:mercadopago@2.0.15';

const corsHeaders = getCorsHeaders();

interface PaymentRequest {
  items: Array<{
    id: string;
    title: string;
    unit_price: number;
    quantity: number;
  }>;
  payer: {
    email: string;
    first_name?: string;
    last_name?: string;
    identification?: {
      type: string;
      number: string;
    };
    phone?: {
      area_code: string;
      number: string;
    } | string;
    address?: {
      zip_code?: string;
      street_name?: string;
      street_number?: number;
    };
  };
  payment_method_id?: string;
  token?: string;
  installments?: number;
  metadata: {
    order_id: string;
    schedulePayload?: any;
  };
  device_id?: string;
}

/**
 * ✅ ETAPA 5: Mapeia SKU para category_id específico do Mercado Pago
 */
function getCategoryIdBySKU(sku: string): string {
  // Categorias mais específicas para reduzir recusas
  if (sku.includes('PSI') || sku.includes('PSICO')) return 'health_services';
  if (sku.includes('LAU')) return 'health_services';
  if (sku.includes('REC') || sku.includes('RZP')) return 'health_services';
  if (sku.includes('EXA') || sku.includes('LAB')) return 'medical_services';
  if (sku.includes('ITC') || sku.includes('PRON')) return 'health';
  if (sku.includes('PLAN')) return 'subscriptions';
  
  return 'health'; // fallback
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    const MP_NOTIFICATION_URL = Deno.env.get('MP_NOTIFICATION_URL');

    if (!MP_ACCESS_TOKEN) {
      throw new Error('MP_ACCESS_TOKEN not configured');
    }

    const paymentRequest: PaymentRequest = await req.json();
    
    // ✅ Extrair IP do cliente para additional_info.ip_address
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     req.headers.get('cf-connecting-ip') ||
                     req.headers.get('x-real-ip') ||
                     undefined;
    
    // ✅ FASE 6.1: Log detalhado PRE-VALIDAÇÃO
    console.log('[mp-create-payment] 🔒 SECURITY CHECKLIST PRE-VALIDATION:', {
      has_device_id: !!paymentRequest.device_id,
      has_ip_address: !!clientIp,
      has_payer_email: !!paymentRequest.payer?.email,
      has_payer_cpf: !!paymentRequest.payer?.identification?.number,
      has_payer_phone: !!paymentRequest.payer?.phone,
      has_complete_address: !!(
        paymentRequest.payer?.address?.zip_code &&
        paymentRequest.payer?.address?.street_name &&
        paymentRequest.payer?.address?.street_number
      ),
      token_present: !!paymentRequest.token,
      payment_method: paymentRequest.payment_method_id
    });

    // ✅ FASE 1.3 + 6.1: BLOQUEAR se Device ID ausente
    if (!paymentRequest.device_id) {
      console.error('[mp-create-payment] ❌ BLOCKED: Device ID missing');
      throw new Error('Device ID é obrigatório para segurança do pagamento');
    }
    
    // ✅ NOVO: Conectar ao Supabase para validar preço
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const sku = paymentRequest.items?.[0]?.id;
    if (!sku) {
      throw new Error('Missing SKU in payment request');
    }

    const clientAmount = paymentRequest.items.reduce(
      (sum, item) => sum + (item.unit_price * item.quantity), 
      0
    );

    console.log('[mp-create-payment] Items received:', {
      items_count: paymentRequest.items?.length || 0,
      client_amount: clientAmount
    });

    // ✅ NOVO: Buscar preço validado do banco
    const { data: service, error: serviceError } = await supabaseClient
      .from('services')
      .select('sku, name, price_cents, allows_recurring, recurring_frequency, recurring_frequency_type')
      .eq('sku', sku)
      .eq('active', true)
      .maybeSingle();

    if (serviceError || !service) {
      console.error('[mp-create-payment] Invalid SKU:', {
        sku,
        error: serviceError?.message
      });
      throw new Error(`Invalid or inactive service SKU: ${sku}`);
    }

    const expectedAmount = service.price_cents / 100; // Converter para reais

    // ✅ CORRIGIDO: Tolerar clientAmount ausente/zero (usar apenas preço do DB)
    if (clientAmount === 0 || !paymentRequest.items || paymentRequest.items.length === 0) {
      console.log('[mp-create-payment] Client amount missing or zero, using DB price:', {
        sku,
        expected: expectedAmount
      });
    } else {
      // Se cliente enviou amount, validar com tolerância de 1 centavo
      const priceDifference = Math.abs(clientAmount - expectedAmount);
      if (priceDifference > 0.01) {
        console.error('[mp-create-payment] Price mismatch detected:', {
          sku,
          client_sent: clientAmount,
          expected: expectedAmount,
          difference: priceDifference
        });
        throw new Error(
          `Price validation failed: expected R$ ${expectedAmount.toFixed(2)}, received R$ ${clientAmount.toFixed(2)}`
        );
      }
    }

    console.log('[mp-create-payment] Validation passed:', {
      sku,
      name: service.name,
      amount: expectedAmount
    });

    // ✅ Usar valores validados do DB (não do cliente)
    const paymentData: any = {
      transaction_amount: expectedAmount,
      description: service.name,
      external_reference: paymentRequest.metadata.order_id, // ✅ CRÍTICO: Reconciliação financeira (+14 pontos)
      payer: {
        ...paymentRequest.payer,
        address: paymentRequest.payer.address ? {
          zip_code: paymentRequest.payer.address.zip_code,
          street_name: paymentRequest.payer.address.street_name,
          street_number: paymentRequest.payer.address.street_number,
          // ✅ Removido: city, state (causam bad_request 400)
        } : undefined
      },
      metadata: paymentRequest.metadata,
      notification_url: MP_NOTIFICATION_URL,
      // ✅ ETAPA 2: Additional Info COMPLETO com todos os campos
      additional_info: {
        items: [
          {
            id: sku,
            title: service.name,
            description: service.name,
            picture_url: `https://prontiasaude.com.br/assets/servicos/${sku.toLowerCase()}.jpg`, // ✅ FASE 5.1: URL específica do serviço
            category_id: getCategoryIdBySKU(sku),
            quantity: 1,
            unit_price: expectedAmount
          }
        ],
        payer: {
          first_name: paymentRequest.payer.first_name || '',
          last_name: paymentRequest.payer.last_name || '',
          phone: paymentRequest.payer.phone || {},
          address: {
            zip_code: paymentRequest.payer.address?.zip_code,
            street_name: paymentRequest.payer.address?.street_name,
            street_number: paymentRequest.payer.address?.street_number
          },
          registration_date: paymentRequest.metadata?.schedulePayload?.registration_date || new Date().toISOString() // ✅ FASE 2.2: Usar data real do metadata
        },
        // ✅ Informações sobre o negócio/envio (sem city/state que causam bad_request)
        shipments: {
          receiver_address: {
            zip_code: paymentRequest.payer.address?.zip_code,
            street_name: paymentRequest.payer.address?.street_name,
            street_number: paymentRequest.payer.address?.street_number
          }
        },
        // ✅ IP do cliente para análise antifraude
        ip_address: clientIp
      }
    };

    // ✅ Determinar método de pagamento sem fallback silencioso
    if (paymentRequest.payment_method_id === 'pix' || (!paymentRequest.token && !paymentRequest.payment_method_id)) {
      // PIX payment (explícito ou quando não há dados de cartão)
      paymentData.payment_method_id = 'pix';
    } else if (paymentRequest.token && paymentRequest.payment_method_id) {
      // Card payment (PRECISA ter token E payment_method_id)
      paymentData.token = paymentRequest.token;
      paymentData.payment_method_id = paymentRequest.payment_method_id;
      paymentData.installments = paymentRequest.installments || 1;
      paymentData.statement_descriptor = 'PRONTIA SAUDE'; // ✅ RECOMENDADO: Nome na fatura (+10 pontos)
      
      // ✅ NOVO: Normalização server-side para cartão + binary_mode
      const payerEmail = String(paymentRequest.payer?.email || '').trim().toLowerCase();
      const payerCPF = String(paymentRequest.payer?.identification?.number || '').replace(/\D/g, '');
      
      // ✅ Normalizar telefone server-side: string E.164 → { area_code, number }
      let normalizedPhone: { area_code: string; number: string } | undefined;
      if (paymentRequest.payer.phone) {
        if (typeof paymentRequest.payer.phone === 'string') {
          // Telefone veio como string (ex: "+5511999887766" ou "(11) 99988-7766")
          const digitsOnly = paymentRequest.payer.phone.replace(/\D/g, '');
          if (digitsOnly.length >= 10) {
            // Assume Brasil: DDI 55 + DDD (2) + número (8-9 dígitos)
            const cleanNumber = digitsOnly.startsWith('55') ? digitsOnly.slice(2) : digitsOnly;
            normalizedPhone = {
              area_code: cleanNumber.slice(0, 2),
              number: cleanNumber.slice(2)
            };
          }
        } else if (paymentRequest.payer.phone.area_code && paymentRequest.payer.phone.number) {
          // Já estruturado, apenas sanear
          normalizedPhone = {
            area_code: String(paymentRequest.payer.phone.area_code).replace(/\D/g, ''),
            number: String(paymentRequest.payer.phone.number).replace(/\D/g, '')
          };
        }
      }
      
      paymentData.payer = {
        ...paymentRequest.payer,
        email: payerEmail,
        identification: {
          type: 'CPF',
          number: payerCPF
        },
        phone: normalizedPhone,
        address: paymentRequest.payer.address ? {
          zip_code: paymentRequest.payer.address.zip_code,
          street_name: paymentRequest.payer.address.street_name,
          street_number: paymentRequest.payer.address.street_number,
        } : undefined
      };
      
      // ✅ binary_mode: true força resposta approved/rejected (evita in_process)
      paymentData.binary_mode = true;
      
      // ✅ Forçar 3DS 2.0 em modo REQUIRED para aumentar aprovação
      paymentData.three_d_secure_mode = 'required';
      
      console.log('[mp-create-payment] Card payment normalized:', {
        email: payerEmail,
        cpf: payerCPF ? `${payerCPF.substring(0, 3)}***` : 'AUSENTE',
        phone_structured: !!(normalizedPhone?.area_code && normalizedPhone?.number),
        phone_area_code: normalizedPhone?.area_code || 'N/A',
        binary_mode: true,
        three_d_secure_mode: 'required'
      });
    } else {
      // ✅ BLOQUEAR fallback silencioso: cartão sem token é ERRO
      console.error('[mp-create-payment] Invalid card payment: missing token or payment_method_id', {
        has_token: !!paymentRequest.token,
        has_payment_method: !!paymentRequest.payment_method_id,
        payment_method: paymentRequest.payment_method_id
      });
      throw new Error('Missing card token or payment_method_id for card payment');
    }

    // Generate idempotency key
    const idempotencyKey = crypto.randomUUID();

    console.log('[mp-create-payment] Creating payment:', {
      amount: paymentData.transaction_amount,
      payment_method: paymentData.payment_method_id,
      order_id: paymentRequest.metadata.order_id,
      external_reference: paymentData.external_reference, // ✅ Validação
      statement_descriptor: paymentData.statement_descriptor || 'N/A (PIX)' // ✅ Validação
    });

    // Generate idempotency key
    const idempotencyKey = crypto.randomUUID();

    // ✅ FASE 1.3: Garantir envio obrigatório do Device ID no header
    if (!paymentRequest.device_id) {
      throw new Error('Device ID é obrigatório para processamento do pagamento');
    }

    // ✅ ETAPA 2: Inicializar SDK oficial do Mercado Pago
    const client = new MercadoPagoConfig({ 
      accessToken: MP_ACCESS_TOKEN,
      options: {
        timeout: 30000
      }
    });

    const payment = new Payment(client);

    console.log('[mp-create-payment] 🚀 Using official Mercado Pago SDK (Etapa 1+2 implemented)');

    // ✅ CRÍTICO: Usar SDK v2 com headers corretos via customHeaders
    const mpResponse = await payment.create({
      body: paymentData,
      requestOptions: {
        idempotencyKey: idempotencyKey,
        customHeaders: {
          'X-meli-session-id': paymentRequest.device_id,
          'X-Forwarded-For': clientIp ?? '',
          'User-Agent': req.headers.get('user-agent') ?? ''
        }
      }
    });

    console.log('[mp-create-payment] ✅ Headers set via SDK requestOptions (idempotencyKey + customHeaders)');

    // ✅ SDK retorna objeto direto, não precisa de .json()
    const responseData = {
      id: mpResponse.id,
      status: mpResponse.status,
      status_detail: mpResponse.status_detail,
      external_reference: mpResponse.external_reference,
      point_of_interaction: mpResponse.point_of_interaction,
      transaction_details: mpResponse.transaction_details,
      error: mpResponse.error
    };

    if (mpResponse.status === 'rejected' || mpResponse.error) {
      console.error('[mp-create-payment] MP API error:', responseData);
      throw new Error(`Mercado Pago API error: ${responseData.error?.message || responseData.status_detail || 'Unknown error'}`);
    }

    // ✅ ETAPA 7: Logs detalhados de validação de segurança
    console.log('[mp-create-payment] 🎉 Payment created successfully:', {
      payment_id: responseData.id,
      status: responseData.status,
      status_detail: responseData.status_detail,
      '🔒 SECURITY CHECKLIST': {
        '✅ Device ID': !!paymentRequest.device_id ? 'SENT ✓' : '❌ MISSING - HIGH RISK!',
        '✅ IP Address': !!clientIp ? `SENT ✓ (${clientIp})` : '⚠️ NOT CAPTURED',
        '✅ Additional Info': !!paymentData.additional_info ? 'COMPLETE ✓' : '⚠️ INCOMPLETE',
        '✅ 3DS Mode': paymentData.three_d_secure_mode || 'NOT SET',
        '✅ Binary Mode': paymentData.binary_mode || false,
        '✅ Payer Data Completeness': {
          email: !!paymentRequest.payer.email ? '✓' : '✗',
          cpf: !!paymentRequest.payer.identification?.number ? '✓' : '✗',
          phone_structured: !!(paymentData.payer?.phone?.area_code && paymentData.payer?.phone?.number) ? '✓' : '✗',
          address_complete: !!(
            paymentRequest.payer.address?.zip_code &&
            paymentRequest.payer.address?.street_name &&
            paymentRequest.payer.address?.street_number
          ) ? '✓ COMPLETE' : '⚠️ INCOMPLETE'
        }
      },
      '⚠️ RISK FACTORS': {
        missing_device_id: !paymentRequest.device_id ? '🔴 YES - CRITICAL' : '✅ NO',
        missing_ip: !clientIp ? '🟡 YES - MEDIUM RISK' : '✅ NO',
        missing_address: !paymentRequest.payer.address?.zip_code ? '🟡 YES - HIGH RISK' : '✅ NO',
        incomplete_phone: !(paymentData.payer?.phone?.area_code && paymentData.payer?.phone?.number) ? '🟡 YES' : '✅ NO',
        incomplete_additional_info: !paymentData.additional_info?.items?.[0]?.description ? '🟡 YES' : '✅ NO'
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: responseData.id,
        status: responseData.status,
        status_detail: responseData.status_detail,
        error_message: responseData.error?.message,
        qr_code: responseData.point_of_interaction?.transaction_data?.qr_code,
        qr_code_base64: responseData.point_of_interaction?.transaction_data?.qr_code_base64,
        ticket_url: responseData.point_of_interaction?.transaction_data?.ticket_url,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('[mp-create-payment] Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
