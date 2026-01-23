import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { payment_id } = await req.json();

    if (!payment_id) {
      return new Response(
        JSON.stringify({ success: false, message: 'payment_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[process-pending-coupon] Processando payment_id: ${payment_id}`);

    // Inicializar Supabase Admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Buscar dados do pending_payment
    const { data: pendingPayment, error: fetchError } = await supabaseAdmin
      .from('pending_payments')
      .select('*')
      .eq('payment_id', payment_id)
      .single();

    if (fetchError || !pendingPayment) {
      console.error('[process-pending-coupon] Pagamento não encontrado:', fetchError);
      return new Response(
        JSON.stringify({ success: false, message: 'Pagamento não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[process-pending-coupon] Dados encontrados: ${pendingPayment.email}, cupom: ${pendingPayment.coupon_code}`);

    // 2. Consultar status no Mercado Pago
    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN');
    const mpResponse = await fetch(
      `https://api.mercadopago.com/v1/payments/${payment_id}`,
      {
        headers: {
          'Authorization': `Bearer ${mpAccessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!mpResponse.ok) {
      console.error('[process-pending-coupon] Erro ao consultar MP:', mpResponse.status);
      return new Response(
        JSON.stringify({ success: false, message: 'Erro ao consultar Mercado Pago' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const payment = await mpResponse.json();
    console.log(`[process-pending-coupon] Status MP: ${payment.status}`);

    // 3. Se não foi aprovado, retornar status atual
    if (payment.status !== 'approved') {
      return new Response(
        JSON.stringify({
          success: false,
          status: payment.status,
          message: `Pagamento está ${payment.status}`,
          payment_data: {
            amount: payment.transaction_amount,
            status: payment.status,
            date_created: payment.date_created,
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Pagamento aprovado - processar cupom
    console.log('[process-pending-coupon] Pagamento aprovado! Processando cupom...');

    // Buscar dados do cupom com owner info
    const { data: couponData } = await supabaseAdmin
      .from('user_coupons')
      .select('id, owner_user_id, pix_key')
      .eq('code', pendingPayment.coupon_code)
      .single();

    // Buscar email do owner
    let ownerEmail = '';
    let ownerPixKey = couponData?.pix_key || null;
    
    if (couponData?.owner_user_id) {
      const { data: ownerPatient } = await supabaseAdmin
        .from('patients')
        .select('email')
        .eq('id', couponData.owner_user_id)
        .single();
      
      if (ownerPatient) {
        ownerEmail = ownerPatient.email || '';
      }
    }

    // Buscar dados do comprador
    const { data: buyerData } = await supabaseAdmin
      .from('patients')
      .select('first_name, last_name')
      .eq('email', pendingPayment.email)
      .single();

    const buyerName = buyerData 
      ? `${buyerData.first_name || ''} ${buyerData.last_name || ''}`.trim()
      : pendingPayment.email.split('@')[0];

    // 5. Criar registro em coupon_uses
    const amountOriginal = pendingPayment.amount_original || 0;
    const amountFinal = pendingPayment.amount || 0;
    const discountAmount = amountOriginal - amountFinal;
    
    const { error: couponUseError } = await supabaseAdmin
      .from('coupon_uses')
      .insert({
        coupon_id: pendingPayment.coupon_id || couponData?.id,
        coupon_code: pendingPayment.coupon_code,
        used_by_user_id: null,
        used_by_name: buyerName,
        used_by_email: pendingPayment.patient_email,
        service_sku: pendingPayment.sku,
        service_or_plan_name: pendingPayment.sku || 'Serviço',
        owner_id: couponData?.owner_user_id || null,
        owner_email: ownerEmail,
        owner_pix_key: ownerPixKey,
        payment_id: payment_id,
        order_id: pendingPayment.order_id,
        original_amount: amountOriginal,
        discount_amount: discountAmount,
        final_amount: amountFinal,
        discount_percent: pendingPayment.discount_percent || 0,
      });

    if (couponUseError) {
      console.error('[process-pending-coupon] Erro ao criar coupon_use:', couponUseError);
    } else {
      console.log('[process-pending-coupon] coupon_uses criado com sucesso!');
    }

    // 6. Atualizar pending_payments
    const { error: updateError } = await supabaseAdmin
      .from('pending_payments')
      .update({
        status: 'approved',
        processed: true,
        processed_at: new Date().toISOString(),
      })
      .eq('payment_id', payment_id);

    if (updateError) {
      console.error('[process-pending-coupon] Erro ao atualizar pending_payments:', updateError);
    }

    // 7. Registrar métrica de venda
    await supabaseAdmin.from('metrics').insert({
      metric_type: 'sale',
      patient_email: pendingPayment.email,
      amount_cents: pendingPayment.amount_cents,
      plan_code: pendingPayment.sku,
      status: 'approved',
      metadata: {
        payment_id,
        order_id: pendingPayment.order_id,
        coupon_code: pendingPayment.coupon_code,
        manually_processed: true,
      },
    });

    console.log('[process-pending-coupon] ✅ Processamento completo!');

    return new Response(
      JSON.stringify({
        success: true,
        status: 'approved',
        message: 'Pagamento confirmado e cupom processado',
        coupon_use_created: !couponUseError,
        payment_data: {
          amount: payment.transaction_amount,
          status: payment.status,
          date_approved: payment.date_approved,
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[process-pending-coupon] Erro geral:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message || 'Erro interno do servidor' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
