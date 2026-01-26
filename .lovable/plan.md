

## Correção das Falhas de Processamento de Pagamentos do Mercado Pago (10-25%)

### Diagnóstico Detalhado

Após análise minuciosa do código e dados do banco, identifiquei **3 problemas principais** que estão causando a taxa de falha de 10-25% nos pagamentos aprovados:

---

### Problema 1: Schema Incorreto da Tabela `clicklife_registrations`

**Descrição**: O código do `mp-webhook` (linhas 837-854, 1117-1135, 1421-1437) tenta inserir dados com **12 colunas que não existem** no schema atual:

| O código espera | O que existe no banco |
|-----------------|----------------------|
| `patient_email` | ❌ Não existe |
| `patient_cpf` | `cpf` (similar) |
| `patient_name` | ❌ Não existe |
| `order_id` | ❌ Não existe |
| `payment_id` | ❌ Não existe |
| `sku` | ❌ Não existe |
| `service_name` | ❌ Não existe |
| `clicklife_empresa_id` | ❌ Não existe |
| `clicklife_plano_id` | ❌ Não existe |
| `success` | ❌ Não existe |
| `response_data` | `registration_data` (similar) |

**Impacto**: Quando o insert falha, o código está em um `try-catch` que apenas loga o erro e continua. **Mas isso pode estar causando comportamento imprevisível** que interrompe o fluxo em alguns casos.

**Correção**: Atualizar o código do `mp-webhook` para usar a estrutura correta da tabela (usando `registration_data` como JSONB para armazenar todos os dados adicionais).

---

### Problema 2: Ausência de Cron Job para Reconciliação

**Descrição**: A extensão `pg_cron` **não está habilitada** no projeto Supabase, então não há job automático de reconciliação.

**Impacto**: Pagamentos que falham no webhook ficam em `processed: false` **indefinidamente** até serem corrigidos manualmente.

**Dados atuais**:
| Data | Aprovados | Não Processados | Taxa de Falha |
|------|-----------|-----------------|---------------|
| 26/01 | 8 | 1 | 12.5% |
| 25/01 | 12 | 3 | 25.0% |
| 24/01 | 10 | 3 | 30.0% |
| 23/01 | 23 | 4 | 17.4% |
| 22/01 | 28 | 1 | 3.6% |
| 21/01 e antes | - | 0 | 0% |

**Correção**: Habilitar `pg_cron` e `pg_net` e configurar job automático a cada 15 minutos.

---

### Problema 3: Lógica de `processed = true` Inconsistente

**Descrição**: O `mp-webhook` marca `processed = true` no final do fluxo (linha 1757), mas apenas se `scheduledOk` for `true`. 

**Porém**, os dados mostram que:
- Todos os pagamentos não processados para **serviços** (SKU `ITC6534`) **TÊM** appointment com redirect_url
- Isso significa que o **polling do frontend** (`check-payment-status`) criou o appointment, **mas não marcou como processado**

**Causa raiz**: O `check-payment-status` não está marcando `processed = true` quando **já existe** um appointment.

**Correção**: Garantir que `check-payment-status` marque como processado mesmo quando encontra appointment existente.

---

## Plano de Correção

### Correção 1: Atualizar inserts em `clicklife_registrations`

**Arquivo**: `supabase/functions/mp-webhook/index.ts`

**Alteração**: Substituir todos os inserts que usam colunas inexistentes por uma estrutura compatível:

```typescript
// ANTES (incorreto)
await supabaseAdmin.from('clicklife_registrations').insert({
  patient_email: email,
  patient_cpf: cpf,
  patient_name: nome,
  order_id: orderId,
  // ... 8 colunas que não existem
});

// DEPOIS (correto)
await supabaseAdmin.from('clicklife_registrations').insert({
  cpf: cpf,  // Único campo obrigatório
  patient_id: patientId || null,
  status: clicklifeResult.success ? 'success' : 'failed',
  error_message: clicklifeResult.error || null,
  registration_data: {  // JSONB para todos os dados extras
    patient_email: email,
    patient_name: nome,
    order_id: orderId,
    payment_id: paymentId,
    sku: sku,
    service_name: serviceName,
    clicklife_empresa_id: 9083,
    clicklife_plano_id: planoId,
    success: clicklifeResult.success,
    response: clicklifeResult
  }
});
```

