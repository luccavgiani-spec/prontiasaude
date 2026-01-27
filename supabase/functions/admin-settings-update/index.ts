/**
 * 🔧 Edge Function: Admin Settings Update
 * 
 * Permite que o painel admin atualize configurações (overrides, especialidades)
 * diretamente no banco de PRODUÇÃO usando service_role.
 * 
 * POST /admin-settings-update
 * Body: { key: string, value: any }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 🔒 Credenciais HARDCODED do projeto Supabase de PRODUÇÃO
const ORIGINAL_SUPABASE_URL = "https://ploqujuhpwutpcibedbr.supabase.co";
const ORIGINAL_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('ORIGINAL_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar método
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse body
    const body = await req.json();
    const { key, value } = body;

    if (!key) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: key' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[admin-settings-update] Updating key: ${key}`);

    // Criar cliente Supabase com service_role (acesso total)
    const supabase = createClient(
      ORIGINAL_SUPABASE_URL,
      ORIGINAL_SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Upsert na tabela admin_settings
    const { data, error } = await supabase
      .from('admin_settings')
      .upsert(
        {
          key,
          value,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'key' }
      )
      .select()
      .single();

    if (error) {
      console.error('[admin-settings-update] Upsert error:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[admin-settings-update] Successfully updated key: ${key}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        key, 
        value: data?.value,
        updated_at: data?.updated_at
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[admin-settings-update] Error:', err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
