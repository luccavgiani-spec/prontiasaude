

# Plano: Códigos Auto-Contidos para Deploy Manual no Supabase

## Diagnóstico

### Erro da `validate-coupon`
O erro `"Relative import path 'zod' not prefixed with / or ./ or ../"` acontece porque o editor do dashboard do Supabase NÃO reconhece o arquivo `deno.json` com import maps. Cada edge function deployada pelo dashboard precisa ser **auto-contida** com imports completos.

### `admin-coupon-operations` não existe
Essa função nunca foi criada no Supabase de Produção. Ela precisa ser criada manualmente.

---

## Código Pronto para Copiar

### 1. validate-coupon (versão auto-contida)

Substitua TODO o conteúdo da função `validate-coupon` no dashboard do Supabase de Produção por este código:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidateCouponResponse {
  is_valid: boolean;
  error_message?: string;
  coupon_id?: string;
  coupon_code?: string;
  discount_percentage?: number;
  amount_original?: number;
  amount_discounted?: number;
  owner_user_id?: string;
  owner_email?: string;
  owner_pix_key?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ is_valid: false, error_message: 'Corpo da requisição inválido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { coupon_code, item_type, amount_original, user_id, user_email, sku } = body;

    // Validações básicas
    if (!coupon_code || typeof coupon_code !== 'string' || coupon_code.length < 3) {
      return new Response(
        JSON.stringify({ is_valid: false, error_message: 'Código de cupom inválido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (!['SERVICE', 'PLAN'].includes(item_type)) {
      return new Response(
        JSON.stringify({ is_valid: false, error_message: 'Tipo de item deve ser SERVICE ou PLAN' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (typeof amount_original !== 'number' || amount_original <= 0) {
      return new Response(
        JSON.stringify({ is_valid: false, error_message: 'Valor original inválido' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('[validate-coupon] Request:', { coupon_code, item_type, amount_original, user_id, user_email, sku });

    // Buscar cupom no banco
    const { data: coupon, error: couponError } = await supabase
      .from('user_coupons')
      .select('*')
      .eq('code', coupon_code.toUpperCase())
      .eq('is_active', true)
      .single();

    if (couponError || !coupon) {
      console.log('[validate-coupon] Cupom não encontrado:', couponError);
      return new Response(
        JSON.stringify({ is_valid: false, error_message: 'Cupom inválido ou expirado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar tipo de cupom vs tipo de item
    const isSystemCoupon = coupon.owner_user_id === null;
    
    if (!isSystemCoupon && coupon.coupon_type !== item_type) {
      const expectedType = item_type === 'SERVICE' ? 'serviços avulsos' : 'planos';
      console.log('[validate-coupon] Tipo incompatível:', { coupon_type: coupon.coupon_type, item_type });
      return new Response(
        JSON.stringify({ is_valid: false, error_message: `Este cupom só pode ser usado para ${expectedType}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (isSystemCoupon) {
      console.log('[validate-coupon] System coupon detected - accepting any item type');
    }

    // Validar SKU se o cupom tiver restrição
    if (coupon.allowed_skus && coupon.allowed_skus.length > 0) {
      if (!sku || !coupon.allowed_skus.includes(sku)) {
        console.log('[validate-coupon] SKU não permitido:', { sku, allowed_skus: coupon.allowed_skus });
        return new Response(
          JSON.stringify({ is_valid: false, error_message: 'Este cupom não é válido para este serviço' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Impedir uso do próprio cupom
    if (user_id && coupon.owner_user_id === user_id) {
      console.log('[validate-coupon] Usuário tentando usar próprio cupom');
      return new Response(
        JSON.stringify({ is_valid: false, error_message: 'Você não pode usar seu próprio cupom' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ Só verificar uso duplicado se o cupom for de uso único
    if (coupon.is_single_use !== false) {
      if (user_id) {
        const { data: existingUse } = await supabase
          .from('coupon_uses')
          .select('id')
          .eq('coupon_id', coupon.id)
          .eq('used_by_user_id', user_id)
          .limit(1);

        if (existingUse && existingUse.length > 0) {
          console.log('[validate-coupon] Usuário já usou este cupom (por user_id)');
          return new Response(
            JSON.stringify({ is_valid: false, error_message: 'Você já usou este cupom anteriormente' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      if (user_email) {
        const { data: existingUseByEmail } = await supabase
          .from('coupon_uses')
          .select('id')
          .eq('coupon_id', coupon.id)
          .eq('used_by_email', user_email.toLowerCase())
          .limit(1);

        if (existingUseByEmail && existingUseByEmail.length > 0) {
          console.log('[validate-coupon] Email já usou este cupom:', user_email);
          return new Response(
            JSON.stringify({ is_valid: false, error_message: 'Este email já usou este cupom anteriormente' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    } else {
      console.log('[validate-coupon] Cupom de uso múltiplo - pulando verificação de duplicidade');
    }

    // Calcular desconto
    const discount_percentage = coupon.discount_percentage;
    const amount_discounted = Math.round(amount_original * (1 - discount_percentage / 100));

    // Buscar dados do owner
    let owner_email = '';
    if (coupon.owner_user_id) {
      const { data: ownerPatient } = await supabase
        .from('patients')
        .select('email')
        .eq('id', coupon.owner_user_id)
        .single();
      owner_email = ownerPatient?.email || '';
    }

    console.log('[validate-coupon] Cupom válido:', { coupon_id: coupon.id, discount_percentage, amount_discounted });

    const response: ValidateCouponResponse = {
      is_valid: true,
      coupon_id: coupon.id,
      coupon_code: coupon.code,
      discount_percentage,
      amount_original,
      amount_discounted,
      owner_user_id: coupon.owner_user_id,
      owner_email,
      owner_pix_key: coupon.pix_key,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[validate-coupon] Erro:', error);
    return new Response(
      JSON.stringify({ is_valid: false, error_message: 'Erro ao validar cupom' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
```

**Mudanças importantes:**
- Import usando URL completa: `https://esm.sh/@supabase/supabase-js@2.49.1`
- Removido Zod completamente (validação manual inline)
- Lógica de `is_single_use` implementada

---

### 2. admin-coupon-operations (função nova)

Crie uma **NOVA** edge function no Supabase de Produção com nome `admin-coupon-operations` e cole este código:

```typescript
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { operation, ...params } = body;

    console.log('[admin-coupon-operations] Operation:', operation, 'Params:', params);

    switch (operation) {
      case 'list': {
        const { data, error } = await supabase
          .from('user_coupons')
          .select(`
            *,
            patients:owner_user_id (email, first_name, last_name)
          `)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, coupons: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create': {
        // Verificar se código já existe
        const { data: existing } = await supabase
          .from('user_coupons')
          .select('code')
          .eq('code', params.code?.toUpperCase())
          .maybeSingle();

        if (existing) {
          return new Response(
            JSON.stringify({ success: false, error: 'Código de cupom já existe' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Resolver owner_user_id se email fornecido
        let ownerId = params.owner_user_id || null;
        if (params.owner_email && !ownerId) {
          const { data: patient } = await supabase
            .from('patients')
            .select('id')
            .ilike('email', params.owner_email)
            .maybeSingle();
          ownerId = patient?.id || null;
        }

        const { data, error } = await supabase
          .from('user_coupons')
          .insert({
            owner_user_id: ownerId,
            code: params.code?.toUpperCase(),
            coupon_type: params.coupon_type || 'SERVICE',
            discount_percentage: params.discount_percentage || 10,
            pix_key: params.pix_key || null,
            is_active: true,
            is_single_use: params.is_single_use ?? true,
          })
          .select()
          .single();

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, coupon: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        if (!params.coupon_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'coupon_id é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const updateData: any = {};
        if (params.is_active !== undefined) updateData.is_active = params.is_active;
        if (params.discount_percentage !== undefined) updateData.discount_percentage = params.discount_percentage;
        if (params.pix_key !== undefined) updateData.pix_key = params.pix_key;
        if (params.is_single_use !== undefined) updateData.is_single_use = params.is_single_use;

        const { data, error } = await supabase
          .from('user_coupons')
          .update(updateData)
          .eq('id', params.coupon_id)
          .select()
          .single();

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true, coupon: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        if (!params.coupon_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'coupon_id é obrigatório' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { error } = await supabase
          .from('user_coupons')
          .delete()
          .eq('id', params.coupon_id);

        if (error) throw error;
        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: `Operação desconhecida: ${operation}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('[admin-coupon-operations] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## Passos para Executar

| Passo | Ação |
|-------|------|
| 1 | No Supabase de Produção, vá em **Edge Functions** |
| 2 | Clique na função `validate-coupon` e substitua TODO o código pelo código acima |
| 3 | Clique em **Deploy updates** |
| 4 | Clique em **Create a new function** |
| 5 | Nome: `admin-coupon-operations` |
| 6 | Cole o código da função admin-coupon-operations acima |
| 7 | Clique em **Deploy** |

---

## Detalhes Técnicos

- **Import auto-contido**: Usamos `https://esm.sh/@supabase/supabase-js@2.49.1` em vez de `@supabase/supabase-js`
- **Sem Zod**: Removemos a dependência do Zod e fizemos validação manual para evitar problemas de import
- **is_single_use**: A lógica está implementada em ambas as funções
- **owner_user_id nullable**: A função `create` agora aceita `ownerId = null` para cupons do sistema

