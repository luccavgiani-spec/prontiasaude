

# Plano de Correção: Sistema de Cupons - Análise Completa e Correções

## Resumo Executivo

Após análise detalhada do fluxo de cupons, identifiquei **6 incongruências críticas** que estão afetando o funcionamento do sistema. O problema mais grave é que **102 pagamentos aprovados com cupom não tiveram o registro em `coupon_uses`**, permitindo que usuários usem o mesmo cupom múltiplas vezes.

---

## Problemas Identificados

### Problema 1: `coupon_uses` não sendo registrado pelo mp-webhook
**Gravidade: CRÍTICA**

**Sintoma:** 
- 102 pagamentos aprovados com cupom (ex: BEMVINDO10) não têm registro correspondente em `coupon_uses`
- Usuários conseguem usar o mesmo cupom várias vezes (ex: `miriansantosesteves5@gmail.com` usou BEMVINDO10 em 4 tentativas)

**Causa Raiz:**
O código no `mp-webhook` (linhas 2026-2034) depende de `payment.metadata.coupon_id` que só é enviado quando o cupom é aplicado via frontend. Para cupons do sistema (owner_user_id = NULL), o `coupon_id` pode não estar sendo passado corretamente, ou o webhook não está encontrando os metadados.

---

### Problema 2: Verificação de uso duplicado só por `user_id`
**Gravidade: ALTA**

**Sintoma:**
A função `validate-coupon` verifica uso anterior apenas pelo `used_by_user_id` (linha 155), mas:
1. Usuários não logados não têm `user_id`
2. O campo é `null` para muitos registros de `coupon_uses`

**Código atual (problemático):**
```typescript
.eq('used_by_user_id', user_id)  // Falha se user_id é null
```

**Correção necessária:**
Verificar também por `used_by_email` como fallback.

---

### Problema 3: Inconsistência de ambiente no PaymentModal
**Gravidade: MÉDIA**

**Sintoma:**
A função `handleApplyCoupon` usa `supabase.auth.getUser()` (Cloud), mas chama a edge function `validate-coupon` na Produção. Se o usuário está logado na Produção, o `user_id` enviado será `null` ou de outro ambiente.

**Código atual (linha 2316):**
```typescript
user_id: (await supabase.auth.getUser()).data.user?.id, // CLOUD user_id
```

**Correção necessária:**
Usar `getHybridSession()` para obter o `user_id` correto.

---

### Problema 4: Leitura/escrita em ambientes diferentes no CouponsTab
**Gravidade: MÉDIA**

**Sintoma:**
- `loadCouponUses()` e `loadActiveCoupons()` usam `supabaseProduction` (correto para leitura)
- `handleToggleCoupon()` e `handleDeleteCoupon()` usam `supabase` (Cloud) para escrita

**Código atual (linhas 286, 305):**
```typescript
// ESCRITA no Cloud - NÃO FUNCIONA para dados reais!
const { error } = await supabase
  .from('user_coupons')
  .update({ is_active: !currentStatus })
  .eq('id', id);
```

**Correção necessária:**
Usar `supabaseProduction` ou chamar edge function para escritas.

---

### Problema 5: CreateCouponModal escrevendo no Cloud
**Gravidade: MÉDIA**

**Sintoma:**
A criação de cupons manuais (admin) está usando `supabase` (Cloud), então os cupons criados não aparecem na Produção.

**Código atual (linhas 54, 71, 94, 110):**
Todas as operações usam `supabase` (Cloud).

**Correção necessária:**
Usar `supabaseProduction` ou edge function para criar cupons na Produção.

---

### Problema 6: MeusCuponsCard usando apenas Cloud
**Gravidade: MÉDIA**

**Sintoma:**
O componente de cupons do paciente usa `supabase.auth.getUser()` e queries diretas, que funcionam apenas para usuários do Cloud. Usuários da Produção não veem seus cupons.

---

## Detalhamento Técnico das Correções

### Correção 1: Garantir registro de `coupon_uses` no mp-webhook

**Arquivo:** `supabase/functions/mp-webhook/index.ts`

**Alteração:**
Além de verificar `payment.metadata.coupon_id`, também buscar no `pending_payments` caso o metadata esteja incompleto:

```typescript
// ANTES da seção existente de cupom (linha 2025)
// Buscar dados do cupom no pending_payment se não estiver no metadata
let couponData = {
  coupon_id: payment.metadata?.coupon_id,
  coupon_code: payment.metadata?.coupon_code,
  amount_original: payment.metadata?.amount_original,
  discount_percentage: payment.metadata?.discount_percentage
};

// Se não tiver no metadata, buscar no pending_payments
if (!couponData.coupon_id && payment.metadata?.order_id) {
  const { data: pending } = await supabaseAdmin
    .from('pending_payments')
    .select('coupon_code, coupon_owner_id, amount_original, discount_percent')
    .eq('order_id', payment.metadata.order_id)
    .maybeSingle();
  
  if (pending?.coupon_code) {
    // Buscar coupon_id pelo código
    const { data: coupon } = await supabaseAdmin
      .from('user_coupons')
      .select('id, owner_user_id, pix_key')
      .eq('code', pending.coupon_code)
      .single();
    
    if (coupon) {
      couponData = {
        coupon_id: coupon.id,
        coupon_code: pending.coupon_code,
        amount_original: pending.amount_original,
        discount_percentage: pending.discount_percent
      };
    }
  }
}
```

