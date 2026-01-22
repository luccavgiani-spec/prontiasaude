import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Check, Copy, QrCode, RefreshCw, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { usePaymentRedirect } from '@/hooks/usePaymentRedirect';

interface PixPaymentFormProps {
  qrCode: string;
  qrCodeBase64: string;
  redirectUrl?: string;
  onCancel: () => void;
  paymentId?: string;
  orderId?: string;
  email?: string;
}

export function PixPaymentForm({ qrCode, qrCodeBase64, redirectUrl, onCancel, paymentId, orderId, email }: PixPaymentFormProps) {
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // ✅ CORREÇÃO: Aumentar tempo de polling para PIX (6 minutos = 120 tentativas x 3s)
  // Hook para polling automático - chama check-payment-status ativamente
  const { redirectUrl: autoRedirectUrl, isChecking, attempts, hasTimedOut } = usePaymentRedirect({
    orderId,
    email,
    paymentId,
    enabled: !redirectUrl && (!!orderId || !!email || !!paymentId),
    maxAttempts: 120, // 6 minutos de polling (120 x 3s = 360s)
    intervalMs: 3000  // Verificar a cada 3 segundos
  });

  // Atualizar progress bar baseado nas tentativas
  useEffect(() => {
    if (isChecking && attempts > 0) {
      // Calcular progresso: 0% a 95% durante polling (nunca 100% até confirmar)
      const percentage = Math.min((attempts / 120) * 95, 95);
      setProgress(percentage);
    } else if (redirectUrl || autoRedirectUrl) {
      setProgress(100);
    }
  }, [attempts, isChecking, redirectUrl, autoRedirectUrl]);

  // Redirecionar quando URL estiver disponível (de qualquer fonte)
  useEffect(() => {
    const url = autoRedirectUrl || redirectUrl;
    if (url) {
      console.log('[PixPaymentForm] ✅ Redirect URL detected, redirecting to:', url);
      toast.success('Pagamento confirmado! Redirecionando...');
      // Redirecionar mais rápido
      setTimeout(() => {
        window.location.href = url;
      }, 800);
    }
  }, [autoRedirectUrl, redirectUrl]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(qrCode);
      setCopied(true);
      toast.success('Código PIX copiado!');
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      toast.error('Erro ao copiar código');
    }
  };

  const handleCheckPaymentStatus = async () => {
    if (!paymentId && !orderId) {
      toast.error('Dados de pagamento não disponíveis');
      return;
    }

    setChecking(true);
    
    try {
      console.log('[PixPaymentForm] Verificando status do pagamento:', { paymentId, orderId, email });
      
      const { data, error } = await supabase.functions.invoke('check-payment-status', {
        body: { 
          payment_id: paymentId,
          order_id: orderId,
          email: email
        }
      });

      if (error) {
        console.error('[PixPaymentForm] Erro ao verificar status:', error);
        toast.error('Erro ao verificar pagamento');
        return;
      }

      console.log('[PixPaymentForm] Resposta:', data);

      if (data.approved && data.redirect_url) {
        toast.success('Pagamento aprovado! Redirecionando...');
        setTimeout(() => {
          window.location.href = data.redirect_url;
        }, 1500);
      } else if (data.status === 'pending') {
        toast.info('Pagamento ainda pendente. Aguarde a compensação.');
      } else if (data.status === 'rejected') {
        toast.error('Pagamento rejeitado. Tente novamente.');
      } else {
        toast.warning(`Status: ${data.status}`);
      }
    } catch (error) {
      console.error('[PixPaymentForm] Exceção:', error);
      toast.error('Erro ao verificar pagamento');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ⚠️ AVISO IMPORTANTE - Não fechar aba */}
      <div className="bg-amber-50 border-2 border-amber-400 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <p className="font-bold text-amber-800 text-base">
              NÃO FECHE ESTA ABA!
            </p>
            <p className="text-sm text-amber-700 mt-1">
              Após realizar o pagamento PIX, você será redirecionado automaticamente para o atendimento. 
              Mantenha esta janela aberta.
            </p>
          </div>
        </div>
      </div>

      {/* QR Code Image */}
      <div className="flex flex-col items-center justify-center bg-white p-6 rounded-xl border-2 border-primary/20">
        <div className="mb-4 text-center">
          <QrCode className="h-8 w-8 text-primary mx-auto mb-2" />
          <h3 className="font-semibold text-lg">Pague com PIX</h3>
          <p className="text-sm text-muted-foreground">
            Escaneie o QR Code ou copie o código abaixo
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg border">
          <img 
            src={`data:image/png;base64,${qrCodeBase64}`} 
            alt="QR Code PIX" 
            className="w-64 h-64 mx-auto"
          />
        </div>
      </div>

      {/* PIX Code */}
      <div className="space-y-2">
        <label className="block text-sm font-medium">Código PIX Copia e Cola</label>
        <div className="flex gap-2">
          <div className="flex-1 p-3 bg-muted rounded-lg border text-sm font-mono break-all max-h-20 overflow-y-auto">
            {qrCode}
          </div>
        </div>
      </div>

      {/* Copy Button */}
      <Button
        type="button"
        onClick={handleCopyCode}
        variant="outline"
        className="w-full"
        size="lg"
      >
        {copied ? (
          <>
            <Check className="mr-2 h-4 w-4 text-green-600" />
            Copiado!
          </>
        ) : (
          <>
            <Copy className="mr-2 h-4 w-4" />
            Copiar Código PIX
          </>
        )}
      </Button>

      {/* Status com Progress Bar */}
      <div className="space-y-4">
        {/* Barra de Progresso */}
        {isChecking && !redirectUrl && !autoRedirectUrl && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-xs text-center text-muted-foreground">
              Verificando pagamento... ({Math.ceil(attempts * 3 / 60)} min)
            </p>
          </div>
        )}
        
        {/* Timeout message */}
        {hasTimedOut && !redirectUrl && !autoRedirectUrl && (
          <div className="rounded-lg p-4 text-center border-2 bg-yellow-50 border-yellow-200">
            <p className="text-sm text-yellow-700">
              Tempo limite atingido. Clique em "Verificar Status" ou acesse sua{' '}
              <a href="/area-do-paciente" className="text-primary hover:underline font-medium">
                Área do Paciente
              </a>.
            </p>
          </div>
        )}

        {/* Status Card */}
        <div className={`rounded-lg p-4 text-center border-2 transition-colors ${
          redirectUrl || autoRedirectUrl 
            ? 'bg-green-50 border-green-200' 
            : 'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-center justify-center gap-2 mb-2">
            {redirectUrl || autoRedirectUrl ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-700">Pagamento confirmado!</span>
              </>
            ) : (
              <>
                <Clock className="h-5 w-5 text-blue-600 animate-pulse" />
                <span className="font-medium text-blue-700">Aguardando pagamento...</span>
              </>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {redirectUrl || autoRedirectUrl 
              ? 'Redirecionando para o atendimento...'
              : 'Verificando status automaticamente a cada 3 segundos'
            }
          </p>
        </div>

        {/* Mensagem de fallback - apenas quando ainda aguardando */}
        {!redirectUrl && !autoRedirectUrl && (
          <p className="text-sm text-center text-muted-foreground mt-3">
            Caso não seja redirecionado automaticamente, entre na sua{' '}
            <a 
              href="/area-do-paciente" 
              className="text-primary hover:underline font-medium"
              target="_blank"
              rel="noopener noreferrer"
            >
              Área do Paciente
            </a>{' '}
            para acessar sua consulta.
          </p>
        )}
      </div>

      {/* Botão Verificar Status Manualmente */}
      {(paymentId || orderId) && !redirectUrl && (
        <Button
          type="button"
          onClick={handleCheckPaymentStatus}
          disabled={checking}
          variant="outline"
          className="w-full"
          size="lg"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Verificando...' : 'Verificar Status do Pagamento'}
        </Button>
      )}

      {/* Botão Acessar Atendimento - Apenas quando redirectUrl existir */}
      {redirectUrl && (
        <Button
          type="button"
          onClick={() => window.location.href = redirectUrl}
          className="w-full"
          size="lg"
        >
          Acessar Atendimento
        </Button>
      )}

      {/* Cancel */}
      <Button
        type="button"
        onClick={onCancel}
        variant="ghost"
        className="w-full"
      >
        Cancelar
      </Button>

      {/* Selo Mercado Pago */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <span>Ambiente seguro Mercado Pago</span>
      </div>
    </div>
  );
}
