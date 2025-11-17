import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-signature',
};

interface SendLinkRequest {
  contact_id?: string;
  phone_e164?: string;
  patient_email: string;
  patient_name?: string;
  service_name: string;
  redirect_url: string;
  order_id?: string;
  use_template?: boolean;
  request_id?: string;
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11 && !digits.startsWith('55')) {
    return `+55${digits}`;
  }
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+${digits}`;
  }
  return phone;
}

function validateHMAC(body: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  
  const encoder = new TextEncoder();
  const key = encoder.encode(secret);
  const data = encoder.encode(body);
  
  return crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  ).then(cryptoKey =>
    crypto.subtle.sign('HMAC', cryptoKey, data)
  ).then(signatureBuffer => {
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return signatureHex === signature;
  }).catch(() => false);
}

async function checkRateLimit(supabase: any, orderId: string): Promise<boolean> {
  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
  
  const { data, error } = await supabase
    .from('whatsapp_rate_limits')
    .select('attempt_count')
    .eq('order_id', orderId)
    .gte('last_attempt_at', oneMinuteAgo)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('[mc-send-consultation-link] Rate limit check error:', error);
    return true;
  }
  
  if (data && data.attempt_count >= 1) {
    console.warn('[mc-send-consultation-link] Rate limit: 1 attempt/minute exceeded');
    return false;
  }
  
  const { data: totalData } = await supabase
    .from('whatsapp_rate_limits')
    .select('attempt_count')
    .eq('order_id', orderId)
    .single();
  
  if (totalData && totalData.attempt_count >= 3) {
    console.warn('[mc-send-consultation-link] Rate limit: 3 total attempts exceeded');
    return false;
  }
  
  return true;
}

async function updateRateLimit(supabase: any, orderId: string): Promise<void> {
  await supabase.rpc('increment_whatsapp_rate_limit', { p_order_id: orderId });
}

async function getSubscriberIdByPhone(phone: string, apiKey: string, requestId: string): Promise<string | null> {
  try {
    console.log(JSON.stringify({
      request_id: requestId,
      event: 'looking_up_subscriber',
      phone: phone
    }));

    const response = await fetch('https://api.manychat.com/fb/subscriber/findBySystemField', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        field_name: 'phone',
        field_value: phone
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(JSON.stringify({
        request_id: requestId,
        event: 'subscriber_lookup_failed',
        status: response.status,
        error: errorText.substring(0, 200)
      }));
      return null;
    }

    const data = await response.json();
    const subscriberId = data?.data?.id?.toString();

    if (subscriberId) {
      console.log(JSON.stringify({
        request_id: requestId,
        event: 'subscriber_found',
        subscriber_id: subscriberId,
        phone: phone
      }));
      return subscriberId;
    }

    console.warn(JSON.stringify({
      request_id: requestId,
      event: 'subscriber_not_found',
      phone: phone
    }));
    return null;
  } catch (error) {
    console.error(JSON.stringify({
      request_id: requestId,
      event: 'subscriber_lookup_exception',
      error: error.message
    }));
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const bodyText = await req.text();
    const payload: SendLinkRequest = JSON.parse(bodyText);
    
    const requestId = payload.request_id || `req-${Date.now()}`;
    
    console.log(JSON.stringify({
      request_id: requestId,
      function: 'mc-send-consultation-link',
      event: 'request_received',
      phone: payload.phone_e164 || payload.contact_id,
      order_id: payload.order_id
    }));

    // HMAC validation
    const MC_HMAC_SECRET = Deno.env.get('MC_HMAC_SECRET');
    if (MC_HMAC_SECRET) {
      const signature = req.headers.get('x-client-signature');
      const isValid = await validateHMAC(bodyText, signature, MC_HMAC_SECRET);
      if (!isValid) {
        console.error('[mc-send-consultation-link] Invalid HMAC signature');
        return new Response(
          JSON.stringify({ ok: false, error: 'Invalid signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Validations
    if (!payload.contact_id && !payload.phone_e164) {
      return new Response(
        JSON.stringify({ ok: false, error: 'contact_id ou phone_e164 obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!payload.patient_email || !payload.service_name || !payload.redirect_url) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Campos obrigatórios: patient_email, service_name, redirect_url' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone
    if (payload.phone_e164) {
      payload.phone_e164 = normalizePhone(payload.phone_e164);
      if (!payload.phone_e164.match(/^\+55[1-9][1-9]\d{8,9}$/)) {
        return new Response(
          JSON.stringify({ ok: false, error: 'phone_e164 inválido (formato: +5511999999999)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check idempotency
    if (payload.order_id) {
      const { data: existing } = await supabase
        .from('metrics')
        .select('id')
        .eq('metric_type', 'whatsapp_link_dispatched')
        .eq('metadata->>order_id', payload.order_id)
        .maybeSingle();

      if (existing) {
        console.log(JSON.stringify({
          request_id: requestId,
          event: 'duplicate_skipped',
          order_id: payload.order_id
        }));
        return new Response(
          JSON.stringify({ ok: true, message: 'Already sent', duplicate: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check rate limit
      const canProceed = await checkRateLimit(supabase, payload.order_id);
      if (!canProceed) {
        return new Response(
          JSON.stringify({ ok: false, error: 'Rate limit exceeded' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await updateRateLimit(supabase, payload.order_id);
    }

    const MANYCHAT_API_KEY = Deno.env.get('MANYCHAT_API_KEY');
    const TEMPLATE_NAME = Deno.env.get('MANYCHAT_TEMPLATE_NAME');
    const TEMPLATE_NAMESPACE = Deno.env.get('MANYCHAT_TEMPLATE_NAMESPACE');
    
    // Se template não está configurado, usar texto simples
    const USE_TEMPLATE = TEMPLATE_NAME && (payload.use_template ?? (Deno.env.get('MANYCHAT_USE_TEMPLATE') === 'true'));
    
    // Define endpoints for template and text messages
    const baseUrl = (Deno.env.get('MANYCHAT_API_URL') || 'https://api.manychat.com').replace(/\/+$/, '');
    const templateEndpoint = Deno.env.get('MANYCHAT_TEMPLATE_ENDPOINT') || '/fb/sending/sendContent';
    const textEndpoint = Deno.env.get('MANYCHAT_TEXT_ENDPOINT') || '/fb/sending/sendMessage';
    
    // Select endpoint based on message type
    const endpoint = USE_TEMPLATE ? templateEndpoint : textEndpoint;
    const manychatUrl = `${baseUrl}${endpoint}`;
    
    if (!MANYCHAT_API_KEY) {
      console.error('[mc-send-consultation-link] MANYCHAT_API_KEY não configurado');
      return new Response(
        JSON.stringify({ ok: false, error: 'MANYCHAT_API_KEY não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let subscriberId = payload.contact_id;
    
    // Se não temos contact_id, buscar subscriber_id pelo telefone
    if (!subscriberId && payload.phone_e164) {
      subscriberId = await getSubscriberIdByPhone(payload.phone_e164, MANYCHAT_API_KEY, requestId);
      
      if (!subscriberId) {
        console.error(JSON.stringify({
          request_id: requestId,
          event: 'subscriber_id_not_found',
          phone: payload.phone_e164
        }));
        
        return new Response(
          JSON.stringify({ 
            ok: false, 
            error: 'Subscriber not found in ManyChat',
            details: `Phone ${payload.phone_e164} is not registered as a ManyChat subscriber`
          }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
    console.log(JSON.stringify({
      request_id: requestId,
      event: 'subscriber_id_resolved',
      subscriber_id: subscriberId,
      from_contact_id: !!payload.contact_id,
      from_phone_lookup: !payload.contact_id && !!payload.phone_e164
    }));
    
    let manychatPayload: any;

    if (USE_TEMPLATE) {
      // Extrair nome do paciente (fallback para email se ausente)
      const patientName = payload.patient_name || payload.patient_email.split('@')[0];
      
      manychatPayload = {
        subscriber_id: subscriberId,
        data: {
          version: 'v2',
          content: {
            messages: [
              {
                type: 'text',
                text: `Olá ${patientName}! 🎉\nSeu pagamento foi aprovado ✅\n\nAcesse sua consulta através do botão abaixo:\n\nSe precisar de ajuda, estamos por aqui 💚`,
                buttons: [
                  {
                    type: 'url',
                    caption: 'Acessar Consulta',
                    url: payload.redirect_url
                  }
                ]
              }
            ]
          }
        }
      };
      
      console.log(JSON.stringify({
        request_id: requestId,
        event: 'manychat_content_payload_constructed',
        patient_name: patientName,
        redirect_url: payload.redirect_url,
        subscriber_id: subscriberId
      }));
    } else {
      manychatPayload = {
        subscriber_id: subscriberId,
        message_tag: 'POST_PURCHASE_UPDATE',
        text: `Olá! Seu pagamento foi aprovado ✅\n\n🩺 *Serviço*: ${payload.service_name}\n\n📲 *Acesse sua consulta*:\n${payload.redirect_url}\n\n_Equipe Prontia Saúde_`
      };
    }

    console.log(JSON.stringify({
      request_id: requestId,
      event: 'sending_to_manychat',
      mode: USE_TEMPLATE ? 'template' : 'text',
      endpoint: endpoint,
      url: manychatUrl,
      use_template: USE_TEMPLATE
    }));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    let manychatRes = await fetch(manychatUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MANYCHAT_API_KEY}`
      },
      body: JSON.stringify(manychatPayload),
      signal: controller.signal
    }).catch(async (error) => {
      clearTimeout(timeoutId);
      
      // Save to DLQ
      await supabase
        .from('outbox_whatsapp')
        .insert({
          payload: manychatPayload,
          error: error.message,
          status: 'pending',
          scheduled_for: new Date(Date.now() + 60000).toISOString()
        });
      
      throw error;
    });

    clearTimeout(timeoutId);

    let manychatResText = await manychatRes.text();

    // Handle 404 with retry fallback
    if (manychatRes.status === 404) {
      console.warn(JSON.stringify({
        request_id: requestId,
        event: 'manychat_404_retry',
        original_url: manychatUrl,
        response: manychatResText.substring(0, 200)
      }));

      // Fallback: try plain text message via text endpoint
      const fallbackUrl = `${baseUrl}${textEndpoint}`;
      const fallbackPayload = {
        subscriber_id: subscriberId,
        message_tag: 'POST_PURCHASE_UPDATE',
        text: `Olá! Seu pagamento foi aprovado ✅\n\n🩺 *Serviço*: ${payload.service_name}\n\n📲 *Acesse sua consulta*:\n${payload.redirect_url}\n\n_Equipe Prontia Saúde_`
      };

      console.log(JSON.stringify({
        request_id: requestId,
        event: 'fallback_to_sendMessage',
        url: fallbackUrl
      }));

      const fallbackController = new AbortController();
      const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 8000);

      manychatRes = await fetch(fallbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MANYCHAT_API_KEY}`
        },
        body: JSON.stringify(fallbackPayload),
        signal: fallbackController.signal
      }).catch(async (error) => {
        clearTimeout(fallbackTimeoutId);
        
        // Save to DLQ
        await supabase
          .from('outbox_whatsapp')
          .insert({
            payload: fallbackPayload,
            error: error.message,
            status: 'pending',
            scheduled_for: new Date(Date.now() + 60000).toISOString()
          });
        
        throw error;
      });

      clearTimeout(fallbackTimeoutId);
      manychatResText = await manychatRes.text();
    }

    if (!manychatRes.ok) {
      console.error(JSON.stringify({
        request_id: requestId,
        event: 'manychat_error',
        status: manychatRes.status,
        response: manychatResText
      }));
      return new Response(
        JSON.stringify({ 
          ok: false, 
          error: `ManyChat API error: ${manychatRes.status}`,
          details: manychatResText
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const manychatData = JSON.parse(manychatResText);
    const messageId = manychatData.message_id || manychatData.id || 'unknown';

    await supabase
      .from('metrics')
      .insert({
        metric_type: 'whatsapp_link_dispatched',
        platform: 'manychat',
        status: 'sent',
        patient_email: payload.patient_email,
        metadata: {
          request_id: requestId,
          phone: payload.phone_e164,
          contact_id: payload.contact_id,
          service_name: payload.service_name,
          redirect_url: payload.redirect_url,
          order_id: payload.order_id || null,
          message_id: messageId,
          use_template: USE_TEMPLATE,
          timestamp: new Date().toISOString()
        }
      });

    console.log(JSON.stringify({
      request_id: requestId,
      event: 'message_sent',
      message_id: messageId,
      order_id: payload.order_id
    }));

    return new Response(
      JSON.stringify({ 
        ok: true, 
        message_id: messageId,
        order_id: payload.order_id || null
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[mc-send-consultation-link] Exception:', error);
    return new Response(
      JSON.stringify({ ok: false, error: error.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
