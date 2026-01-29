

# Plano: Ajustar patient-operations para colunas reais do banco de produção

## Problema identificado
A função `patient-operations` está tentando inserir/atualizar as colunas:
- `activated_at` ❌ (não existe)
- `activated_by` ❌ (não existe)
- `patient_id` ❌ (provavelmente não existe no seu schema)
- `user_id` ❌ (provavelmente não existe no seu schema)

Mas o schema real da tabela `patient_plans` no banco de produção tem apenas:
- `id`
- `plan_code`
- `plan_expires_at`
- `status`
- `created_at`
- `updated_at`
- `email` (você confirmou que upsert usa onConflict: 'email')

## Objetivo
Modificar a edge function para usar APENAS as colunas que realmente existem no banco de produção.

---

## Arquivo que será modificado
- `supabase/functions/patient-operations/index.ts`

---

## Escopo das alterações

### 1. Payload do upsert (linhas ~1222-1232)
**Antes:**
```typescript
const planPayloadFull = {
  patient_id: patient.id,        // ❌ não existe
  user_id: patient.user_id,      // ❌ não existe
  email: patient_email,
  plan_code: plan_code,
  status: 'active',
  plan_expires_at: expiresAtDate,
  activated_at: new Date().toISOString(),  // ❌ não existe
  activated_by: adminEmail,       // ❌ não existe
  updated_at: new Date().toISOString()
};
```

**Depois:**
```typescript
const planPayload = {
  email: patient_email.toLowerCase().trim(),
  plan_code: plan_code,
  status: 'active',
  plan_expires_at: expiresAtDate,
  updated_at: new Date().toISOString()
  // Removidos: patient_id, user_id, activated_at, activated_by
};
```

### 2. Remover lógica de fallback (linhas ~1239-1270)
Como não haverá mais colunas "problemáticas", o fallback não é mais necessário. O código ficará mais simples:
- Tentar upsert uma única vez
- Se falhar, retornar erro com detalhes

### 3. Ajustar resposta de sucesso (linhas ~1347-1359)
- Remover `activated_by` da resposta (não foi gravado)
- Manter `expires_at` e `patient_id` (do lookup anterior)
- Remover `warning`/`hint` de fallback (não existe mais)

### 4. Ajustar métrica de auditoria (linhas ~1289-1299)
- Manter `activated_by_admin: adminEmail` nos metadados da métrica (para rastreabilidade)
- Isso fica no campo `metadata` (jsonb), não depende de coluna específica

---

## Visão do código corrigido

```typescript
// ✅ PASSO 5: Upsert plano no banco de PRODUÇÃO
console.log('[activate_plan_manual] Upserting plano...');

const planPayload = {
  email: patient_email.toLowerCase().trim(),
  plan_code: plan_code,
  status: 'active',
  plan_expires_at: expiresAtDate,
  updated_at: new Date().toISOString()
};

const { error: upsertError } = await supabase
  .from('patient_plans')
  .upsert(planPayload, { onConflict: 'email' });

if (upsertError) {
  console.error('[activate_plan_manual] Erro no upsert:', upsertError.message);
  return new Response(
    JSON.stringify({ 
      success: false, 
      step: 'plan_upsert', 
      error: 'Failed to upsert plan',
      details: upsertError.message 
    }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

---

## O que NÃO será alterado
- Validação de admin (PASSO 1-3) — mantida intacta
- Busca de paciente (PASSO 4) — mantida (mesmo que `patient_id` não seja gravado, é usado para ClickLife)
- Cadastro na ClickLife (PASSO 7) — mantido
- Envio de email opcional — mantido
- Todas as outras operações da função — intocadas

---

## Próximos passos após aprovação
1. Aplicar alteração no arquivo aqui no Lovable
2. Você copia o código atualizado para o Supabase de produção (como já está fazendo)
3. Testar a ativação manual — deve funcionar sem erro

---

## Benefício adicional
Se no futuro você quiser adicionar as colunas `activated_at`, `activated_by`, `patient_id`, `user_id` no banco de produção (via ALTER TABLE), podemos reintroduzir esses campos no payload depois, sem retrabalho significativo.

