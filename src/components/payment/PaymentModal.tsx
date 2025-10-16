import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, AlertCircle, CreditCard } from 'lucide-react';
import { validateCPF } from '@/lib/cpf-validator';
import { validatePhoneE164 } from '@/lib/validations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PixPaymentForm } from './PixPaymentForm';
import { MP_PUBLIC_KEY, GAS_BASE_ROUTE_URL } from '@/lib/constants';

declare global {
  interface Window {
    MercadoPago: any;
  }
}

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sku: string;
  serviceName: string;
  amount: number;
  especialidade?: string;
  recurring?: boolean;
  frequency?: number;
  frequencyType?: 'months' | 'days';
  onSuccess?: () => void;
}

type PaymentMethod = 'card' | 'pix';
type PaymentStatus = 'idle' | 'processing' | 'approved' | 'rejected' | 'pending_pix' | 'in_process';

interface FormData {
  name: string;
  email: string;
  cpf: string;
  phone: string;
}

interface PixData {
  qrCode: string;
  qrCodeBase64: string;
  paymentId: string;
}

export function PaymentModal({
  open,
  onOpenChange,
  sku,
  serviceName,
  amount,
  especialidade,
  recurring = false,
  frequency = 1,
  frequencyType = 'months',
  onSuccess
}: PaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    cpf: '',
    phone: ''
  });
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [error, setError] = useState<string>('');
  const [paymentId, setPaymentId] = useState<string>('');
  const [lastPaymentId, setLastPaymentId] = useState<string>('');
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  const [hasRequiredData, setHasRequiredData] = useState(false);
  
  const mpInstanceRef = useRef<any>(null);
  const cardPaymentBrickRef = useRef<any>(null);
  const isBrickMountedRef = useRef(false);

  // Carregar dados do usuário e inicializar MP quando modal abre
  useEffect(() => {
    if (open) {
      loadUserData();
      loadMercadoPagoSDK();
    } else {
      // Reset ao fechar
      setPaymentStatus('idle');
      setPixData(null);
      setError('');
      if (cardPaymentBrickRef.current) {
        cardPaymentBrickRef.current.unmount();
        cardPaymentBrickRef.current = null;
        isBrickMountedRef.current = false;
      }
    }
  }, [open]);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsUserLoggedIn(false);
        return;
      }

      setIsUserLoggedIn(true);

      const { data: patient } = await supabase
        .from('patients')
        .select('*')
        .eq('id', user.id)
        .single();

      if (patient) {
        const hasData = !!(
          patient.first_name &&
          patient.last_name &&
          patient.cpf &&
          patient.phone_e164 &&
          user.email
        );

        setHasRequiredData(hasData);

        if (hasData) {
          setFormData({
            name: `${patient.first_name} ${patient.last_name}`,
            email: user.email,
            cpf: patient.cpf,
            phone: patient.phone_e164
          });
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    }
  };

  const loadMercadoPagoSDK = () => {
    if (window.MercadoPago) {
      mpInstanceRef.current = new window.MercadoPago(MP_PUBLIC_KEY, {
        locale: 'pt-BR'
      });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.async = true;
    script.onload = () => {
      mpInstanceRef.current = new window.MercadoPago(MP_PUBLIC_KEY, {
        locale: 'pt-BR'
      });
    };
    document.body.appendChild(script);
  };

  // Montar Card Payment Brick quando método = cartão
  useEffect(() => {
    if (open && paymentMethod === 'card' && mpInstanceRef.current && !isBrickMountedRef.current) {
      mountCardPaymentBrick();
    }
  }, [open, paymentMethod, mpInstanceRef.current]);

  // Retry automático para PIX (a cada 20s)
  useEffect(() => {
    if (!lastPaymentId || paymentStatus !== 'pending_pix') return;
    
    console.log('[PIX Auto-retry] Starting interval for payment_id:', lastPaymentId);
    
    const interval = setInterval(() => {
      console.log('[PIX Auto-retry] Attempting notify call...');
      handlePixAccess();
    }, 20000); // 20 segundos
    
    return () => {
      console.log('[PIX Auto-retry] Clearing interval');
      clearInterval(interval);
    };
  }, [lastPaymentId, paymentStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const mountCardPaymentBrick = async () => {
    if (isBrickMountedRef.current || !mpInstanceRef.current) return;

    try {
      const bricksBuilder = mpInstanceRef.current.bricks();
      
      const cardPaymentBrick = await bricksBuilder.create('cardPayment', 'cardPaymentBrick', {
        initialization: {
          amount: amount / 100,
        },
        callbacks: {
          onReady: () => {
            console.log('Card Payment Brick pronto');
            isBrickMountedRef.current = true;
          },
          onSubmit: async (formData: any) => {
            await handleCardSubmit(formData);
          },
          onError: (error: any) => {
            console.error('Erro no Card Payment Brick:', error);
            setError('Erro ao processar pagamento. Tente novamente.');
          },
        },
      });

      cardPaymentBrickRef.current = cardPaymentBrick;
    } catch (err) {
      console.error('Erro ao montar brick:', err);
      setError('Erro ao carregar formulário de pagamento');
    }
  };

  const validateForm = (): boolean => {
    if (!formData.name || !formData.email || !formData.cpf || !formData.phone) {
      setError('Preencha todos os campos');
      return false;
    }

    if (!validateCPF(formData.cpf)) {
      setError('CPF inválido');
      return false;
    }

    if (!validatePhoneE164(formData.phone)) {
      setError('Telefone inválido');
      return false;
    }

    return true;
  };

  const buildSchedulePayload = () => {
    return {
      email: formData.email,
      cpf: (formData.cpf || '').replace(/\D/g, ''),
      nome: formData.name,
      telefone: formData.phone, // should be E.164 format (+55...)
      sku,
      especialidade: especialidade || 'Clínico Geral',
      plano_ativo: false,
      horario_iso: new Date().toISOString()
    };
  };

  const handleCardSubmit = async (cardFormData: any) => {
    if (!validateForm()) return;

    console.log('[handleCardSubmit] Card form data:', cardFormData);
    setPaymentStatus('processing');
    setError('');

    try {
      const orderId = `order_${Date.now()}`;
      const schedulePayload = buildSchedulePayload();
      
      const paymentRequest = {
        items: [{
          id: sku,
          title: serviceName,
          unit_price: amount / 100,
          quantity: 1
        }],
        payer: {
          email: formData.email,
          first_name: formData.name.split(' ')[0],
          last_name: formData.name.split(' ').slice(1).join(' '),
          identification: {
            type: 'CPF',
            number: formData.cpf.replace(/\D/g, '')
          }
        },
        token: cardFormData.token,
        payment_method_id: cardFormData.payment_method_id,
        installments: cardFormData.installments,
        metadata: {
          order_id: orderId,
          schedulePayload
        }
      };

      console.log('[handleCardSubmit] Payment request:', paymentRequest);

      const { data, error } = await supabase.functions.invoke('mp-create-payment', {
        body: paymentRequest
      });

      if (error) throw error;

      console.log('[handleCardSubmit] Payment creation response:', data);

      if (data.status === 'approved') {
        setPaymentStatus('approved');
        setPaymentId(data.payment_id);
        toast.success('Pagamento aprovado!');
        
        // Chamar lovable-payment-notify para obter redirectUrl
        await notifyPaymentAndRedirect(data.payment_id, orderId, schedulePayload);
      } else if (data.status === 'in_process' || data.status === 'pending') {
        setPaymentStatus('in_process');
        setPaymentId(data.payment_id);
        toast.info('Pagamento em análise. Aguarde confirmação.');
        // NÃO redirecionar - webhook do MP notificará o GAS quando aprovar
      } else {
        setPaymentStatus('rejected');
        setError('Pagamento rejeitado. Verifique os dados do cartão.');
      }
    } catch (err: any) {
      console.error('[handleCardSubmit] Card payment error:', err);
      setError(err.message || 'Erro ao processar pagamento');
      setPaymentStatus('idle');
    }
  };

  const handlePixSubmit = async () => {
    if (!validateForm()) return;

    console.log('[handlePixSubmit] Starting PIX generation');
    setPaymentStatus('processing');
    setError('');

    try {
      const orderId = `order_${Date.now()}`;
      const schedulePayload = buildSchedulePayload();
      
      const paymentRequest = {
        items: [{
          id: sku,
          title: serviceName,
          unit_price: amount / 100,
          quantity: 1
        }],
        payer: {
          email: formData.email,
          first_name: formData.name.split(' ')[0],
          last_name: formData.name.split(' ').slice(1).join(' '),
          identification: {
            type: 'CPF',
            number: formData.cpf.replace(/\D/g, '')
          }
        },
        metadata: {
          order_id: orderId,
          schedulePayload
        }
      };

      console.log('[handlePixSubmit] Payment request:', paymentRequest);

      const { data, error } = await supabase.functions.invoke('mp-create-payment', {
        body: paymentRequest
      });

      if (error) throw error;

      console.log('[handlePixSubmit] PIX creation response:', data);

      setPixData({
        qrCode: data.qr_code,
        qrCodeBase64: data.qr_code_base64,
        paymentId: data.payment_id
      });
      setPaymentId(data.payment_id);
      setLastPaymentId(data.payment_id);
      setPaymentStatus('pending_pix');
      
      // Usuário paga PIX, webhook notifica GAS em background
      toast.info('Aguardando pagamento do PIX...');
    } catch (err: any) {
      console.error('[handlePixSubmit] PIX generation error:', err);
      setError(err.message || 'Erro ao gerar PIX');
      setPaymentStatus('idle');
    }
  };

  const notifyPaymentAndRedirect = async (paymentId: string, orderId: string, schedulePayload: any) => {
    try {
      const body = {
        payment_id: paymentId,
        status: 'approved',
        email: schedulePayload.email,
        cpf: schedulePayload.cpf,
        sku,
        origin: 'lovable',
        cart: {
          items: [{ sku, qty: 1, price: amount / 100 }]
        },
        schedulePayload
      };

      console.log('[notifyPaymentAndRedirect] Request body:', body);

      const response = await fetch(`${GAS_BASE_ROUTE_URL}?path=lovable-payment-notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      console.log('[notifyPaymentAndRedirect] Response status:', response.status);

      const data = await response.json().catch(() => ({}));
      console.log('[notifyPaymentAndRedirect] Response data:', data);

      if (response.ok && data.success && data.redirectUrl) {
        toast.success('Redirecionando para o atendimento...');
        window.location.href = data.redirectUrl;
      } else {
        const params = new URLSearchParams({
          payment_id: paymentId,
          order_id: orderId || '',
          email: schedulePayload.email,
          cpf: schedulePayload.cpf,
          sku
        });
        console.warn('[notifyPaymentAndRedirect] Failed, redirecting to /pagamento/confirmado', data);
        toast.error(data.error || data.message || 'Não foi possível obter o link de redirecionamento.');
        window.location.href = `/pagamento/confirmado?${params.toString()}`;
      }
    } catch (err) {
      console.error('[notifyPaymentAndRedirect] Error:', err);
      const params = new URLSearchParams({
        payment_id: paymentId,
        order_id: orderId || '',
        email: schedulePayload.email,
        cpf: schedulePayload.cpf,
        sku
      });
      toast.error('Erro ao processar redirecionamento.');
      window.location.href = `/pagamento/confirmado?${params.toString()}`;
    }
  };

  const handlePixAccess = async () => {
    if (!lastPaymentId) {
      toast.error('ID do pagamento não encontrado');
      return;
    }

    setPaymentStatus('processing');
    
    const schedulePayload = buildSchedulePayload();

    const body = {
      payment_id: String(lastPaymentId),
      status: 'approved',
      email: schedulePayload.email,
      cpf: schedulePayload.cpf,
      sku,
      origin: 'lovable_pix_cta',
      cart: { items: [{ sku, qty: 1, price: amount / 100 }] },
      schedulePayload
    };

    console.log('[pix CTA] notify body:', body);

    try {
      const { callGasViaProxy } = await import('@/lib/gas-proxy');
      const { ok, data } = await callGasViaProxy('lovable-payment-notify', body);
      
      console.log('[pix CTA] notify response:', ok ? 200 : 500, data);

      if (ok && data?.success && data?.redirectUrl) {
        toast.success('Redirecionando para o atendimento...');
        window.location.href = data.redirectUrl;
      } else {
        // NÃO redirecionar - apenas mostrar toast e voltar para tela QR Code
        setPaymentStatus('pending_pix');
        const errorMsg = data.error || data.message || 'Pagamento ainda não compensou. Aguarde alguns instantes e tente novamente.';
        console.error('[NOTIFY ERROR]', {
          payment_id: lastPaymentId,
          error: data.error,
          message: data.message,
          full_response: data
        });
        toast.error(errorMsg);
      }
    } catch (err) {
      console.error('[pix CTA] Error:', err);
      setPaymentStatus('pending_pix');
      toast.error('Erro ao processar. Tente novamente.');
    }
  };

  const handleTryAgain = () => {
    setPaymentStatus('idle');
    setError('');
    setPixData(null);
    if (cardPaymentBrickRef.current) {
      cardPaymentBrickRef.current.unmount();
      cardPaymentBrickRef.current = null;
      isBrickMountedRef.current = false;
    }
  };

  const renderStatus = () => {
    if (paymentStatus === 'processing') {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg font-medium">Processando pagamento...</p>
        </div>
      );
    }

    if (paymentStatus === 'approved') {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
          <p className="text-xl font-bold text-green-600 mb-2">Pagamento Aprovado!</p>
          <p className="text-muted-foreground">Redirecionando...</p>
        </div>
      );
    }

    if (paymentStatus === 'rejected') {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
          <p className="text-xl font-bold text-red-600 mb-2">Pagamento Recusado</p>
          <p className="text-muted-foreground mb-4">{error || 'Verifique os dados e tente novamente'}</p>
          <Button onClick={handleTryAgain}>Tentar Novamente</Button>
        </div>
      );
    }

    if (paymentStatus === 'in_process') {
      return (
        <div className="space-y-6 text-center py-8">
          <div className="flex justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
          <div>
            <p className="text-lg font-medium mb-2">Pagamento em análise...</p>
            <p className="text-sm text-muted-foreground">
              Aguarde enquanto validamos seu pagamento. Você será notificado quando o pagamento for aprovado.
            </p>
          </div>
          <Button onClick={handleTryAgain} variant="outline">
            Voltar
          </Button>
        </div>
      );
    }

    if (paymentStatus === 'pending_pix' && pixData) {
      return (
        <PixPaymentForm
          qrCode={pixData.qrCode}
          qrCodeBase64={pixData.qrCodeBase64}
          onCancel={handleTryAgain}
          onAccessAttendance={handlePixAccess}
          isProcessing={false}
        />
      );
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {serviceName}
          </DialogTitle>
          <p className="text-2xl font-bold text-primary">
            R$ {(amount / 100).toFixed(2).replace('.', ',')}
          </p>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {renderStatus()}

        {paymentStatus === 'idle' && (
          <div className="space-y-4">
            {/* Formulário de dados do usuário (se necessário) */}
            {(!isUserLoggedIn || !hasRequiredData) && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Seu nome completo"
                  />
                </div>
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="seu@email.com"
                  />
                </div>
                <div>
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    placeholder="000.000.000-00"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+55 11 99999-9999"
                  />
                </div>
              </div>
            )}

            {/* Seletor de método de pagamento */}
            <div className="flex gap-2 border-b pb-4">
              <Button
                type="button"
                variant={paymentMethod === 'card' ? 'default' : 'outline'}
                onClick={() => setPaymentMethod('card')}
                className="flex-1"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Cartão
              </Button>
              <Button
                type="button"
                variant={paymentMethod === 'pix' ? 'default' : 'outline'}
                onClick={() => setPaymentMethod('pix')}
                className="flex-1"
              >
                PIX
              </Button>
            </div>

            {/* Card Payment Brick (renderiza automaticamente quando método = cartão) */}
            {paymentMethod === 'card' && (
              <div id="cardPaymentBrick"></div>
            )}

            {/* Botão PIX */}
            {paymentMethod === 'pix' && (
              <Button onClick={handlePixSubmit} className="w-full" size="lg">
                Gerar QR Code PIX
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
