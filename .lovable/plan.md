
# Plano de Correção: Hierarquia de Roteamento e Reprocessamento

## 1. SQL Corrigido para Reprocessar Pagamento do Túlio

Execute este SQL no **Supabase de Produção** (Dashboard → SQL Editor):

```sql
-- 1. Apagar appointment errado (foi para Communicare em vez de ClickLife)
DELETE FROM appointments 
WHERE order_id = 'order_1769468646487';

-- 2. Atualizar status do pagamento para "approved" e marcar como não processado
-- NOTA: Removido "updated_at" pois a tabela não tem esta coluna editável diretamente
UPDATE pending_payments
SET 
    status = 'approved',
    processed = false
WHERE payment_id = '143631692958'
  AND order_id = 'order_1769468646487';

-- 3. Verificar resultado
SELECT id, order_id, payment_id, status, processed 
FROM pending_payments 
WHERE payment_id = '143631692958';
```

Após executar, chame a edge function `reconcile-pending-payments` para reprocessar.

---

## 2. Correção da Hierarquia de Roteamento

A hierarquia atual está **parcialmente correta**, mas precisa de ajustes para garantir que os overrides funcionem na ordem certa.

### Hierarquia Solicitada (Nova)

```text
┌─────────────────────────────────────────────────────────────────┐
│ 1. PLANO ATIVO? → ClickLife (sempre, ignora tudo)               │
├─────────────────────────────────────────────────────────────────┤
│ 2. OVERRIDE ATIVO? → Seguir override                            │
│    • force_clicklife = true → ClickLife                         │
│    • force_clicklife_pronto_atendimento = true (ITC6534) → CL   │
│    • force_communicare_clinico = true (ITC6534) → Communicare   │
├─────────────────────────────────────────────────────────────────┤
│ 3. HORÁRIO (7h-19h BRT, dias úteis)                             │
│    • Horário comercial → continua                               │
│    • Fora do comercial/fim de semana → ClickLife                │
├─────────────────────────────────────────────────────────────────┤
│ 4. ESPECIALIDADE aceita pela Communicare?                       │
│    • Sim → Communicare                                          │
│    • Não → ClickLife                                            │
├─────────────────────────────────────────────────────────────────┤
│ 5. EXCEÇÕES (WhatsApp, Laudos, etc.)                            │
│    • Laudos Psicológicos → WhatsApp                             │
│    • Especialistas → WhatsApp Suporte                           │
│    • Psicólogos sem plano → Agenda Online                       │
└─────────────────────────────────────────────────────────────────┘
```

### Problema Atual no Código

O código atual tem a seguinte ordem (incorreta):
1. Override ClickLife PA (linha 570) ← **ANTES de verificar plano**
2. Exceções de SKUs (laudos, whatsapp, psicólogos)
3. Override Emergência (linha 939)
4. Plano ativo employee (linha 952)
5. Plano ativo DB (linha 967)
6. Plano ativo payload (linha 979)
7. Override Communicare (linha 999)
8. Horário/Dia
9. Especialidades

### Correção Necessária

Reorganizar as verificações para seguir a hierarquia correta:

