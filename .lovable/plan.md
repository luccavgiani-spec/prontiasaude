

# Diagnóstico e Correção: Convite de Familiar "Não Autorizado"

## Causa raiz do erro

O erro "Não Autorizado" ocorre porque a função `invokeEdgeFunction` no arquivo `src/lib/edge-functions.ts` **nunca envia o JWT do usuário logado**. Na linha 54, ela sempre usa:

```
Authorization: Bearer ${SUPABASE_ANON_KEY}
```

Quando a operação `invite-familiar` na edge function `patient-operations` tenta validar o token (linha 1683-1693):

```typescript
const token = authHeader!.replace("Bearer ", "");
const { data: { user }, error: authError } = await supabase.auth.getUser(token);
```

Ela recebe a **anon key** em vez do JWT do usuário → `getUser` falha → retorna "Não autorizado".

## Bug secundário

Na `FamiliaresSection.tsx` linha 191, o `handleCancelInvite` usa `.eq('titular_id', currentUserId)` mas a coluna correta na tabela é `titular_patient_id`.

## Plano de correção

### 1. Corrigir `FamiliaresSection.tsx` — passar o token do usuário

Modificar `handleSendInvite`, `handleResendInvite` e `handleCancelInvite` para obter a sessão do usuário e passar o access_token no header Authorization da chamada `invokeEdgeFunction`.

Também corrigir `titular_id` → `titular_patient_id` no `handleCancelInvite`.

### 2. SQL para ativar planos manualmente

Para cadastrar o plano familiar com especialistas para ambos os usuários na **produção**, execute no Dashboard do Supabase (`ploqujuhpwutpcibedbr`):

```sql
-- 1. Verificar se monikeagatha174@gmail.com já tem plano ativo
SELECT * FROM patient_plans WHERE email = 'monikeagatha174@gmail.com';

-- 2. Se não tiver, ativar plano Familiar com Especialistas - Mensal para o TITULAR
INSERT INTO patient_plans (email, plan_code, status, plan_expires_at, activated_by, created_at, updated_at)
VALUES (
  'monikeagatha174@gmail.com',
  'FAM_COM_ESP_1M',
  'active',
  (NOW() + INTERVAL '30 days')::date,
  'admin_manual',
  NOW(),
  NOW()
);

-- 3. Ativar plano para o DEPENDENTE
INSERT INTO patient_plans (email, plan_code, status, plan_expires_at, activated_by, created_at, updated_at)
VALUES (
  'uaylan.davi.black.18@gmail.com',
  'FAM_COM_ESP_1M',
  'active',
  (NOW() + INTERVAL '30 days')::date,
  'admin_manual',
  NOW(),
  NOW()
);
```

**Nota:** Se o titular já tem plano (o screenshot mostra "Familiar com Especialistas - Mensal"), execute apenas o INSERT do dependente. Ajuste o `plan_expires_at` para coincidir com a data de expiração do plano do titular.

### Arquivos que serão modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/patient/FamiliaresSection.tsx` | Passar access_token no Authorization header; corrigir `titular_id` → `titular_patient_id` |

### Arquivos NÃO alterados
- `src/lib/edge-functions.ts` — design intencional de não enviar token por padrão
- `supabase/functions/patient-operations/index.ts` — lógica de validação está correta
- Nenhum outro arquivo

