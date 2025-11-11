import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as jose from 'https://deno.land/x/jose@v5.2.0/index.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { token } = await req.json();
    
    if (!token) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Token não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const JWT_SECRET = Deno.env.get('AUTH_JWT_SECRET');
    if (!JWT_SECRET) {
      console.error('[validate-sso-token] AUTH_JWT_SECRET não configurado');
      return new Response(
        JSON.stringify({ ok: false, error: 'Configuração incompleta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const secret = new TextEncoder().encode(JWT_SECRET);
    const { payload } = await jose.jwtVerify(token, secret, {
      audience: 'CLICKLIFE'
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: ssoToken, error } = await supabase
      .from('sso_tokens')
      .select('*')
      .eq('jti', payload.jti)
      .maybeSingle();

    if (error || !ssoToken) {
      console.error('[validate-sso-token] Token não encontrado:', payload.jti);
      return new Response(
        JSON.stringify({ ok: false, error: 'Token não encontrado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (ssoToken.used_at) {
      console.warn('[validate-sso-token] Token já foi usado:', payload.jti);
      return new Response(
        JSON.stringify({ ok: false, error: 'Token já foi usado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (new Date(ssoToken.expires_at) < new Date()) {
      console.warn('[validate-sso-token] Token expirado:', payload.jti);
      return new Response(
        JSON.stringify({ ok: false, error: 'Token expirado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark as used (single-use)
    await supabase
      .from('sso_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('jti', payload.jti);

    console.log('[validate-sso-token] Token validado e invalidado:', payload.jti);

    return new Response(
      JSON.stringify({
        ok: true,
        clicklife_token: payload.clicklife_token,
        redirect_to: payload.redirect_to
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[validate-sso-token] Exception:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message || 'Token inválido' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
