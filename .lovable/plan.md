
# Plano de Correção: Duplicação de Cobrança e Appointments da Angela Bandeira

## Diagnóstico do Problema

### Causa Raiz: Race Condition entre Webhook e Polling

A duplicação de appointment (e potencialmente cobrança dupla) ocorreu porque existem **dois processos paralelos** tentando criar o appointment para o mesmo pagamento:

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│                      RACE CONDITION - FLUXO ATUAL                             │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  T=0s    Usuário paga via Cartão/PIX                                          │
│            │                                                                  │
│            ├── Frontend inicia pollPaymentStatus (a cada 8s)                  │
│            │                                                                  │
│  T=3s     Mercado Pago envia webhook para mp-webhook                          │
│            │                                                                  │
│  T=8s     Polling chama check-payment-status                                  │
│            │                                                                  │
│            │  ┌─────────────────────────────────────────────────────────────┐ │
│            │  │ JANELA DE RACE CONDITION (~500ms a 3s)                      │ │
│            │  │                                                             │ │
│            │  │  mp-webhook verifica: "Existe appointment com order_id X?"  │ │
│            │  │  → Não existe                                               │ │
│            │  │  → Chama schedule-redirect                                  │ │
│            │  │                                                             │ │
│            │  │  check-payment-status verifica: "Existe appointment?"       │ │
│            │  │  → Não existe (ainda não foi criado pelo webhook)           │ │
│            │  │  → Chama schedule-redirect TAMBÉM                           │ │
│            │  │                                                             │ │
│            │  │  RESULTADO: 2 appointments criados para o mesmo order_id!   │ │
│            │  └─────────────────────────────────────────────────────────────┘ │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Por que a verificação de duplicação existente não funciona?

O código atual verifica se já existe appointment com o `order_id` ANTES de criar:

```typescript
// schedule-redirect/index.ts linha 418-433
if (payload.order_id) {
  const { data: existingAppointment } = await supabase
    .from('appointments')
    .select('appointment_id, redirect_url')
    .eq('order_id', payload.order_id)
    .maybeSingle();
  
  if (existingAppointment) {
    return { existing: true }; // Retorna existente
  }
}
// Se não existe, CRIA NOVO...
```

**Problema:** Esta verificação é feita em nível de aplicação, não no banco de dados. Se dois processos executam a verificação quase simultaneamente (antes do INSERT ser commitado), ambos veem "não existe" e ambos criam.

### Evidência no Código

| Arquivo | Verificação de Duplicação | Problema |
|---------|---------------------------|----------|
| `schedule-redirect/index.ts` linhas 418-434 | SELECT antes de INSERT | Não é atômica |
| `check-payment-status/index.ts` linhas 187-230 | SELECT antes de chamar schedule-redirect | Não é atômica |
| `mp-webhook/index.ts` linhas 853-878 | SELECT antes de chamar schedule-redirect | Não é atômica |

---

## Solução: Unique Constraint + INSERT ON CONFLICT

### Etapa 1: Adicionar Unique Constraint na Tabela `appointments`

**Arquivo:** Migration SQL (via ferramenta de migração)

A tabela `appointments` precisa de um índice único no campo `order_id` para garantir que apenas um appointment exista por pagamento.

```sql
-- Criar índice único para order_id (apenas se não nulo)
CREATE UNIQUE INDEX IF NOT EXISTS appointments_order_id_unique_idx 
ON appointments (order_id) 
WHERE order_id IS NOT NULL;
```

---

### Etapa 2: Modificar `schedule-redirect` para usar INSERT ON CONFLICT

**Arquivo:** `supabase/functions/schedule-redirect/index.ts`

Substituir o padrão "SELECT → INSERT" por um INSERT atômico com tratamento de conflito:

```typescript
// ANTES (vulnerável a race condition):
if (payload.order_id) {
  const { data: existingAppointment } = await supabase
    .from('appointments')
    .select('appointment_id, redirect_url')
    .eq('order_id', payload.order_id)
    .maybeSingle();
  
  if (existingAppointment) {
    return { existing: true };
  }
}
// INSERT normal...

// DEPOIS (atômico e seguro):
const { data, error } = await supabase
  .from('appointments')
  .upsert(appointmentData, {
    onConflict: 'order_id',
    ignoreDuplicates: false // Retorna o registro existente
  })
  .select()
  .maybeSingle();
```

**Alternativa mais robusta:** Usar INSERT e capturar erro de unique violation:

