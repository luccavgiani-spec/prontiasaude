import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edge-functions';

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
  maxAttempts = 60, // Aumentado de 20 para 60 (3 minutos de polling para PIX)
  intervalMs = 3000
}: UsePaymentRedirectOptions) {
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const attemptsRef = useRef(0);
  const isMountedRef = useRef(true);
  const hasFoundUrlRef = useRef(false);

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Limpar interval anterior
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!enabled || (!orderId && !email && !paymentId)) {
      return;
    }

    // Reset state quando parâmetros mudam
    attemptsRef.current = 0;
    hasFoundUrlRef.current = false;
    setAttempts(0);
    setIsChecking(true);
    setRedirectUrl(null);

    const checkForPayment = async () => {
      if (!isMountedRef.current || hasFoundUrlRef.current) return;
      
      if (attemptsRef.current >= maxAttempts) {
        console.log('[usePaymentRedirect] Max attempts reached');
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (isMountedRef.current) setIsChecking(false);
        return;
      }

      attemptsRef.current++;
      if (isMountedRef.current) setAttempts(attemptsRef.current);
      
      try {
        console.log('[usePaymentRedirect] Checking payment status...', { 
          orderId, paymentId, email, attempt: attemptsRef.current 
        });

        // Estratégia 1: check-payment-status (cria appointment se aprovado)
        // ✅ CORREÇÃO: Usar invokeEdgeFunction para garantir chamada ao projeto correto (ploqujuhpwutpcibedbr)
        if (paymentId || orderId) {
          const { data, error } = await invokeEdgeFunction<{
            approved?: boolean;
            redirect_url?: string;
            status?: string;
          }>('check-payment-status', {
            body: { 
              payment_id: paymentId,
              order_id: orderId,
              email: email
            }
          });

          if (!error && data?.approved && data?.redirect_url) {
            console.log('[usePaymentRedirect] ✅ Payment approved!', data.redirect_url);
            hasFoundUrlRef.current = true;
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }
            if (isMountedRef.current) {
              setRedirectUrl(data.redirect_url);
              setIsChecking(false);
            }
            return;
          }
          
          // Log status para debug
          if (data?.status) {
            console.log('[usePaymentRedirect] Status:', data.status);
          }
        }

        // Estratégia 2: Buscar appointment direto (fallback)
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

        const { data: appointmentData } = await query;

        if (appointmentData?.[0]?.redirect_url) {
          console.log('[usePaymentRedirect] ✅ Appointment found!', appointmentData[0].redirect_url);
          hasFoundUrlRef.current = true;
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          if (isMountedRef.current) {
            setRedirectUrl(appointmentData[0].redirect_url);
            setIsChecking(false);
          }
        }
      } catch (err) {
        console.error('[usePaymentRedirect] Exception:', err);
      }
    };

    // Initial check
    checkForPayment();

    // Set up interval (só se ainda não encontrou URL)
    intervalRef.current = setInterval(checkForPayment, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [orderId, email, paymentId, enabled, maxAttempts, intervalMs]); // REMOVIDO 'attempts'

  return {
    redirectUrl,
    isChecking: isChecking && !redirectUrl,
    hasTimedOut: attempts >= maxAttempts && !redirectUrl,
    attempts
  };
}
