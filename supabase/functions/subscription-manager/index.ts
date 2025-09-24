import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  console.log(`[SUBSCRIPTION-MANAGER] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || "", {
      apiVersion: "2023-10-16",
    });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authentication required");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");

    const { operation } = await req.json();
    logStep('Operation requested', { operation, user: user.email });

    switch (operation) {
      case 'check_subscription':
        return await checkSubscription(user, stripe, supabaseClient);
      case 'get_discount':
        return await getDiscount(user, stripe, supabaseClient);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }

  } catch (error: any) {
    logStep('ERROR', { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function checkSubscription(user: any, stripe: any, supabase: any) {
  logStep('Checking subscription', { user: user.email });

  // Check if customer exists in Stripe
  const customers = await stripe.customers.list({ 
    email: user.email, 
    limit: 1 
  });

  if (customers.data.length === 0) {
    logStep('No customer found');
    return new Response(JSON.stringify({ 
      subscribed: false,
      subscription_tier: null,
      subscription_end: null 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const customerId = customers.data[0].id;
  
  // Check for active subscriptions
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 1,
  });

  const hasActiveSub = subscriptions.data.length > 0;
  let subscriptionTier = null;
  let subscriptionEnd = null;

  if (hasActiveSub) {
    const subscription = subscriptions.data[0];
    subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
    
    // Determine subscription tier from price
    const priceId = subscription.items.data[0].price.id;
    const price = await stripe.prices.retrieve(priceId);
    const amount = price.unit_amount || 0;
    
    if (amount <= 999) {
      subscriptionTier = "BASICO";
    } else if (amount <= 1999) {
      subscriptionTier = "FAMILIAR";
    } else {
      subscriptionTier = "PREMIUM";
    }
    
    logStep('Active subscription found', { 
      subscriptionTier, 
      endDate: subscriptionEnd 
    });
  }

  // Google Sheets logging removed

  return new Response(JSON.stringify({
    subscribed: hasActiveSub,
    subscription_tier: subscriptionTier,
    subscription_end: subscriptionEnd
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Google Sheets integration removed

async function getDiscount(user: any, stripe: any, supabase: any) {
  logStep('Getting discount info', { user: user.email });

  const subscriptionData = await checkSubscription(user, stripe, supabase);
  const subscription = await subscriptionData.json();

  let discount = 0;
  if (subscription.subscribed) {
    switch (subscription.subscription_tier) {
      case 'BASICO':
        discount = 0.10; // 10%
        break;
      case 'FAMILIAR':
        discount = 0.20; // 20%
        break;
      case 'PREMIUM':
        discount = 0.30; // 30%
        break;
    }
  }

  return new Response(JSON.stringify({
    ...subscription,
    discount_percentage: discount
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}