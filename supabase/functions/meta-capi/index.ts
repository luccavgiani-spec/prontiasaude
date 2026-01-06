// Meta Conversions API (CAPI) - Server-side event tracking
// This edge function sends events directly to Meta's Conversions API

import { getCorsHeaders } from '../common/cors.ts';

const PIXEL_ID = '1489396668966676';
const META_API_VERSION = 'v19.0';
const META_API_URL = `https://graph.facebook.com/${META_API_VERSION}/${PIXEL_ID}/events`;

interface CAPIPayload {
  event_name: string;
  event_time: number;
  event_source_url?: string;
  value?: number;
  currency?: string;
  order_id?: string;
  fbp?: string;
  fbc?: string;
  client_user_agent?: string;
  content_name?: string;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload: CAPIPayload = await req.json();
    
    console.log('[Meta CAPI] Received payload:', JSON.stringify(payload));
    
    // Validate required fields
    if (!payload.event_name) {
      return new Response(JSON.stringify({ error: 'event_name is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get access token from environment
    const accessToken = Deno.env.get('META_ACCESS_TOKEN');
    if (!accessToken) {
      console.error('[Meta CAPI] META_ACCESS_TOKEN not configured');
      return new Response(JSON.stringify({ error: 'Meta access token not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build user_data object
    const userData: Record<string, string> = {};
    if (payload.fbp) userData.fbp = payload.fbp;
    if (payload.fbc) userData.fbc = payload.fbc;
    if (payload.client_user_agent) userData.client_user_agent = payload.client_user_agent;
    
    // Get client IP from request headers (for better attribution)
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
                  || req.headers.get('cf-connecting-ip')
                  || req.headers.get('x-real-ip');
    if (clientIp) userData.client_ip_address = clientIp;

    // Build custom_data object (no sensitive medical data)
    const customData: Record<string, unknown> = {};
    if (payload.value !== undefined) customData.value = payload.value;
    if (payload.currency) customData.currency = payload.currency;
    if (payload.order_id) customData.order_id = payload.order_id;
    // Note: content_name excluded to avoid any medical data

    // Build event data for Meta CAPI
    const eventData = {
      event_name: payload.event_name,
      event_time: payload.event_time || Math.floor(Date.now() / 1000),
      event_id: payload.order_id || `${Date.now()}_${Math.random().toString(36).substring(2)}`,
      event_source_url: payload.event_source_url || 'https://prontiasaude.com.br',
      action_source: 'website',
      user_data: userData,
      custom_data: customData,
    };

    console.log('[Meta CAPI] Sending to Meta:', JSON.stringify(eventData));

    // Build the complete request body
    const requestBody = {
      data: [eventData],
      test_event_code: 'TEST45323', // ⚠️ REMOVER APÓS VALIDAÇÃO
    };

    // Log the complete payload being sent (without token)
    console.log('[Meta CAPI] 📦 Complete request body (with test_event_code):', JSON.stringify(requestBody));

    // Send to Meta Conversions API
    const response = await fetch(`${META_API_URL}?access_token=${accessToken}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('[Meta CAPI] Error from Meta:', JSON.stringify(result));
      return new Response(JSON.stringify({ 
        success: false, 
        error: result.error?.message || 'Meta API error',
        details: result
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[Meta CAPI] ✅ Success:', JSON.stringify(result));
    
    return new Response(JSON.stringify({ 
      success: true, 
      fbtrace_id: result.fbtrace_id,
      events_received: result.events_received
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[Meta CAPI] Error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
