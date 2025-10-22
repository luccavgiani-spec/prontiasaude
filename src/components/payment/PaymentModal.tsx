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
  const [userMessage, setUserMessage] = useState<string>('');
  const [paymentId, setPaymentId] = useState<string>('');
  const [lastPaymentId, setLastPaymentId] = useState<string>('');
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  const [hasRequiredData, setHasRequiredData] = useState(false);
  const [isLoadingUserData, setIsLoadingUserData] = useState(true);
  
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
      setUserMessage('');
      if (cardPaymentBrickRef.current) {
        cardPaymentBrickRef.current.unmount();
        cardPaymentBrickRef.current = null;
        isBrickMountedRef.current = false;
      }
    }
  }, [open]);

  const loadUserData = async () => {
    setIsLoadingUserData(true);
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
    } finally {
      setIsLoadingUserData(false);
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

  // Limpar erros ao trocar método de pagamento
  useEffect(() => {
    if (open && paymentStatus === 'idle') {
      setError('');
      setUserMessage('');
    }
  }, [paymentMethod, open, paymentStatus]);

  // Montar Card Payment Brick quando método = cartão
  useEffect(() => {
    if (
      open && 
      paymentMethod === 'card' && 
      mpInstanceRef.current && 
      !isBrickMountedRef.current &&
      !isLoadingUserData &&
      (hasRequiredData || !isUserLoggedIn)
    ) {
      mountCardPaymentBrick();
    }
  }, [open, paymentMethod, mpInstanceRef.current, isLoadingUserData, hasRequiredData, isUserLoggedIn]);

  // Remontar Brick quando dados forem preenchidos
  useEffect(() => {
    if (open && paymentMethod === 'card' && formData.email && formData.cpf && formData.name) {
      if (!isBrickMountedRef.current && mpInstanceRef.current) {
        mountCardPaymentBrick();
      }
    }
  }, [open, paymentMethod, formData.email, formData.cpf, formData.name]);


  const mountCardPaymentBrick = async () => {
    if (isBrickMountedRef.current || !mpInstanceRef.current) return;

    // Se usuário logado mas dados incompletos, não montar brick
    if (isUserLoggedIn && !hasRequiredData) {
      console.warn('[PaymentModal] Aguardando dados do usuário...');
      return;
    }

    // Para usuários não logados ou com dados completos, usar valores disponíveis ou placeholders
    const payerEmail = formData.email || 'placeholder@example.com';
    const payerCPF = formData.cpf.replace(/\D/g, '') || '00000000000';

    try {
      const bricksBuilder = mpInstanceRef.current.bricks();
      
      const cardPaymentBrick = await bricksBuilder.create('cardPayment', 'cardPaymentBrick', {
        initialization: {
          amount: amount / 100,
          payer: {
            email: payerEmail,
            identification: {
              type: 'CPF',
              number: payerCPF
            }
          }
        },
        callbacks: {
          onReady: () => {
            console.log('Card Payment Brick pronto');
            isBrickMountedRef.current = true;
          },
          onSubmit: async (brickSubmitData: any) => {
            // ✅ Validar dados ANTES de processar
            if (!validateForm()) {
              setError('Preencha todos os campos antes de finalizar o pagamento');
              return;
            }

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
            console.error('[Card Payment Brick] Error:', error);
            
            // ✅ Exibir erros críticos ao usuário
            if (error?.cause?.[0]?.code === 'E301' || error?.message?.includes('token')) {
              setError('Erro ao processar dados do cartão. Verifique as informações e tente novamente.');
              setPaymentStatus('idle');
            } else if (error?.message?.includes('security_code')) {
              setError('Código de segurança (CVV) inválido.');
              setPaymentStatus('idle');
            } else {
              // Erros não críticos: apenas logar
              console.warn('[Card Payment Brick] Non-critical error:', error);
            }
          },
        },
      });

      cardPaymentBrickRef.current = cardPaymentBrick;
    } catch (err) {
      console.error('Erro ao montar brick (não crítico):', err);
      // NÃO exibir mensagem ao usuário - brick pode funcionar mesmo com erros de setup
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
    setUserMessage('');

    try {
      // ✅ Garantir que temos os dados corretos do cartão
      if (!cardFormData.token || !cardFormData.payment_method_id) {
        setError('Não foi possível processar os dados do cartão. Verifique os campos e tente novamente.');
        setPaymentStatus('idle');
        toast.error('Erro ao processar dados do cartão');
        return; // NÃO lançar erro, apenas retornar
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
      console.log('[PaymentModal] Enviando pagamento:', {
        sku,
        serviceName,
        amount,
        recurring,
        frequency,
        formData: { name: formData.name, email: formData.email, cpf: formData.cpf },
        cardData: {
          token: cardFormData.token,
          payment_method_id: cardFormData.payment_method_id,
          installments: cardFormData.installments
        }
      });

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
        
        setUserMessage(userMessage);
        setError('');
        
        console.error('[CARD REJECTED]', {
          status_detail: data.status_detail,
          error_message: data.error_message,
          payment_id: data.payment_id
        });
      }
    } catch (err: any) {
      console.error('[handleCardSubmit] Card payment error:', err);
      
      // ✅ NOVO: Tratamento específico de erros
      let errorMessage = 'Erro ao processar pagamento';
      
      if (err.message?.includes('Price validation failed')) {
        errorMessage = 'Erro: Preço inválido detectado. Recarregue a página e tente novamente.';
      } else if (err.message?.includes('Invalid SKU')) {
        errorMessage = 'Erro: Serviço inválido. Entre em contato com o suporte.';
      } else if (err.message?.includes('does not support recurring')) {
        errorMessage = 'Este serviço não está disponível como assinatura.';
      } else if (err.response?.status === 401) {
        errorMessage = 'Erro de autenticação. Faça login novamente.';
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
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

    console.log('[notifyPaymentAndRedirect] Calling schedule-redirect for payment:', paymentId);

    try {
      const { data, error } = await supabase.functions.invoke('schedule-redirect', {
        body: schedulePayload
      });

      if (error) throw error;

      console.log('[notifyPaymentAndRedirect] Response:', data);

      if (data && data.ok && data.url) {
        toast.success('Redirecionando para o atendimento...');
        window.location.href = data.url;
      } else {
        // Fallback para /pagamento/confirmado
        setPaymentStatus('idle');
        const params = new URLSearchParams({
          payment_id: paymentId,
          order_id: orderId || '',
          email: schedulePayload.email,
          cpf: schedulePayload.cpf,
          sku
        });
        console.warn('[notifyPaymentAndRedirect] Failed, redirecting to /pagamento/confirmado', data);
        toast.error(data?.error || 'Não foi possível obter o link de redirecionamento.');
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
        />
      );
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>
            {serviceName}
          </DialogTitle>
          <p className="text-2xl font-bold text-primary">
            R$ {(amount / 100).toFixed(2).replace('.', ',')}
          </p>
        </DialogHeader>

        {userMessage && paymentStatus === 'rejected' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-600 text-sm">{userMessage}</p>
          </div>
        )}

        {renderStatus()}

        {paymentStatus === 'idle' && (
          <div className="space-y-4">
            {isLoadingUserData ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                <span className="text-muted-foreground">Carregando dados...</span>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