---

### Correção 2: Validação por email no validate-coupon

**Arquivo:** `supabase/functions/validate-coupon/index.ts`

**Alteração (após linha 172):**
Adicionar verificação por email como fallback:

```typescript
// Verificar se o usuário já usou este cupom (por user_id OU por email)
const userEmail = body.user_email; // Novo parâmetro a ser enviado

if (user_id) {
  const { data: existingUse } = await supabase
    .from('coupon_uses')
    .select('id')
    .eq('coupon_id', coupon.id)
    .eq('used_by_user_id', user_id)
    .limit(1);

  if (existingUse && existingUse.length > 0) {
    return new Response(
      JSON.stringify({
        is_valid: false,
        error_message: 'Você já usou este cupom anteriormente',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// NOVO: Verificar também por email (fallback para quando user_id é null)
if (userEmail) {
  const { data: existingUseByEmail } = await supabase
    .from('coupon_uses')
    .select('id')
    .eq('coupon_id', coupon.id)
    .eq('used_by_email', userEmail.toLowerCase())
    .limit(1);

  if (existingUseByEmail && existingUseByEmail.length > 0) {
    return new Response(
      JSON.stringify({
        is_valid: false,
        error_message: 'Este email já usou este cupom anteriormente',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
```

---

### Correção 3: Usar sessão híbrida no handleApplyCoupon

**Arquivo:** `src/components/payment/PaymentModal.tsx`

**Alteração (linha 2302-2318):**

```typescript
const handleApplyCoupon = async () => {
  setIsValidatingCoupon(true);
  setCouponError("");
  
  try {
    const itemType = sku.startsWith('IND_') || sku.startsWith('FAM_') ? 'PLAN' : 'SERVICE';
    
    // CORREÇÃO: Usar sessão híbrida para obter user_id correto
    const { session } = await getHybridSession();
    const userId = session?.user?.id;
    
    const { data, error } = await invokeEdgeFunction('validate-coupon', {
      body: {
        coupon_code: couponCode,
        item_type: itemType,
        amount_original: amount,
        user_id: userId, // Agora vem do ambiente correto
        user_email: formData.email, // NOVO: Enviar email como fallback
        sku: sku
      }
    });
    
    // ... resto do código
  }
};
```

---

### Correção 4: CouponsTab usar Produção para escritas

**Arquivo:** `src/components/admin/CouponsTab.tsx`

**Alterações:**
1. `handleToggleCoupon` - usar edge function ou supabaseProduction
2. `handleDeleteCoupon` - usar edge function ou supabaseProduction
3. `handleToggleReviewed` - usar edge function ou supabaseProduction

Como as operações de escrita requerem autenticação, a solução ideal é criar uma edge function `admin-coupon-operations`:

```typescript
// Nova edge function: supabase/functions/admin-coupon-operations/index.ts
// Operações: toggle, delete, mark_reviewed
```

---

### Correção 5: CreateCouponModal usar Produção

**Arquivo:** `src/components/admin/CreateCouponModal.tsx`

**Alteração:**
Usar `supabaseProduction` ou chamar edge function para todas as operações.

---

### Correção 6: MeusCuponsCard usar sessão híbrida

**Arquivo:** `src/components/patient/MeusCuponsCard.tsx`

**Alteração:**
Usar `getHybridSession()` e o cliente de banco correto baseado no ambiente.

---

## Resumo dos Arquivos a Modificar

| Arquivo | Alteração | Prioridade |
|---------|-----------|------------|
| `supabase/functions/mp-webhook/index.ts` | Garantir registro de coupon_uses mesmo sem metadata | CRÍTICA |
| `supabase/functions/validate-coupon/index.ts` | Adicionar verificação por email | ALTA |
| `src/components/payment/PaymentModal.tsx` | Usar sessão híbrida no handleApplyCoupon | ALTA |
| `src/components/admin/CouponsTab.tsx` | Usar Produção para escritas | MÉDIA |
| `src/components/admin/CreateCouponModal.tsx` | Usar Produção para criação de cupons | MÉDIA |
| `src/components/patient/MeusCuponsCard.tsx` | Usar sessão híbrida | MÉDIA |

---

## Impacto das Correções

1. **Prevenção de uso múltiplo:** Usuários não conseguirão mais usar o mesmo cupom de primeira compra várias vezes
2. **Registro correto de uso:** Todos os pagamentos aprovados com cupom terão registro em `coupon_uses`
3. **Consistência de ambiente:** Operações no painel admin funcionarão corretamente
4. **Rastreabilidade:** O admin terá visão completa dos cupons utilizados e valores de repasse

