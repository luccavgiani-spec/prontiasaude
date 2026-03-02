import { createClient } from "npm:@supabase/supabase-js@2.94.1";

// ✅ URL FIXA do projeto original onde as Edge Functions estão deployadas
// NÃO usar Deno.env.get('SUPABASE_URL') pois pode apontar para projeto errado (Lovable Cloud)
const ORIGINAL_SUPABASE_URL = "https://ploqujuhpwutpcibedbr.supabase.co";
const ORIGINAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3F1anVocHd1dHBjaWJlZGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3NjYxODQsImV4cCI6MjA3MjM0MjE4NH0.WD3MXt1Y4sYxkaCPGgD0s8LdhPx_7eEQ1ewaFhnQ8-I";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ✅ Cadastro ClickLife removido deste arquivo — agora ocorre exclusivamente via mp-webhook e schedule-redirect

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { payment_id, email, order_id } = await req.json();

    console.log("[check-payment-status] ==============================");
    console.log("[check-payment-status] 🔍 Verificando pagamento:", { payment_id, order_id, email });

    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");
    if (!MP_ACCESS_TOKEN) {
      throw new Error("MP_ACCESS_TOKEN não configurado");
    }

    // Consultar API do Mercado Pago
    const response = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });

    if (!response.ok) {
      console.error("[check-payment-status] Erro ao buscar payment:", response.status);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Payment não encontrado",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const payment = await response.json();
    console.log("[check-payment-status] 📊 Status do payment:", payment.status);
    console.log("[check-payment-status] 📦 Metadata:", JSON.stringify(payment.metadata));

    // Se aprovado, processar criação de appointment
    if (payment.status === "approved") {
      console.log("[check-payment-status] ✅ Pagamento APROVADO! Processando...");

      const schedulePayload = payment.metadata?.schedulePayload || payment.metadata?.schedule_payload;

      if (!schedulePayload) {
        console.error("[check-payment-status] ❌ schedulePayload NÃO encontrado no metadata!");
        console.error("[check-payment-status] Metadata keys:", Object.keys(payment.metadata || {}));
        return new Response(
          JSON.stringify({
            success: false,
            status: payment.status,
            approved: true,
            error: "Dados de agendamento não encontrados no pagamento",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      console.log("[check-payment-status] 📋 schedulePayload encontrado:", JSON.stringify(schedulePayload));

      // ✅ CORREÇÃO: Usar URL e KEY fixa do projeto original (evita split-brain)
      const ORIGINAL_SERVICE_ROLE_KEY =
        Deno.env.get("ORIGINAL_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      const supabase = createClient(ORIGINAL_SUPABASE_URL, ORIGINAL_SERVICE_ROLE_KEY);

      const supabaseAdmin = createClient(ORIGINAL_SUPABASE_URL, ORIGINAL_SERVICE_ROLE_KEY);

      const orderIdToCheck = payment.metadata?.order_id || order_id;

      // ✅ VERIFICAÇÃO DE DUPLICAÇÃO: Checar se já existe appointment com este order_id
      if (orderIdToCheck) {
        const { data: existingAppointment } = await supabaseAdmin
          .from("appointments")
          .select("appointment_id, redirect_url, provider")
          .eq("order_id", orderIdToCheck)
          .maybeSingle();

        if (existingAppointment) {
          console.log("[check-payment-status] ⚠️ Appointment já existe para order_id:", orderIdToCheck);
          console.log("[check-payment-status] Retornando dados existentes em vez de criar duplicado");

          // ✅ CORREÇÃO: Garantir que pending_payment seja marcado como processado
          try {
            const { error: updateError } = await supabaseAdmin
              .from("pending_payments")
              .update({
                processed: true,
                processed_at: new Date().toISOString(),
                status: "approved",
              })
              .eq("order_id", orderIdToCheck);

            if (updateError) {
              console.error("[check-payment-status] ⚠️ Erro ao atualizar pending_payment:", updateError);
            } else {
              console.log("[check-payment-status] ✅ pending_payment atualizado para processed=true");
            }
          } catch (updateErr) {
            console.error("[check-payment-status] ⚠️ Exceção ao atualizar pending_payment:", updateErr);
          }

          return new Response(
            JSON.stringify({
              success: true,
              status: payment.status,
              approved: true,
              redirect_url: existingAppointment.redirect_url,
              appointment_id: existingAppointment.appointment_id,
              existing: true,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }

      // ✅ NOVO: Verificar se é SKU de PLANO (IND_* ou FAM_*)
      const sku = schedulePayload.sku || "";
      const isPlanPurchase = /^(IND_|FAM_)/.test(sku);

      if (isPlanPurchase) {
        console.log("[check-payment-status] 🎯 SKU de PLANO detectado:", sku);

        // Calcular expiração do plano (1 mês para mensal, 12 meses para anual)
        const planExpiresAt = new Date();
        if (sku.includes("_12M")) {
          planExpiresAt.setFullYear(planExpiresAt.getFullYear() + 1);
        } else {
          planExpiresAt.setMonth(planExpiresAt.getMonth() + 1);
        }

        // Buscar patient_id pelo email
        const patientEmail = schedulePayload.email?.toLowerCase()?.trim();
        let patientId = null;

        if (patientEmail) {
          const { data: patient } = await supabaseAdmin
            .from("patients")
            .select("id")
            .eq("email", patientEmail)
            .maybeSingle();
          patientId = patient?.id || null;
        }

        // Verificar se já existe um plano ativo
        const { data: existingPlan } = await supabaseAdmin
          .from("patient_plans")
          .select("id")
          .eq("email", patientEmail)
          .eq("plan_code", sku)
          .eq("status", "active")
          .maybeSingle();

        let planCreatedSuccessfully = false;

        if (existingPlan) {
          console.log("[check-payment-status] ⚠️ Plano já existe e está ativo, atualizando expiração");

          const { error: updateError } = await supabaseAdmin
            .from("patient_plans")
            .update({
              plan_expires_at: planExpiresAt.toISOString().split("T")[0],
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingPlan.id);

          planCreatedSuccessfully = !updateError;
        } else {
          // Criar novo patient_plans
          const { error: planError } = await supabaseAdmin.from("patient_plans").insert({
            email: patientEmail,
            patient_id: patientId,
            plan_code: sku,
            plan_expires_at: planExpiresAt.toISOString().split("T")[0],
            start_date: new Date().toISOString().split("T")[0],
            status: "active",
            activated_at: new Date().toISOString(),
            activated_by: "check-payment-status",
            payment_method: payment.payment_type_id || "unknown",
          });

          if (planError) {
            console.error("[check-payment-status] ❌ Erro ao criar plano:", planError);
            planCreatedSuccessfully = false;
          } else {
            console.log("[check-payment-status] ✅ Plano criado com sucesso!");
            planCreatedSuccessfully = true;
          }
        }

        // ✅ CORREÇÃO: Verificar se o plano realmente foi criado antes de marcar como processado
        if (planCreatedSuccessfully) {
          // Verificar no banco se o plano existe (double-check)
          const { data: verifyPlan } = await supabaseAdmin
            .from("patient_plans")
            .select("id")
            .eq("email", patientEmail)
            .eq("plan_code", sku)
            .eq("status", "active")
            .maybeSingle();

          if (!verifyPlan) {
            console.error("[check-payment-status] ❌ Verificação falhou: plano não encontrado após criação");
            return new Response(
              JSON.stringify({
                success: false,
                status: payment.status,
                approved: true,
                error: "Plan verification failed - please refresh and try again",
              }),
              {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              },
            );
          }

          // ✅ Cadastro ClickLife removido — ocorre exclusivamente via mp-webhook e schedule-redirect

          // Atualizar pending_payment como processado
          if (orderIdToCheck) {
            await supabaseAdmin
              .from("pending_payments")
              .update({
                processed: true,
                processed_at: new Date().toISOString(),
                status: "approved",
              })
              .eq("order_id", orderIdToCheck);
          }

          // Gravar métrica de venda para PLANO
          await supabaseAdmin.from("metrics").insert({
            metric_type: "sale",
            sku: sku,
            metric_value: Math.round(payment.transaction_amount * 100),
            platform: "plan_activation",
            metadata: {
              payment_id: payment.id,
              mp_status: payment.status,
              order_id: orderIdToCheck,
              source: "check-payment-status",
              is_plan: true,
            },
          });

          console.log("[check-payment-status] ✅ Plano processado, redirecionando para área do paciente");

          return new Response(
            JSON.stringify({
              success: true,
              status: "approved",
              approved: true,
              redirect_url: "/area-do-paciente",
              is_plan: true,
              plan_code: sku,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        } else {
          // Plano não foi criado - retornar erro para frontend tentar novamente
          console.error("[check-payment-status] ❌ Plano não foi criado, retornando erro");
          return new Response(
            JSON.stringify({
              success: false,
              status: payment.status,
              approved: true,
              error: "Plan creation failed - system will retry automatically",
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }

      // ==========================================
      // FLUXO NORMAL PARA SERVIÇOS (NÃO É PLANO)
      // ==========================================
      console.log("[check-payment-status] 🎉 PIX/Cartão aprovado para SERVIÇO! Criando appointment...");

      // ✅ CORREÇÃO: Chamar schedule-redirect via fetch direto com URL fixa do projeto original
      // NÃO usar supabase.functions.invoke() pois usa SUPABASE_URL que pode apontar para projeto errado
      const scheduleResponse = await fetch(`${ORIGINAL_SUPABASE_URL}/functions/v1/schedule-redirect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ORIGINAL_ANON_KEY}`,
          apikey: ORIGINAL_ANON_KEY,
        },
        body: JSON.stringify({
          cpf: schedulePayload.cpf,
          email: schedulePayload.email,
          nome: schedulePayload.nome,
          telefone: schedulePayload.telefone,
          especialidade: schedulePayload.especialidade || "Clínico Geral",
          sku: schedulePayload.sku,
          horario_iso: schedulePayload.horario_iso || new Date().toISOString(),
          plano_ativo: schedulePayload.plano_ativo || false,
          order_id: orderIdToCheck,
          payment_id: payment.id,
          birth_date: schedulePayload.birth_date,
          sexo: schedulePayload.sexo,
        }),
      });

      const scheduleData = scheduleResponse.ok ? await scheduleResponse.json() : null;
      const scheduleError = !scheduleResponse.ok ? { message: `HTTP ${scheduleResponse.status}` } : null;

      if (scheduleError) {
        console.error("[check-payment-status] Erro ao criar appointment:", scheduleError);
        return new Response(
          JSON.stringify({
            success: false,
            status: payment.status,
            error: "Erro ao criar agendamento",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Gravar métrica de venda para SERVIÇO
      await supabaseAdmin.from("metrics").insert({
        metric_type: "sale",
        sku: schedulePayload.sku || "UNKNOWN",
        metric_value: Math.round(payment.transaction_amount * 100),
        platform: scheduleData?.provider || "unknown",
        metadata: {
          payment_id: payment.id,
          mp_status: payment.status,
          order_id: orderIdToCheck,
          source: "check-payment-status",
        },
      });

      // Marcar pending_payment como processado E status como approved
      if (orderIdToCheck) {
        await supabaseAdmin
          .from("pending_payments")
          .update({
            processed: true,
            processed_at: new Date().toISOString(),
            status: "approved",
          })
          .eq("order_id", orderIdToCheck);
      }

      console.log("[check-payment-status] ✅ Appointment criado:", scheduleData);

      return new Response(
        JSON.stringify({
          success: true,
          status: payment.status,
          approved: true,
          redirect_url: scheduleData?.url,
          appointment_id: scheduleData?.appointment_id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Se ainda pending ou outro status
    return new Response(
      JSON.stringify({
        success: true,
        status: payment.status,
        approved: false,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("[check-payment-status] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
