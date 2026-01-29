
# Plano de Correção Definitivo: Lista de Pacientes + Cadastro

## ✅ STATUS: IMPLEMENTADO

## Diagnóstico Confirmado

### Problema 1: Apenas 220 usuários na lista
A Edge Function `list-all-users` estava usando a lógica errada de fallback para keys, e estava sendo executada no ambiente errado.

### Problema 2: Cadastro falha
O sistema híbrido de cadastro (`hybridSignUp`) criava usuários apenas na Produção. Agora cria em ambos.

---

## ✅ Solução Implementada

### Parte 1: Corrigir `list-all-users` (Edge Function)
- Removido fallback problemático
- Configurado para usar `SUPABASE_SERVICE_ROLE_KEY` (Cloud automático) e `ORIGINAL_SUPABASE_SERVICE_ROLE_KEY` (Produção manual)
- Adicionados logs detalhados para debug
- Função executa no Lovable Cloud e acessa ambos os ambientes

### Parte 2: Criar `create-user-both-envs` (Nova Edge Function)
- Cria usuário em ambos os ambientes (Produção + Cloud)
- Sincroniza tabela `patients` em ambos
- Auto-confirma email em ambos

### Parte 3: Atualizar Frontend
- Criado `invokeCloudEdgeFunction` em `edge-functions.ts` para chamar funções no Lovable Cloud
- `UserRegistrationsTab` usa `invokeCloudEdgeFunction` para `list-all-users`
- `hybridSignUp` usa `invokeCloudEdgeFunction` para `create-user-both-envs`

---

## Arquivos Modificados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/list-all-users/index.ts` | Corrigido uso de keys e URLs |
| `supabase/functions/create-user-both-envs/index.ts` | **NOVO** - Cria usuário em ambos |
| `supabase/config.toml` | Adicionada config para `create-user-both-envs` |
| `src/lib/edge-functions.ts` | Adicionado `invokeCloudEdgeFunction` |
| `src/components/admin/UserRegistrationsTab.tsx` | Usa `invokeCloudEdgeFunction` |
| `src/lib/auth-hybrid.ts` | Usa `invokeCloudEdgeFunction` para cadastro |
| `src/pages/Cadastrar.tsx` | Simplificado para usar `hybridSignUp` |

---

## ✅ Resultado dos Testes

```json
{
  "stats": {
    "totalUnique": 570,
    "cloudOnly": 349,
    "productionOnly": 120,
    "both": 101,
    "cloudAuthTotal": 450,
    "prodAuthTotal": 221,
    "cloudKeyConfigured": true,
    "prodKeyConfigured": true
  },
  "success": true
}
```

---

## Arquitetura Final

```text
[Frontend]
    |
    v
[invokeCloudEdgeFunction] --> Lovable Cloud (yrsjluhhnhxogdgnbnya)
         |
         v
    [list-all-users]
         |
         +-> Cloud auth.users (450)
         +-> Produção auth.users (221)
         |
         v
     Merge by email --> 570 unique users
```

### Fluxo de Cadastro

```text
[Cadastrar.tsx]
    |
    v
[hybridSignUp] --> [invokeCloudEdgeFunction]
                        |
                        v
              [create-user-both-envs]
                        |
                        +-> Produção auth.admin.createUser
                        +-> Cloud auth.admin.createUser
                        +-> Sync patients (both)
                        |
                        v
                    Return success
```
