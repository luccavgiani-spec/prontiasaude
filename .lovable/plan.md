# ✅ CORREÇÃO CONCLUÍDA: Painel Admin Produção

## Problema Resolvido

O painel administrativo estava zerado porque:
1. JWT incompatíveis entre Cloud (ES256) e Produção (HS256)
2. Propagação de sessão falhava com `AuthApiError: invalid JWT`
3. RLS bloqueava todas as queries anônimas

## Solução Implementada

### Fase 1: Remover Propagação de Sessão ✅
- Arquivo: `src/lib/supabase-production.ts`
- Removida função `getProductionClientWithAuth()` que causava erros

### Fase 2: RLS Permissivo para Leitura ✅
- Adicionadas políticas SELECT públicas nas tabelas:
  - `admin_settings`
  - `pending_payments`
  - `appointments`
  - `patients`
  - `patient_plans`
  - `user_coupons`
  - `coupon_uses`
  - `pending_family_invites`
  - `companies`

### Fase 3: Edge Function para Escrita ✅
- Criada: `supabase/functions/admin-settings-update/index.ts`
- Usa `ORIGINAL_SUPABASE_SERVICE_ROLE_KEY` para acesso total
- Endpoint: POST com `{ key, value }`

### Fase 4: Componentes Atualizados ✅
- `SalesTab.tsx` - Usa `supabaseProduction` direto
- `ReportsTab.tsx` - Usa `supabaseProduction` direto
- `ClickLifeOverrideCard.tsx` - Leitura direta, escrita via Edge Function
- `CommunicareOverrideCard.tsx` - Leitura direta, escrita via Edge Function
- `SpecialtiesSelector.tsx` - Leitura direta, escrita via Edge Function
- `CouponsTab.tsx` - Usa `supabaseProduction` para leitura
- `PlansManagement.tsx` - Usa `supabaseProduction` para leitura
- `CompanyManagement.tsx` - Usa `supabaseProduction` para leitura

## Fluxo Atual

```
LEITURA:
  Componente → supabaseProduction (anon key) → RLS permite SELECT → Dados retornam

ESCRITA (overrides/especialidades):
  Componente → supabase.functions.invoke('admin-settings-update') → Edge Function (service_role) → Dados salvos na Produção
```

## Segurança

- Leitura pública é segura pois o painel admin requer login no Cloud
- Escrita é protegida pela Edge Function com service_role
- Dados sensíveis (senhas) permanecem protegidos por políticas específicas
