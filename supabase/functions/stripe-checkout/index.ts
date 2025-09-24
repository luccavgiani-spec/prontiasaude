import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckoutRequest {
  mode: 'payment' | 'subscription';
  price_id?: string;
  email: string;
  product_name?: string;
  product_sku?: string;
  plan_name?: string;
  plan_code?: string;
  plan_duration_months?: number;
  success_url?: string;
  cancel_url?: string;
  // Novos campos para agendamentos
  appointment_id?: string;
  service_code?: string;
  start_at_local?: string;
  duration_min?: number;
  order_id?: string;
}

// Google Sheets integration removed
const SITE_BASE_URL = 'https://prontiasaude.com.br';

const logStep = (step: string, details?: any) => {
  console.log(`[STRIPE-CHECKOUT] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

// Function to check if user has an active subscription
async function checkActiveSubscription(email: string, stripe: Stripe): Promise<boolean> {
  try {
    logStep('Checking active subscription for user', { email });
    
    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length === 0) {
      logStep('No Stripe customer found');
      return false;
    }
    
    const customerId = customers.data[0].id;
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    
    const hasActiveSub = subscriptions.data.length > 0;
    logStep('Subscription check result', { hasActiveSub, customerId });
    
    return hasActiveSub;
  } catch (error: any) {
    logStep('Error checking subscription', { error: error.message });
    return false;
  }
}

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
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    // Get user if authenticated (optional for some checkouts)
    let user = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: userData } = await supabaseClient.auth.getUser(token);
      user = userData.user;
    }

    const checkoutData: CheckoutRequest = await req.json();
    logStep('Checkout requested', { 
      mode: checkoutData.mode,
      email: checkoutData.email,
      user: user?.email 
    });

    // Check for existing customer
    const customers = await stripe.customers.list({ 
      email: checkoutData.email, 
      limit: 1 
    });

    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep('Found existing customer', { customerId });
    }

    // Check if user has active subscription for discount calculation
    let hasActiveSubscription = false;
    if (user && checkoutData.mode === 'payment' && checkoutData.price_id) {
      hasActiveSubscription = await checkActiveSubscription(checkoutData.email, stripe);
    }

    // Function to calculate subscription discount based on duration
    const getSubscriptionDiscount = (durationMonths?: number): { percentage: number; multiplier: number } => {
      switch (durationMonths) {
        case 3:  return { percentage: 10, multiplier: 0.90 }; // 10% desconto
        case 6:  return { percentage: 20, multiplier: 0.80 }; // 20% desconto  
        case 12: return { percentage: 40, multiplier: 0.60 }; // 40% desconto
        default: return { percentage: 0, multiplier: 1.00 };   // Sem desconto
      }
    };

    // Create line items based on mode and subscription status
    let lineItems;
    
    if (checkoutData.price_id && checkoutData.mode === 'payment' && hasActiveSubscription) {
      // Apply 45% discount for active subscribers on services
      logStep('Applying 45% discount for active subscriber');
      
      // Get original price from Stripe
      const price = await stripe.prices.retrieve(checkoutData.price_id);
      const originalAmount = price.unit_amount || 0;
      const discountedAmount = Math.round(originalAmount * 0.55); // 45% discount = pay 55%
      
      logStep('Discount calculation', { 
        originalAmount, 
        discountedAmount,
        discountPercent: 45
      });
      
      lineItems = [{
        price_data: {
          currency: 'brl',
          product_data: { 
            name: `${checkoutData.product_name || 'Serviço'} (45% desconto)`,
          },
          unit_amount: discountedAmount,
        },
        quantity: 1,
      }];
    } else if (checkoutData.price_id && checkoutData.mode === 'subscription' && checkoutData.plan_duration_months) {
      // Apply duration-based discount for subscription plans
      const discount = getSubscriptionDiscount(checkoutData.plan_duration_months);
      
      if (discount.percentage > 0) {
        logStep('Applying subscription duration discount', { 
          duration: checkoutData.plan_duration_months,
          discountPercent: discount.percentage 
        });
        
        // Get original price from Stripe
        const price = await stripe.prices.retrieve(checkoutData.price_id);
        const originalAmount = price.unit_amount || 0;
        const discountedAmount = Math.round(originalAmount * discount.multiplier);
        
        logStep('Subscription discount calculation', { 
          originalAmount, 
          discountedAmount,
          discountPercent: discount.percentage,
          duration: checkoutData.plan_duration_months
        });
        
        lineItems = [{
          price_data: {
            currency: 'brl',
            product_data: { 
              name: `${checkoutData.plan_name || checkoutData.product_name || 'Plano'} (${discount.percentage}% desconto)`,
            },
            unit_amount: discountedAmount,
            recurring: {
              interval: 'month',
              interval_count: 1,
            },
          },
          quantity: 1,
        }];
      } else {
        // No discount, use original price_id
        lineItems = [{
          price: checkoutData.price_id,
          quantity: 1,
        }];
      }
    } else if (checkoutData.price_id) {
      // Use Price ID for regular payments and subscriptions without discount
      lineItems = [{
        price: checkoutData.price_id,
        quantity: 1,
      }];
    } else {
      // Fallback with price_data for cases without price_id
      lineItems = [{
        price_data: {
          currency: 'brl',
          product_data: { 
            name: checkoutData.product_name || 'Produto',
          },
          unit_amount: 1000, // Fallback value - should use price_id instead
        },
        quantity: 1,
      }];
    }

    const origin = req.headers.get("origin") || SITE_BASE_URL;
    
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : checkoutData.email,
      line_items: lineItems,
      mode: checkoutData.mode,
      success_url: checkoutData.success_url || `${SITE_BASE_URL}/confirmacao?session_id={CHECKOUT_SESSION_ID}&email=${encodeURIComponent(checkoutData.email)}`,
      cancel_url: checkoutData.cancel_url || `${SITE_BASE_URL}/servicos?cancel=1`,
      phone_number_collection: {
        enabled: true,
      },
      metadata: {
        user_id: user?.id || '',
        product_sku: checkoutData.product_sku || '',
        plan_code: checkoutData.plan_code || '',
        // Metadata para webhook (OBRIGATÓRIO - novo fluxo automático)
        email: checkoutData.email,
        service_code: checkoutData.service_code || 'CONSULTA_CLINICA',
        duration_min: checkoutData.duration_min ? String(checkoutData.duration_min) : '30',
      },
    });

    logStep('Checkout session created', { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ 
      sessionId: session.id,
      url: session.url 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    logStep('ERROR', { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Google Sheets integration removed