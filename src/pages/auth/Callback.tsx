import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ensurePatientRow } from '@/lib/patients';
import { trackPurchase } from '@/lib/meta-tracking';
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        window.location.replace('/entrar');
        return;
      }
      try {
        await ensurePatientRow(session.user.id);
      } catch (e) {
        console.error('ensurePatientRow error:', e);
      }

      // Check if this is a successful payment redirect (from Stripe)
      const urlParams = new URLSearchParams(window.location.search);
      const sessionId = urlParams.get('session_id');
      const purchaseType = urlParams.get('purchase_type'); // 'servico' or 'plano'
      const productName = urlParams.get('product_name');
      const productValue = urlParams.get('value');
      const orderId = urlParams.get('order_id');

      // Track Purchase event if payment was successful
      if (sessionId && productValue && orderId) {
        trackPurchase({
          value: parseFloat(productValue),
          order_id: orderId,
          content_name: productName || 'Compra',
          content_category: purchaseType === 'plano' ? 'plano_assinatura' : 'servico_medico',
          contents: [{
            id: orderId,
            quantity: 1,
            item_price: parseFloat(productValue),
          }],
        });
      }

      // Busca flags pra decidir o redirecionamento
      const { data, error } = await supabase
        .from('patients')
        .select('profile_complete,intake_complete')
        .eq('id', session.user.id)
        .maybeSingle();

      if (error) {
        console.error('Fetch patient flags error:', error);
        window.location.replace('/completar-perfil');
        return;
      }

      if (!data?.profile_complete) {
        window.location.replace('/completar-perfil');
      } else {
        window.location.replace('/area-do-paciente');
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Processando autenticação...</p>
      </div>
    </div>
  );
};

export default AuthCallback;