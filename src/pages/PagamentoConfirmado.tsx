import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { transformToGASPayload } from '@/lib/payload-transform';

const SUPABASE_URL = 'https://ploqujuhpwutpcibedbr.supabase.co';

async function callNotifyViaProxy(path: string, payload: any) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/gas-proxy?path=${encodeURIComponent(path)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    mode: 'cors',
    credentials: 'omit',
  });

  let data: any = null;
  try { data = await res.json(); } catch {}
  return { ok: res.ok, status: res.status, data };
}

export default function PagamentoConfirmado() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isRetrying, setIsRetrying] = useState(false);

  const payment_id = searchParams.get('payment_id');
  const order_id = searchParams.get('order_id');
  const email = searchParams.get('email') || '';
  const cpf = (searchParams.get('cpf') || '').replace(/\D/g, '');
  const sku = searchParams.get('sku') || 'ITC6534';

  const handleRetry = async () => {
    if (!payment_id) {
      toast.error('ID de pagamento não encontrado');
      return;
    }

    setIsRetrying(true);
    
    try {
      const body = transformToGASPayload({
        payment_id,
        payment_status: 'approved',
        sku,
        amount: 4390, // fallback genérico (43.90 * 100)
        cpf,
        email,
        name: '', // não disponível via searchParams
        phone: '', // não disponível via searchParams
        especialidade: 'Clínico Geral',
        horario_iso: new Date().toISOString(),
        plano_ativo: false
      });

      console.log('[handleRetry] Request body:', body);

      const { ok, status, data } = await callNotifyViaProxy('lovable-payment-notify', body);
      console.log('[handleRetry] Response status/data:', status, data);

      if (ok && data?.success && data?.redirectUrl) {
        toast.success('Redirecionando...');
        window.location.href = data.redirectUrl;
      } else {
        // ✅ Permanece na página mostrando erro
        const errorMsg = data?.error || data?.message || 'Pagamento ainda não compensou. Tente novamente em instantes.';
        console.error('[NOTIFY ERROR]', {
          payment_id,
          error: data?.error,
          message: data?.message,
          full_response: data
        });
        toast.error(errorMsg);
        setIsRetrying(false);
      }
    } catch (err) {
      console.error('[handleRetry] Error:', err);
      toast.error('Erro ao processar. Tente novamente.');
      setIsRetrying(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="max-w-md w-full bg-card rounded-xl shadow-lg p-8 text-center space-y-6">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-green-600">
          Pagamento Confirmado!
        </h1>
        
        <p className="text-muted-foreground">
          Seu pagamento foi processado com sucesso. Você será redirecionado para o atendimento em instantes.
        </p>

        {payment_id && (
          <p className="text-xs text-muted-foreground">
            ID do pagamento: {payment_id}
          </p>
        )}

        <div className="space-y-2 pt-4">
          <Button 
            onClick={handleRetry} 
            className="w-full"
            disabled={isRetrying}
          >
            {isRetrying ? 'Processando...' : 'Acessar Atendimento'}
          </Button>
          
          <Button 
            onClick={() => navigate('/paciente')} 
            variant="outline" 
            className="w-full"
          >
            Ir para Área do Paciente
          </Button>
          
          <Button 
            onClick={() => navigate('/')} 
            variant="ghost" 
            className="w-full"
          >
            Voltar ao início
          </Button>
        </div>

        <p className="text-xs text-muted-foreground pt-4">
          Se não for redirecionado automaticamente, clique em "Acessar Atendimento" acima.
        </p>
      </div>
    </div>
  );
}
