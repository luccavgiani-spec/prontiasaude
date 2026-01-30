import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ensurePatientRow } from '@/lib/patients';
import { trackPurchase } from '@/lib/meta-tracking';
import { Loader2 } from "lucide-react";
import { getHybridSession, supabaseProductionAuth } from '@/lib/auth-hybrid';
import { supabaseProduction } from '@/lib/supabase-production';
import { invokeCloudEdgeFunction } from '@/lib/edge-functions';

const AuthCallback = () => {
  useEffect(() => {
    (async () => {
      // ✅ HÍBRIDO: Verificar sessão em ambos os ambientes
      let session = null;
      let authEnvironment: 'cloud' | 'production' | null = null;
      let attempts = 0;
      const maxAttempts = 30; // 3 segundos (100ms * 30)
      
      // Verificar qual ambiente usar (pode vir do sessionStorage)
      const savedEnvironment = sessionStorage.getItem('auth_environment') as 'cloud' | 'production' | null;
      
      while (!session && attempts < maxAttempts) {
        const hybridResult = await getHybridSession();
        session = hybridResult.session;
        authEnvironment = hybridResult.environment;
        
        if (!session) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
      }
      
      // Se não encontrou sessão híbrida, usar ambiente salvo
      if (!session && savedEnvironment) {
        authEnvironment = savedEnvironment;
        if (savedEnvironment === 'production') {
          const { data } = await supabaseProductionAuth.auth.getSession();
          session = data.session;
        } else {
          const { data } = await supabase.auth.getSession();
          session = data.session;
        }
      }
      
      if (!session?.user?.id) {
        console.error('No session after', attempts, 'attempts');
        window.location.replace('/entrar');
        return;
      }
      
      console.log('[AuthCallback] Session found via:', authEnvironment);
      
      // ✅ CRÍTICO: Verificar tokens de convite ANTES de qualquer redirecionamento
      // Verificar sessionStorage E localStorage (redundância)
      const pendingFamilyToken = sessionStorage.getItem('pending_family_invite_token')
        || localStorage.getItem('pending_family_invite_token');
      if (pendingFamilyToken) {
        sessionStorage.removeItem('pending_family_invite_token');
        localStorage.removeItem('pending_family_invite_token');
        console.log('[AuthCallback] Redirecting to complete family invite');
        window.location.replace(`/completar-perfil?token_familiar=${pendingFamilyToken}`);
        return;
      }
      
      const pendingToken = sessionStorage.getItem('pending_invite_token')
        || localStorage.getItem('pending_invite_token');
      if (pendingToken) {
        sessionStorage.removeItem('pending_invite_token');
        localStorage.removeItem('pending_invite_token');
        console.log('[AuthCallback] Redirecting to complete employee invite');
        window.location.replace(`/completar-perfil?token=${pendingToken}`);
        return;
      }
      
try {
  // ✅ HÍBRIDO: Usar cliente correto baseado no ambiente
  const patientDbClient = authEnvironment === 'production' ? supabaseProductionAuth : supabase;
  await ensurePatientRow(session.user.id, patientDbClient);
} catch (e) {
  console.error('ensurePatientRow error:', e);
}

// ✅ FALLBACK: Se login foi via Cloud (Google OAuth), garantir que existe na Produção
if (authEnvironment === 'cloud' && session?.user?.email) {
  try {
    console.log('[AuthCallback] Sincronizando usuário Cloud com Produção...');
    invokeCloudEdgeFunction('sync-google-user', {
      body: {
        email: session.user.email,
        cloudUserId: session.user.id,
        metadata: {
          first_name: session.user.user_metadata?.given_name || session.user.user_metadata?.first_name,
          last_name: session.user.user_metadata?.family_name || session.user.user_metadata?.last_name,
        }
      }
    }).then(result => {
      if (result.error) {
        console.warn('[AuthCallback] Sync to production failed (non-critical):', result.error);
      } else {
        console.log('[AuthCallback] ✅ User synced to production:', result.data);
      }
    }).catch(e => {
      console.warn('[AuthCallback] Sync to production failed:', e);
    });
  } catch (e) {
    console.warn('[AuthCallback] Error initiating sync:', e);
  }
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

      // ✅ HÍBRIDO: Usar cliente correto baseado no ambiente de autenticação
      const dbClient = authEnvironment === 'production' ? supabaseProduction : supabase;

      // ✅ Verificar se é admin de empresa
      const { data: companyCredentials } = await dbClient
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
      // Tentar em ambos os ambientes para encontrar o paciente
      let patientData = null;
      
      // Primeiro, tentar no ambiente atual
      const { data: currentEnvData } = await dbClient
        .from('patients')
        .select('profile_complete')
        .eq('user_id', session.user.id)
        .maybeSingle();
      
      patientData = currentEnvData;
      
      // Se não encontrou, tentar no outro ambiente
      if (!patientData) {
        const otherClient = authEnvironment === 'production' ? supabase : supabaseProduction;
        const { data: otherEnvData } = await otherClient
          .from('patients')
          .select('profile_complete')
          .eq('user_id', session.user.id)
          .maybeSingle();
        patientData = otherEnvData;
      }

      if (!patientData?.profile_complete) {
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