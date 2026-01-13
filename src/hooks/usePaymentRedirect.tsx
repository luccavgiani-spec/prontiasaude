import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UsePaymentRedirectOptions {
  orderId?: string;
  email?: string;
  paymentId?: string;
  enabled?: boolean;
  maxAttempts?: number;
  intervalMs?: number;
}

export function usePaymentRedirect({
  orderId,
  email,
  paymentId,
  enabled = true,
  maxAttempts = 20,
  intervalMs = 3000
}: UsePaymentRedirectOptions) {
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled || (!orderId && !email && !paymentId) || attempts >= maxAttempts) {
      return;
    }

    setIsChecking(true);

    const checkForPayment = async () => {
      try {
        console.log('[usePaymentRedirect] Checking payment status...', { orderId, paymentId, email, attempt: attempts + 1 });

        // Estratégia 1: Chamar check-payment-status para verificar E criar appointment se aprovado
        if (paymentId || orderId) {
          const { data, error } = await supabase.functions.invoke('check-payment-status', {
            body: { 
              payment_id: paymentId,
              order_id: orderId,
              email: email
            }
          });

          if (!error && data?.approved && data?.redirect_url) {
            console.log('[usePaymentRedirect] ✅ Payment approved! Redirect URL:', data.redirect_url);
            setRedirectUrl(data.redirect_url);
            setIsChecking(false);
            if (intervalRef.current) clearInterval(intervalRef.current);
            return;
          }
          
          // Se não aprovado ainda, incrementar tentativas
          if (data?.status === 'pending') {
            console.log('[usePaymentRedirect] ⏳ Payment still pending...');
            setAttempts((prev) => prev + 1);
            return;
          }
        }

        // Estratégia 2: Buscar appointment direto no banco (fallback)
        let query = supabase
          .from('appointments')
          .select('redirect_url, created_at, order_id')
          .not('redirect_url', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1);

        if (orderId) {
          query = query.eq('order_id', orderId);
        } else if (email) {
          query = query.eq('email', email);
        }

        const { data: appointmentData, error: appointmentError } = await query;

        if (appointmentError) {
          console.error('[usePaymentRedirect] Error checking appointment:', appointmentError);
          setAttempts((prev) => prev + 1);
          return;
        }

        if (appointmentData && appointmentData.length > 0 && appointmentData[0].redirect_url) {
          console.log('[usePaymentRedirect] ✅ Appointment found! Redirect URL:', appointmentData[0].redirect_url);
          setRedirectUrl(appointmentData[0].redirect_url);
          setIsChecking(false);
          if (intervalRef.current) clearInterval(intervalRef.current);
        } else {
          setAttempts((prev) => prev + 1);
        }
      } catch (err) {
        console.error('[usePaymentRedirect] Exception:', err);
        setAttempts((prev) => prev + 1);
      }
    };

    // Initial check
    checkForPayment();

    // Set up interval
    intervalRef.current = setInterval(checkForPayment, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      setIsChecking(false);
    };
  }, [orderId, email, paymentId, enabled, attempts, maxAttempts, intervalMs]);

  return {
    redirectUrl,
    isChecking: isChecking && !redirectUrl,
    hasTimedOut: attempts >= maxAttempts && !redirectUrl,
    attempts
  };
}
