
# Plano: Correção de Ativação Manual de Planos e Reset de Senha

## Diagnóstico do Problema

### Problema 1: "Paciente não encontrado" na Ativação Manual

**Causa raiz identificada:**
O Painel Admin (`UserRegistrationsTab.tsx`) atualmente lista pacientes do **Lovable Cloud** (linha 126: `supabase.from('patients')`), mas a função `activate_plan_manual` busca pacientes no **banco de Produção** (linha 1234-1238).

Quando um usuário se cadastra via Cloud, ele pode existir no Lovable Cloud mas NÃO existir no banco de produção, gerando o erro "Paciente não encontrado".

**Emails afetados:**
- `barrosleticia774@gmail.com`
- `neres_deisesena@hotmail.com`

### Problema 2: "load failed" no Reset de Senha

**Causa raiz identificada:**
A função `send-password-reset` está funcionando corretamente no backend (usa Resend), mas o frontend (`EsqueciSenha.tsx`) pode estar falhando ao invocar a edge function, possivelmente por:
1. O `invokeEdgeFunction` está apontando para o projeto errado (Cloud vs Produção)
2. Erro de CORS ou headers incompletos
3. A URL do email aponta para `prontia.com.br` (linha 89) mas o domínio real é `prontiasaude.com.br`

---

## Solução Proposta

### Parte 1: Painel Admin via Produção (Ativação Manual)

Modificar o `UserRegistrationsTab.tsx` para listar pacientes diretamente do banco de **Produção**, não do Cloud.

**Arquivos a alterar:**
1. `src/components/admin/UserRegistrationsTab.tsx`

**Mudanças técnicas:**
- Substituir `supabase.from('patients')` por `supabaseProduction.from('patients')` nas queries de listagem e contagem
- Manter a importação existente de `supabaseProduction` (já presente na linha 11)
- Garantir que o email passado ao modal seja o da produção

```typescript
// ANTES (linha 126)
let query = supabase.from('patients')...

// DEPOIS
let query = supabaseProduction.from('patients')...
```

**Linhas afetadas no UserRegistrationsTab.tsx:**
- Linha 126: query principal de pacientes
- Linhas 142-175: queries de contagem (totalCount, withAccountCount, etc.)

### Parte 2: Consertar Email Customizado (Reset de Senha)

**Arquivos a alterar:**
1. `supabase/functions/send-password-reset/index.ts`
2. `src/pages/EsqueciSenha.tsx` (verificar invokeEdgeFunction)
3. `src/lib/edge-functions.ts` (se necessário)

**Mudanças técnicas:**

**a) Corrigir URL de reset no email:**
```typescript
// ANTES (linha 89)
const resetUrl = `https://prontia.com.br/nova-senha?token=${token}`;

// DEPOIS (domínio correto)
const resetUrl = `https://prontiasaude.com.br/nova-senha?token=${token}`;
```

**b) Usar URLs de produção na função:**
A função `send-password-reset` atualmente usa `SUPABASE_URL` que pode apontar para Cloud. Precisa usar URLs hardcoded de produção.

```typescript
// ANTES (linhas 32-33)
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// DEPOIS
const ORIGINAL_SUPABASE_URL = 'https://ploqujuhpwutpcibedbr.supabase.co';
const supabaseServiceKey = Deno.env.get('ORIGINAL_SUPABASE_SERVICE_ROLE_KEY') 
  || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
```

**c) Melhorar CORS headers:**
```typescript
// ANTES (linha 8)
"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",

// DEPOIS
"Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
```

### Parte 3: Validar/Corrigir Funções Relacionadas

**Arquivos a alterar:**
1. `supabase/functions/validate-reset-token/index.ts`
2. `supabase/functions/complete-password-reset/index.ts`

Aplicar as mesmas correções (URLs de produção + CORS headers completos) para garantir que todo o fluxo funcione.

---

## Resumo das Alterações

| Arquivo | Alteração |
|---------|-----------|
| `src/components/admin/UserRegistrationsTab.tsx` | Trocar queries de `supabase` para `supabaseProduction` |
| `supabase/functions/send-password-reset/index.ts` | Corrigir URL (prontia → prontiasaude), usar URLs de produção, melhorar CORS |
| `supabase/functions/validate-reset-token/index.ts` | Usar URLs de produção, melhorar CORS |
| `supabase/functions/complete-password-reset/index.ts` | Usar URLs de produção, melhorar CORS |

---

## Resultado Esperado

1. **Ativação Manual:** O Painel Admin listará pacientes do banco de produção, eliminando o erro "Paciente não encontrado" para emails que existem em produção.

2. **Reset de Senha:** O email será enviado corretamente com link para `prontiasaude.com.br/nova-senha`, e as funções de validação/conclusão funcionarão com o banco de produção.

---

## Próximos Passos Após Implementação

1. Testar ativação manual para `barrosleticia774@gmail.com`
2. Testar ativação manual para `neres_deisesena@hotmail.com`
3. Testar reset de senha para `maianasouza21@gmail.com`
4. Publicar alterações (Publish → Update)
