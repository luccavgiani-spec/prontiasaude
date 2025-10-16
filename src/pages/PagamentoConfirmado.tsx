import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { GAS_BASE_ROUTE_URL } from '@/lib/constants';

export default function PagamentoConfirmado() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'timeout'>('loading');
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);

  const payment_id = searchParams.get('payment_id');
  const order_id = searchParams.get('order_id');

  useEffect(() => {
    if (!payment_id || !order_id) {
      navigate('/');
      return;
    }

    // Polling para obter redirect_url do Apps Script
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(
          `${GAS_BASE_ROUTE_URL}?path=route&payment_id=${payment_id}`
        );
        const data = await response.json();

        if (data.redirect_url) {
          setRedirectUrl(data.redirect_url);
          setStatus('success');
          clearInterval(pollInterval);
          
          // Redirecionar após 2 segundos
          setTimeout(() => {
            window.location.href = data.redirect_url;
          }, 2000);
        }
      } catch (error) {
        console.error('[Polling] Error:', error);
      }
    }, 3000); // Poll a cada 3 segundos

    // Countdown timer
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          clearInterval(pollInterval);
          setStatus('timeout');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Cleanup
    return () => {
      clearInterval(pollInterval);
      clearInterval(countdownInterval);
    };
  }, [payment_id, order_id, navigate]);

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="max-w-md w-full bg-card rounded-xl shadow-lg p-8 text-center space-y-6">
        {status === 'loading' && (
          <>
            <div className="flex justify-center">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Pagamento aprovado!
            </h1>
            <p className="text-muted-foreground">
              Preparando seu atendimento...
            </p>
            <div className="text-4xl font-bold text-primary">
              {countdown}s
            </div>
            <p className="text-sm text-muted-foreground">
              Aguarde enquanto processamos sua solicitação
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-green-600">
              Tudo certo!
            </h1>
            <p className="text-muted-foreground">
              Redirecionando para sua consulta...
            </p>
            {redirectUrl && (
              <p className="text-xs text-muted-foreground break-all">
                {redirectUrl}
              </p>
            )}
          </>
        )}

        {status === 'timeout' && (
          <>
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-orange-100 flex items-center justify-center">
                <XCircle className="h-10 w-10 text-orange-600" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Tempo esgotado
            </h1>
            <p className="text-muted-foreground">
              Ainda estamos processando seu pagamento. Por favor, aguarde alguns instantes e tente novamente.
            </p>
            <div className="space-y-2">
              <Button onClick={handleRetry} className="w-full">
                Tentar novamente
              </Button>
              <Button onClick={() => navigate('/')} variant="outline" className="w-full">
                Voltar ao início
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Se o problema persistir, entre em contato com nosso suporte.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
