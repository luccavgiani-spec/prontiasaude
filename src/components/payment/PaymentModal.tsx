import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, AlertCircle, CreditCard } from 'lucide-react';
import { validateCPF } from '@/lib/cpf-validator';
import { validatePhoneE164 } from '@/lib/validations';
import { supabase } from '@/integrations/supabase/client';
import { getAppointments } from '@/lib/appointments';
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
  const [patientGender, setPatientGender] = useState<string>('');
  const [redirectUrl, setRedirectUrl] = useState<string>('');
  const [pixPaymentId, setPixPaymentId] = useState<string | null>(null);
  const [isPollingPayment, setIsPollingPayment] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  
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
          patient.gender &&
          user.email
        );

        setHasRequiredData(hasData);
        setPatientGender(patient.gender || '');

        if (hasData) {
          setFormData({
            name: `${patient.first_name} ${patient.last_name}`,
            email: user.email,
            cpf: patient.cpf,
            phone: patient.phone_e164
          });
        }
      }

      // Verificar plano ativo antes de permitir checkout
      const { checkPatientPlanActive } = await import('@/lib/patient-plan');
      const planStatus = await checkPatientPlanActive(user.email!);

      if (planStatus.canBypassPayment) {
        toast.info('Você já tem um plano ativo! Redirecionando...');
        onOpenChange(false);
        
        // Mapear gender para 'M' ou 'F'
        const mapSexo = (g?: string) => (g?.toUpperCase().startsWith('F') ? 'F' : 'M');

        // Agendar direto com plano ativo
        const { scheduleWithActivePlan } = await import('@/lib/schedule-service');
        const result = await scheduleWithActivePlan({
          cpf: patient?.cpf || '',
          email: user.email!,
          nome: patient ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() : '',
          telefone: patient?.phone_e164 || '',
          sku: sku,
          plano_ativo: true,
          sexo: mapSexo(patient?.gender)
        });
        
        if (result.ok && result.url) {
          window.location.href = result.url;
        } else {
          toast.error(result.error || 'Erro ao agendar');
        }
        return;
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

  // Montar Card Payment Brick APENAS quando tiver dados mínimos válidos
  useEffect(() => {
    if (!open || paymentMethod !== 'card' || !mpInstanceRef.current || isLoadingUserData) {
      return;
    }

    // Verifica se tem dados mínimos: email válido + CPF com 11 dígitos
    const emailValid = formData.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
    const cpfValid = formData.cpf && formData.cpf.replace(/\D/g, '').length === 11;
    const hasMinimalPayerData = emailValid && cpfValid;

    // Se usuário logado, só montar se hasRequiredData
    // Se não logado, só montar se hasMinimalPayerData
    if ((isUserLoggedIn && hasRequiredData) || (!isUserLoggedIn && hasMinimalPayerData)) {
      if (!isBrickMountedRef.current) {
        mountCardPaymentBrick();
      }
    } else {
      // Se perdeu dados mínimos, desmontar brick
      if (isBrickMountedRef.current && cardPaymentBrickRef.current) {
        cardPaymentBrickRef.current.unmount();
        cardPaymentBrickRef.current = null;
        isBrickMountedRef.current = false;
      }
    }
  }, [open, paymentMethod, mpInstanceRef.current, isLoadingUserData, hasRequiredData, isUserLoggedIn, formData.email, formData.cpf]);


  const mountCardPaymentBrick = async () => {
    if (isBrickMountedRef.current || !mpInstanceRef.current) return;

    // CRITICAL: Só usar dados REAIS (não placeholders)
    const payerEmail = formData.email;
    const payerCPF = formData.cpf.replace(/\D/g, '');

    // Validação final antes de montar
    if (!payerEmail || !payerCPF || payerCPF.length !== 11) {
      console.warn('[PaymentModal] Dados insuficientes para montar Brick:', { payerEmail, payerCPF });
      return;
    }

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
            try {
              console.log('[Brick onSubmit] Received data:', brickSubmitData);
              
              // ✅ Validar dados ANTES de processar
              if (!validateForm()) {
                setError('Preencha todos os campos antes de finalizar o pagamento');
                setPaymentStatus('idle');
                return;
              }

              // ✅ Resolver wrapper do Brick para obter token/payment_method_id
              const cardData = brickSubmitData?.getCardFormData
                ? await brickSubmitData.getCardFormData()
                : brickSubmitData;
              
              console.log('[Brick onSubmit] Card data resolved:', cardData);
              
              // ✅ NOVO: Validar se cardData tem os campos obrigatórios
              if (!cardData || !cardData.token || !cardData.payment_method_id) {
                console.error('[Brick onSubmit] Invalid card data:', cardData);
                setError('Erro ao processar dados do cartão. Tente novamente.');
                setPaymentStatus('idle');
                toast.error('Dados do cartão inválidos');
                return;
              }
              
              await handleCardSubmit({
                token: cardData.token,
                payment_method_id: cardData.payment_method_id || cardData.paymentMethodId,
                installments: cardData.installments || 1,
              });
            } catch (error) {
              console.error('[Brick onSubmit] Uncaught error:', error);
              setError('Erro ao processar pagamento. Tente novamente.');
              setPaymentStatus('idle');
              toast.error('Erro ao processar pagamento');
            }
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
    const payload: any = {
      email: formData.email,
      cpf: (formData.cpf || '').replace(/\D/g, ''),
      nome: formData.name,
      telefone: formData.phone, // should be E.164 format (+55...)
      sku,
      especialidade: especialidade || 'Clínico Geral',
      plano_ativo: false,
      horario_iso: new Date().toISOString()
    };

    // Adicionar sexo se disponível (M ou F)
    if (patientGender) {
      payload.sexo = patientGender === 'male' ? 'M' : patientGender === 'female' ? 'F' : patientGender;
    }

    return payload;
  };

  const pollPaymentStatus = async (paymentId: string, orderId: string) => {
    setIsPollingPayment(true);
    setCurrentOrderId(orderId);
    console.log('[pollPaymentStatus] Aguardando appointment com order_id:', orderId);
    
    const maxAttempts = 60; // 5 minutos (5s x 60)
    let attempts = 0;
    
    const interval = setInterval(async () => {
      attempts++;
      
      try {
        // Buscar appointments do usuário
        const result = await getAppointments(formData.email);
        
        if (result.success && result.appointments) {
          // 🔍 Procurar appointment ESPECÍFICO deste pagamento (filtrar por order_id)
          const appointment = result.appointments.find(
            apt => apt.order_id === orderId && 
                   apt.status === 'confirmed' && 
                   apt.redirect_url
          );
          
          if (appointment?.redirect_url) {
            clearInterval(interval);
            setIsPollingPayment(false);
            
            console.log('[pollPaymentStatus] ✅ Appointment encontrado:', {
              order_id: appointment.order_id,
              redirect_url: appointment.redirect_url,
              provider: appointment.provider
            });
            
            toast.success('✅ Pagamento aprovado! Redirecionando para sua consulta...');
            
            setTimeout(() => {
              window.location.href = appointment.redirect_url!;
            }, 1500);
          }
        }
        
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setIsPollingPayment(false);
          
          toast.info('Aguardando confirmação do pagamento. Acesse "Minhas Consultas" em alguns instantes.');
        }
      } catch (error) {
        console.error('[pollPaymentStatus] Erro ao verificar status:', error);
      }
    }, 5000); // 5 segundos
  };

  const handleCardSubmit = async (cardFormData: any) => {
    console.log('[handleCardSubmit] START - Card form data:', cardFormData);
    console.log('[handleCardSubmit] formData:', formData);
    console.log('[handleCardSubmit] SKU:', sku, 'Amount:', amount);
    
    setPaymentStatus('processing');
    setError('');
    setUserMessage('');

    try {
      // ✅ Garantir que temos os dados corretos do cartão
      if (!cardFormData.token || !cardFormData.payment_method_id) {
        console.error('[handleCardSubmit] Missing card data:', cardFormData);
        setError('Não foi possível processar os dados do cartão. Verifique os campos e tente novamente.');
        setPaymentStatus('idle');
        toast.error('Erro ao processar dados do cartão');
        return;
      }

      const orderId = `order_${Date.now()}`;
      const schedulePayload = buildSchedulePayload();
      
      // ✅ SEMPRE buscar preço do DB, NUNCA usar fallback de props
      const { data: service, error: serviceError } = await supabase
        .from('services')
        .select('price_cents, name')
        .eq('sku', sku)
        .eq('active', true)
        .maybeSingle();

      if (serviceError || !service) {
        throw new Error(`Serviço ${sku} não encontrado ou inativo`);
      }

      const dbUnitPrice = service.price_cents / 100;
      
      const paymentRequest: any = {
        items: [{
          id: sku,
          title: serviceName,
          unit_price: dbUnitPrice,
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
          transaction_amount: dbUnitPrice,
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

      console.log('[handleCardSubmit] Invoking mp-create-payment with:', paymentRequest);

      const { data, error } = await supabase.functions.invoke('mp-create-payment', {
        body: paymentRequest
      });
      
      console.log('[handleCardSubmit] Response:', { data, error });

      if (error) throw error;

      console.log('[handleCardSubmit] Payment creation response:', data);

      if (data.status === 'approved') {
        setPaymentId(data.payment_id);
        setPaymentStatus('approved');
        toast.success('Pagamento aprovado! Criando agendamento...');
        
        // Chamar schedule-redirect imediatamente após pagamento aprovado
        const { data: scheduleData, error: scheduleError } = await supabase.functions.invoke('schedule-redirect', {
          body: schedulePayload
        });
        
        if (scheduleError || !scheduleData?.ok) {
          console.error('[Card Payment] Erro ao criar agendamento:', scheduleError || scheduleData);
          toast.error('Pagamento aprovado, mas houve erro no agendamento. Entre em contato.');
          return;
        }
        
        if (scheduleData.url) {
          toast.success('✅ Pagamento aprovado! Redirecionando...');
          setTimeout(() => {
            window.location.href = scheduleData.url;
          }, 1500);
        }
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
    } finally {
      // ✅ Garantir que sempre reseta o status em caso de erro não tratado
      if (paymentStatus === 'processing') {
        setPaymentStatus('idle');
      }
    }
  };

  const handlePixSubmit = async () => {
    if (!validateForm()) return;

    console.log('[handlePixSubmit] Starting PIX generation');
    setPaymentStatus('processing');
    setError('');

    try {
      // Formatar telefone localmente ANTES de usar
      const { formatPhoneE164, validatePhoneE164 } = await import('@/lib/validations');
      const formattedPhone = formatPhoneE164(formData.phone);

      // Validar o telefone formatado
      if (!validatePhoneE164(formattedPhone)) {
        setError('Telefone inválido. Use o formato (11) 91234-5678');
        setPaymentStatus('idle');
        return;
      }

      const orderId = `order_${Date.now()}`;
      const schedulePayload = {
        ...buildSchedulePayload(),
        telefone: formattedPhone // Usar telefone formatado localmente
      };
      
      // ✅ SEMPRE buscar preço do DB, NUNCA usar fallback de props
      const { data: service, error: serviceError } = await supabase
        .from('services')
        .select('price_cents, name')
        .eq('sku', sku)
        .eq('active', true)
        .maybeSingle();

      if (serviceError || !service) {
        throw new Error(`Serviço ${sku} não encontrado ou inativo`);
      }

      const dbUnitPrice = service.price_cents / 100;
      
      const paymentRequest: any = {
        items: [{
          id: sku,
          title: serviceName,
          unit_price: dbUnitPrice,
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
        payment_method_id: 'pix',
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
          transaction_amount: dbUnitPrice,
          currency_id: 'BRL'
        };
      }

      console.log('[handlePixSubmit] Payment request:', paymentRequest);

      const { data, error } = await supabase.functions.invoke('mp-create-payment', {
        body: paymentRequest
      });

      if (error) throw error;

      // ✅ Validar resposta PIX antes de usar
      if (!data.success || !data.qr_code || !data.qr_code_base64) {
        throw new Error(data.error || 'Falha ao gerar código PIX');
      }

      console.log('[handlePixSubmit] PIX creation response:', data);

      setPixData({
        qrCode: data.qr_code,
        qrCodeBase64: data.qr_code_base64,
        paymentId: data.payment_id
      });
      setPaymentId(data.payment_id);
      setLastPaymentId(data.payment_id);
      setPixPaymentId(data.payment_id);
      setPaymentStatus('pending_pix');
      
      // Iniciar polling para detectar aprovação automaticamente
      console.log('[handlePixSubmit] Iniciando polling para order_id:', orderId);
      pollPaymentStatus(data.payment_id, orderId);
      
      // Usuário paga PIX, webhook notifica GAS em background
      toast.info('Aguardando pagamento do PIX...');
    } catch (err: any) {
      console.error('[handlePixSubmit] PIX generation error:', err);
      setError(err.message || 'Erro ao gerar PIX');
      setPaymentStatus('idle');
    }
  };

  // Listener Supabase Realtime para redirect_url após pagamento aprovado
  useEffect(() => {
    if (!open || (paymentStatus !== 'approved' && paymentStatus !== 'pending_pix')) {
      return;
    }

    console.log('[Realtime] Subscribing to appointments for email:', formData.email);

    const channel = supabase
      .channel('appointment-redirect')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'appointments',
          filter: `email=eq.${formData.email}`
        },
        (payload) => {
          console.log('[Realtime] Received appointment:', payload);
          const appointment = payload.new as any;

          // 🔍 Verificar se é o appointment deste pagamento específico
          if (appointment.redirect_url && appointment.order_id && appointment.order_id === currentOrderId) {
            console.log('[Realtime] ✅ Appointment CORRETO detectado:', {
              appointment_id: appointment.appointment_id,
              order_id: appointment.order_id,
              redirect_url: appointment.redirect_url
            });
            
            setRedirectUrl(appointment.redirect_url);
            toast.success('Agendamento confirmado! Redirecionando...');
            
            setTimeout(() => {
              window.location.href = appointment.redirect_url;
            }, 1500);
          } else {
            console.log('[Realtime] Appointment ignorado (order_id diferente):', {
              received_order_id: appointment.order_id,
              expected_order_id: currentOrderId
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, paymentStatus, formData.email]);


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
          redirectUrl={redirectUrl}
          onCancel={handleTryAgain}
        />
      );
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>
            {serviceName}
          </DialogTitle>
          <p className="text-2xl font-bold text-primary">
            R$ {(amount / 100).toFixed(2).replace('.', ',')}
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
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
                   <div id="cardPaymentBrick" className="mp-brick-container min-h-[400px]"></div>
                 )}

                 {/* Botão PIX */}
                 {paymentMethod === 'pix' && (
                   <>
                     <Button onClick={handlePixSubmit} className="w-full" size="lg">
                       Gerar QR Code PIX
                     </Button>
                     
                     {isPollingPayment && (
                       <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                         <div className="flex items-center gap-2">
                           <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                           <span className="text-sm text-blue-800">
                             Aguardando confirmação do pagamento...
                           </span>
                         </div>
                       </div>
                     )}
                   </>
                 )}
              </>
            )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
