

# Diagnóstico: Usuários não conseguem gerar cupons

## Causa raiz

O `MeusCuponsCard.tsx` tenta fazer INSERT diretamente na tabela `user_coupons` via cliente Supabase, mas falha em **ambos os cenários** do sistema híbrido:

### Cenário 1: Usuário logado via Cloud (maioria dos usuários)
- `environment === 'cloud'` → usa o cliente `supabase` (Cloud)
- INSERT funciona no banco do **Cloud** (RLS ok, `auth.uid()` presente)
- **Porém**: a `validate-coupon` Edge Function roda na **Produção** e consulta `user_coupons` da Produção → cupom **não é encontrado** na validação

### Cenário 2: Usuário logado via Produção
- `environment === 'production'` → usa `supabaseProduction`
- Este cliente tem `persistSession: false` e `autoRefreshToken: false` — é um cliente **anônimo**
- `auth.uid()` retorna NULL → RLS INSERT policy (`owner_user_id = auth.uid()`) **bloqueia** o insert
- Resultado: erro de RLS violation

### Resumo
| Ambiente login | Cliente usado | INSERT funciona? | Cupom visível na validação? |
|---|---|---|---|
| Cloud | `supabase` (Cloud) | Sim | **Não** (validate-coupon lê Produção) |
| Produção | `supabaseProduction` | **Não** (sem sessão) | N/A |

---

## Plano de correção

### Arquivo: `src/components/patient/MeusCuponsCard.tsx`

Substituir o INSERT direto por uma chamada à Edge Function `admin-coupon-operations` (que já existe na Produção e usa `service_role` para bypass de RLS), passando os dados do cupom. Isso garante que:

1. O cupom é **sempre criado na Produção** (onde `validate-coupon` consulta)
2. Não depende de sessão do cliente para RLS (a Edge Function usa `service_role`)
3. A leitura de cupons existentes (`loadCoupons`) também deve usar a Edge Function ou `invokeEdgeFunction` para consultar Produção

### Mudanças específicas:

1. **`createCoupon` function (linhas 101-177)**: Trocar o `client.from('user_coupons').insert(...)` por `invokeEdgeFunction('admin-coupon-operations', { body: { operation: 'create', ... } })`

2. **`loadCoupons` function (linhas 34-73)**: Trocar o `client.from('user_coupons').select(...)` por `invokeEdgeFunction` que consulta a Produção, garantindo que cupons criados lá sejam visíveis

3. Importar `invokeEdgeFunction` de `@/lib/edge-functions` e remover imports não mais necessários (`supabaseProduction`)

### O que NÃO será alterado:
- Edge Functions (`admin-coupon-operations`, `validate-coupon`)
- Tabela `user_coupons` e suas RLS policies
- Nenhum outro componente ou página

