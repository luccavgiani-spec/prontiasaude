import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // 1. Buscar pending_payments não processados
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    console.log('[reconcile-pending-payments] Buscando pagamentos desde:', cutoffDate.toISOString());

    // Buscar pagamentos pendentes que não foram processados
    const { data: pendingPayments, error: fetchError } = await supabase
      .from('pending_payments')
      .select('*')
      .or('status.eq.pending,and(status.eq.approved,processed.eq.false)')
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
        console.log(`[reconcile-pending-payments] Processando payment_id: ${payment.payment_id}`);

        // Consultar status no Mercado Pago
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

        console.log(`[reconcile-pending-payments] Status MP: ${mpPayment.status}`);

        // Processar conforme status
        if (mpPayment.status === 'approved') {
          // Tentar extrair schedulePayload do metadata ou payment_data local
          const schedulePayload = 
            mpPayment.metadata?.schedulePayload || 
            mpPayment.metadata?.schedule_payload ||
            (payment.payment_data as any)?.schedulePayload;

          if (schedulePayload && !dryRun) {
            // Chamar schedule-redirect para criar appointment
            // IMPORTANTE: Injetar order_id e payment_id no payload para que o appointment
            // seja criado corretamente e apareça na aba de Vendas
            console.log(`[reconcile-pending-payments] Chamando schedule-redirect com order_id: ${payment.order_id}`);
            
            const enrichedPayload = {
              ...schedulePayload,
              order_id: payment.order_id,
              payment_id: payment.payment_id
            };
            
            const scheduleResponse = await fetch(
              `${Deno.env.get('SUPABASE_URL')}/functions/v1/schedule-redirect`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
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
            result.action = 'would_create_appointment';
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

    console.log('[reconcile-pending-payments] ==============================');
    console.log('[reconcile-pending-payments] ✅ Reconciliação concluída');
    console.log('[reconcile-pending-payments] Summary:', summary);

    return new Response(JSON.stringify({
      success: true,
      dry_run: dryRun,
      summary,
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
