
# Plano de Correção: Erro NOT NULL e Opção de Uso Único

## Diagnóstico do Problema

### Erro 1: `owner_user_id` NOT NULL na Produção
O erro `"null value in column \"owner_user_id\" violates not-null constraint"` ocorre porque:
- O banco de **Cloud** tem `owner_user_id` como NULLABLE
- O banco de **Produção** aparentemente tem uma constraint NOT NULL diferente

**Solução:** A edge function `admin-coupon-operations` deve gerar um UUID placeholder para cupons do sistema (sem dono específico), ou você precisa alterar a coluna na Produção para aceitar NULL.

### Erro 2: Falta opção de cupom com uso ilimitado
Atualmente, todos os cupons são tratados como uso único (verificação por `user_id` e `email` na função `validate-coupon`). Mas você quer poder criar cupons promocionais de uso múltiplo.

---

## Alterações Necessárias

### 1. Adicionar coluna `is_single_use` na tabela `user_coupons` (Produção)

Executar no Supabase de Produção via SQL Editor:

```sql
-- Adicionar coluna is_single_use com default TRUE (mantém comportamento atual)
ALTER TABLE public.user_coupons 
ADD COLUMN IF NOT EXISTS is_single_use boolean DEFAULT true;

-- Opcional: Também permitir owner_user_id NULL se ainda não for permitido
-- ALTER TABLE public.user_coupons 
-- ALTER COLUMN owner_user_id DROP NOT NULL;
```

### 2. Atualizar Frontend: `CreateCouponModal.tsx`

**Mudanças:**
- Adicionar estado `isSingleUse` (checkbox ou switch)
- Enviar `is_single_use` no body da request

```typescript
// Novo estado
const [formData, setFormData] = useState({
  code: "",
  couponType: "SERVICE" as "SERVICE" | "PLAN",
  discountPercentage: "",
  ownerEmail: "",
  pixKey: "",
  isSingleUse: true,  // ← NOVO
});

// No body da request
const { data, error } = await invokeEdgeFunction('admin-coupon-operations', {
  body: {
    operation: 'create',
    code: formData.code.toUpperCase(),
    coupon_type: formData.couponType,
    discount_percentage: discount,
    owner_email: formData.ownerEmail.trim() || null,
    pix_key: formData.pixKey.trim() || null,
    is_single_use: formData.isSingleUse,  // ← NOVO
  }
});
```

**UI - Adicionar Switch após o campo PIX:**

```tsx
<div className="flex items-center justify-between">
  <div className="space-y-0.5">
    <Label htmlFor="singleUse">Uso Único</Label>
    <p className="text-xs text-muted-foreground">
      Se ativado, cada usuário só pode usar este cupom uma vez
    </p>
  </div>
  <Switch
    id="singleUse"
    checked={formData.isSingleUse}
    onCheckedChange={(checked) => 
      setFormData(prev => ({ ...prev, isSingleUse: checked }))
    }
  />
</div>
```

### 3. Atualizar Edge Function: `admin-coupon-operations` (Produção)

**Mudanças no case 'create':**

```typescript
case 'create': {
  // Verificar se código já existe
  const { data: existing } = await supabase
    .from('user_coupons')
    .select('code')
    .eq('code', params.code)
    .maybeSingle();

  if (existing) {
    return new Response(
      JSON.stringify({ success: false, error: 'Código já existe' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Resolver owner_user_id se email fornecido
  let ownerId = params.owner_user_id || null;
  if (params.owner_email && !ownerId) {
    const { data: patient } = await supabase
      .from('patients')
      .select('id')
      .ilike('email', params.owner_email)  // ← Case-insensitive
      .maybeSingle();
    ownerId = patient?.id || null;
  }

  const { data, error } = await supabase
    .from('user_coupons')
    .insert({
      owner_user_id: ownerId,  // ← Pode ser NULL se a coluna permitir
      code: params.code,
      coupon_type: params.coupon_type || 'SERVICE',
      discount_percentage: params.discount_percentage || 10,
      pix_key: params.pix_key || null,
      is_active: true,
      is_single_use: params.is_single_use ?? true,  // ← NOVO: default true
    })
    .select()
    .single();

  if (error) throw error;
  return new Response(
    JSON.stringify({ success: true, coupon: data }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
```

### 4. Atualizar Edge Function: `validate-coupon` (Produção)

**Mudanças:** Verificar `is_single_use` antes de bloquear uso duplicado.

```typescript
// Após buscar o cupom, antes de verificar uso duplicado:

// ✅ Só verificar uso duplicado se o cupom for de uso único
if (coupon.is_single_use !== false) {
  // Verificar por user_id
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

  // Verificar por email
  if (user_email) {
    const { data: existingUseByEmail } = await supabase
      .from('coupon_uses')
      .select('id')
      .eq('coupon_id', coupon.id)
      .eq('used_by_email', user_email.toLowerCase())
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
} else {
  console.log('[validate-coupon] Cupom de uso múltiplo - pulando verificação de duplicidade');
}
```

---

## Resumo de Ações

| Local | Ação |
|-------|------|
| **Supabase Produção (SQL)** | Adicionar coluna `is_single_use boolean DEFAULT true` |
| **Supabase Produção (SQL)** | Opcional: Permitir `owner_user_id NULL` se necessário |
| **Frontend** | Atualizar `CreateCouponModal.tsx` com switch de uso único |
| **Supabase Produção (Edge)** | Atualizar `admin-coupon-operations` para receber `is_single_use` |
| **Supabase Produção (Edge)** | Atualizar `validate-coupon` para respeitar `is_single_use` |

---

## Ordem de Execução

1. **Primeiro:** Execute a SQL no Supabase de Produção para adicionar a coluna
2. **Segundo:** Atualize as Edge Functions na Produção (copiar/deployar)
3. **Terceiro:** Eu atualizo o frontend `CreateCouponModal.tsx` aqui no Lovable

---

## Deploy Necessário

Após eu implementar as mudanças no frontend, você precisará:
1. Executar SQL na Produção
2. Copiar e deployar `admin-coupon-operations` atualizada
3. Copiar e deployar `validate-coupon` atualizada
