import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, Copy, QrCode } from 'lucide-react';
import { toast } from 'sonner';

interface PixPaymentFormProps {
  qrCode: string;
  qrCodeBase64: string;
  onCancel: () => void;
  onAccessAttendance?: () => void;
  isProcessing?: boolean;
}

export function PixPaymentForm({ qrCode, qrCodeBase64, onCancel, onAccessAttendance, isProcessing }: PixPaymentFormProps) {
  const [copied, setCopied] = useState(false);

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

      {/* Botão de acesso ao atendimento */}
      {onAccessAttendance && (
        <Button
          type="button"
          onClick={onAccessAttendance}
          className="w-full"
          size="lg"
          disabled={isProcessing}
        >
          {isProcessing ? 'Processando...' : 'Acessar atendimento'}
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
