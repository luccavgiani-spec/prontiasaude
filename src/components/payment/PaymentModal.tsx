import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
import { PaymentSummary } from './PaymentSummary';
import { MP_PUBLIC_KEY } from '@/lib/constants';

declare global {
  interface Window {
    MercadoPago: any;
    MP_DEVICE_SESSION_ID?: string;
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
  const [showSummary, setShowSummary] = useState(true); // Começa mostrando resumo
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | undefined>(undefined);
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
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [patientAddress, setPatientAddress] = useState<{
    cep?: string;
    city?: string;
    state?: string;
    street_name?: string;
    street_number?: string;
  } | null>(null);
  const [threeDSecureUrl, setThreeDSecureUrl] = useState<string | null>(null);
  
  const mpInstanceRef = useRef<any>(null);
  const cardPaymentBrickRef = useRef<any>(null);
  const isBrickMountedRef = useRef(false);
  const deviceIdIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isSubmittingRef = useRef(false);
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const brickRecoverAttemptsRef = useRef(0);
  const isMountingRef = useRef(false);
  const mountTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reset de segurança: liberar flag após 10 segundos (caso algo dê errado)
  useEffect(() => {
    if (isSubmittingRef.current) {
      const timeout = setTimeout(() => {
        console.warn('[Safety] Resetting isSubmittingRef after 10s timeout');
        isSubmittingRef.current = false;
      }, 10000);
      
      return () => clearTimeout(timeout);
    }
  }, [paymentStatus]);

  // Carregar dados do usuário e inicializar MP quando modal abre
  useEffect(() => {
    if (open) {
      setShowSummary(true); // Reset para resumo ao abrir
      setPaymentMethod(undefined); // Reset método de pagamento
      loadUserData();
      loadMercadoPagoSDK();
      captureDeviceId();
    } else {
      // Reset ao fechar
      setShowSummary(true);
      setPaymentMethod(undefined);
      setPaymentStatus('idle');
      setPixData(null);
      setError('');
      setUserMessage('');
      setDeviceId(null);
      setPatientAddress(null);
      setThreeDSecureUrl(null);
      isSubmittingRef.current = false;
      setIsLoadingUserData(false);
      setIsPollingPayment(false);
      
      // Limpar intervals e timeouts
      if (deviceIdIntervalRef.current) {
        clearInterval(deviceIdIntervalRef.current);
        deviceIdIntervalRef.current = null;
      }
      
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
        validationTimeoutRef.current = null;
      }
      
      if (cardPaymentBrickRef.current) {
        cardPaymentBrickRef.current.unmount();
        cardPaymentBrickRef.current = null;
        isBrickMountedRef.current = false;
      }
    }
  }, [open]);

  const captureDeviceId = () => {
    // Limpar interval anterior se existir
    if (deviceIdIntervalRef.current) {
      clearInterval(deviceIdIntervalRef.current);
    }

    const maxAttempts = 20; // ✅ ETAPA 1: Aumentado para 10 segundos (20 * 500ms)
    let attempts = 0;

    deviceIdIntervalRef.current = setInterval(() => {
      if (window.MP_DEVICE_SESSION_ID) {
        console.log('[Device ID] ✅ Captured:', window.MP_DEVICE_SESSION_ID);
        setDeviceId(window.MP_DEVICE_SESSION_ID);
        if (deviceIdIntervalRef.current) {
          clearInterval(deviceIdIntervalRef.current);
          deviceIdIntervalRef.current = null;
        }
      } else {
        attempts++;
        if (attempts >= maxAttempts) {
          console.error('[Device ID] ❌ NOT CAPTURED after 10 seconds - SECURITY RISK!');
          if (deviceIdIntervalRef.current) {
            clearInterval(deviceIdIntervalRef.current);
            deviceIdIntervalRef.current = null;
          }
        }
      }
    }, 500);
  };

  const loadUserData = async () => {
    console.log('[loadUserData] Starting...');
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

        // ✅ ETAPA 4 (OPÇÃO A): Validar endereço completo antes de checkout
        const patientAddressData = {
          cep: patient.cep,
          city: patient.city,
          state: patient.state,
          street_name: patient.address_line,
          street_number: patient.address_number
        };

        const hasCompleteAddress = !!(
          patientAddressData.cep &&
          patientAddressData.city &&
          patientAddressData.state &&
          patientAddressData.street_name
        );

        if (!hasCompleteAddress) {
          console.warn('[Payment Security] ⚠️ Endereço incompleto detectado - RISCO DE RECUSA');
          toast.warning('⚠️ Complete seu endereço no perfil para aumentar a aprovação do pagamento', {
            duration: 5000
          });
        }

        setPatientAddress(patientAddressData);
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
      console.log('[loadUserData] Finished, setting isLoadingUserData = false');
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

  // ✅ ETAPA 1: Proteger Brick contra desmontagens indevidas
  useEffect(() => {
    // Só desmontar se:
    // 1. Modal está aberto
    // 2. NÃO está mostrando resumo
    // 3. Método mudou para algo diferente de 'card'
    // 4. Método está definido (não é undefined)
    // 5. Brick está montado
    if (
      open && 
      !showSummary && 
      paymentMethod !== 'card' && 
      paymentMethod !== undefined && 
      isBrickMountedRef.current && 
      cardPaymentBrickRef.current
    ) {
      console.log('[Brick Unmount] Desmontando brick (troca de método para:', paymentMethod, ')');
      console.log('[Brick Unmount] Estado:', {
        paymentMethod,
        isBrickMounted: isBrickMountedRef.current,
        cardPaymentBrickRef: !!cardPaymentBrickRef.current
      });
      try {
        cardPaymentBrickRef.current.unmount();
      } catch (err) {
        console.warn('[PaymentModal] Erro ao desmontar brick:', err);
      } finally {
        cardPaymentBrickRef.current = null;
        isBrickMountedRef.current = false;
      }
    }
  }, [paymentMethod, open, showSummary]);

  // Montar Card Payment Brick APENAS quando tiver dados mínimos válidos E showSummary === false
  useEffect(() => {
    console.log('[Brick Mount Effect] Triggered with:', {
      open,
      showSummary,
      paymentMethod,
      paymentStatus,
      isLoadingUserData,
      hasMPInstance: !!mpInstanceRef.current,
      hasRequiredData,
      isUserLoggedIn,
      isBrickMounted: isBrickMountedRef.current
    });

    // ✅ Só montar se não estiver mostrando o resumo
    if (showSummary) {
      console.log('[Brick Mount Effect] Skipping (showing summary)');
      return;
    }

    // Não mexer no Brick durante processamento
    if (
      paymentStatus === 'processing' || 
      paymentStatus === 'in_process' ||
      isSubmittingRef.current
    ) {
      console.log('[Brick Mount Effect] Skipping (payment in progress or submitting)');
      return;
    }

    // Verificar se mpInstanceRef está pronto
    if (!mpInstanceRef.current) {
      console.log('[Brick Mount Effect] MP Instance não está pronta ainda');
      return;
    }

    if (!open || paymentMethod !== 'card' || isLoadingUserData) {
      return;
    }

    // Verifica se tem dados mínimos: email válido + CPF com 11 dígitos
    const emailValid = formData.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
    const cpfValid = formData.cpf && formData.cpf.replace(/\D/g, '').length === 11;
    const hasMinimalPayerData = emailValid && cpfValid;

    // ✅ Montar se tiver dados mínimos OU dados completos
    if (hasRequiredData || hasMinimalPayerData) {
      if (!isBrickMountedRef.current) {
        mountCardPaymentBrick();
      }
    } else {
      // Desmontar quando não estiver no método cartão
      if (isBrickMountedRef.current && cardPaymentBrickRef.current && paymentMethod !== 'card') {
        console.log('[Brick Mount Effect] Unmounting: payment method changed from card');
        cardPaymentBrickRef.current.unmount();
        isBrickMountedRef.current = false;
      }
    }
  }, [open, showSummary, paymentMethod, isLoadingUserData, hasRequiredData, isUserLoggedIn, formData.email, formData.cpf, paymentStatus]);

  const mountCardPaymentBrick = async () => {
    // Guard: Prevenir montagens concorrentes
    if (isMountingRef.current) {
      console.warn('[mountCardPaymentBrick] Montagem já em andamento, ignorando');
      return;
    }
    if (isBrickMountedRef.current || !mpInstanceRef.current) {
      console.log('[mountCardPaymentBrick] Skipping:', { 
        isBrickMounted: isBrickMountedRef.current, 
        hasMPInstance: !!mpInstanceRef.current 
      });
      return;
    }

    isMountingRef.current = true;

    console.log('[mountCardPaymentBrick] Iniciando montagem. Estado:', {
      isBrickMounted: isBrickMountedRef.current,
      hasMPInstance: !!mpInstanceRef.current,
      hasContainer: !!document.getElementById('cardPaymentBrick'),
      formData: { email: formData.email, cpf: formData.cpf }
    });

    // Timeout de segurança para detectar montagens travadas
    if (mountTimeoutRef.current) {
      clearTimeout(mountTimeoutRef.current);
    }
    
    mountTimeoutRef.current = setTimeout(() => {
      if (isMountingRef.current) {
        console.error('[mountCardPaymentBrick] Montagem travada, resetando...');
        isMountingRef.current = false;
        isBrickMountedRef.current = false;
        cardPaymentBrickRef.current = null;
      }
    }, 10000);

    // ✅ ETAPA 4: Aguardar DOM estar estável
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // ✅ ETAPA 4: Verificar múltiplas vezes se container existe
    let container = document.getElementById('cardPaymentBrick');
    let attempts = 0;
    
    while (!container && attempts < 5) {
      console.log('[mountCardPaymentBrick] Container não encontrado, aguardando... (tentativa', attempts + 1, ')');
      await new Promise(resolve => setTimeout(resolve, 200));
      container = document.getElementById('cardPaymentBrick');
      attempts++;
    }
    
    if (!container) {
      console.error('[PaymentModal] Container #cardPaymentBrick não encontrado após 5 tentativas');
      isMountingRef.current = false;
      if (mountTimeoutRef.current) {
        clearTimeout(mountTimeoutRef.current);
      }
      return;
    }

    // Limpar container antes de montar
    container.innerHTML = '';

    console.log('[mountCardPaymentBrick] Container encontrado, montando brick...');

    // CRITICAL: Só usar dados REAIS (não placeholders)
    const payerEmail = formData.email;
    const payerCPF = formData.cpf.replace(/\D/g, '');

    // Validação final antes de montar
    if (!payerEmail || !payerCPF || payerCPF.length !== 11) {
      console.warn('[PaymentModal] Dados insuficientes para montar Brick:', { payerEmail, payerCPF });
      isMountingRef.current = false;
      if (mountTimeoutRef.current) {
        clearTimeout(mountTimeoutRef.current);
      }
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
        customization: {
          visual: {
            style: {
              theme: 'default'
            }
          },
          // ✅ ETAPA 3: Permitir paste nos campos (pode ser limitado pelo MP)
          paymentMethods: {
            creditCard: 'all',
            debitCard: 'all'
          }
        },
        callbacks: {
          onReady: () => {
            console.log('[Brick onReady] ✅ Card Payment Brick montado com sucesso');
            console.log('[Brick onReady] Container:', document.getElementById('cardPaymentBrick'));
            isBrickMountedRef.current = true;
            brickRecoverAttemptsRef.current = 0;
            isMountingRef.current = false;
            if (mountTimeoutRef.current) {
              clearTimeout(mountTimeoutRef.current);
            }
          },
          onSubmit: async (brickSubmitData: any) => {
            // Prevenir múltiplos submits simultâneos
            if (isSubmittingRef.current) {
              console.warn('[Brick onSubmit] Submit already in progress, ignoring');
              return;
            }

            isSubmittingRef.current = true;

            try {
              console.log('[Brick onSubmit] Received data:', brickSubmitData);
              
              // Validar dados ANTES de processar
              if (!validateForm()) {
                setError('Preencha todos os campos antes de finalizar o pagamento');
                setPaymentStatus('idle');
                return;
              }

              // Resolver wrapper do Brick
              const cardData = brickSubmitData?.getCardFormData
                ? await brickSubmitData.getCardFormData()
                : brickSubmitData;
              
              console.log('[Brick onSubmit] Card data resolved:', cardData);
              
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
            } finally {
              // Liberar flag após 2 segundos (prevenir double-click)
              setTimeout(() => {
                isSubmittingRef.current = false;
              }, 2000);
            }
          },
          onError: (error: any) => {
            console.error('[Card Payment Brick] Error:', error);

            const cause = error?.cause || error?.cause?.[0]?.code || '';
            const message: string = error?.message || '';
            const isSecureFieldsFailure =
              cause === 'fields_setup_failed_after_3_tries' ||
              cause === 'fields_setup_failed' ||
              message.toLowerCase().includes('secure fields failed') ||
              message.toLowerCase().includes('fields_setup_failed');

            if (isSecureFieldsFailure) {
              console.warn('[Card Payment Brick] Secure Fields setup failure detectado');
              
              if (brickRecoverAttemptsRef.current >= 2) {
                console.error('[Card Payment Brick] Máximo de tentativas atingido');
                setError('Não foi possível carregar o formulário de pagamento. Por favor, recarregue a página.');
                return;
              }
              
              brickRecoverAttemptsRef.current += 1;
              
              // Desmontar completamente
              try {
                if (cardPaymentBrickRef.current) {
                  cardPaymentBrickRef.current.unmount();
                }
              } catch (e) {
                console.warn('[Card Payment Brick] Erro ao desmontar:', e);
              } finally {
                cardPaymentBrickRef.current = null;
                isBrickMountedRef.current = false;
                isMountingRef.current = false;
                if (mountTimeoutRef.current) {
                  clearTimeout(mountTimeoutRef.current);
                }
              }
              
              // Aguardar mais tempo antes de remontar (1.5s em vez de 400ms)
              setTimeout(() => {
                if (open && !showSummary && paymentMethod === 'card' && mpInstanceRef.current) {
                  console.log('[Card Payment Brick] Tentando remontagem após espera');
                  mountCardPaymentBrick();
                }
              }, 1500);
              
              return;
            }

            // ✅ Exibir erros críticos ao usuário
            if (error?.cause?.[0]?.code === 'E301' || message.includes('token')) {
              setError('Erro ao processar dados do cartão. Verifique as informações e tente novamente.');
              setPaymentStatus('idle');
            } else if (message.includes('security_code')) {
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
    } finally {
      isMountingRef.current = false;
      if (mountTimeoutRef.current) {
        clearTimeout(mountTimeoutRef.current);
      }
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

  // ✅ ETAPA 6: Validação pré-pagamento (checklist completo)
  const validatePaymentReadiness = (): boolean => {
    const checks = {
      deviceId: !!deviceId,
      cpf: !!formData.cpf && formData.cpf.replace(/\D/g, '').length === 11,
      email: !!formData.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email),
      phone: !!formData.phone && formData.phone.replace(/\D/g, '').length >= 10,
      address: !!(patientAddress?.cep && patientAddress?.city && patientAddress?.state && patientAddress?.street_name),
      name: formData.name.trim().split(' ').length >= 2
    };

    console.log('[Payment Readiness Check] 🔒', checks);

    if (!checks.deviceId) {
      toast.error('🔒 Erro de segurança: Device ID não capturado. Recarregue a página e tente novamente.', {
        duration: 5000
      });
      return false;
    }

    if (!checks.address) {
      toast.error('📍 Complete seu endereço no perfil antes de finalizar o pagamento. Endereços incompletos aumentam as recusas.', {
        duration: 6000
      });
      return false;
    }

    if (!checks.cpf || !checks.email || !checks.phone) {
      toast.error('📋 Dados pessoais incompletos (CPF, email ou telefone)');
      return false;
    }

    if (!checks.name) {
      toast.error('👤 Digite seu nome completo (nome e sobrenome)');
      return false;
    }

    return true;
  };

  const handleCardSubmit = async (cardFormData: any) => {
    console.log('[handleCardSubmit] START - Card form data:', cardFormData);
    console.log('[handleCardSubmit] formData:', formData);
    console.log('[handleCardSubmit] SKU:', sku, 'Amount:', amount);
    
    // ✅ ETAPA 6: Validar readiness ANTES de processar
    if (!validatePaymentReadiness()) {
      setPaymentStatus('idle');
      return;
    }
    
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
      
      // Validação do checklist de dados de pagamento
      console.log('[Payment Validation Checklist]', {
        '✅ Device ID': deviceId ? 'PRESENTE' : '⚠️ AUSENTE',
        '✅ CPF': formData.cpf ? 'PRESENTE' : '❌ AUSENTE',
        '✅ Email': formData.email ? 'PRESENTE' : '❌ AUSENTE',
        '✅ Telefone': formData.phone ? 'PRESENTE' : '❌ AUSENTE',
        '✅ Endereço': patientAddress ? 'PRESENTE' : '⚠️ AUSENTE (opcional)',
        '✅ Card Token': cardFormData.token ? 'PRESENTE' : '❌ AUSENTE',
        '✅ Payment Method': cardFormData.payment_method_id ? 'PRESENTE' : '❌ AUSENTE'
      });
      
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
          },
          // ✅ ETAPA 3: Parse telefone robusto
          phone: (() => {
            const phoneClean = formData.phone.replace(/\D/g, '');
            let areaCode = '';
            let phoneNumber = '';

            if (phoneClean.startsWith('55')) {
              // Formato E.164 (+5511999998888)
              areaCode = phoneClean.substring(2, 4); // DDD
              phoneNumber = phoneClean.substring(4); // Número
            } else if (phoneClean.length === 11) {
              // Formato nacional (11999998888)
              areaCode = phoneClean.substring(0, 2);
              phoneNumber = phoneClean.substring(2);
            } else if (phoneClean.length === 10) {
              // Formato nacional sem 9 (1199998888)
              areaCode = phoneClean.substring(0, 2);
              phoneNumber = phoneClean.substring(2);
            } else {
              // Fallback: tentar extrair primeiros 2 dígitos como DDD
              areaCode = phoneClean.substring(0, 2) || '11';
              phoneNumber = phoneClean.substring(2) || phoneClean;
            }

            console.log('[Phone Parse]', { original: formData.phone, clean: phoneClean, areaCode, phoneNumber });
            
            return {
              area_code: areaCode,
              number: phoneNumber
            };
          })(),
          address: patientAddress ? {
            zip_code: patientAddress.cep?.replace(/\D/g, ''),
            street_name: patientAddress.street_name,
            street_number: patientAddress.street_number ? parseInt(patientAddress.street_number) : undefined
          } : undefined
        },
        token: cardFormData.token,
        payment_method_id: cardFormData.payment_method_id,
        installments: cardFormData.installments || 1,
        metadata: {
          order_id: orderId,
          schedulePayload
        },
        device_id: deviceId || undefined
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
      } else if (data.status === 'pending' && data.status_detail === 'pending_challenge') {
        // Usuário precisa completar desafio 3DS
        console.log('[3DS] Challenge required:', data);
        
        if (data.three_d_secure_info?.external_resource_url) {
          setThreeDSecureUrl(data.three_d_secure_info.external_resource_url);
          setPaymentStatus('in_process');
          setPaymentId(data.payment_id);
          toast.info('Autenticação adicional necessária');
        }
      } else if (data.status === 'in_process' || data.status === 'pending') {
        setPaymentStatus('in_process');
        setPaymentId(data.payment_id);
        toast.info('Pagamento em análise. Aguarde confirmação.');
      } else {
        setPaymentStatus('rejected');
        
        // ✅ ETAPA 8: Mensagens específicas e úteis
        const rejectMessages: Record<string, string> = {
          'cc_rejected_insufficient_amount': '💳 Cartão sem saldo suficiente. Tente outro cartão ou PIX.',
          'cc_rejected_bad_filled_security_code': '🔒 Código de segurança (CVV) incorreto. Verifique e tente novamente.',
          'cc_rejected_bad_filled_card_number': '❌ Número do cartão inválido. Verifique os dados.',
          'cc_rejected_bad_filled_date': '📅 Data de validade inválida.',
          'cc_rejected_call_for_authorize': '🔒 Cartão bloqueado. Entre em contato com seu banco.',
          'cc_rejected_high_risk': `🔒 PAGAMENTO RECUSADO POR SEGURANÇA

Para sua proteção, este pagamento foi bloqueado pelo sistema de segurança do Mercado Pago.

✅ RECOMENDAÇÕES:
• Use outro cartão de crédito
• Pague com PIX (aprovação instantânea)
• Entre em contato com seu banco
• Certifique-se de que seu endereço está completo no perfil

Geralmente isso ocorre quando:
- É a primeira compra com este cartão
- Dados incompletos no cadastro
- Endereço não cadastrado`,
          'cc_rejected_invalid_installments': '📊 Número de parcelas inválido para este cartão.',
          'cc_rejected_duplicated_payment': '⚠️ Pagamento duplicado detectado.',
          'cc_rejected_card_disabled': '🚫 Cartão desabilitado. Entre em contato com seu banco.',
          'cc_rejected_max_attempts': '⚠️ Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
          'cc_rejected_bad_filled_other': '❌ Dados do cartão incorretos. Verifique todas as informações.',
          'cc_rejected_blacklist': '🚫 Cartão não aceito. Use outro cartão ou PIX.',
          'cc_amount_rate_limit_exceeded': '💰 Valor excede o limite permitido para este cartão.'
        };
        
        const userMessage = data.status_detail 
          ? rejectMessages[data.status_detail] || `Pagamento rejeitado (${data.status_detail}). Use outro cartão ou tente PIX.` 
          : 'Pagamento rejeitado. Use outro cartão ou tente PIX.';
        
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
    // Prevenir múltiplos submits
    if (isSubmittingRef.current || paymentStatus === 'processing') {
      console.warn('[handlePixSubmit] Submit already in progress, ignoring');
      return;
    }

    if (!validateForm()) return;

    // Setar flag ANTES de iniciar
    isSubmittingRef.current = true;

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
        },
        device_id: deviceId || undefined
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
    } finally {
      // Liberar flag após 2 segundos
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 2000);
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
    setShowSummary(true); // Voltar para o resumo
    setPaymentMethod(undefined);
    setPaymentStatus('idle');
    setError('');
    setPixData(null);
    if (cardPaymentBrickRef.current) {
      cardPaymentBrickRef.current.unmount();
      cardPaymentBrickRef.current = null;
      isBrickMountedRef.current = false;
    }
  };

  const handlePaymentMethodSelect = (method: 'card' | 'pix') => {
    setPaymentMethod(method);
    setShowSummary(false); // Transicionar para tela de pagamento
  };

  const handleBackToSummary = () => {
    setShowSummary(true);
    setPaymentMethod(undefined);
    // Desmontar Brick se montado
    if (cardPaymentBrickRef.current) {
      try {
        cardPaymentBrickRef.current.unmount();
      } catch (err) {
        console.warn('[handleBackToSummary] Erro ao desmontar brick:', err);
      } finally {
        cardPaymentBrickRef.current = null;
        isBrickMountedRef.current = false;
      }
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
          <p className="text-muted-foreground mb-4 text-center px-4">
            {userMessage || error || 'Verifique os dados e tente novamente'}
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 max-w-md">
            <p className="text-sm text-blue-800 font-medium mb-2">💡 Sugestões:</p>
            <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
              <li>Verifique se os dados do cartão estão corretos</li>
              <li>Tente usar outro cartão</li>
              <li>Use PIX (aprovação instantânea)</li>
              <li>Entre em contato com seu banco se o problema persistir</li>
            </ul>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={handleTryAgain} variant="outline">
              Tentar Outro Cartão
            </Button>
            <Button onClick={() => setPaymentMethod('pix')} variant="default">
              Pagar com PIX
            </Button>
          </div>
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
            <p className="text-lg font-medium mb-2">
              {threeDSecureUrl ? 'Autenticação Necessária' : 'Pagamento em análise...'}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {threeDSecureUrl 
                ? 'Complete a autenticação do seu banco para finalizar o pagamento.'
                : 'Aguarde enquanto validamos seu pagamento. Você será notificado quando o pagamento for aprovado.'
              }
            </p>
          </div>
          
          {threeDSecureUrl && (
            <Button 
              onClick={() => window.location.href = threeDSecureUrl} 
              className="w-full max-w-xs mx-auto"
              size="lg"
            >
              Continuar Autenticação
            </Button>
          )}
          
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

  const modalBody = (
    <>
      {/* Overlay de loading durante processamento */}
      {open && (paymentStatus === 'processing' || paymentStatus === 'in_process') && (
        <>
          {console.log('[Overlay] Rendering overlay:', { paymentStatus })}
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {paymentStatus === 'processing' ? 'Processando pagamento...' : 'Aguardando confirmação...'}
              </p>
            </div>
          </div>
        </>
      )}
      
      <div className="flex flex-col space-y-1.5 text-center sm:text-left">
        <h2 className="text-lg font-semibold leading-none tracking-tight">
          {showSummary ? 'Finalizar Compra' : serviceName}
        </h2>
        {!showSummary && (
          <p className="text-2xl font-bold text-primary">
            R$ {(amount / 100).toFixed(2).replace('.', ',')}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {userMessage && paymentStatus === 'rejected' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-600 text-sm">{userMessage}</p>
          </div>
        )}

        {renderStatus()}

        {/* Resumo da compra - tela inicial */}
        {paymentStatus === 'idle' && showSummary && (
          <>
            {console.log('[UI] Renderizando resumo:', { showSummary, isLoadingUserData, paymentStatus })}
            
            {/* Indicador de carregamento */}
            {isLoadingUserData && (
              <div className="flex items_center gap-2 p-4 bg-muted/50 rounded-lg mb-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Carregando seus dados...</span>
              </div>
            )}
            
            <PaymentSummary
              serviceName={serviceName}
              amount={amount}
              formData={formData}
              recurring={recurring}
              frequency={frequency}
              frequencyType={frequencyType}
              onSelectPaymentMethod={handlePaymentMethodSelect}
            />
          </>
        )}

        {paymentStatus === 'idle' && !showSummary && (
          <div className="space-y-4">
            {/* Botão Voltar */}
            <Button
              onClick={handleBackToSummary}
              variant="ghost"
              size="sm"
              className="mb-2"
            >
              ← Voltar para resumo
            </Button>

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
                    <h3 className="font-semibold text_sm">Dados Pessoais</h3>
                    <div>
                      <Label htmlFor="name">Nome Completo</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Seu nome completo"
                        autoComplete="name"
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
                        autoComplete="email"
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
                        autoComplete="off"
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
                        autoComplete="tel"
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
                  <div 
                    key={`brick-${paymentMethod}`}
                    id="cardPaymentBrick" 
                    className="mp-brick-container min-h-[400px]"
                  ></div>
                )}

                {/* Botão PIX */}
                {paymentMethod === 'pix' && (
                  <>
                    <Button 
                      onClick={handlePixSubmit} 
                      className="w-full" 
                      size="lg"
                    >
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
    </>
  );

  // Versão com componentes Radix para produção
  const modalBodyRadix = (
    <>
      {renderStatus()}
      
      {(paymentStatus === 'processing' || paymentStatus === 'in_process') && (
        <>
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {paymentStatus === 'processing' ? 'Processando pagamento...' : 'Aguardando confirmação...'}
              </p>
            </div>
          </div>
        </>
      )}
      
      <DialogHeader>
        <DialogTitle>
          {showSummary ? 'Finalizar Compra' : serviceName}
        </DialogTitle>
        {!showSummary && (
          <p className="text-2xl font-bold text-primary">
            R$ {(amount / 100).toFixed(2).replace('.', ',')}
          </p>
        )}
      </DialogHeader>

      <div className="flex-1 overflow-y-auto">
        {userMessage && paymentStatus === 'rejected' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-600 text-sm">{userMessage}</p>
          </div>
        )}

        {renderStatus()}

        {/* Resumo da compra - tela inicial */}
        {paymentStatus === 'idle' && showSummary && (
          <>
            {console.log('[UI] Renderizando resumo:', { showSummary, isLoadingUserData, paymentStatus })}
            
            {/* Indicador de carregamento */}
            {isLoadingUserData && (
              <div className="flex items_center gap-2 p-4 bg-muted/50 rounded-lg mb-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Carregando seus dados...</span>
              </div>
            )}
            
            <PaymentSummary
              serviceName={serviceName}
              amount={amount}
              formData={formData}
              recurring={recurring}
              frequency={frequency}
              frequencyType={frequencyType}
              onSelectPaymentMethod={handlePaymentMethodSelect}
            />
          </>
        )}

        {paymentStatus === 'idle' && !showSummary && (
          <div className="space-y-4">
            {/* Botão Voltar */}
            <Button
              onClick={handleBackToSummary}
              variant="ghost"
              size="sm"
              className="mb-2"
            >
              ← Voltar para resumo
            </Button>

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
                    <h3 className="font-semibold text_sm">Dados Pessoais</h3>
                    <div>
                      <Label htmlFor="name">Nome Completo</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Seu nome completo"
                        autoComplete="name"
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
                        autoComplete="email"
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
                        autoComplete="off"
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
                        autoComplete="tel"
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
                  <div 
                    key={`brick-${paymentMethod}`}
                    id="cardPaymentBrick" 
                    className="mp-brick-container min-h-[400px]"
                  ></div>
                )}

                {/* Botão PIX */}
                {paymentMethod === 'pix' && (
                  <>
                    <Button 
                      onClick={handlePixSubmit} 
                      className="w-full" 
                      size="lg"
                    >
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
    </>
  );

  const isInlineFallback = typeof window !== 'undefined' && window.location.hostname.includes('lovableproject.com');

  if (!open) return null;

  if (isInlineFallback) {
    console.log('[PaymentModal] Inline fallback ativo');
    return (
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100]">
        <div 
          className="absolute inset-0 bg-black/80" 
          onClick={(e) => {
            // Não fechar se estiver processando
            if (paymentStatus === 'processing' || paymentStatus === 'in_process') {
              e.preventDefault();
              return;
            }
            onOpenChange(false);
          }} 
        />
        <div className="fixed left-1/2 top-1/2 z-[100] w-full max-w-[500px] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 border bg-background p-4 sm:p-6 shadow-lg sm:rounded-lg flex flex-col overflow-hidden">
          {modalBody}
        </div>
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-4 sm:p-6" aria-describedby="payment-desc">
        {modalBodyRadix}
      </DialogContent>
    </Dialog>
  );
}
