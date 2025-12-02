import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ensurePatientRow } from '@/lib/patients';
import { trackPurchase } from '@/lib/meta-tracking';
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  useEffect(() => {
    (async () => {
      // ✅ Tentar obter sessão com retry (até 3 segundos)
      let session = null;
      let attempts = 0;
      const maxAttempts = 30; // 3 segundos (100ms * 30)
      
      while (!session && attempts < maxAttempts) {
        const { data } = await supabase.auth.getSession();
        session = data.session;
        
        if (!session) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
      }
      
      if (!session?.user?.id) {
        console.error('No session after', attempts, 'attempts');
        window.location.replace('/entrar');
        return;
      }
      
      try {
        await ensurePatientRow(session.user.id);
      } catch (e) {
        console.error('ensurePatientRow error:', e);
      }

      // Check if this is a successful payment redirect (from Mercado Pago)
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

      // ✅ Verificar se é admin de empresa ANTES de verificar profile_complete
      const { data: companyCredentials } = await supabase
        .from('company_credentials')
        .select('company_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (companyCredentials?.company_id) {
        console.log('User is company admin, redirecting to /empresa');
        window.location.replace('/empresa');
        return;
      }

      // Busca flags pra decidir o redirecionamento (fluxo paciente)
      const { data, error } = await supabase
        .from('patients')
        .select('profile_complete')
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