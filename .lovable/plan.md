

## Análise Completa: Falhas no Processamento de Notificações do Mercado Pago

### Resumo Executivo

Após análise detalhada do código, logs e dados do banco, identifiquei **múltiplos pontos de falha** no fluxo de webhooks do Mercado Pago. O problema é **sistêmico** e afeta aproximadamente **10-25% dos pagamentos aprovados**.

---

### Diagnóstico Detalhado

#### 1. Evidência Estatística

| Data | Pagamentos Aprovados | Não Processados | Taxa de Falha |
|------|---------------------|-----------------|---------------|
| 26/01 | 8 | 1 | 12.5% |
| 25/01 | 12 | 3 | 25% |
| 24/01 | 10 | 3 | 30% |
| 23/01 | 23 | 4 | 17% |

**Observação crítica**: Existe uma grande discrepância entre pagamentos aprovados (~8-28/dia) e métricas de venda (~35-152/dia), indicando que muitas vendas estão sendo registradas pelo **polling do frontend** ou **schedule-redirect**, não pelo mp-webhook.

---

#### 2. Pontos de Falha Identificados

##### A. Configuração de Dois Projetos Supabase (PROBLEMA PRINCIPAL)

O sistema opera com **dois projetos Supabase diferentes**:
- **Lovable Cloud**: `yrsjluhhnhxogdgnbnya` (onde o Lovable faz deploy automático)
- **Produção Original**: `ploqujuhpwutpcibedbr` (onde as edge functions deveriam estar)

**Impacto**: O `MP_NOTIFICATION_URL` configurado no Mercado Pago pode estar apontando para um projeto, enquanto as funções são deploiadas em outro.

##### B. Ausência de Logs do mp-webhook

Não há logs recentes do `mp-webhook` nos analytics do Supabase, indicando:
1. O webhook não está sendo chamado pelo MP
2. Ou está sendo chamado em um projeto diferente do que estamos monitorando
3. Ou está retornando erro antes de logar qualquer coisa

##### C. Tabela de Auditoria ClickLife com Schema Incorreto

O código do `mp-webhook` tenta inserir dados na tabela `clicklife_registrations` com colunas que **não existem**:
- Código espera: `patient_email`, `sku`, `patient_name`, `order_id`, `payment_id`, etc.
- Tabela tem: `patient_id`, `cpf`, `status`, `registration_data`, etc.

Isso causa **falhas silenciosas** que podem interromper o fluxo.

##### D. Fluxo de Plano não Marca como Processado em Alguns Cenários

No código do `mp-webhook` (linha 716-730), quando a criação do plano falha, o código retorna **sem marcar** `processed: true`. Porém, se o erro for transitório, o MP não reenvia (pois recebe 200 OK).

##### E. Dependência Excessiva do Polling Frontend

O sistema depende do polling do frontend (`check-payment-status`) para compensar falhas do webhook. Isso funciona para **serviços** (que criam appointments), mas para **planos** como o da Brunna, se o webhook falhar, o plano **nunca é criado** automaticamente.

---

#### 3. Caso Específico: brunna.caroll123@gmail.com

| Campo | Valor |
|-------|-------|
| SKU | IND_COM_ESP_1M (Plano) |
| Status | approved |
| Processado | false |
| Appointment | Nenhum |
| Plano Criado | Nenhum (você ativou manualmente como PREMIUM) |

**Causa provável**: O `mp-webhook` não foi chamado ou falhou silenciosamente. O polling do frontend (`verifyPlanCreation`) também não encontrou o plano porque o webhook não o criou.

---

### Correções Propostas

#### CORREÇÃO 1: Validar e Corrigir MP_NOTIFICATION_URL

**Problema**: A URL de notificação pode estar apontando para o projeto errado ou não estar acessível.

**Ação**: Verificar se o secret `MP_NOTIFICATION_URL` está apontando para a URL correta do projeto de produção (`ploqujuhpwutpcibedbr`).

**Formato correto**:
```
https://ploqujuhpwutpcibedbr.supabase.co/functions/v1/mp-webhook
```

---

#### CORREÇÃO 2: Adicionar Fallback Agressivo no check-payment-status

**Arquivo**: `supabase/functions/check-payment-status/index.ts`

O `check-payment-status` já cria planos como fallback, mas precisa ser mais agressivo e também:
1. Marcar `pending_payments` como processado mesmo quando só atualiza status
2. Garantir que seja chamado periodicamente (cron job)

---

#### CORREÇÃO 3: Implementar Cron Job para Reconciliação Automática

**Novo Job**: Executar `reconcile-pending-payments` automaticamente a cada 15-30 minutos para capturar qualquer pagamento que escapou.

**SQL para criar cron job**:
```sql
SELECT cron.schedule(
  'reconcile-payments-every-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://ploqujuhpwutpcibedbr.supabase.co/functions/v1/reconcile-pending-payments',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer ANON_KEY"}'::jsonb,
    body:='{"limit": 50, "days_back": 1}'::jsonb
  );
  $$
);
```

---

#### CORREÇÃO 4: Corrigir Schema da Tabela clicklife_registrations

**Ação**: Migrar a tabela para ter as colunas corretas que o código espera, ou atualizar o código para usar a estrutura existente.

---

#### CORREÇÃO 5: Adicionar Verificação de Plano no Frontend Pós-Pagamento

**Arquivo**: `src/components/payment/PaymentModal.tsx`

O `verifyPlanCreation` que implementamos hoje já cobre isso parcialmente, mas precisa:
1. Chamar `check-payment-status` forçando o processamento
2. Aguardar mais tempo antes de considerar falha
3. Mostrar mensagem clara ao usuário se o plano não for criado imediatamente

---

### Priorização de Correções

| Prioridade | Correção | Impacto | Esforço |
|------------|----------|---------|---------|
| 🔴 CRÍTICA | Validar MP_NOTIFICATION_URL | Alto | Baixo |
| 🔴 CRÍTICA | Cron job para reconciliação | Alto | Médio |
| 🟡 ALTA | Fallback agressivo em check-payment-status | Alto | Médio |
| 🟡 ALTA | Corrigir schema clicklife_registrations | Médio | Baixo |
| 🟢 MÉDIA | Melhorar logs do mp-webhook | Baixo | Baixo |

---

### Próximos Passos

1. **IMEDIATO**: Verificar o valor atual do secret `MP_NOTIFICATION_URL` e garantir que aponta para o projeto correto
2. **HOJE**: Implementar cron job de reconciliação para capturar pagamentos não processados
3. **ESTA SEMANA**: Revisar e corrigir o schema da tabela `clicklife_registrations`
4. **MONITORAMENTO**: Acompanhar a taxa de `processed: false` diariamente

---

### Seção Técnica

#### Arquivos que precisam de alteração:

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/reconcile-pending-payments/index.ts` | Adicionar cadastro ClickLife para planos reconciliados |
| `supabase/functions/check-payment-status/index.ts` | Já tem a lógica, apenas garantir que está sendo chamado |
| `supabase/functions/mp-webhook/index.ts` | Corrigir inserts na clicklife_registrations |
| SQL Migration | Adicionar colunas faltantes em clicklife_registrations OU criar nova tabela |
| SQL Cron | Criar job de reconciliação automática |

#### Verificação do MP_NOTIFICATION_URL:

Acessar o painel do Supabase (projeto `ploqujuhpwutpcibedbr`) → Edge Functions → Secrets → `MP_NOTIFICATION_URL` e verificar se está como:
```
https://ploqujuhpwutpcibedbr.supabase.co/functions/v1/mp-webhook
```

