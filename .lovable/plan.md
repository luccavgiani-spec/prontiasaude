
# Plano de Correção Definitivo: Lista de Pacientes + Cadastro

## Diagnóstico Confirmado

### Problema 1: Apenas 220 usuários na lista

A Edge Function `list-all-users` no Supabase de Produção está com a lógica de fallback incorreta. Quando as variáveis `CLOUD_SUPABASE_URL` e `CLOUD_SUPABASE_SERVICE_ROLE_KEY` não são encontradas, ela usa `SUPABASE_URL` como fallback, que aponta para a própria Produção. Resultado: busca a Produção duas vezes e ignora o Cloud.

Evidência dos logs de `check-user-exists` (que funciona corretamente):
- Cloud: 450 usuários
- Produção: 220 usuários
- Total esperado: ~569 únicos

### Problema 2: Cadastro falha

O sistema híbrido de cadastro (`hybridSignUp`) cria usuários apenas na Produção. Você quer que crie nos dois ambientes para garantir consistência.

---

## Solução Completa

### Parte 1: Corrigir `list-all-users` (Edge Function)

Modificar a lógica para:
1. Usar `CLOUD_SUPABASE_URL` obrigatoriamente (não usar fallback para `SUPABASE_URL`)
2. Adicionar logs claros para debug
3. Retornar erro se as credenciais do Cloud não existirem

Mudanças principais:
```text
// ANTES (problemático):
const CLOUD_URL = Deno.env.get("CLOUD_SUPABASE_URL") || Deno.env.get("SUPABASE_URL")!;

// DEPOIS (corrigido):
const CLOUD_URL = Deno.env.get("CLOUD_SUPABASE_URL");
const cloudServiceKey = Deno.env.get("CLOUD_SUPABASE_SERVICE_ROLE_KEY");

if (!CLOUD_URL || !cloudServiceKey) {
  console.error("[list-all-users] CLOUD credentials missing!");
  // Continuar apenas com Produção, mas logar claramente
}
```

### Parte 2: Ajustar `UserRegistrationsTab.tsx`

1. Adicionar logs para debug do retorno da Edge Function
2. Mostrar claramente as estatísticas (cloudOnly, productionOnly, both)
3. Garantir que o filtro de busca funcione corretamente

### Parte 3: Criar usuário nos 2 ambientes (Cadastro)

Modificar `auth-hybrid.ts` e `Cadastrar.tsx` para:
1. Criar usuário primeiro na Produção (principal)
2. Em seguida, criar no Cloud (via Edge Function segura)
3. Sincronizar dados de `patients` em ambos

Nova função `create-user-both-envs` para criar em ambos com segurança.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/list-all-users/index.ts` | Remover fallback problemático, adicionar validação e logs |
| `src/components/admin/UserRegistrationsTab.tsx` | Adicionar debug logs, melhorar exibição de stats |
| `src/lib/auth-hybrid.ts` | Modificar `hybridSignUp` para criar em ambos |
| `src/pages/Cadastrar.tsx` | Usar nova lógica de cadastro dual |
| `supabase/functions/create-user-both-envs/index.ts` | Nova função para criar usuário nos 2 ambientes |

---

## Passo a Passo da Implementação

### Etapa 1: Corrigir `list-all-users`

Atualizar a função para:
- Validar que `CLOUD_SUPABASE_URL` e `CLOUD_SUPABASE_SERVICE_ROLE_KEY` existem
- Se não existirem, retornar apenas dados da Produção com aviso
- Adicionar logs detalhados para cada etapa

### Etapa 2: Criar Edge Function `create-user-both-envs`

Nova função que:
- Recebe email, password, metadata
- Cria usuário na Produção via `auth.admin.createUser`
- Cria usuário no Cloud via cliente Cloud
- Sincroniza tabela `patients` em ambos
- Retorna sucesso apenas se ambos forem criados

### Etapa 3: Atualizar Frontend

- `hybridSignUp` chama a nova Edge Function em vez de criar diretamente
- `UserRegistrationsTab` exibe logs de debug e estatísticas corretas

---

## Validação Pós-Implementação

1. Acessar `/admin/dashboard` > aba Pacientes
2. Verificar se mostra ~569 usuários (não 220)
3. Tentar cadastrar novo usuário
4. Verificar se aparece nos dois ambientes

---

## Seção Técnica

### Configuração de Secrets Necessária (Produção)

Confirme que estas secrets existem no Supabase de Produção:

| Secret | Valor |
|--------|-------|
| `CLOUD_SUPABASE_URL` | `https://yrsjluhhnhxogdgnbnya.supabase.co` |
| `CLOUD_SUPABASE_SERVICE_ROLE_KEY` | (service role key do projeto Cloud) |
| `ORIGINAL_SUPABASE_SERVICE_ROLE_KEY` | (service role key da Produção - já existe) |

### Arquitetura Final

```text
[Frontend]
    |
    v
[list-all-users] --> Cloud (450 users)
         |           Production (220 users)
         |
         v
     Merge by email --> 569 unique users
```

### Fluxo de Cadastro

```text
[Cadastrar.tsx]
    |
    v
[hybridSignUp] --> [create-user-both-envs Edge Function]
                        |
                        +-> Production auth.admin.createUser
                        +-> Cloud auth.admin.createUser
                        +-> Sync patients table (both)
                        |
                        v
                    Return success
```