```typescript
const { data, error } = await supabase
  .from('appointments')
  .insert(appointmentData)
  .select()
  .maybeSingle();

// Se erro de duplicação, buscar o existente
if (error?.code === '23505') { // unique_violation
  console.log('[saveAppointment] ⚠️ Duplicado detectado via constraint');
  const { data: existing } = await supabase
    .from('appointments')
    .select('appointment_id, redirect_url')
    .eq('order_id', payload.order_id)
    .single();
  
  return { 
    appointment_id: existing.appointment_id, 
    redirect_url: existing.redirect_url,
    existing: true 
  };
}
```

---

### Etapa 3: Adicionar Unique Constraint para Métricas (Opcional)

**Arquivo:** Migration SQL

Para evitar métricas duplicadas de venda:

```sql
-- Índice único para evitar métricas de venda duplicadas por order_id
CREATE UNIQUE INDEX IF NOT EXISTS metrics_sale_order_id_unique_idx 
ON metrics (metric_type, (metadata->>'order_id')) 
WHERE metric_type = 'sale' AND metadata->>'order_id' IS NOT NULL;
```

---

### Etapa 4: Proteção Extra no `check-payment-status`

**Arquivo:** `supabase/functions/check-payment-status/index.ts`

Antes de chamar `schedule-redirect`, verificar novamente se appointment já existe (proteção em camadas):

```typescript
// Antes de chamar schedule-redirect, verificar uma última vez
const { data: existingApt } = await supabaseAdmin
  .from('appointments')
  .select('appointment_id, redirect_url')
  .eq('order_id', orderIdToCheck)
  .maybeSingle();

if (existingApt) {
  console.log('[check-payment-status] ✅ Appointment já existe, retornando...');
  return new Response(JSON.stringify({ 
    success: true,
    approved: true,
    redirect_url: existingApt.redirect_url,
    existing: true
  }), { status: 200, headers: corsHeaders });
}
```

---

## Arquivos a Serem Modificados

| Arquivo | Alteração | Criticidade |
|---------|-----------|-------------|
| Migration SQL | Adicionar `UNIQUE INDEX` em `appointments.order_id` | Alta |
| `supabase/functions/schedule-redirect/index.ts` | Usar INSERT com tratamento de `23505` unique_violation | Alta |
| `supabase/functions/check-payment-status/index.ts` | Adicionar verificação extra antes de schedule-redirect | Média |
| `supabase/functions/mp-webhook/index.ts` | Confiar no tratamento do schedule-redirect (já delega) | Baixa |

---

## Fluxo Corrigido

```text
┌───────────────────────────────────────────────────────────────────────────────┐
│                         FLUXO CORRIGIDO (COM CONSTRAINT)                      │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  T=0s    Usuário paga via Cartão/PIX                                          │
│            │                                                                  │
│  T=3s     mp-webhook chama schedule-redirect                                  │
│            │                                                                  │
│            └── INSERT appointment (order_id = 'X') → SUCESSO                  │
│                                                                               │
│  T=8s     check-payment-status chama schedule-redirect                        │
│            │                                                                  │
│            └── INSERT appointment (order_id = 'X')                            │
│                  │                                                            │
│                  └── ERRO 23505 (unique_violation)                            │
│                        │                                                      │
│                        └── SELECT existente → RETORNA appointment original    │
│                                                                               │
│  RESULTADO: Apenas 1 appointment, 1 métrica, 1 cobrança                       │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## Ação Imediata: Corrigir Dados da Angela Bandeira

Após a correção ser implementada, será necessário:

1. **Identificar os appointments duplicados** no banco de produção
2. **Remover o appointment duplicado** (manter apenas o primeiro criado)
3. **Verificar se houve cobrança dupla** no Mercado Pago
4. **Estornar se necessário** o pagamento duplicado

---

## Seção Técnica

### PostgreSQL Error Codes

| Código | Nome | Significado |
|--------|------|-------------|
| `23505` | unique_violation | Tentativa de inserir valor que viola constraint única |

### Memórias Relevantes

- `memory/database/appointments-insertion-constraints`: Confirma que o projeto original usa `.insert()` e não tem unique constraint
- `memory/technical/payment-duplicate-processing-guard`: Menciona guards de duplicação, mas focados em `pending_payments`, não appointments

### Tabelas Afetadas

- `appointments`: Adicionar índice único em `order_id`
- `metrics`: Opcionalmente adicionar índice único para evitar métricas duplicadas
