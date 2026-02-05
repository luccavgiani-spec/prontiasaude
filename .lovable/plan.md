
# Plano: Correção dos Erros de Edição de Perfil (Usuário e Admin)

## Diagnóstico Confirmado

### Problema 1: Usuário não consegue editar próprio perfil
**Erro:** `insert or update on table "patients" violates foreign key constraint "patients_user_id_fkey"`  
**URL da requisição:** `https://yrsjluhhnhxogdgnbnya.supabase.co/functions/v1/patient-operations` (Cloud)

**Causa raiz identificada:**
O usuário está logado no ambiente de **Produção**, mas a chamada `ensurePatientRow` está enviando a requisição para o **Lovable Cloud** (via `invokeCloudEdgeFunction`). O problema está em `src/lib/patients.ts` linha 38:

```typescript
const invokeFunction = environment === 'production' ? invokeEdgeFunction : invokeCloudEdgeFunction;
```

Mesmo detectando `environment === 'production'`, o `user_id` do usuário (que existe em Produção) é enviado para a Edge Function no **Cloud**, que tenta fazer INSERT na tabela `patients` do Cloud. Como esse `user_id` não existe na tabela `auth.users` do Cloud, a foreign key constraint é violada.

**Observação da imagem:** A requisição claramente vai para `yrsjluhhnhxogdgnbnya.supabase.co` (Cloud), confirmando que o roteamento está incorreto.

### Problema 2: Admin não consegue editar paciente
**Erro:** `{"error":"Token inválido"}`

**Causa raiz identificada:**
O `EditPatientModal.tsx` usa `invokeEdgeFunction` (linha 133), que:
1. Obtém o token do cliente **Cloud** (`supabase.auth.getSession()` em `edge-functions.ts` linha 42-43)
2. Envia a requisição para a URL de **Produção** (`EDGE_FUNCTIONS_URL = https://ploqujuhpwutpcibedbr.supabase.co`)

Na Edge Function `patient-operations` de **Produção**, a operação `admin_update_patient`:
1. Cria um cliente do **Lovable Cloud** para validar o token (linha 2060)
2. Tenta validar o token usando `authClient.auth.getUser(token)` (linha 2066)

**O problema**: O token JWT do Cloud enviado pelo frontend não corresponde ao cliente Cloud criado na função, pois o `invokeEdgeFunction` usa a sessão do **Cloud local** (`@/integrations/supabase/client`), mas a Edge Function está rodando em **Produção**.

---

## Correções Necessárias

### Correção 1: Rotear `ensure_patient` corretamente para Produção

**Arquivo:** `src/lib/patients.ts`

O problema é que mesmo quando `environment === 'production'`, a função está indo para o Cloud. Precisamos garantir que:
1. Usuários de Produção chamem a Edge Function de Produção
2. O token correto seja enviado

**Alteração:** Simplificar a lógica para SEMPRE chamar `invokeEdgeFunction` (produção) quando for `ensure_patient`, pois essa operação usa `service_role` e não precisa de validação de JWT do usuário.

```typescript
// ANTES (linha 38-40):
const invokeFunction = environment === 'production' ? invokeEdgeFunction : invokeCloudEdgeFunction;

// DEPOIS:
// ✅ CORREÇÃO: ensure_patient SEMPRE vai para Produção pois usa service_role (bypass RLS)
// A operação está na AUTH_BYPASS_OPERATIONS e não precisa de token válido
const { data, error } = await invokeEdgeFunction('patient-operations', {
  body: {
    operation: 'ensure_patient',
    user_id: userId,
    email: userEmail
  }
  // ✅ Sem headers de Authorization - a função usa service_role internamente
});
```

### Correção 2: Enviar token correto no Admin Edit

**Arquivo:** `src/components/admin/EditPatientModal.tsx`

O admin faz login no **Cloud** (página `/admin`). Quando ele edita um paciente, precisamos:
1. Obter o token do cliente Cloud
2. Enviá-lo explicitamente no header Authorization

