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
import { MP_PUBLIC_KEY } from '@/lib/constants';
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

    // ✅ Validar dados antes de montar o Brick
    if (!formData.email || !formData.cpf || !formData.name) {
      setError('Preencha seus dados pessoais antes de adicionar o cartão');
      return;
    }

    try {
      const bricksBuilder = mpInstanceRef.current.bricks();
      
      const cardPaymentBrick = await bricksBuilder.create('cardPayment', 'cardPaymentBrick', {
        initialization: {
          amount: amount / 100,
          payer: {  // ✅ Adicionar payer com email e CPF
            email: formData.email,
            identification: {
              type: 'CPF',
              number: formData.cpf.replace(/\D/g, '')
            }
          }
        },
        callbacks: {
          onReady: () => {
            console.log('Card Payment Brick pronto');
            isBrickMountedRef.current = true;
          },
          onSubmit: async (brickSubmitData: any) => {
            // ✅ Resolver wrapper do Brick para obter token/payment_method_id
            const cardData = brickSubmitData?.getCardFormData
              ? await brickSubmitData.getCardFormData()
              : brickSubmitData;
            
            await handleCardSubmit({
              token: cardData.token,
              payment_method_id: cardData.payment_method_id || cardData.paymentMethodId,
              installments: cardData.installments,
            });
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
    console.log('[handleCardSubmit] Card form data:', cardFormData);
    setPaymentStatus('processing');
    setError('');

    try {
      // ✅ Garantir que temos os dados corretos do cartão
      if (!cardFormData.token || !cardFormData.payment_method_id) {
        throw new Error('Dados do cartão incompletos. Tente novamente.');
      }

      const orderId = `order_${Date.now()}`;
      const schedulePayload = buildSchedulePayload();
      
      const paymentRequest: any = {
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
        installments: cardFormData.installments || 1,
        metadata: {
          order_id: orderId,
          schedulePayload
        }
      };

      // Adicionar auto_recurring se for assinatura
      if (recurring && frequency && frequencyType) {
        paymentRequest.auto_recurring = {
          frequency,
          frequency_type: frequencyType,
          transaction_amount: amount / 100,
          currency_id: 'BRL'
        };
      }

      console.log('[handleCardSubmit] Payment request:', paymentRequest);

      const { data, error } = await supabase.functions.invoke('mp-create-payment', {
        body: paymentRequest
      });

      if (error) throw error;

      console.log('[handleCardSubmit] Payment creation response:', data);

      if (data.status === 'approved') {
        setPaymentId(data.payment_id);
        toast.success('Pagamento aprovado!');
        await notifyPaymentAndRedirect(data.payment_id, orderId, schedulePayload);
      } else if (data.status === 'in_process' || data.status === 'pending') {
        setPaymentStatus('in_process');
        setPaymentId(data.payment_id);
        toast.info('Pagamento em análise. Aguarde confirmação.');
      } else {
        setPaymentStatus('rejected');
        
        // ✅ Mensagens específicas baseadas em status_detail
        const rejectMessages: Record<string, string> = {
          'cc_rejected_insufficient_amount': 'Cartão sem saldo suficiente',
          'cc_rejected_bad_filled_security_code': 'Código de segurança (CVV) incorreto',
          'cc_rejected_bad_filled_card_number': 'Número do cartão inválido',
          'cc_rejected_call_for_authorize': 'Cartão bloqueado. Entre em contato com seu banco',
          'cc_rejected_high_risk': 'Pagamento recusado por segurança. Use outro cartão',
          'cc_rejected_invalid_installments': 'Número de parcelas inválido',
          'cc_rejected_duplicated_payment': 'Pagamento duplicado detectado',
          'cc_rejected_card_disabled': 'Cartão desabilitado. Entre em contato com seu banco'
        };
        
        const userMessage = data.status_detail 
          ? rejectMessages[data.status_detail] || 'Pagamento rejeitado. Verifique os dados do cartão.' 
          : 'Pagamento rejeitado. Verifique os dados do cartão.';
        
        setError(userMessage);
        
        console.error('[CARD REJECTED]', {
          status_detail: data.status_detail,
          error_message: data.error_message,
          payment_id: data.payment_id
        });
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
      
      const paymentRequest: any = {
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

      // Adicionar auto_recurring se for assinatura
      if (recurring && frequency && frequencyType) {
        paymentRequest.auto_recurring = {
          frequency,
          frequency_type: frequencyType,
          transaction_amount: amount / 100,
          currency_id: 'BRL'
        };
      }

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
    setPaymentStatus('processing');
    
    const body = transformToGASPayload({
      payment_id: paymentId,
      payment_status: 'approved',
      sku,
      amount,
      cpf: schedulePayload.cpf,
      email: schedulePayload.email,
      name: schedulePayload.nome,
      phone: schedulePayload.telefone,
      especialidade: schedulePayload.especialidade || 'Clínico Geral',
      horario_iso: schedulePayload.horario_iso,
      plano_ativo: schedulePayload.plano_ativo
    });

    console.log('[Card] notify body:', body);

    try {
      const { ok, status, data } = await callNotifyViaProxy('lovable-payment-notify', body);
      console.log('[notifyPaymentAndRedirect] status/data:', status, data);

      if (ok && data?.success && data?.redirectUrl) {
        toast.success('Redirecionando para o atendimento...');
        window.location.href = data.redirectUrl;
      } else {
        // ✅ Fallback para /pagamento/confirmado apenas se notify falhar
        setPaymentStatus('idle');
        const params = new URLSearchParams({
          payment_id: paymentId,
          order_id: orderId || '',
          email: schedulePayload.email,
          cpf: schedulePayload.cpf,
          sku
        });
        console.warn('[notifyPaymentAndRedirect] Failed, redirecting to /pagamento/confirmado', data);
        toast.error(data?.error || data?.message || 'Não foi possível obter o link de redirecionamento.');
        window.location.href = `/pagamento/confirmado?${params.toString()}`;
      }
    } catch (err) {
      console.error('[notifyPaymentAndRedirect] Error:', err);
      setPaymentStatus('idle');
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

    const body = transformToGASPayload({
      payment_id: String(lastPaymentId),
      payment_status: 'approved',
      sku,
      amount,
      cpf: schedulePayload.cpf,
      email: schedulePayload.email,
      name: schedulePayload.nome,
      phone: schedulePayload.telefone,
      especialidade: schedulePayload.especialidade || 'Clínico Geral',
      horario_iso: schedulePayload.horario_iso,
      plano_ativo: schedulePayload.plano_ativo
    });

    console.log('[PIX CTA] notify body:', body);

    try {
      const { ok, status, data } = await callNotifyViaProxy('lovable-payment-notify', body);
      console.log('[pix CTA] notify response status/data:', status, data);

      if (ok && data?.success && data?.redirectUrl) {
        toast.success('Redirecionando para o atendimento...');
        window.location.href = data.redirectUrl;
      } else {
        // ✅ NÃO redirecionar - volta para tela QR Code
        setPaymentStatus('pending_pix');
        const errorMsg = data?.error || data?.message || 'Pagamento ainda não compensou. Aguarde alguns instantes e tente novamente.';
        console.error('[NOTIFY ERROR]', {
          payment_id: lastPaymentId,
          error: data?.error,
          message: data?.message,
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
            {/* Dados Pessoais - Mostrar resumo se já carregados */}
            {formData.email && formData.name ? (
              <div className="bg-muted/30 p-4 rounded-lg">
                <h3 className="font-semibold text-sm mb-2">Pagando como:</h3>
                <div className="space-y-1">
                  <p className="text-sm font-medium">{formData.name}</p>
                  <p className="text-sm text-muted-foreground">{formData.email}</p>
                  <p className="text-sm text-muted-foreground">{formData.cpf}</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 bg-muted/30 p-4 rounded-lg">
                <h3 className="font-semibold text-sm">Dados Pessoais</h3>
                <div>
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Seu nome completo"
                    required
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
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    placeholder="000.000.000-00"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+55 11 99999-9999"
                    required
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

            {/* Card Payment Brick */}
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
