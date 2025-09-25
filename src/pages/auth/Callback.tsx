import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ensurePatientRow } from '@/lib/patients';
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