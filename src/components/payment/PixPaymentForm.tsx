import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Copy, QrCode, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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

      {/* Status */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
        <div className="flex items-center justify-center gap-2 text-blue-700 mb-2">
          <div className="h-2 w-2 bg-blue-600 rounded-full animate-pulse" />
          <span className="font-medium">Aguardando pagamento...</span>
        </div>
        <p className="text-sm text-blue-600">
          O pagamento será confirmado automaticamente após a compensação
        </p>
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
