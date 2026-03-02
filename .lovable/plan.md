

# Parecer: Subscriptions Pendentes e Solução

## Diagnóstico confirmado

A `reconcile-pending-payments` **NÃO processa subscriptions**. Ela só consulta a tabela `pending_payments` (pagamentos avulsos via PIX/cartão). As subscriptions ficam na tabela `patient_subscriptions` com `mp_status = 'pending_first_payment'` — e ninguém as reconcilia.

**Fluxo atual quebrado:**
1. `mp-create-subscription` cria preapproval no MP → polling 6s → desiste → salva com `mp_status: 'pending_first_payment'`
2. `mp-subscription-webhook` só recebe `subscription_authorized_payment` (cobranças mês 2+), não o primeiro pagamento
3. `reconcile-pending-payments` ignora completamente a tabela `patient_subscriptions`

## Solução proposta

### 1. Adicionar reconciliação de subscriptions pendentes à `reconcile-pending-payments`

Após processar `pending_payments`, adicionar um bloco que:
- Busca `patient_subscriptions` com `mp_status = 'pending_first_payment'` (últimos 7 dias)
- Para cada uma, consulta `GET /preapproval/{id}` no MP para verificar `summarized.charged_quantity`
- Também consulta `/authorized_payments/search?preapproval_id={id}` para verificar pagamento aprovado
- Se pagamento aprovado → ativa o plano em `patient_plans` + registra na ClickLife (mesmo fluxo que já existe no reconciler para planos avulsos)
- Se rejeitado → cancela a subscription no MP e marca como `cancelled`

### 2. Reduzir intervalo do cron de 15min para 2min

Sim, reduzir para 2 minutos é uma solução prática e eficaz. O custo computacional é baixo (a função retorna rápido quando não há pendências). Isso reduz o gap de ativação de ~60min para ~2min.

**Ação necessária:** Atualizar o cron job SQL existente de `*/15 * * * *` para `*/2 * * * *`.

### 3. Ativar manualmente limiervivi e gusan715

Isso pode ser feito via painel admin (ativação manual de plano) ou diretamente no banco.

## Arquivos a modificar

- **`supabase/functions/reconcile-pending-payments/index.ts`**: Adicionar ~80 linhas após a linha 512 (antes do log final) para processar `patient_subscriptions` pendentes
- **Cron job SQL**: Alterar intervalo de 15min para 2min (executado manualmente no banco de Produção)

## O que NÃO será alterado
- `mp-create-subscription` (o polling de 6s é um "best effort" razoável)
- `mp-subscription-webhook` (continua processando cobranças recorrentes futuras)
- Nenhum componente frontend

