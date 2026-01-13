// Supabase Edge Function: mp-create-payment
// Cria pagamentos no Mercado Pago usando ACCESS_TOKEN server-side

import { getCorsHeaders } from '../common/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';
// ✅ ETAPA 2: SDK oficial do Mercado Pago (+5 pontos no dashboard)
import { MercadoPagoConfig, Payment } from 'npm:mercadopago@2.0.15';

const corsHeaders = getCorsHeaders();

interface PayerOverride {
  first_name: string;
  last_name: string;
  cpf: string;
  phone: {
    area_code: string;
    number: string;
  };
  address: {
    zip_code: string;
    street_name: string;
    street_number?: string;
    neighborhood?: string;
    city: string;
    state: string;
  };
}

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
    coupon_id?: string;
    coupon_code?: string;
    amount_original?: number;
    amount_discounted?: number;
    discount_percentage?: number;
    owner_user_id?: string;
    owner_email?: string;
    owner_pix_key?: string;
  };
  device_id?: string;
  payerOverride?: PayerOverride;
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
    
    // ✅ PERSISTIR CONTACT_ID DO MANYCHAT (ETAPA 2 do plano)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const schedulePayload = paymentRequest.metadata?.schedulePayload;
    const contactId = schedulePayload?.contact_id;

    if (contactId) {
      console.log('[mp-create-payment] 📌 contact_id recebido:', contactId);
      
      // Normalizar dados
      const email = (schedulePayload.email || paymentRequest.payer?.email || '').trim().toLowerCase();
      const cpf = (schedulePayload.cpf || paymentRequest.payer?.identification?.number || '').replace(/\D/g, '');
      
      // Normalizar telefone para +55DDNNNNNNNNN
      let phoneE164 = schedulePayload.telefone || '';
      if (phoneE164) {
        const digitsOnly = phoneE164.replace(/\D/g, '');
        if (digitsOnly.length >= 10) {
          const cleanNumber = digitsOnly.startsWith('55') ? digitsOnly : '55' + digitsOnly;
          phoneE164 = '+' + cleanNumber;
        }
      }

      // 1) Atualizar patients.manychat_contact_id se existir
      if (email || cpf) {
        const { data: patient } = await supabaseAdmin
          .from('patients')
          .select('id, manychat_contact_id')
          .or(email ? `email.eq.${email}` : `cpf.eq.${cpf}`)
          .maybeSingle();

        if (patient?.id && !patient.manychat_contact_id) {
          await supabaseAdmin
            .from('patients')
            .update({ manychat_contact_id: contactId })
            .eq('id', patient.id);
          
          console.log('[mp-create-payment] ✅ patient.manychat_contact_id atualizado');
        }
      }

      // 2) Upsert em manychat_contacts
      const contactData = {
        email: email || null,
        cpf: cpf || null,
        phone_e164: phoneE164 || null,
        contact_id: contactId
      };

      try {
        if (email) {
          await supabaseAdmin.from('manychat_contacts').upsert(contactData, {
            onConflict: 'email',
            ignoreDuplicates: false
          });
          console.log('[mp-create-payment] 📌 contact_id persistido (key: email)');
        } else if (cpf) {
          await supabaseAdmin.from('manychat_contacts').upsert(contactData, {
            onConflict: 'cpf',
            ignoreDuplicates: false
          });
          console.log('[mp-create-payment] 📌 contact_id persistido (key: cpf)');
        } else if (phoneE164) {
          await supabaseAdmin.from('manychat_contacts').upsert(contactData, {
            onConflict: 'phone_e164',
            ignoreDuplicates: false
          });
          console.log('[mp-create-payment] 📌 contact_id persistido (key: phone)');
        }
      } catch (upsertError) {
        console.error('[mp-create-payment] ⚠️ Erro ao persistir contact_id:', upsertError);
      }
    }
    
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

    // Device ID: avisar se não foi capturado explicitamente, mas não bloquear
    if (!paymentRequest.device_id || paymentRequest.device_id === 'mp_sdk_auto') {
      console.warn('[mp-create-payment] ⚠️ Device ID não capturado explicitamente. SDK do MP deve enviar automaticamente.');
      // Não bloquear - o SDK do MP já está enviando o Device ID nos headers automaticamente
    }
    
    // ✅ NOVO: Validar preço usando supabaseAdmin já instanciado acima

    const sku = paymentRequest.items?.[0]?.id;
    if (!sku) {
      throw new Error('Missing SKU in payment request');
    }

    // ✅ CUPOM: Se houver cupom aplicado, usar amount_discounted
    const hasCoupon = paymentRequest.metadata?.coupon_id && paymentRequest.metadata?.amount_discounted;
    
    const clientAmount = hasCoupon 
      ? (paymentRequest.metadata.amount_discounted! / 100) // converter centavos para reais
      : paymentRequest.items.reduce(
          (sum, item) => sum + (item.unit_price * item.quantity), 
          0
        );

    console.log('[mp-create-payment] Items received:', {
      items_count: paymentRequest.items?.length || 0,
      client_amount: clientAmount,
      has_coupon: hasCoupon,
      coupon_code: paymentRequest.metadata?.coupon_code,
      amount_original: paymentRequest.metadata?.amount_original,
      amount_discounted: paymentRequest.metadata?.amount_discounted
    });

    // ✅ NOVO: Buscar preço validado do banco
    const { data: service, error: serviceError } = await supabaseAdmin
      .from('services')
      .select('sku, name, price_cents, allows_recurring, recurring_frequency, recurring_frequency_type')
      .eq('sku', sku)
      .eq('is_active', true)
      .maybeSingle();

    if (serviceError || !service) {
      console.error('[mp-create-payment] Invalid SKU:', {
        sku,
        error: serviceError?.message
      });
      throw new Error(`Invalid or inactive service SKU: ${sku}`);
    }

    const expectedAmount = service.price_cents / 100; // Converter para reais

    // ✅ CUPOM: Se houver cupom, validar amount_discounted vs amount_original
    if (hasCoupon) {
      const originalAmount = paymentRequest.metadata.amount_original! / 100;
      const discountedAmount = paymentRequest.metadata.amount_discounted! / 100;
      
      // Validar que o amount_original bate com o preço do DB
      const priceDifference = Math.abs(originalAmount - expectedAmount);
      if (priceDifference > 0.01) {
        console.error('[mp-create-payment] Coupon price mismatch:', {
          sku,
          expected: expectedAmount,
          original_sent: originalAmount,
          difference: priceDifference
        });
        throw new Error(
          `Coupon price validation failed: expected R$ ${expectedAmount.toFixed(2)}, received R$ ${originalAmount.toFixed(2)}`
        );
      }
      
      console.log('[mp-create-payment] ✅ Coupon validation passed:', {
        original: originalAmount,
        discounted: discountedAmount,
        discount_percentage: paymentRequest.metadata.discount_percentage
      });
    } else {
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
    }

    console.log('[mp-create-payment] Validation passed:', {
      sku,
      name: service.name,
      amount: expectedAmount
    });

    // ✅ Construir objeto payer explicitamente (sem spread operator)
    // Para evitar campos inválidos como 'full_name' que o cliente pode enviar
    const basePayer = {
      email: paymentRequest.payer.email,
      identification: paymentRequest.payer.identification ? {
        type: 'CPF',
        number: String(paymentRequest.payer.identification.number || '').replace(/\D/g, '')
      } : undefined
    };

    // ✅ Para PIX: apenas email e CPF (API do MP não aceita outros campos)
    // ✅ Para cartão: adicionar first_name, last_name, phone, address
    const finalPayer = paymentRequest.payerOverride ? {
      ...basePayer,
      email: paymentRequest.payer.email, // Email sempre do comprador
      first_name: paymentRequest.payerOverride.first_name,
      last_name: paymentRequest.payerOverride.last_name,
      identification: {
        type: 'CPF',
        number: paymentRequest.payerOverride.cpf
      },
      phone: paymentRequest.payerOverride.phone,
      address: {
        zip_code: paymentRequest.payerOverride.address.zip_code,
        street_name: paymentRequest.payerOverride.address.street_name,
        street_number: paymentRequest.payerOverride.address.street_number ? parseInt(paymentRequest.payerOverride.address.street_number) : undefined
      }
    } : {
      ...basePayer,
      first_name: paymentRequest.payer.first_name,
      last_name: paymentRequest.payer.last_name,
      phone: paymentRequest.payer.phone,
      address: paymentRequest.payer.address ? {
        zip_code: paymentRequest.payer.address.zip_code,
        street_name: paymentRequest.payer.address.street_name,
        street_number: paymentRequest.payer.address.street_number,
      } : undefined
    };

    const paymentData: any = {
      transaction_amount: hasCoupon 
        ? (paymentRequest.metadata.amount_discounted! / 100) 
        : expectedAmount,
      description: service.name,
      external_reference: paymentRequest.metadata.order_id, // ✅ CRÍTICO: Reconciliação financeira (+14 pontos)
      payer: finalPayer,
      metadata: {
        ...paymentRequest.metadata,
        user_id: paymentRequest.metadata?.schedulePayload?.user_id,
        payer_cpf: finalPayer.identification?.number,
        payer_name: `${finalPayer.first_name} ${finalPayer.last_name}`,
        sku: sku,
        source: 'web',
        is_third_party_card: !!paymentRequest.payerOverride
      },
      notification_url: MP_NOTIFICATION_URL,
      // ✅ ETAPA 2: Additional Info COMPLETO com todos os campos
      additional_info: {
        items: [
          {
            id: sku,
            title: service.name,
            description: hasCoupon 
              ? `${service.name} (${paymentRequest.metadata.discount_percentage}% desconto)` 
              : service.name,
            picture_url: `https://prontiasaude.com.br/assets/servicos/${sku.toLowerCase()}.jpg`, // ✅ FASE 5.1: URL específica do serviço
            category_id: getCategoryIdBySKU(sku),
            quantity: 1,
            unit_price: hasCoupon 
              ? (paymentRequest.metadata.amount_discounted! / 100) 
              : expectedAmount
          }
        ],
        payer: {
          first_name: finalPayer.first_name || '',
          last_name: finalPayer.last_name || '',
          phone: finalPayer.phone || {},
          address: {
            zip_code: finalPayer.address?.zip_code,
            street_name: finalPayer.address?.street_name,
            street_number: finalPayer.address?.street_number
          },
          registration_date: paymentRequest.metadata?.schedulePayload?.registration_date || new Date().toISOString() // ✅ FASE 2.2: Usar data real do metadata
        },
        // ✅ Informações sobre o negócio/envio (sem city/state que causam bad_request)
        shipments: {
          receiver_address: {
            zip_code: finalPayer.address?.zip_code,
            street_name: finalPayer.address?.street_name,
            street_number: finalPayer.address?.street_number
          }
        },
        // ✅ IP do cliente para análise antifraude
        ip_address: clientIp
      }
    };

    // Log de confirmação de cupom aplicado
    if (hasCoupon) {
      console.log('[mp-create-payment] 🎫 Cupom aplicado:', {
        coupon_code: paymentRequest.metadata.coupon_code,
        original_amount: expectedAmount,
        discounted_amount: paymentRequest.metadata.amount_discounted! / 100,
        discount_percentage: paymentRequest.metadata.discount_percentage,
        transaction_amount_sent_to_mp: paymentData.transaction_amount
      });
    }

    // ✅ Determinar método de pagamento sem fallback silencioso
    if (paymentRequest.payment_method_id === 'pix' || (!paymentRequest.token && !paymentRequest.payment_method_id)) {
      // PIX payment (explícito ou quando não há dados de cartão)
      paymentData.payment_method_id = 'pix';
      
      // ✅ CRÍTICO: Para PIX, remover campos não aceitos pela API do MP
      paymentData.payer = {
        email: finalPayer.email,
        identification: finalPayer.identification
      };
      
      console.log('[mp-create-payment] PIX payment - usando apenas email e CPF no payer');
    } else if (paymentRequest.token && paymentRequest.payment_method_id) {
      // Card payment (PRECISA ter token E payment_method_id)
      paymentData.token = paymentRequest.token;
      paymentData.payment_method_id = paymentRequest.payment_method_id;
      paymentData.installments = paymentRequest.installments || 1;
      paymentData.statement_descriptor = 'PRONTIA SAUDE'; // ✅ RECOMENDADO: Nome na fatura (+10 pontos)
      
      // ✅ NOVO: Normalização server-side para cartão (apenas se NÃO for override)
      // Declarar variáveis no escopo correto ANTES do if
      let payerEmail = '';
      let payerCPF = '';
      let normalizedPhone: { area_code: string; number: string } | undefined;
      
      if (!paymentRequest.payerOverride) {
        payerEmail = String(paymentRequest.payer?.email || '').trim().toLowerCase();
        payerCPF = String(paymentRequest.payer?.identification?.number || '').replace(/\D/g, '');
        
        // Validar email obrigatório
        if (!payerEmail) {
          throw new Error('Email do pagador é obrigatório para pagamentos por cartão');
        }
        
        // ✅ Normalizar telefone server-side: string E.164 → { area_code, number }
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
          ...paymentData.payer,
          email: payerEmail,
          identification: {
            type: 'CPF',
            number: payerCPF
          },
          phone: normalizedPhone
        };
        
        console.log('[mp-create-payment] Card payment normalized (no override):', {
          email: payerEmail,
          cpf: payerCPF ? `${payerCPF.substring(0, 3)}***` : 'AUSENTE',
          phone_structured: !!(normalizedPhone?.area_code && normalizedPhone?.number)
        });
      }
      
      // ✅ binary_mode CONDICIONAL: false se override (permitir review), true caso contrário
      paymentData.binary_mode = !paymentRequest.payerOverride;
      
      // ✅ Forçar 3DS 2.0 em modo REQUIRED para aumentar aprovação
      paymentData.three_d_secure_mode = 'required';
      
      console.log('[mp-create-payment] Card payment config:', {
        binary_mode: paymentData.binary_mode,
        three_d_secure_mode: 'required',
        is_third_party: !!paymentRequest.payerOverride
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

    // Device ID: avisar se ausente, mas não bloquear (SDK envia automaticamente)
    if (!paymentRequest.device_id || paymentRequest.device_id === 'mp_sdk_auto') {
      console.warn('[mp-create-payment] ⚠️ Device ID não explícito. SDK do MP envia automaticamente.');
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
          'X-meli-session-id': paymentRequest.device_id || '',
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

    // ✅ Se rejeitado, retornar 200 com status_detail para frontend tratar
    if (mpResponse.status === 'rejected') {
      console.warn('[mp-create-payment] Payment rejected:', {
        id: responseData.id,
        status_detail: responseData.status_detail
      });
      return new Response(
        JSON.stringify({
          success: true,
          payment_id: responseData.id,
          status: 'rejected',
          status_detail: responseData.status_detail,
          error_message: responseData.error?.message
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }
    
    // Erros técnicos reais (não pagamento rejeitado)
    if (mpResponse.error) {
      console.error('[mp-create-payment] MP API technical error:', responseData);
      throw new Error(`Mercado Pago API error: ${responseData.error?.message || 'Unknown error'}`);
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

    // ✅ SEMPRE salvar em pending_payments para TODOS os pagamentos PIX (com ou sem cupom)
    try {
      const pendingPaymentData: any = {
        payment_id: String(responseData.id),
        patient_email: paymentRequest.payer.email,
        patient_name: `${paymentRequest.payer.first_name || ''} ${paymentRequest.payer.last_name || ''}`.trim() || null,
        patient_cpf: paymentRequest.payer?.identification?.number?.replace(/\D/g, '') || null,
        status: responseData.status || 'pending',
        order_id: paymentRequest.metadata.order_id,
        sku: sku,
        amount: hasCoupon 
          ? (paymentRequest.metadata.amount_discounted! / 100) 
          : expectedAmount,
        amount_original: service.price_cents / 100,
        payment_method: paymentData.payment_method_id || 'pix',
        payment_data: {
          schedulePayload: paymentRequest.metadata.schedulePayload
        }
      };

      // Adicionar campos de cupom se houver
      if (hasCoupon && paymentRequest.metadata?.coupon_id) {
        pendingPaymentData.coupon_code = paymentRequest.metadata.coupon_code;
        pendingPaymentData.coupon_owner_id = paymentRequest.metadata.owner_user_id;
        pendingPaymentData.discount_percent = paymentRequest.metadata.discount_percentage;
      }

      const { error: pendingPaymentError } = await supabaseAdmin
        .from('pending_payments')
        .insert(pendingPaymentData);

      if (pendingPaymentError) {
        console.error('[mp-create-payment] ⚠️ Erro ao salvar pending_payment:', pendingPaymentError);
      } else {
        console.log('[mp-create-payment] ✅ Pending payment salvo:', {
          payment_id: responseData.id,
          order_id: paymentRequest.metadata.order_id,
          has_coupon: hasCoupon
        });
      }
    } catch (err) {
      console.error('[mp-create-payment] ⚠️ Erro ao processar pending_payment:', err);
    }

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
        order_id: paymentRequest.metadata?.order_id,
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
