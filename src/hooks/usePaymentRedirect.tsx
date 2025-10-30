import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UsePaymentRedirectOptions {
  orderId?: string;
  email?: string;
  enabled?: boolean;
  maxAttempts?: number;
  intervalMs?: number;
}

export function usePaymentRedirect({
  orderId,
  email,
  enabled = true,
  maxAttempts = 20,
  intervalMs = 3000
}: UsePaymentRedirectOptions) {
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (!enabled || (!orderId && !email) || attempts >= maxAttempts) {
      return;
    }

    setIsChecking(true);

    const checkForAppointment = async () => {
      try {
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

        const { data, error } = await query;

        if (error) {
          console.error('[usePaymentRedirect] Error checking appointment:', error);
          return;
        }

        if (data && data.length > 0 && data[0].redirect_url) {
          console.log('[usePaymentRedirect] Redirect URL found:', data[0].redirect_url);
          setRedirectUrl(data[0].redirect_url);
          setIsChecking(false);
        } else {
          setAttempts((prev) => prev + 1);
        }
      } catch (err) {
        console.error('[usePaymentRedirect] Exception:', err);
        setAttempts((prev) => prev + 1);
      }
    };

    // Initial check
    checkForAppointment();

    // Set up interval
    const intervalId = setInterval(checkForAppointment, intervalMs);

    return () => {
      clearInterval(intervalId);
      setIsChecking(false);
    };
  }, [orderId, email, enabled, attempts, maxAttempts, intervalMs]);

  return {
    redirectUrl,
    isChecking: isChecking && !redirectUrl,
    hasTimedOut: attempts >= maxAttempts && !redirectUrl,
    attempts
  };
}
