
# Plano de Correção: Override ClickLife e Data de Nascimento

## Diagnóstico Confirmado

### Problema 1: Override ClickLife não funcionou
**Causa**: A edge function `schedule-redirect` usa `Deno.env.get('SUPABASE_URL')` que aponta para o projeto Lovable Cloud (yrsjluhhnhxogdgnbnya), onde a tabela `admin_settings` não tem `force_clicklife_pronto_atendimento = true`.

**Evidência nos logs**:
```
reason: "commercial_hours"  ← Prova que o override NÃO foi acionado
```

### Problema 2: Data de nascimento usou fallback (01/01/1990)
**Causa**: O `check-payment-status` não está passando `birth_date` e `sexo` para o `schedule-redirect`, mesmo tendo esses dados no `schedulePayload`.

**Evidência**:
```typescript
// check-payment-status linha 435-446 - FALTA birth_date e sexo no body
body: JSON.stringify({
  cpf, email, nome, telefone, especialidade, sku, horario_iso, plano_ativo, order_id, payment_id
  // ❌ birth_date ausente
  // ❌ sexo ausente
})
```

---

## Correções Necessárias

### Correção 1: Forçar URL fixa no `schedule-redirect`

**Arquivo**: `supabase/functions/schedule-redirect/index.ts`

**Alteração nas linhas 569-573**:

```typescript
// ANTES (PROBLEMÁTICO):
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// DEPOIS (CORRIGIDO):
// ✅ URL FIXA do projeto original onde admin_settings está configurado
const ORIGINAL_SUPABASE_URL = 'https://ploqujuhpwutpcibedbr.supabase.co';
const supabase = createClient(
  ORIGINAL_SUPABASE_URL,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);
```

**Também corrigir linhas 1308-1311** (dentro de `redirectClickLife`):
```typescript
const supabaseInstance = createClient(
  ORIGINAL_SUPABASE_URL,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
```

---

### Correção 2: Adicionar `birth_date` e `sexo` no `check-payment-status`

**Arquivo**: `supabase/functions/check-payment-status/index.ts`

**Alteração nas linhas 435-446**:

```typescript
// ANTES:
body: JSON.stringify({
  cpf: schedulePayload.cpf,
  email: schedulePayload.email,
  nome: schedulePayload.nome,
  telefone: schedulePayload.telefone,
  especialidade: schedulePayload.especialidade || 'Clínico Geral',
  sku: schedulePayload.sku,
  horario_iso: schedulePayload.horario_iso || new Date().toISOString(),
  plano_ativo: schedulePayload.plano_ativo || false,
  order_id: orderIdToCheck,
  payment_id: payment.id
})

// DEPOIS:
body: JSON.stringify({
  cpf: schedulePayload.cpf,
  email: schedulePayload.email,
  nome: schedulePayload.nome,
  telefone: schedulePayload.telefone,
  especialidade: schedulePayload.especialidade || 'Clínico Geral',
  sku: schedulePayload.sku,
  horario_iso: schedulePayload.horario_iso || new Date().toISOString(),
  plano_ativo: schedulePayload.plano_ativo || false,
  order_id: orderIdToCheck,
  payment_id: payment.id,
  birth_date: schedulePayload.birth_date,  // ✅ NOVO
  sexo: schedulePayload.sexo               // ✅ NOVO
})
```

---

## Seção Tecnica: Outras instâncias de createClient no schedule-redirect

Preciso corrigir TODAS as instâncias onde `createClient` usa `SUPABASE_URL`:

| Linha | Contexto | Status |
|-------|----------|--------|
| 570 | Inicio da função | Corrigir |
| 1308 | Dentro de redirectClickLife | Corrigir |
| Outras | saveAppointment usa supabase passado como parametro | OK (recebe da linha 570) |

---

## Resultado Esperado

| Aspecto | Antes | Depois |
|---------|-------|--------|
| Override ClickLife | Não funciona (busca em banco errado) | Funciona (URL fixa) |
| Data de nascimento | Fallback 01/01/1990 | Data real do paciente |
| Gênero | Pode usar fallback | Valor real do frontend |

---

## Arquivos a Modificar

1. `supabase/functions/schedule-redirect/index.ts`
   - Linhas 569-573: Usar ORIGINAL_SUPABASE_URL constante
   - Linhas 1308-1311: Usar mesma constante

2. `supabase/functions/check-payment-status/index.ts`
   - Linhas 435-446: Adicionar birth_date e sexo no body