**Localizações no código**:
- Linhas 837-854 (fluxo de plano)
- Linhas 1117-1135 (especialista sem plano)
- Linhas 1181-1197 (fallback quando patientData é null)
- Linhas 1421-1437 (cadastro universal)

---

### Correção 2: Marcar `processed = true` em Todos os Cenários Bem-Sucedidos

**Arquivo**: `supabase/functions/mp-webhook/index.ts`

**Problema identificado**: Quando um pagamento **já tem appointment** (criado pelo polling do frontend), o `mp-webhook` detecta duplicação e retorna cedo (linhas 595-607), **sem marcar `processed = true`**.

**Correção**: Adicionar atualização de `processed = true` antes do return nas verificações de duplicação:

```typescript
// Linha ~600 - Verificação de duplicação para planos
if (existingAppointment) {
  console.log('[mp-webhook] ⚠️ Appointment duplicado detectado!');
  
  // ✅ NOVA CORREÇÃO: Marcar como processado
  if (orderId) {
    await supabaseAdmin
      .from('pending_payments')
      .update({ processed: true, processed_at: new Date().toISOString(), status: 'approved' })
      .eq('order_id', orderId);
  }
  
  return new Response(...);
}
```

Aplicar em **4 locais** onde há verificação de duplicação:
- Linha ~595 (fluxo de plano)
- Linha ~950 (psicólogo sem plano)
- Linha ~1203 (especialista sem plano)

---

### Correção 3: Habilitar pg_cron e Criar Job de Reconciliação

**Ação via SQL** (executar no Supabase Dashboard > SQL Editor):

```sql
-- 1. Habilitar extensões (se não estiverem ativas)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Criar job de reconciliação a cada 15 minutos
SELECT cron.schedule(
  'reconcile-payments-every-15min',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url:='https://ploqujuhpwutpcibedbr.supabase.co/functions/v1/reconcile-pending-payments',
    headers:=jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsb3F1anVocHd1dHBjaWJlZGJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mjc0NjI2MTgsImV4cCI6MjA0MzAzODYxOH0.1nLOxDcmjNEOfQ4DRFfIZBfDnzCuMvXQMJhGYyO4HG0'
    ),
    body:=jsonb_build_object('limit', 50, 'days_back', 3)
  );
  $$
);
```

**Nota**: Será necessário executar isso manualmente no painel do Supabase, pois o Lovable Cloud não pode habilitar extensões via migration.

---

### Correção 4: Adicionar Cadastro ClickLife no `reconcile-pending-payments`

**Arquivo**: `supabase/functions/reconcile-pending-payments/index.ts`

**Problema**: Quando o job de reconciliação cria um plano, ele não cadastra o paciente na ClickLife.

**Correção**: Adicionar chamada de registro ClickLife após criar plano (similar ao que foi feito no `check-payment-status`).

---

## Resumo das Alterações

| Arquivo | Alteração | Prioridade |
|---------|-----------|------------|
| `supabase/functions/mp-webhook/index.ts` | Corrigir inserts em clicklife_registrations | 🔴 CRÍTICA |
| `supabase/functions/mp-webhook/index.ts` | Marcar processed=true nas verificações de duplicação | 🔴 CRÍTICA |
| `supabase/functions/reconcile-pending-payments/index.ts` | Adicionar cadastro ClickLife para planos | 🟡 ALTA |
| SQL (manual) | Habilitar pg_cron e criar job | 🟡 ALTA |

---

## Resultado Esperado

Após as correções:
1. **100% dos pagamentos aprovados** serão marcados como `processed = true`
2. **Planos comprados** serão ativados automaticamente e cadastrados na ClickLife
3. **Serviços** terão appointments criados e marcados como processados
4. **Job de reconciliação** capturará qualquer falha residual a cada 15 minutos

