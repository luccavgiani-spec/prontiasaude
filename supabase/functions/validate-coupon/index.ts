import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Zod schema for input validation
const ValidateCouponSchema = z.object({
  coupon_code: z.string()
    .min(3, 'Código de cupom deve ter pelo menos 3 caracteres')
    .max(30, 'Código de cupom deve ter no máximo 30 caracteres')
    .regex(/^[A-Za-z0-9_-]+$/, 'Código de cupom contém caracteres inválidos'),
  item_type: z.enum(['SERVICE', 'PLAN'], {
    errorMap: () => ({ message: 'Tipo de item deve ser SERVICE ou PLAN' })
  }),
  amount_original: z.number()
    .int('Valor deve ser um número inteiro')
    .positive('Valor deve ser positivo')
    .max(10000000, 'Valor máximo excedido'), // 100k reais in centavos
  user_id: z.string().uuid('ID de usuário inválido').optional(),
  user_email: z.string().email('Email inválido').optional(), // ✅ NOVO: Email para verificação de uso duplicado
  sku: z.string().optional(), // SKU do serviço/plano para validação de restrição
});

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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({
          is_valid: false,
          error_message: 'Corpo da requisição inválido',
        } as ValidateCouponResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate input with zod schema
    const validationResult = ValidateCouponSchema.safeParse(body);
    
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors[0]?.message || 'Parâmetros inválidos';
      console.log('[validate-coupon] Validation error:', validationResult.error.errors);
      return new Response(
        JSON.stringify({
          is_valid: false,
          error_message: errorMessage,
        } as ValidateCouponResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { coupon_code, item_type, amount_original, user_id, user_email, sku } = validationResult.data;

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
        JSON.stringify({
          is_valid: false,
          error_message: 'Cupom inválido ou expirado',
        } as ValidateCouponResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validar tipo de cupom vs tipo de item
    // Cupons do sistema (owner_user_id = NULL) são universais - funcionam para qualquer tipo
    const isSystemCoupon = coupon.owner_user_id === null;
    
    if (!isSystemCoupon && coupon.coupon_type !== item_type) {
      const expectedType = item_type === 'SERVICE' ? 'serviços avulsos' : 'planos';
      console.log('[validate-coupon] Tipo incompatível:', { coupon_type: coupon.coupon_type, item_type });
      return new Response(
        JSON.stringify({
          is_valid: false,
          error_message: `Este cupom só pode ser usado para ${expectedType}`,
        } as ValidateCouponResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (isSystemCoupon) {
      console.log('[validate-coupon] System coupon detected - accepting any item type');
    }

    // Validar SKU se o cupom tiver restrição de serviços específicos
    if (coupon.allowed_skus && coupon.allowed_skus.length > 0) {
      if (!sku || !coupon.allowed_skus.includes(sku)) {
        console.log('[validate-coupon] SKU não permitido:', { sku, allowed_skus: coupon.allowed_skus });
        return new Response(
          JSON.stringify({
            is_valid: false,
            error_message: 'Este cupom não é válido para este serviço',
          } as ValidateCouponResponse),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.log('[validate-coupon] SKU validado:', { sku, allowed_skus: coupon.allowed_skus });
    }

    // Opcional: impedir que o usuário use seu próprio cupom
    if (user_id && coupon.owner_user_id === user_id) {
      console.log('[validate-coupon] Usuário tentando usar próprio cupom');
      return new Response(
        JSON.stringify({
          is_valid: false,
          error_message: 'Você não pode usar seu próprio cupom',
        } as ValidateCouponResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ Só verificar uso duplicado se o cupom for de uso único (is_single_use !== false)
    if (coupon.is_single_use !== false) {
      // Verificar por user_id
      if (user_id) {
        const { data: existingUse, error: useError } = await supabase
          .from('coupon_uses')
          .select('id')
          .eq('coupon_id', coupon.id)
          .eq('used_by_user_id', user_id)
          .limit(1);

        if (useError) {
          console.log('[validate-coupon] Erro ao verificar uso anterior por user_id:', useError);
        }

        if (existingUse && existingUse.length > 0) {
          console.log('[validate-coupon] Usuário já usou este cupom (por user_id)');
          return new Response(
            JSON.stringify({
              is_valid: false,
              error_message: 'Você já usou este cupom anteriormente',
            } as ValidateCouponResponse),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Verificar por email
      if (user_email) {
        const { data: existingUseByEmail, error: emailUseError } = await supabase
          .from('coupon_uses')
          .select('id')
          .eq('coupon_id', coupon.id)
          .eq('used_by_email', user_email.toLowerCase())
          .limit(1);

        if (emailUseError) {
          console.log('[validate-coupon] Erro ao verificar uso anterior por email:', emailUseError);
        }

        if (existingUseByEmail && existingUseByEmail.length > 0) {
          console.log('[validate-coupon] Email já usou este cupom:', user_email);
          return new Response(
            JSON.stringify({
              is_valid: false,
              error_message: 'Este email já usou este cupom anteriormente',
            } as ValidateCouponResponse),
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

    // Buscar dados do owner (email da tabela patients)
    const { data: ownerPatient, error: ownerError } = await supabase
      .from('patients')
      .select('email, first_name, last_name')
      .eq('id', coupon.owner_user_id)
      .single();

    if (ownerError) {
      console.log('[validate-coupon] Erro ao buscar owner:', ownerError);
    }

    const owner_email = ownerPatient?.email || '';

    console.log('[validate-coupon] Cupom válido:', {
      coupon_id: coupon.id,
      discount_percentage,
      amount_original,
      amount_discounted,
    });

    // Retornar resultado válido
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
      JSON.stringify({
        is_valid: false,
        error_message: 'Erro ao validar cupom',
      } as ValidateCouponResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