**Alteração:** Passar explicitamente o token do Cloud no header:

```typescript
// ANTES (linha 133-140):
const { data, error } = await invokeEdgeFunction('patient-operations', {
  body: {
    operation: 'admin_update_patient',
    patient_id: patient.id,
    email: patient.email,
    updates
  }
});

// DEPOIS:
// ✅ CORREÇÃO: Obter token do Cloud e enviá-lo explicitamente
const { data: sessionData } = await supabase.auth.getSession();
const cloudToken = sessionData?.session?.access_token;

if (!cloudToken) {
  throw new Error('Sessão expirada. Faça login novamente.');
}

const { data, error } = await invokeEdgeFunction('patient-operations', {
  body: {
    operation: 'admin_update_patient',
    patient_id: patient.id,
    email: patient.email,
    updates
  },
  headers: {
    'Authorization': `Bearer ${cloudToken}`
  }
});
```

### Correção 3: Ajustar a Edge Function para aceitar o token do ambiente correto

**Arquivo:** `supabase/functions/patient-operations/index.ts`

O problema é que a Edge Function está deployada em **Produção** e tenta validar o token no **Cloud**, mas o token enviado pode não ser reconhecido. Precisamos usar a secret `CLOUD_SUPABASE_URL` e `CLOUD_SUPABASE_SERVICE_ROLE_KEY` para criar o cliente de validação.

**Alteração:** Usar as secrets configuradas ao invés de hardcode:

```typescript
// ANTES (linha 2056-2058):
const LOVABLE_CLOUD_URL = 'https://yrsjluhhnhxogdgnbnya.supabase.co';
const LOVABLE_CLOUD_ANON_KEY = 'eyJ...';

// DEPOIS:
// ✅ CORREÇÃO: Usar secrets configuradas para consistência
const LOVABLE_CLOUD_URL = Deno.env.get('CLOUD_SUPABASE_URL') || 'https://yrsjluhhnhxogdgnbnya.supabase.co';
const LOVABLE_CLOUD_SERVICE_KEY = Deno.env.get('CLOUD_SUPABASE_SERVICE_ROLE_KEY');

// Criar cliente com service_role para poder acessar user_roles
const authClient = createClient(LOVABLE_CLOUD_URL, LOVABLE_CLOUD_SERVICE_KEY || LOVABLE_CLOUD_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${token}` } }
});
```

---

## Resumo das Alterações

| Arquivo | Alteração | Impacto |
|---------|-----------|---------|
| `src/lib/patients.ts` | Forçar `invokeEdgeFunction` para `ensure_patient` | Corrige FK violation |
| `src/components/admin/EditPatientModal.tsx` | Enviar token Cloud explicitamente | Corrige "Token inválido" |
| `supabase/functions/patient-operations/index.ts` | Usar secrets para validação admin | Garante consistência |

---

## Arquivos que NÃO serão alterados

- Integrações de pagamento (Mercado Pago)
- Redirecionamentos Clicklife/Communicare
- Conteúdo/serviços/FAQ/home sections
- Fluxo de cadastro (já funcionando)

---

## Validação Pós-Implementação

1. **Usuário editando próprio perfil:**
   - Login em Produção
   - Acessar `/completar-perfil` ou área do paciente
   - Editar dados e salvar
   - Verificar Network: requisição deve ir para `ploqujuhpwutpcibedbr.supabase.co`
   - Confirmar dados persistidos

2. **Admin editando paciente:**
   - Login como `suporte@prontiasaude.com.br`
   - Abrir modal de edição de paciente
   - Salvar alterações
   - Confirmar toast de sucesso
   - Verificar dados atualizados no banco

3. **Atualizar dados da Natália:**
   - Após correções, editar via painel admin:
   - Nome: `Natália Fernanda Geraldo`
   - Sobrenome: `dos Santos`
