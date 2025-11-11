import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

export default function ClickLifeSSO() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(true);

  useEffect(() => {
    const validateAndRedirect = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setError('Token não fornecido');
        setValidating(false);
        return;
      }

      try {
        console.log('[ClickLifeSSO] Validando token...');

        const { data, error: invokeError } = await supabase.functions.invoke('validate-sso-token', {
          body: { token }
        });

        if (invokeError || !data?.ok) {
          throw new Error(data?.error || 'Token inválido');
        }

        console.log('[ClickLifeSSO] Token validado, redirecionando...');

        // Remove token from URL history
        window.history.replaceState(null, '', '/sso');

        // Redirect to ClickLife with validated token
        const clicklifeUrl = `https://app.clicklifesaude.com/preconsulta?token=${data.clicklife_token}`;
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        window.location.href = clicklifeUrl;

      } catch (err: any) {
        console.error('[ClickLifeSSO] Erro:', err);
        setError(err.message || 'Erro ao processar login automático');
        setValidating(false);
      }
    };

    validateAndRedirect();
  }, [searchParams]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="max-w-md w-full bg-card shadow-lg rounded-lg p-8 text-center">
          <div className="text-destructive text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-foreground mb-4">Erro no Login</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <button
            onClick={() => navigate('/entrar')}
            className="bg-primary text-primary-foreground px-6 py-2 rounded-lg hover:bg-primary/90 transition"
          >
            Voltar para Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full bg-card shadow-lg rounded-lg p-8 text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-6"></div>
        <h1 className="text-2xl font-bold text-foreground mb-2">Acessando sua consulta...</h1>
        <p className="text-muted-foreground">Aguarde enquanto fazemos login automaticamente.</p>
        <p className="text-sm text-muted-foreground/60 mt-4">Você será redirecionado em instantes.</p>
      </div>
    </div>
  );
}
