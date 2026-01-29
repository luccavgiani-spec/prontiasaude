
# Plano de Correção: Erro de RLS no Cadastro

## Problema Identificado

**Erro:** `new row violates row-level security policy for table "patients"`

**Causa Raiz:**

O arquivo `patients.ts` está usando o cliente ERRADO para operações de banco na Produção:

| Cliente | Arquivo | Sessão | Uso Correto |
|---------|---------|--------|-------------|
| `supabaseProduction` | supabase-production.ts | ❌ `persistSession: false` | Admin/leitura anônima |
| `supabaseProductionAuth` | auth-hybrid.ts | ✅ `persistSession: true` | Operações autenticadas |

Quando o código usa `supabaseProduction.from('patients').insert(...)`, o `auth.uid()` retorna `NULL` porque esse cliente não tem sessão. A política RLS `user_id = auth.uid()` falha!

## Arquivo que será modificado

`src/lib/patients.ts`

## Correção Cirúrgica

### ANTES (linha 2):
```typescript
import { supabaseProduction } from "@/lib/supabase-production";
```

### DEPOIS:
```typescript
import { supabaseProductionAuth } from "@/lib/auth-hybrid";
```

### ANTES (linha 59):
```typescript
const dbClient = environment === 'production' ? supabaseProduction : supabase;
```

### DEPOIS:
```typescript
const dbClient = environment === 'production' ? supabaseProductionAuth : supabase;
```

## Por que isso resolve

1. `supabaseProductionAuth` foi criado com `persistSession: true` e `storageKey: 'supabase-production-auth'`
2. Quando o usuário fez login via `hybridSignIn` → sessão foi salva no `supabaseProductionAuth`
3. Agora quando fazemos operações de banco, o `auth.uid()` retorna o ID correto
4. A política RLS `user_id = auth.uid()` passa!

## Validação

1. Monique (ou outro usuário) tenta completar o cadastro novamente
2. Os dados são salvos sem erro de RLS
3. O fluxo prossegue normalmente

---

## Resumo

- **ARQUIVO:** `src/lib/patients.ts`
- **MOTIVO:** Corrigir erro de RLS no cadastro
- **ESCOPO:** Trocar `supabaseProduction` por `supabaseProductionAuth` (que tem a sessão autenticada)
- **CONFIRMAÇÃO:** ✅ Solicitado explicitamente pelo usuário
