import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessResult {
  payment_id: string;
  email: string;
  coupon_code: string;
  sku: string;
  mp_status: string;
  processed: boolean;
  message: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[process-all-pending-coupons] Iniciando verificação em lote...');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const mpAccessToken = Deno.env.get('MP_ACCESS_TOKEN');

    // 1. Buscar todos os pending_payments com cupom
    const { data: pendingPayments, error: fetchError } = await supabaseAdmin
      .from('pending_payments')
      .select('*')
      .not('coupon_code', 'is', null)
      .eq('status', 'pending')
      .eq('processed', false)
      .limit(50); // Limitar a 50 para evitar timeout

    if (fetchError) {
      console.error('[process-all-pending-coupons] Erro ao buscar pendentes:', fetchError);
      throw fetchError;
    }

    console.log(`[process-all-pending-coupons] ${pendingPayments?.length || 0} pagamentos para verificar`);

    if (!pendingPayments || pendingPayments.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          summary: { total: 0, approved: 0, pending: 0, refunded: 0, rejected: 0, errors: 0 },
          details: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Processar cada pagamento em paralelo
    const results = await Promise.all(
      pendingPayments.map(async (pp): Promise<ProcessResult> => {
        try {
          console.log(`[process-all-pending-coupons] Verificando payment_id: ${pp.payment_id}`);

          // Consultar status no Mercado Pago com timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

          const mpResponse = await fetch(
            `https://api.mercadopago.com/v1/payments/${pp.payment_id}`,
            {
              headers: {
                'Authorization': `Bearer ${mpAccessToken}`,
                'Content-Type': 'application/json',
              },
              signal: controller.signal,
            }
          );

          clearTimeout(timeoutId);

          if (!mpResponse.ok) {
            console.error(`[process-all-pending-coupons] Erro MP para ${pp.payment_id}:`, mpResponse.status);
            return {
              payment_id: pp.payment_id,
              email: pp.email,
              coupon_code: pp.coupon_code,
              sku: pp.sku || 'N/A',
              mp_status: 'error',
              processed: false,
              message: `Erro ao consultar MP (${mpResponse.status})`
            };
          }

          const payment = await mpResponse.json();
          console.log(`[process-all-pending-coupons] ${pp.payment_id} status: ${payment.status}`);

          // Se aprovado, processar cupom
          if (payment.status === 'approved') {
            try {
              // Buscar dados do cupom
              const { data: couponData } = await supabaseAdmin
                .from('user_coupons')
                .select('owner_user_id, pix_key')
                .eq('id', pp.coupon_id)
                .single();

              // Buscar email do owner
              const { data: ownerPatient } = await supabaseAdmin
                .from('patients')
                .select('email')
                .eq('id', couponData?.owner_user_id)
                .single();

              // Buscar dados do comprador
              const { data: buyerData } = await supabaseAdmin
                .from('patients')
                .select('first_name, last_name, id')
                .eq('email', pp.email)
                .single();

              const buyerName = buyerData 
                ? `${buyerData.first_name || ''} ${buyerData.last_name || ''}`.trim()
                : pp.email.split('@')[0];

              // Criar registro em coupon_uses
              const { error: couponUseError } = await supabaseAdmin
                .from('coupon_uses')
                .insert({
                  coupon_id: pp.coupon_id,
                  coupon_code: pp.coupon_code,
                  used_by_user_id: buyerData?.id || null,
                  used_by_name: buyerName,
                  used_by_email: pp.email,
                  service_or_plan_id: pp.sku,
                  service_or_plan_name: pp.sku || 'Serviço',
                  owner_user_id: couponData?.owner_user_id || null,
                  owner_email: ownerPatient?.email || '',
                  owner_pix_key: couponData?.pix_key || null,
                  payment_id: pp.payment_id,
                  order_id: pp.order_id,
                  amount_original: pp.amount_original,
                  amount_discounted: pp.amount_cents,
                  discount_percentage: pp.discount_percentage,
                });

              if (couponUseError) {
                console.error('[process-all-pending-coupons] Erro ao criar coupon_use:', couponUseError);
              }

              // Atualizar pending_payments
              await supabaseAdmin
                .from('pending_payments')
                .update({
                  status: 'approved',
                  processed: true,
                  processed_at: new Date().toISOString(),
                })
                .eq('payment_id', pp.payment_id);

              // Registrar métrica
              await supabaseAdmin.from('metrics').insert({
                metric_type: 'sale',
                patient_email: pp.email,
                amount_cents: pp.amount_cents,
                plan_code: pp.sku,
                status: 'approved',
                metadata: {
                  payment_id: pp.payment_id,
                  order_id: pp.order_id,
                  coupon_code: pp.coupon_code,
                  batch_processed: true,
                },
              });

              console.log(`[process-all-pending-coupons] ✅ ${pp.payment_id} processado com sucesso`);

              return {
                payment_id: pp.payment_id,
                email: pp.email,
                coupon_code: pp.coupon_code,
                sku: pp.sku || 'N/A',
                mp_status: 'approved',
                processed: true,
                message: '✅ Processado e registrado'
              };
            } catch (processError) {
              console.error('[process-all-pending-coupons] Erro ao processar aprovado:', processError);
              return {
                payment_id: pp.payment_id,
                email: pp.email,
                coupon_code: pp.coupon_code,
                sku: pp.sku || 'N/A',
                mp_status: 'approved',
                processed: false,
                message: `Erro ao processar: ${processError.message}`
              };
            }
          }

          // Se estornado ou rejeitado, atualizar pending_payment
          if (payment.status === 'refunded' || payment.status === 'rejected' || payment.status === 'cancelled') {
            await supabaseAdmin
              .from('pending_payments')
              .update({ status: payment.status })
              .eq('payment_id', pp.payment_id);

            return {
              payment_id: pp.payment_id,
              email: pp.email,
              coupon_code: pp.coupon_code,
              sku: pp.sku || 'N/A',
              mp_status: payment.status,
              processed: false,
              message: payment.status === 'refunded' ? '🔄 Estornado no MP' : '❌ Rejeitado no MP'
            };
          }

          // Ainda pendente
          return {
            payment_id: pp.payment_id,
            email: pp.email,
            coupon_code: pp.coupon_code,
            sku: pp.sku || 'N/A',
            mp_status: 'pending',
            processed: false,
            message: '⏳ Ainda aguardando pagamento'
          };

        } catch (error) {
          console.error(`[process-all-pending-coupons] Erro ao processar ${pp.payment_id}:`, error);
          return {
            payment_id: pp.payment_id,
            email: pp.email,
            coupon_code: pp.coupon_code,
            sku: pp.sku || 'N/A',
            mp_status: 'error',
            processed: false,
            message: `⚠️ Erro: ${error.message}`
          };
        }
      })
    );

    // 3. Gerar resumo
    const summary = {
      total: results.length,
      approved: results.filter(r => r.processed && r.mp_status === 'approved').length,
      pending: results.filter(r => r.mp_status === 'pending').length,
      refunded: results.filter(r => r.mp_status === 'refunded').length,
      rejected: results.filter(r => r.mp_status === 'rejected' || r.mp_status === 'cancelled').length,
      errors: results.filter(r => r.mp_status === 'error').length,
    };

    console.log('[process-all-pending-coupons] Resumo:', summary);

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        details: results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[process-all-pending-coupons] Erro geral:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        message: error.message || 'Erro interno do servidor',
        summary: { total: 0, approved: 0, pending: 0, refunded: 0, rejected: 0, errors: 0 },
        details: []
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