```typescript
// ============ NOVA HIERARQUIA (linhas 540+) ============

// ====== EXCEÇÕES IMUTÁVEIS (SEMPRE processadas primeiro) ======

// LAUDOS PSICOLÓGICOS → SEMPRE WhatsApp (independente de tudo)
if (payload.sku === 'OVM9892') { ... }

// SKUs que vão para WhatsApp (apenas SEM plano)
if (WHATSAPP_REDIRECT_SKUS[payload.sku] && !payload.plano_ativo) { ... }

// Psicólogos SEM plano → Agenda Online
if (isPsicologoSemPlano) { ... }

// Especialistas ou Psicólogos COM plano → WhatsApp Suporte
if (isEspecialista || isPsicologoComPlano) { ... }

// ====== HIERARQUIA 1: PLANO ATIVO ======

// 1.1 Funcionário empresa com plano
if (employeeData?.has_active_plan) { → ClickLife }

// 1.2 Plano ativo no banco
if (patientPlan) { → ClickLife }

// 1.3 Plano ativo no payload
if (payload.plano_ativo) { → ClickLife }

// ====== A PARTIR DAQUI: SEM PLANO ATIVO ======

// ====== HIERARQUIA 2: OVERRIDES ADMIN ======

// 2.1 Override EMERGÊNCIA (força TUDO para ClickLife)
if (force_clicklife === true) { → ClickLife }

// 2.2 Override ClickLife para Pronto Atendimento
if (force_clicklife_pronto_atendimento === true && sku === 'ITC6534') { → ClickLife }

// 2.3 Override Communicare para Clínico Geral
if (force_communicare_clinico === true && sku === 'ITC6534') { → Communicare }

// ====== HIERARQUIA 3: HORÁRIO ======

// Fim de semana → ClickLife
if (isWeekend) { → ClickLife }

// Horário noturno (19h-7h BRT) → ClickLife
if (isNighttime) { → ClickLife }

// ====== HIERARQUIA 4: ESPECIALIDADES ======

// Especialidade não aceita pela Communicare → ClickLife
if (!communicareNormalized.includes(especialidadeNormalized)) { → ClickLife }

// ====== FALLBACK: Communicare ======
return → Communicare
```

---

## 3. Alterações no Arquivo

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/schedule-redirect/index.ts` | Reorganizar hierarquia de verificações conforme ordem correta |

### Mudanças Específicas

1. **Mover verificação de plano ativo para ANTES das exceções de SKU** (linhas 609-735 precisam vir DEPOIS da verificação de plano)

2. **Consolidar todos os overrides em um único bloco** (após verificação de plano)

3. **Adicionar logging de diagnóstico** para entender porque o override não funcionou:

```typescript
const { data: overrideSettings, error: overrideError } = await supabase
  .from('admin_settings')
  .select('value')
  .eq('key', 'force_clicklife_pronto_atendimento')
  .maybeSingle();

console.log('[schedule-redirect] 🔍 Override ClickLife PA:', {
  value: overrideSettings?.value,
  valueType: typeof overrideSettings?.value,
  error: overrideError?.message || null,
  sku: payload.sku,
  match: (overrideSettings?.value === true || overrideSettings?.value === 'true') && payload.sku === 'ITC6534'
});
```

---

## 4. Causa Raiz do Bug Atual

Analisando os logs e o código:

1. **O override `force_clicklife_pronto_atendimento = true`** está configurado corretamente no banco (desde 17:00:34 UTC)

2. **`force_communicare_clinico = false`** também está correto

3. **PORÉM** o log mostrou "Override Communicare ativo" que é da linha 1000

4. **Possíveis causas:**
   - A query do override ClickLife PA (linha 564-568) está retornando `null` 
   - O `ORIGINAL_SUPABASE_SERVICE_ROLE_KEY` pode não estar configurado
   - A verificação (linha 570) está passando mas não executando o `return`

5. **A mais provável:** O código nunca chegou à linha 570 porque há um `return` anterior (nas exceções de SKU que começam na linha 609)

**O bug está na ordem:** A exceção para SKUs de WhatsApp/especialistas (linhas 609-735) está sendo processada **ANTES** da verificação de override, e alguma dessas condições está sendo atingida incorretamente.

---

## Seção Técnica: Diagrama de Fluxo Atual vs. Proposto

### Fluxo Atual (Problemático)

```text
Request → Override PA → Exceções SKU → Override Emergência → Plano Ativo → Override Comm → Horário → Especialidade
                ↓              ↓
         (não funciona)   (pode retornar antes de verificar overrides)
```

### Fluxo Proposto (Correto)

```text
Request → Exceções FIXAS (Laudos, WhatsApp) → PLANO ATIVO? → Overrides Admin → Horário → Especialidade
                                                    ↓
                                          (se sim, ClickLife direto)
```

A diferença crítica é que **plano ativo deve ser verificado ANTES dos overrides** para garantir que usuários pagos sempre vão para ClickLife.
