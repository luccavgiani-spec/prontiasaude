

# Plano: Criar `admin-coupon-operations` Edge Function no Cloud

## Operações necessárias (usadas pelo frontend)

A partir da análise do código, a Edge Function precisa suportar **7 operações**:

1. **`create`** — Criar cupom na `user_coupons` (usado por `CreateCouponModal` e `MeusCuponsCard`)
2. **`toggle`** — Ativar/desativar cupom (usado por `CouponsTab`)
3. **`delete`** — Deletar cupom (usado por `CouponsTab`)
4. **`mark_reviewed`** — Marcar uso de cupom como conferido na `coupon_uses` (usado por `CouponsTab`)
5. **`list_by_owner`** — Listar cupons de um owner específico (usado por `MeusCuponsCard`)
6. **`get_patient_name`** — Buscar `first_name` de um paciente por `user_id` (usado por `MeusCuponsCard`)

## Arquivo a criar

**`supabase/functions/admin-coupon-operations/index.ts`**

- Auto-contido (sem imports relativos, CORS inline)
- Usa `ORIGINAL_SUPABASE_SERVICE_ROLE_KEY` para operar no banco de **Produção**
- `verify_jwt = false` no `config.toml` (já que pacientes não-autenticados na Produção precisam acessar)

## Detalhes técnicos

- A função conecta ao Supabase de **Produção** (`ploqujuhpwutpcibedbr`) usando `ORIGINAL_SUPABASE_SERVICE_ROLE_KEY`
- Todas as operações usam `service_role` para bypass de RLS
- O `create` aceita `owner_user_id` direto (para pacientes) ou busca por `owner_email` (para admin)
- Retorna `{ success: true, coupon: {...} }` no create, `{ success: true }` nos demais

## config.toml

Adicionar entrada `[functions.admin-coupon-operations]` com `verify_jwt = false`.

