

# Plano: Atualizar Frontend para Usar a Nova Edge Function

## O Que Você Já Fez
Você deployou a edge function `admin-coupon-operations` no Supabase de Produção.

## O Que Ainda Precisa Ser Feito
Agora preciso atualizar os componentes frontend para chamarem a nova edge function ao invés de usar `supabaseProduction` diretamente.

---

## Arquivos a Modificar

### 1. `src/components/admin/CreateCouponModal.tsx`

**Mudanças:**
- Remover imports de `supabaseProduction` e `supabase`
- Adicionar import de `invokeEdgeFunction`
- Substituir toda a lógica de `handleSubmit` para chamar a edge function

**Código simplificado do novo handleSubmit:**
```typescript
const { data, error } = await invokeEdgeFunction('admin-coupon-operations', {
  body: {
    operation: 'create',
    code: formData.code.toUpperCase(),
    coupon_type: formData.couponType,
    discount_percentage: discount,
    owner_email: formData.ownerEmail.trim() || null,
    pix_key: formData.pixKey.trim() || null,
  }
});
```

---

### 2. `src/components/admin/CouponsTab.tsx`

**Mudanças em 3 funções:**

1. **`handleToggleCoupon`** - Usar edge function:
```typescript
const { data, error } = await invokeEdgeFunction('admin-coupon-operations', {
  body: {
    operation: 'toggle',
    id: id,
    is_active: !currentStatus,
  }
});
```

2. **`handleDeleteCoupon`** - Usar edge function:
```typescript
const { data, error } = await invokeEdgeFunction('admin-coupon-operations', {
  body: {
    operation: 'delete',
    id: couponToDelete,
  }
});
```

3. **`handleToggleReviewed`** - Usar edge function:
```typescript
const { data, error } = await invokeEdgeFunction('admin-coupon-operations', {
  body: {
    operation: 'mark_reviewed',
    id: id,
    admin_reviewed: !currentStatus,
  }
});
```

---

## Resultado Esperado

Após essas alterações, todas as operações de escrita (criar, ativar/desativar, deletar, marcar como revisado) passarão pela edge function `admin-coupon-operations`, que usa `service_role` para bypass de RLS.

O fluxo será:
```
Frontend → invokeEdgeFunction() → admin-coupon-operations (service_role) → Supabase DB
```

---

## Nenhum Deploy Manual Adicional

Essas são apenas alterações de frontend - serão aplicadas automaticamente quando eu implementar o plano.

