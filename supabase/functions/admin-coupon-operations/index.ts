/**
 * 🎟️ Edge Function: Admin Coupon Operations
 * 
 * Gerencia cupons na tabela user_coupons do banco de PRODUÇÃO.
 * Usa service_role para bypass de RLS.
 * 
 * Operações: create, toggle, delete, mark_reviewed, list_by_owner, get_patient_name
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

const ORIGINAL_SUPABASE_URL = "https://ploqujuhpwutpcibedbr.supabase.co";
const ORIGINAL_SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('ORIGINAL_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

function getSupabase() {
  return createClient(ORIGINAL_SUPABASE_URL, ORIGINAL_SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const body = await req.json();
    const { operation } = body;

    if (!operation) {
      return jsonResponse({ error: 'Missing required field: operation' }, 400);
    }

    console.log(`[admin-coupon-operations] operation=${operation}`);
    const supabase = getSupabase();

    // ═══════════════════════════════════════════
    // CREATE — Criar cupom
    // ═══════════════════════════════════════════
    if (operation === 'create') {
      const { code, coupon_type, discount_percentage, pix_key, owner_user_id, owner_email, allowed_skus } = body;

      if (!code) {
        return jsonResponse({ error: 'Missing required field: code' }, 400);
      }

      let finalOwnerUserId = owner_user_id;

      // Se veio owner_email em vez de owner_user_id, buscar o user_id pelo email
      if (!finalOwnerUserId && owner_email) {
        const { data: patient } = await supabase
          .from('patients')
          .select('user_id')
          .ilike('email', owner_email)
          .limit(1)
          .single();

        if (patient?.user_id) {
          finalOwnerUserId = patient.user_id;
        }
      }

      const insertData: any = {
        code,
        coupon_type: coupon_type || 'SERVICE',
        discount_percentage: discount_percentage ?? 10,
        is_active: true,
      };

      if (pix_key) insertData.pix_key = pix_key;
      if (finalOwnerUserId) insertData.owner_user_id = finalOwnerUserId;
      if (allowed_skus) insertData.allowed_skus = allowed_skus;

      const { data, error } = await supabase
        .from('user_coupons')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('[admin-coupon-operations] create error:', error);
        return jsonResponse({ success: false, error: error.message }, 400);
      }

      return jsonResponse({ success: true, coupon: data });
    }

    // ═══════════════════════════════════════════
    // TOGGLE — Ativar/desativar cupom
    // ═══════════════════════════════════════════
    if (operation === 'toggle') {
      const { id, is_active } = body;

      if (!id || is_active === undefined) {
        return jsonResponse({ error: 'Missing required fields: id, is_active' }, 400);
      }

      const { error } = await supabase
        .from('user_coupons')
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error('[admin-coupon-operations] toggle error:', error);
        return jsonResponse({ success: false, error: error.message }, 500);
      }

      return jsonResponse({ success: true });
    }

    // ═══════════════════════════════════════════
    // DELETE — Deletar cupom
    // ═══════════════════════════════════════════
    if (operation === 'delete') {
      const { id } = body;

      if (!id) {
        return jsonResponse({ error: 'Missing required field: id' }, 400);
      }

      const { error } = await supabase
        .from('user_coupons')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[admin-coupon-operations] delete error:', error);
        return jsonResponse({ success: false, error: error.message }, 500);
      }

      return jsonResponse({ success: true });
    }

    // ═══════════════════════════════════════════
    // MARK_REVIEWED — Marcar uso como conferido
    // ═══════════════════════════════════════════
    if (operation === 'mark_reviewed') {
      const { id, reviewed } = body;

      if (!id || reviewed === undefined) {
        return jsonResponse({ error: 'Missing required fields: id, reviewed' }, 400);
      }

      const updateData: any = {
        reviewed,
        reviewed_at: reviewed ? new Date().toISOString() : null,
      };

      const { error } = await supabase
        .from('coupon_uses')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('[admin-coupon-operations] mark_reviewed error:', error);
        return jsonResponse({ success: false, error: error.message }, 500);
      }

      return jsonResponse({ success: true });
    }

    // ═══════════════════════════════════════════
    // LIST_BY_OWNER — Listar cupons de um owner
    // ═══════════════════════════════════════════
    if (operation === 'list_by_owner') {
      const { owner_user_id } = body;

      if (!owner_user_id) {
        return jsonResponse({ error: 'Missing required field: owner_user_id' }, 400);
      }

      const { data, error } = await supabase
        .from('user_coupons')
        .select('*')
        .eq('owner_user_id', owner_user_id)
        .eq('is_active', true);

      if (error) {
        console.error('[admin-coupon-operations] list_by_owner error:', error);
        return jsonResponse({ success: false, error: error.message }, 500);
      }

      return jsonResponse({ success: true, coupons: data || [] });
    }

    // ═══════════════════════════════════════════
    // GET_PATIENT_NAME — Buscar nome do paciente
    // ═══════════════════════════════════════════
    if (operation === 'get_patient_name') {
      const { user_id } = body;

      if (!user_id) {
        return jsonResponse({ error: 'Missing required field: user_id' }, 400);
      }

      const { data, error } = await supabase
        .from('patients')
        .select('first_name')
        .eq('user_id', user_id)
        .limit(1)
        .single();

      if (error) {
        console.error('[admin-coupon-operations] get_patient_name error:', error);
        return jsonResponse({ success: true, first_name: 'USER' });
      }

      return jsonResponse({ success: true, first_name: data?.first_name || 'USER' });
    }

    return jsonResponse({ error: `Unknown operation: ${operation}` }, 400);

  } catch (err) {
    console.error('[admin-coupon-operations] Error:', err);
    return jsonResponse({ error: err instanceof Error ? err.message : 'Unknown error' }, 500);
  }
});
