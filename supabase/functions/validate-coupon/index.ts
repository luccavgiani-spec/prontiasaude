import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidateCouponRequest {
  coupon_code: string;
  item_type: 'SERVICE' | 'PLAN';
  amount_original: number; // em centavos
  user_id?: string;
}

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

    const body: ValidateCouponRequest = await req.json();
    const { coupon_code, item_type, amount_original, user_id } = body;

    console.log('[validate-coupon] Request:', { coupon_code, item_type, amount_original, user_id });

    // Validação básica
    if (!coupon_code || !item_type || !amount_original) {
      return new Response(
        JSON.stringify({
          is_valid: false,
          error_message: 'Parâmetros inválidos',
        } as ValidateCouponResponse),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

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
    if (coupon.coupon_type !== item_type) {
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

    // Verificar se o usuário já usou este cupom
    if (user_id) {
      const { data: existingUse, error: useError } = await supabase
        .from('coupon_uses')
        .select('id')
        .eq('coupon_id', coupon.id)
        .eq('used_by_user_id', user_id)
        .limit(1);

      if (useError) {
        console.log('[validate-coupon] Erro ao verificar uso anterior:', useError);
      }

      if (existingUse && existingUse.length > 0) {
        console.log('[validate-coupon] Usuário já usou este cupom');
        return new Response(
          JSON.stringify({
            is_valid: false,
            error_message: 'Você já usou este cupom anteriormente',
          } as ValidateCouponResponse),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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
