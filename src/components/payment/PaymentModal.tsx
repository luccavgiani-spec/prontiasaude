import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, AlertCircle, CreditCard } from "lucide-react";
import { validateCPF } from "@/lib/cpf-validator";
import { validatePhoneE164 } from "@/lib/validations";
import { supabase } from "@/integrations/supabase/client";
import { getAppointments } from "@/lib/appointments";
import { toast } from "sonner";
import { PixPaymentForm } from "./PixPaymentForm";
import { PaymentSummary } from "./PaymentSummary";
import { MP_PUBLIC_KEY } from "@/lib/constants";

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
  frequencyType?: "months" | "days";
  onSuccess?: () => void;
}

type PaymentMethod = "card" | "pix";
type PaymentStatus = "idle" | "processing" | "approved" | "rejected" | "pending_pix" | "in_process";

interface FormData {
  name: string;
  email: string;
  cpf: string;
  phone: string;
}

interface PayerFormData {
  name: string;
  cpf: string;
  phone: string;
  cep: string;
  street_name: string;
  street_number: string;
  neighborhood: string;
  city: string;
  state: string;
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
  frequencyType = "months",
  onSuccess,
}: PaymentModalProps) {
  const [showSummary, setShowSummary] = useState(true); // Começa mostrando resumo
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | undefined>(undefined);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle");
  const [formData, setFormData] = useState<FormData>({
    name: "",
    email: "",
    cpf: "",
    phone: "",
  });
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [error, setError] = useState<string>("");
  const [userMessage, setUserMessage] = useState<string>("");
  const [paymentId, setPaymentId] = useState<string>("");
  const [lastPaymentId, setLastPaymentId] = useState<string>("");
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
  const [hasRequiredData, setHasRequiredData] = useState(false);
  const [isLoadingUserData, setIsLoadingUserData] = useState(true);
  const [patientGender, setPatientGender] = useState<string>("");
  const [redirectUrl, setRedirectUrl] = useState<string>("");
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
  const [patientCreatedAt, setPatientCreatedAt] = useState<string | null>(null);

  // Estados para overlay de erro global
  const [showErrorOverlay, setShowErrorOverlay] = useState(false);
  const [errorOverlayMessage, setErrorOverlayMessage] = useState<string>("");

  // Estados para cartão de terceiros
  const [isThirdPartyCard, setIsThirdPartyCard] = useState(false);
  const [payerData, setPayerData] = useState<PayerFormData>({
    name: "",
    cpf: "",
    phone: "",
    cep: "",
    street_name: "",
    street_number: "",
    neighborhood: "",
    city: "",
    state: "",
  });

  const mpInstanceRef = useRef<any>(null);
  const cardPaymentBrickRef = useRef<any>(null);
  const isBrickMountedRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const brickRecoverAttemptsRef = useRef(0);
  const isMountingRef = useRef(false);
  const mountTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Função de validação de data de validade do cartão
  const validateCardExpiry = (cardData: any): { valid: boolean; error?: string } => {
    if (!cardData.expiration_month || !cardData.expiration_year) {
      return { valid: true };
    }

    const month = parseInt(cardData.expiration_month);
    const year = parseInt(cardData.expiration_year);

    // Validar formato do mês
    if (month < 1 || month > 12) {
      return {
        valid: false,
        error: "Mês de validade inválido. Use formato MM/AA (ex: 12/25)",
      };
    }

    // Validar se não está expirado
    const now = new Date();
    const currentYear = now.getFullYear() % 100; // Últimos 2 dígitos
    const currentMonth = now.getMonth() + 1;

    // Normalizar ano de 2 ou 4 dígitos
    const normalizedYear = year < 100 ? year : year % 100;

    if (normalizedYear < currentYear || (normalizedYear === currentYear && month < currentMonth)) {
      return {
        valid: false,
        error: "Cartão vencido. Verifique a data de validade ou use outro cartão.",
      };
    }

    return { valid: true };
  };

  // Reset de segurança: liberar flag após 10 segundos (caso algo dê errado)
  useEffect(() => {
    if (isSubmittingRef.current) {
      const timeout = setTimeout(() => {
        console.warn("[Safety] Resetting isSubmittingRef after 10s timeout");
        isSubmittingRef.current = false;
      }, 10000);

      return () => clearTimeout(timeout);
    }
  }, [paymentStatus]);
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Cria uma função global que abre o modal
      (window as any).__openPaymentModal = (sku?: string) => {
        // Se você guarda o serviço/SKU em estado, defina aqui também:
        // setSelectedService?.(sku);
        onOpenChange(true);
      };
    }
  }, [onOpenChange]);

  // Carregar dados do usuário e inicializar MP quando modal abre
  useEffect(() => {
    if (open) {
      console.log("[Modal] Abrindo modal, resetando flags...");
      setShowSummary(true); // Reset para resumo ao abrir
      setPaymentMethod(undefined); // Reset método de pagamento
      isSubmittingRef.current = false; // NOVO: Reset de segurança
      loadUserData();
      loadMercadoPagoSDK();
    } else {
      // Reset ao fechar
      console.log("[Modal] Fechando modal, limpando estado...");
      setShowSummary(true);
      setPaymentMethod(undefined);
      setPaymentStatus("idle");
      setPixData(null);
      setError("");
      setUserMessage("");
      setDeviceId(null);
      setPatientAddress(null);
      setThreeDSecureUrl(null);
      isSubmittingRef.current = false; // Garantir reset ao fechar
      setIsLoadingUserData(false);
      setIsPollingPayment(false);

      // Limpar timeouts
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

  const loadUserData = async () => {
    console.log("[loadUserData] Starting...");
    setIsLoadingUserData(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setIsUserLoggedIn(false);
        return;
      }

      setIsUserLoggedIn(true);

      const { data: patient } = await supabase.from("patients").select("*").eq("id", user.id).single();

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
        setPatientGender(patient.gender || "");
        setPatientCreatedAt(patient.created_at); // ✅ FASE 2.1: Capturar data real de cadastro

        if (hasData) {
          setFormData({
            name: `${patient.first_name} ${patient.last_name}`,
            email: user.email,
            cpf: patient.cpf,
            phone: patient.phone_e164,
          });
        }

        // ✅ ETAPA 4 (OPÇÃO A): Validar endereço completo antes de checkout
        const patientAddressData = {
          cep: patient.cep,
          city: patient.city,
          state: patient.state,
          street_name: patient.address_line,
          street_number: patient.address_number,
        };

        const hasCompleteAddress = !!(
          patientAddressData.cep &&
          patientAddressData.city &&
          patientAddressData.state &&
          patientAddressData.street_name
        );

        if (!hasCompleteAddress) {
          console.warn("[Payment Security] ⚠️ Endereço incompleto detectado - RISCO DE RECUSA");
          toast.warning("⚠️ Complete seu endereço no perfil para aumentar a aprovação do pagamento", {
            duration: 5000,
          });
        }

        setPatientAddress(patientAddressData);
      }

      // Verificar plano ativo antes de permitir checkout
      const { checkPatientPlanActive } = await import("@/lib/patient-plan");
      const planStatus = await checkPatientPlanActive(user.email!);

      // ✅ REGRA DE NEGÓCIO: Laudos Psicológicos SEMPRE cobram, mesmo com plano ativo
      const isLaudo = 
        sku === 'OVM9892' || 
        serviceName?.toLowerCase().includes('laudo') || 
        especialidade?.toLowerCase().includes('laudo');

      if (planStatus.canBypassPayment && !isLaudo) {
        toast.info("Você já tem um plano ativo! Redirecionando...");
        setPaymentStatus("idle");
        onOpenChange(false);

        // Mapear gender para 'M' ou 'F'
        const mapSexo = (g?: string) => (g?.toUpperCase().startsWith("F") ? "F" : "M");

        // Agendar direto com plano ativo
        const { scheduleWithActivePlan } = await import("@/lib/schedule-service");
        const result = await scheduleWithActivePlan({
          cpf: patient?.cpf || "",
          email: user.email!,
          nome: patient ? `${patient.first_name || ""} ${patient.last_name || ""}`.trim() : "",
          telefone: patient?.phone_e164 || "",
          sku: sku,
          plano_ativo: true,
          sexo: mapSexo(patient?.gender),
        });

        if (result.ok && result.url) {
          window.location.href = result.url;
        } else {
          toast.error(result.error || "Erro ao agendar");
        }
        return;
      } else if (planStatus.canBypassPayment && isLaudo) {
        console.log("[PaymentModal] Bypass desativado para Laudos Psicológicos (sempre cobrado).");
      }
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      console.log("[loadUserData] Finished, setting isLoadingUserData = false");
      setIsLoadingUserData(false);
    }
  };

  const loadMercadoPagoSDK = () => {
    if (window.MercadoPago) {
      mpInstanceRef.current = new window.MercadoPago(MP_PUBLIC_KEY, {
        locale: "pt-BR",
      });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.async = true;
    script.onload = () => {
      mpInstanceRef.current = new window.MercadoPago(MP_PUBLIC_KEY, {
        locale: "pt-BR",
      });
    };
    document.body.appendChild(script);
  };

  // Limpar erros ao trocar método de pagamento
  useEffect(() => {
    if (open && paymentStatus === "idle") {
      setError("");
      setUserMessage("");
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
      paymentMethod !== "card" &&
      paymentMethod !== undefined &&
      isBrickMountedRef.current &&
      cardPaymentBrickRef.current
    ) {
      console.log("[Brick Unmount] Desmontando brick (troca de método para:", paymentMethod, ")");
      console.log("[Brick Unmount] Estado:", {
        paymentMethod,
        isBrickMounted: isBrickMountedRef.current,
        cardPaymentBrickRef: !!cardPaymentBrickRef.current,
      });
      try {
        cardPaymentBrickRef.current.unmount();
      } catch (err) {
        console.warn("[PaymentModal] Erro ao desmontar brick:", err);
      } finally {
        cardPaymentBrickRef.current = null;
        isBrickMountedRef.current = false;
      }
    }
  }, [paymentMethod, open, showSummary]);

  // Montar Card Payment Brick APENAS quando tiver dados mínimos válidos E showSummary === false
  useEffect(() => {
    console.log("[Brick Mount Effect] Triggered with:", {
      open,
      showSummary,
      paymentMethod,
      paymentStatus,
      isLoadingUserData,
      hasMPInstance: !!mpInstanceRef.current,
      hasRequiredData,
      isUserLoggedIn,
      isBrickMounted: isBrickMountedRef.current,
    });

    // ✅ Só montar se não estiver mostrando o resumo
    if (showSummary) {
      console.log("[Brick Mount Effect] Skipping (showing summary)");
      return;
    }

    // Não mexer no Brick durante processamento
    if (paymentStatus === "processing" || paymentStatus === "in_process" || isSubmittingRef.current) {
      console.log("[Brick Mount Effect] Skipping (payment in progress or submitting)");
      return;
    }

    // Verificar se mpInstanceRef está pronto
    if (!mpInstanceRef.current) {
      console.log("[Brick Mount Effect] MP Instance não está pronta ainda");
      return;
    }

    if (!open || paymentMethod !== "card" || isLoadingUserData) {
      return;
    }

    // Verifica se tem dados mínimos: email válido + CPF com 11 dígitos
    const emailValid = formData.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email);
    const cpfValid = formData.cpf && formData.cpf.replace(/\D/g, "").length === 11;
    const hasMinimalPayerData = emailValid && cpfValid;

    // ✅ Montar se tiver dados mínimos OU dados completos
    if (hasRequiredData || hasMinimalPayerData) {
      if (!isBrickMountedRef.current) {
        mountCardPaymentBrick();
      }
    } else {
      // Desmontar quando não estiver no método cartão
      if (isBrickMountedRef.current && cardPaymentBrickRef.current && paymentMethod !== "card") {
        console.log("[Brick Mount Effect] Unmounting: payment method changed from card");
        cardPaymentBrickRef.current.unmount();
        isBrickMountedRef.current = false;
      }
    }
  }, [
    open,
    showSummary,
    paymentMethod,
    isLoadingUserData,
    hasRequiredData,
    isUserLoggedIn,
    formData.email,
    formData.cpf,
    paymentStatus,
  ]);

  // Scroll automático para o topo quando erro aparece
  useEffect(() => {
    if (paymentStatus === "rejected" && open) {
      const modalContent = document.querySelector('[role="dialog"]');
      if (modalContent) {
        (modalContent as HTMLElement).scrollTop = 0;
      }
    }
  }, [paymentStatus, open]);

  // Cleanup when modal closes: reset error/overlay/state so it doesn't reopen automatically
  useEffect(() => {
    if (!open) {
      setPaymentStatus("idle");
      setShowErrorOverlay(false);
      setErrorOverlayMessage("");
      setError("");
      setUserMessage("");
      setPixData(null);
      setPaymentMethod(undefined);
      setShowSummary(true);
    }
  }, [open]);

  // Failsafe: mostra overlay de erro se modal ainda estiver aberto após recusa
  useEffect(() => {
    if (open && paymentStatus === "rejected") {
      const t = setTimeout(() => {
        if (open) {
          console.warn("[Overlay] Failsafe trigger while modal still open after rejection");
          setShowErrorOverlay(true);
          if (!errorOverlayMessage) {
            setErrorOverlayMessage(userMessage || "Pagamento recusado. Tente novamente.");
          }
        }
      }, 800);
      return () => clearTimeout(t);
    }
  }, [open, paymentStatus, userMessage, errorOverlayMessage]);

  const mountCardPaymentBrick = async () => {
    // Guard: Prevenir montagens concorrentes
    if (isMountingRef.current) {
      console.warn("[mountCardPaymentBrick] Montagem já em andamento, ignorando");
      return;
    }
    if (isBrickMountedRef.current || !mpInstanceRef.current) {
      console.log("[mountCardPaymentBrick] Skipping:", {
        isBrickMounted: isBrickMountedRef.current,
        hasMPInstance: !!mpInstanceRef.current,
      });
      return;
    }

    isMountingRef.current = true;

    console.log("[mountCardPaymentBrick] Iniciando montagem. Estado:", {
      isBrickMounted: isBrickMountedRef.current,
      hasMPInstance: !!mpInstanceRef.current,
      hasContainer: !!document.getElementById("cardPaymentBrick"),
      formData: { email: formData.email, cpf: formData.cpf },
    });

    // Timeout de segurança para detectar montagens travadas
    if (mountTimeoutRef.current) {
      clearTimeout(mountTimeoutRef.current);
    }

    mountTimeoutRef.current = setTimeout(() => {
      if (isMountingRef.current) {
        console.error("[mountCardPaymentBrick] Montagem travada, resetando...");
        isMountingRef.current = false;
        isBrickMountedRef.current = false;
        cardPaymentBrickRef.current = null;
      }
    }, 10000);

    // ✅ ETAPA 4: Aguardar DOM estar estável
    await new Promise((resolve) => setTimeout(resolve, 300));

    // ✅ ETAPA 4: Verificar múltiplas vezes se container existe
    let container = document.getElementById("cardPaymentBrick");
    let attempts = 0;

    while (!container && attempts < 5) {
      console.log("[mountCardPaymentBrick] Container não encontrado, aguardando... (tentativa", attempts + 1, ")");
      await new Promise((resolve) => setTimeout(resolve, 200));
      container = document.getElementById("cardPaymentBrick");
      attempts++;
    }

    if (!container) {
      console.error("[PaymentModal] Container #cardPaymentBrick não encontrado após 5 tentativas");
      isMountingRef.current = false;
      if (mountTimeoutRef.current) {
        clearTimeout(mountTimeoutRef.current);
      }
      return;
    }

    // Limpar container antes de montar
    container.innerHTML = "";

    console.log("[mountCardPaymentBrick] Container encontrado, montando brick...");

    // CRITICAL: Só usar dados REAIS (não placeholders)
    const payerEmail = formData.email;
    const payerCPF = formData.cpf.replace(/\D/g, "");

    // Validação final antes de montar
    if (!payerEmail || !payerCPF || payerCPF.length !== 11) {
      console.warn("[PaymentModal] Dados insuficientes para montar Brick:", { payerEmail, payerCPF });
      isMountingRef.current = false;
      if (mountTimeoutRef.current) {
        clearTimeout(mountTimeoutRef.current);
      }
      return;
    }

    try {
      const bricksBuilder = mpInstanceRef.current.bricks();

      const cardPaymentBrick = await bricksBuilder.create("cardPayment", "cardPaymentBrick", {
        initialization: {
          amount: amount / 100,
          payer: {
            email: payerEmail,
            identification: {
              type: "CPF",
              number: payerCPF,
            },
          },
        },
        customization: {
          visual: {
            style: {
              theme: "default",
            },
          },
          // ✅ ETAPA 3: Permitir paste nos campos (pode ser limitado pelo MP)
          paymentMethods: {
            creditCard: "all",
            debitCard: "all",
          },
        },
        callbacks: {
          onReady: async () => {
            console.log("[Brick onReady] ✅ Card Payment Brick montado com sucesso");
            console.log("[Brick onReady] Container:", document.getElementById("cardPaymentBrick"));
            isBrickMountedRef.current = true;
            brickRecoverAttemptsRef.current = 0;
            isMountingRef.current = false;
            if (mountTimeoutRef.current) {
              clearTimeout(mountTimeoutRef.current);
            }

            // Device ID será capturado no onSubmit (não aqui)
            console.log("[Device ID] ⏳ Aguardando captura no momento do submit");
          },
          onSubmit: (brickSubmitData: any) => {
            console.log("[Brick onSubmit] start");
            return new Promise<void>(async (resolve) => {
              // NOVO: Resetar flag primeiro (caso esteja travada de submit anterior)
              const wasSubmitting = isSubmittingRef.current;
              if (wasSubmitting) {
                console.warn("[Brick onSubmit] Flag já estava em true, resetando...");
              }

              // Prevenir múltiplos submits simultâneos
              if (isSubmittingRef.current) {
                console.warn("[Brick onSubmit] Submit already in progress, ignoring");
                resolve();
                return;
              }

              isSubmittingRef.current = true;
              console.log("[Brick onSubmit] Flag setada, iniciando processamento...");

              // ✅ CAPTURAR Device ID NO MOMENTO DO SUBMIT (não no onReady)
              try {
                const capturedDeviceId = await cardPaymentBrick.getDeviceId();
                if (capturedDeviceId) {
                  console.log("[Device ID] ✅ Capturado no onSubmit:", capturedDeviceId);
                  setDeviceId(capturedDeviceId);
                } else {
                  console.warn("[Device ID] ⚠️ Vazio no onSubmit, mas continuando (SDK envia automaticamente)");
                }
              } catch (err) {
                console.warn("[Device ID] ⚠️ Erro ao capturar, mas continuando:", err);
              }

              try {
                console.log("[Brick onSubmit] Received data:", brickSubmitData);

                // Validar dados ANTES de processar
                if (!validateForm()) {
                  setError("Preencha todos os campos antes de finalizar o pagamento");
                  setPaymentStatus("idle");
                  resolve();
                  return;
                }

                // Resolver wrapper do Brick
                const cardData = brickSubmitData?.getCardFormData
                  ? await brickSubmitData.getCardFormData()
                  : brickSubmitData;

                console.log("[Brick onSubmit] Card data resolved:", cardData);

                // ✅ NOVO: Validar data de validade ANTES de processar
                const expiryValidation = validateCardExpiry(cardData);
                if (!expiryValidation.valid) {
                  console.error("[Brick onSubmit] Invalid card expiry:", cardData);
                  setError(expiryValidation.error || "Data de validade inválida");
                  setPaymentStatus("idle");
                  toast.error(expiryValidation.error || "Data de validade inválida");
                  resolve();
                  return;
                }

                if (!cardData || !cardData.token || !cardData.payment_method_id) {
                  console.error("[Brick onSubmit] Invalid card data:", cardData);
                  setError("Erro ao processar dados do cartão. Tente novamente.");
                  setPaymentStatus("idle");
                  toast.error("Dados do cartão inválidos");
                  resolve();
                  return;
                }

                await handleCardSubmit({
                  token: cardData.token,
                  payment_method_id: cardData.payment_method_id || cardData.paymentMethodId,
                  installments: cardData.installments || 1,
                  deviceId: deviceId || undefined,
                  payerOverride: isThirdPartyCard
                    ? {
                        first_name: payerData.name.split(" ")[0],
                        last_name: payerData.name.split(" ").slice(1).join(" "),
                        cpf: payerData.cpf.replace(/\D/g, ""),
                        phone: (() => {
                          const phoneClean = payerData.phone.replace(/\D/g, "");
                          const areaCode = phoneClean.startsWith("55")
                            ? phoneClean.substring(2, 4)
                            : phoneClean.substring(0, 2);
                          const number = phoneClean.startsWith("55")
                            ? phoneClean.substring(4)
                            : phoneClean.substring(2);
                          return { area_code: areaCode, number: number };
                        })(),
                        address: {
                          zip_code: payerData.cep.replace(/\D/g, ""),
                          street_name: payerData.street_name,
                          street_number: payerData.street_number,
                          neighborhood: payerData.neighborhood,
                          city: payerData.city,
                          state: payerData.state,
                        },
                      }
                    : undefined,
                });
              } catch (error) {
                console.error("[Brick onSubmit] Uncaught error:", error);
                setError("Erro ao processar pagamento. Tente novamente.");
                setPaymentStatus("idle");
                toast.error("Erro ao processar pagamento");
              } finally {
                // Liberar flag após 1 segundo (era 2s)
                setTimeout(() => {
                  console.log("[Brick onSubmit] Liberando isSubmittingRef");
                  isSubmittingRef.current = false;
                }, 1000);
                console.log("[Brick onSubmit] resolve() called");
                resolve();
              }
            });
          },
          onError: (error: any) => {
            console.error("[Card Payment Brick] Error:", error);

            const cause = error?.cause || error?.cause?.[0]?.code || "";
            const message: string = error?.message || "";
            const isSecureFieldsFailure =
              cause === "fields_setup_failed_after_3_tries" ||
              cause === "fields_setup_failed" ||
              message.toLowerCase().includes("secure fields failed") ||
              message.toLowerCase().includes("fields_setup_failed");

            if (isSecureFieldsFailure) {
              console.warn("[Card Payment Brick] Secure Fields setup failure detectado");

              if (brickRecoverAttemptsRef.current >= 2) {
                console.error("[Card Payment Brick] Máximo de tentativas atingido");
                setError("Não foi possível carregar o formulário de pagamento. Por favor, recarregue a página.");
                return;
              }

              brickRecoverAttemptsRef.current += 1;

              // Desmontar completamente
              try {
                if (cardPaymentBrickRef.current) {
                  cardPaymentBrickRef.current.unmount();
                }
              } catch (e) {
                console.warn("[Card Payment Brick] Erro ao desmontar:", e);
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
                if (open && !showSummary && paymentMethod === "card" && mpInstanceRef.current) {
                  console.log("[Card Payment Brick] Tentando remontagem após espera");
                  mountCardPaymentBrick();
                }
              }, 1500);

              return;
            }

            // ✅ Exibir erros críticos ao usuário
            if (error?.cause?.[0]?.code === "E301" || message.includes("token")) {
              setError("Erro ao processar dados do cartão. Verifique as informações e tente novamente.");
              setPaymentStatus("idle");
            } else if (message.includes("security_code")) {
              setError("Código de segurança (CVV) inválido.");
              setPaymentStatus("idle");
            } else {
              // Erros não críticos: apenas logar
              console.warn("[Card Payment Brick] Non-critical error:", error);
            }
          },
        },
      });

      cardPaymentBrickRef.current = cardPaymentBrick;
    } catch (err) {
      console.error("Erro ao montar brick (não crítico):", err);
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
      setError("Preencha todos os campos");
      return false;
    }

    if (!validateCPF(formData.cpf)) {
      setError("CPF inválido");
      return false;
    }

    if (!validatePhoneE164(formData.phone)) {
      setError("Telefone inválido");
      return false;
    }

    // Validar dados do titular se cartão de terceiro
    if (isThirdPartyCard) {
      if (
        !payerData.name ||
        !payerData.cpf ||
        !payerData.phone ||
        !payerData.cep ||
        !payerData.street_name ||
        !payerData.city ||
        !payerData.state
      ) {
        setError("Preencha todos os dados do titular do cartão");
        return false;
      }

      if (!validateCPF(payerData.cpf)) {
        setError("CPF do titular do cartão inválido");
        return false;
      }
    }

    return true;
  };

  const buildSchedulePayload = () => {
    // Detectar se a compra veio da janela ClickLife
    const fromClicklife = document.referrer?.toLowerCase().includes("clicklife");

    const payload: any = {
      email: formData.email,
      cpf: (formData.cpf || "").replace(/\D/g, ""),
      nome: formData.name,
      telefone: formData.phone, // should be E.164 format (+55...)
      sku,
      especialidade: especialidade || "Clínico Geral",
      plano_ativo: false,
      horario_iso: new Date().toISOString(),
      source: fromClicklife ? "clicklife" : "web",
      registration_date: patientCreatedAt || new Date().toISOString(), // ✅ FASE 2.1: Data real de cadastro
    };

    // Adicionar sexo se disponível (M ou F)
    if (patientGender) {
      payload.sexo = patientGender === "male" ? "M" : patientGender === "female" ? "F" : patientGender;
    }

    return payload;
  };

  const pollPaymentStatus = async (paymentId: string, orderId: string) => {
    setIsPollingPayment(true);
    setCurrentOrderId(orderId);
    console.log("[pollPaymentStatus] 🔍 Iniciando polling para order_id:", orderId);

    const maxAttempts = 120; // 10 minutos (5s x 120)
    let attempts = 0;

    const interval = setInterval(async () => {
      attempts++;
      console.log(`[pollPaymentStatus] Tentativa ${attempts}/${maxAttempts} - Buscando appointment...`);

      try {
        // Buscar appointments do usuário
        const result = await getAppointments(formData.email);

        if (result.success && result.appointments) {
          console.log("[pollPaymentStatus] Appointments encontrados:", {
            total: result.appointments.length,
            orders: result.appointments.map((apt) => ({
              order_id: apt.order_id,
              status: apt.status,
              has_redirect: !!apt.redirect_url,
            })),
          });

          // 🔍 Procurar appointment ESPECÍFICO deste pagamento (REMOVIDO filtro de status)
          const appointment = result.appointments.find((apt) => apt.order_id === orderId && apt.redirect_url);

          if (appointment?.redirect_url) {
            clearInterval(interval);
            setIsPollingPayment(false);

            console.log("[pollPaymentStatus] ✅ Appointment encontrado e confirmado:", {
              order_id: appointment.order_id,
              status: appointment.status,
              redirect_url: appointment.redirect_url,
              provider: appointment.provider,
              appointment_id: appointment.appointment_id,
            });

            toast.success("✅ Pagamento aprovado! Redirecionando para sua consulta...");

            setTimeout(() => {
              window.location.href = appointment.redirect_url!;
            }, 1500);
          } else {
            console.log("[pollPaymentStatus] ⏳ Appointment ainda não disponível (tentativa", attempts, ")");
          }
        }

        if (attempts >= maxAttempts) {
          clearInterval(interval);
          setIsPollingPayment(false);

          console.warn("[pollPaymentStatus] ⏱️ Timeout após 10 minutos");
          toast.info('Aguardando confirmação do pagamento. Acesse "Minhas Consultas" para verificar o status.', {
            duration: 8000,
            action: {
              label: "Ir para Área do Paciente",
              onClick: () => window.open("/area-do-paciente", "_blank"),
            },
          });
        }
      } catch (error) {
        console.error("[pollPaymentStatus] ❌ Erro ao verificar status:", error);
      }
    }, 5000); // 5 segundos
  };

  // ✅ FASE 1.2 + 3.2: Validação pré-pagamento (checklist completo com street_number)
  const validatePaymentReadiness = (): boolean => {
    const checks = {
      deviceId: !!deviceId,
      cpf: !!formData.cpf && formData.cpf.replace(/\D/g, "").length === 11,
      email: !!formData.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email),
      phone: !!formData.phone && formData.phone.replace(/\D/g, "").length >= 10,
      address: !!(
        patientAddress?.cep &&
        patientAddress?.city &&
        patientAddress?.state &&
        patientAddress?.street_name &&
        patientAddress?.street_number
      ), // ✅ FASE 3.2: Exigir street_number
      name: formData.name.trim().split(" ").length >= 2,
    };

    console.log("[Payment Readiness Check] 🔒", checks);

    if (!checks.deviceId) {
      console.warn(
        "[Payment Readiness] ⚠️ Device ID não capturado explicitamente, mas SDK do MP pode ter enviado automaticamente",
      );
      // Não bloquear - confiar no SDK
    }

    if (!checks.address) {
      toast.error(
        "📍 Complete seu endereço no perfil antes de finalizar o pagamento. Endereços incompletos aumentam as recusas.",
        {
          duration: 6000,
        },
      );
      return false;
    }

    if (!checks.cpf || !checks.email || !checks.phone) {
      toast.error("📋 Dados pessoais incompletos (CPF, email ou telefone)");
      return false;
    }

    if (!checks.name) {
      toast.error("👤 Digite seu nome completo (nome e sobrenome)");
      return false;
    }

    return true;
  };

  const handleCardSubmit = async (cardFormData: any) => {
    console.log("[handleCardSubmit] START - Card form data:", cardFormData);
    console.log("[handleCardSubmit] formData:", formData);
    console.log("[handleCardSubmit] SKU:", sku, "Amount:", amount);

    // ✅ ETAPA 6: Validar readiness ANTES de processar
    if (!validatePaymentReadiness()) {
      toast.error("Preencha todos os campos obrigatórios");
      setPaymentStatus("idle");
      return;
    }

    setPaymentStatus("processing");
    setError("");
    setUserMessage("");
    toast.loading("Processando pagamento...");

    try {
      // ✅ Garantir que temos os dados corretos do cartão
      if (!cardFormData.token || !cardFormData.payment_method_id) {
        console.error("[handleCardSubmit] Missing card data:", cardFormData);
        const errorMsg = "Não foi possível processar os dados do cartão. Verifique os campos e tente novamente.";
        setError(errorMsg);
        setPaymentStatus("idle");
        toast.dismiss();
        toast.error("Dados do cartão inválidos", {
          description: "Verifique os campos e tente novamente",
        });
        return;
      }

      const orderId = `order_${Date.now()}`;
      const schedulePayload = buildSchedulePayload();

      // ✅ SEMPRE buscar preço do DB, NUNCA usar fallback de props
      const { data: service, error: serviceError } = await supabase
        .from("services")
        .select("price_cents, name")
        .eq("sku", sku)
        .eq("active", true)
        .maybeSingle();

      if (serviceError || !service) {
        throw new Error(`Serviço ${sku} não encontrado ou inativo`);
      }

      const dbUnitPrice = service.price_cents / 100;

      // Validação do checklist de dados de pagamento
      console.log("[Payment Validation Checklist]", {
        "✅ Device ID": deviceId ? "PRESENTE" : "⚠️ AUSENTE",
        "✅ CPF": formData.cpf ? "PRESENTE" : "❌ AUSENTE",
        "✅ Email": formData.email ? "PRESENTE" : "❌ AUSENTE",
        "✅ Telefone": formData.phone ? "PRESENTE" : "❌ AUSENTE",
        "✅ Endereço": patientAddress ? "PRESENTE" : "⚠️ AUSENTE (opcional)",
        "✅ Card Token": cardFormData.token ? "PRESENTE" : "❌ AUSENTE",
        "✅ Payment Method": cardFormData.payment_method_id ? "PRESENTE" : "❌ AUSENTE",
      });

      const paymentRequest: any = {
        items: [
          {
            id: sku,
            title: serviceName,
            unit_price: dbUnitPrice,
            quantity: 1,
          },
        ],
        payer: {
          email: formData.email,
          first_name: formData.name.split(" ")[0],
          last_name: formData.name.split(" ").slice(1).join(" "),
          identification: {
            type: "CPF",
            number: formData.cpf.replace(/\D/g, ""),
          },
          // ✅ FASE 4.1: Parse telefone com validação explícita
          phone: (() => {
            const phoneClean = formData.phone.replace(/\D/g, "");
            let areaCode = "";
            let phoneNumber = "";

            if (phoneClean.startsWith("55")) {
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
              areaCode = phoneClean.substring(0, 2) || "11";
              phoneNumber = phoneClean.substring(2) || phoneClean;
            }

            // ✅ FASE 4.1: Validação final
            if (!areaCode || areaCode.length !== 2) {
              throw new Error("📞 DDD inválido no telefone");
            }
            if (!phoneNumber || phoneNumber.length < 8 || phoneNumber.length > 9) {
              throw new Error("📞 Número de telefone inválido (deve ter 8 ou 9 dígitos)");
            }

            console.log("[Phone Parse] Validado:", {
              original: formData.phone,
              clean: phoneClean,
              areaCode,
              phoneNumber,
            });

            return {
              area_code: areaCode,
              number: phoneNumber,
            };
          })(),
          // ✅ FASE 3.1: BLOQUEAR sem endereço completo e adicionar city/state
          address: (() => {
            if (
              !patientAddress?.cep ||
              !patientAddress?.city ||
              !patientAddress?.state ||
              !patientAddress?.street_name
            ) {
              throw new Error("📍 Endereço completo é obrigatório. Complete no seu perfil antes de pagar.");
            }
            return {
              zip_code: patientAddress.cep.replace(/\D/g, ""),
              street_name: patientAddress.street_name,
              street_number: patientAddress.street_number ? parseInt(patientAddress.street_number) : undefined,
            };
          })(),
        },
        token: cardFormData.token,
        payment_method_id: cardFormData.payment_method_id,
        installments: cardFormData.installments || 1,
        metadata: {
          order_id: orderId,
          schedulePayload,
        },
        // Device ID: usar capturado ou indicar que SDK envia automaticamente
        device_id: deviceId || "mp_sdk_auto",
      };

      // Adicionar auto_recurring se for assinatura
      if (recurring && frequency && frequencyType) {
        paymentRequest.auto_recurring = {
          frequency,
          frequency_type: frequencyType,
          transaction_amount: dbUnitPrice,
          currency_id: "BRL",
        };
      }

      console.log("[handleCardSubmit] Payment request:", paymentRequest);
      console.log("[PaymentModal] Enviando pagamento:", {
        sku,
        serviceName,
        amount,
        recurring,
        frequency,
        formData: { name: formData.name, email: formData.email, cpf: formData.cpf },
        cardData: {
          token: cardFormData.token,
          payment_method_id: cardFormData.payment_method_id,
          installments: cardFormData.installments,
        },
      });

      console.log("[handleCardSubmit] Invoking mp-create-payment with:", paymentRequest);

      const { data, error } = await supabase.functions.invoke("mp-create-payment", {
        body: paymentRequest,
      });

      // --- PATCH DE TRATAMENTO ROBUSTO ---
      if (error || !data) {
        console.error("[handleCardSubmit] invoke error:", error);
        toast.dismiss();
        toast.error("Erro ao criar pagamento", { description: "Tente novamente." });
        setPaymentStatus("idle");
        setShowErrorOverlay(true);
        setErrorOverlayMessage("Não foi possível criar o pagamento. Tente novamente em alguns instantes.");
        return;
      }

      if (data.success === false || data.status === "rejected" || !data.status) {
        console.warn("[handleCardSubmit] Pagamento não aprovado:", data);
        toast.dismiss();
        setPaymentStatus("rejected");
        setError(data.error_message || "Pagamento não aprovado.");
        setUserMessage(data.error_message || "O pagamento não foi aprovado. Verifique os dados e tente novamente.");
        setShowErrorOverlay(true);
        setErrorOverlayMessage(data.error_message || "Pagamento recusado. Você pode tentar novamente ou usar PIX.");
        return;
      }
      // --- FIM DO PATCH ---
      console.log("[handleCardSubmit] Response:", { data, error });

      if (error) throw error;

      console.log("[handleCardSubmit] Payment creation response:", data);

      if (data.status === "approved") {
        setPaymentId(data.payment_id);
        setPaymentStatus("approved");

        toast.dismiss();

        // ✅ Detectar se é PLANO e redirecionar diretamente
        const isPlan = sku.match(/^(IND_|FAM_)/);

        if (isPlan) {
          console.log("[Card Payment] 🎯 PLANO detectado - Redirecionando para área do paciente");
          toast.success("✅ Plano ativado!", {
            description: "Redirecionando para área do paciente...",
          });
          setTimeout(() => {
            window.location.href = "/area-do-paciente";
          }, 1500);
          return; // Não chamar schedule-redirect para planos
        }

        // Fluxo normal para SERVIÇOS
        toast.success("Pagamento aprovado!", {
          description: "Criando agendamento...",
        });

        // Chamar schedule-redirect imediatamente após pagamento aprovado
        const { data: scheduleData, error: scheduleError } = await supabase.functions.invoke("schedule-redirect", {
          body: schedulePayload,
        });

        if (scheduleError || !scheduleData?.ok) {
          console.error("[Card Payment] Erro ao criar agendamento:", scheduleError || scheduleData);
          toast.error("Pagamento aprovado", {
            description: "Mas houve erro no agendamento. Entre em contato.",
          });
          return;
        }

        if (scheduleData.url) {
          toast.success("✅ Pagamento aprovado!", {
            description: "Redirecionando...",
          });
          setTimeout(() => {
            window.location.href = scheduleData.url;
          }, 1500);
        }
      } else if (data.status === "pending" && data.status_detail === "pending_challenge") {
        // Usuário precisa completar desafio 3DS
        console.log("[3DS] Challenge required:", data);

        toast.dismiss();

        if (data.three_d_secure_info?.external_resource_url) {
          setThreeDSecureUrl(data.three_d_secure_info.external_resource_url);
          setPaymentStatus("in_process");
          setPaymentId(data.payment_id);
          toast.info("Autenticação adicional necessária", {
            description: "Complete a verificação para continuar",
          });
        }
      } else if (data.status === "in_process" || data.status === "pending") {
        setPaymentStatus("in_process");
        setPaymentId(data.payment_id);

        toast.dismiss();
        toast.info("Pagamento em análise", {
          description: "Aguarde confirmação",
        });
      } else {
        // ✅ MAPEAMENTO COMPLETO: status_detail → mensagens amigáveis com CTAs
        const statusDetail = data.status_detail || "";

        const errorMapping: Record<string, { message: string; showPix: boolean; showRetry: boolean }> = {
          cc_rejected_high_risk: {
            message:
              "Pagamento recusado por segurança. O cartão utilizado não corresponde ao titular da compra. Use um cartão no seu CPF ou pague via PIX.",
            showPix: true,
            showRetry: true,
          },
          cc_rejected_insufficient_amount: {
            message: "Saldo insuficiente no cartão. Tente outro cartão ou pague via PIX.",
            showPix: true,
            showRetry: true,
          },
          cc_rejected_bad_filled_security_code: {
            message: "Código de segurança (CVV) inválido. Verifique os dados do cartão.",
            showPix: false,
            showRetry: true,
          },
          cc_rejected_card_disabled: {
            message: "Cartão desabilitado. Entre em contato com seu banco ou use outro cartão.",
            showPix: true,
            showRetry: true,
          },
          cc_rejected_call_for_authorize: {
            message: "Seu banco precisa autorizar esta compra. Entre em contato com eles ou tente outro cartão.",
            showPix: true,
            showRetry: true,
          },
          cc_rejected_invalid_installments: {
            message: "Número de parcelas não aceito para este cartão. Tente com menos parcelas.",
            showPix: false,
            showRetry: true,
          },
          cc_rejected_max_attempts: {
            message: "Você atingiu o limite de tentativas. Aguarde alguns minutos ou pague via PIX.",
            showPix: true,
            showRetry: false,
          },
          cc_rejected_duplicated_payment: {
            message: "Pagamento duplicado detectado. Verifique se já não foi processado.",
            showPix: false,
            showRetry: false,
          },
          cc_rejected_bad_filled_card_number: {
            message: "Número do cartão inválido. Verifique os dados digitados.",
            showPix: false,
            showRetry: true,
          },
          cc_rejected_bad_filled_date: {
            message: "Data de validade inválida. Verifique a data do seu cartão.",
            showPix: false,
            showRetry: true,
          },
          cc_rejected_blacklist: {
            message: "Este cartão não pode ser utilizado. Tente outro cartão ou PIX.",
            showPix: true,
            showRetry: true,
          },
        };

        const errorInfo = errorMapping[statusDetail] || {
          message: data.error_message || "Pagamento recusado. Tente outro cartão ou método de pagamento.",
          showPix: true,
          showRetry: true,
        };

        console.error("[handleCardSubmit] Payment rejected:", {
          payment_id: data.payment_id,
          status: data.status,
          status_detail: statusDetail,
          mapped_message: errorInfo.message,
        });

        setError(statusDetail);
        setUserMessage(errorInfo.message);
        setPaymentStatus("rejected");
        setPaymentId(data.payment_id || "");

        // ✅ Desmontar Brick para evitar UI bug, mas manter modal aberto
        try {
          if (cardPaymentBrickRef.current) {
            cardPaymentBrickRef.current.unmount();
          }
        } catch (e) {
          console.warn("[PaymentModal] Erro ao desmontar brick após recusa:", e);
        } finally {
          cardPaymentBrickRef.current = null;
          isBrickMountedRef.current = false;
        }

        // ✅ Ativar overlay de erro global (modal continua aberto)
        setShowErrorOverlay(true);
        setErrorOverlayMessage(errorInfo.message);
        console.log("[Overlay] Showing error overlay with status_detail:", statusDetail);

        toast.dismiss();
      }
    } catch (err: any) {
      console.error("[handleCardSubmit] Card payment error:", err);

      toast.dismiss();

      // ✅ Tratamento específico de erros
      let errorTitle = "Erro ao processar pagamento";
      let errorDescription = "Tente novamente ou use outro método";

      if (err.message?.includes("📍 Endereço")) {
        errorTitle = "Endereço incompleto";
        errorDescription = "Complete seu endereço no perfil antes de pagar";
      } else if (err.message?.includes("📞")) {
        errorTitle = "Telefone inválido";
        errorDescription = "Verifique o telefone digitado";
      } else if (err.message?.includes("Price validation failed")) {
        errorTitle = "Erro de preço";
        errorDescription = "Recarregue a página e tente novamente";
      } else if (err.message?.includes("Invalid SKU")) {
        errorTitle = "Serviço inválido";
        errorDescription = "Entre em contato com o suporte";
      } else if (err.message?.includes("does not support recurring")) {
        errorTitle = "Serviço indisponível";
        errorDescription = "Este serviço não está disponível como assinatura";
      } else if (err.response?.status === 401) {
        errorTitle = "Erro de autenticação";
        errorDescription = "Faça login novamente";
      } else if (err.message?.includes("bad_request") || err.message?.includes("400")) {
        errorTitle = "Dados inválidos";
        errorDescription = "Verifique os dados do cartão";
      }

      setError(errorTitle);
      toast.error(errorTitle, { description: errorDescription });
      setPaymentStatus("idle");
    } finally {
      // ✅ Garantir que sempre reseta o status em caso de erro não tratado
      if (paymentStatus === "processing") {
        setPaymentStatus("idle");
      }
    }
  };

  const handlePixSubmit = async () => {
    // Prevenir múltiplos submits
    if (isSubmittingRef.current || paymentStatus === "processing") {
      console.warn("[handlePixSubmit] Submit already in progress, ignoring");
      return;
    }

    // Validar CPF ANTES de tudo
    const cleanCPF = formData.cpf.replace(/\D/g, "");
    if (!validateCPF(cleanCPF)) {
      toast.error("CPF inválido", {
        description: "Verifique o CPF digitado e tente novamente.",
      });
      return;
    }

    // Validar email
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      toast.error("Email inválido", {
        description: "Digite um email válido para continuar.",
      });
      return;
    }

    // Validar telefone
    const { formatPhoneE164, validatePhoneE164 } = await import("@/lib/validations");
    const formattedPhone = formatPhoneE164(formData.phone);
    if (!validatePhoneE164(formattedPhone)) {
      toast.error("Telefone inválido", {
        description: "Use o formato: (11) 91234-5678",
      });
      return;
    }

    if (!validateForm()) return;

    // Setar flag ANTES de iniciar
    isSubmittingRef.current = true;

    console.log("[handlePixSubmit] Starting PIX generation");
    setPaymentStatus("processing");
    setError("");
    toast.loading("Gerando código PIX...");

    try {
      const orderId = `order_${Date.now()}`;
      const schedulePayload = {
        ...buildSchedulePayload(),
        telefone: formattedPhone, // Usar telefone formatado localmente
      };

      // ✅ SEMPRE buscar preço do DB, NUNCA usar fallback de props
      const { data: service, error: serviceError } = await supabase
        .from("services")
        .select("price_cents, name")
        .eq("sku", sku)
        .eq("active", true)
        .maybeSingle();

      if (serviceError || !service) {
        throw new Error(`Serviço ${sku} não encontrado ou inativo`);
      }

      const dbUnitPrice = service.price_cents / 100;

      const paymentRequest: any = {
        items: [
          {
            id: sku,
            title: serviceName,
            unit_price: dbUnitPrice,
            quantity: 1,
          },
        ],
        payer: {
          email: formData.email,
          first_name: formData.name.split(" ")[0],
          last_name: formData.name.split(" ").slice(1).join(" "),
          identification: {
            type: "CPF",
            number: cleanCPF,
          },
        },
        payment_method_id: "pix",
        metadata: {
          order_id: orderId,
          schedulePayload,
        },
        device_id: deviceId || "mp_sdk_auto",
      };

      // Adicionar auto_recurring se for assinatura
      if (recurring && frequency && frequencyType) {
        paymentRequest.auto_recurring = {
          frequency,
          frequency_type: frequencyType,
          transaction_amount: dbUnitPrice,
          currency_id: "BRL",
        };
      }

      console.log("[handlePixSubmit] Payment request:", paymentRequest);

      const { data, error } = await supabase.functions.invoke("mp-create-payment", {
        body: paymentRequest,
      });

      // --- PATCH DE TRATAMENTO ROBUSTO PARA PIX ---
      if (error || !data) {
        console.error("[handlePixSubmit] invoke error:", error);
        toast.dismiss();
        toast.error("Erro ao gerar código PIX", { description: "Tente novamente." });
        setPaymentStatus("idle");
        setShowErrorOverlay(true);
        setErrorOverlayMessage("Não foi possível gerar o código PIX. Tente novamente em alguns instantes.");
        return;
      }

      if (!data.qr_code || !data.qr_code_base64) {
        console.error("[handlePixSubmit] PIX inválido:", data);
        toast.dismiss();
        toast.error("Erro ao gerar QR Code PIX", { description: data.error_message || "Tente novamente." });
        setPaymentStatus("idle");
        setShowErrorOverlay(true);
        setErrorOverlayMessage("Falha ao gerar QR Code PIX. Verifique sua conexão e tente novamente.");
        return;
      }
      // --- FIM DO PATCH ---
      console.log("[handlePixSubmit] PIX creation response:", data);

      toast.dismiss();
      toast.success("Código PIX gerado com sucesso!", {
        description: "Escaneie o QR Code para pagar",
      });

      setPixData({
        qrCode: data.qr_code,
        qrCodeBase64: data.qr_code_base64,
        paymentId: data.payment_id,
      });
      setPaymentId(data.payment_id);
      setLastPaymentId(data.payment_id);
      setPixPaymentId(data.payment_id);
      setPaymentStatus("pending_pix");

      // Iniciar polling para detectar aprovação automaticamente
      console.log("[handlePixSubmit] Iniciando polling para order_id:", orderId);
      pollPaymentStatus(data.payment_id, orderId);
    } catch (err: any) {
      console.error("[handlePixSubmit] PIX generation error:", err);

      toast.dismiss();

      // Mensagens de erro específicas
      let errorTitle = "Erro ao gerar PIX";
      let errorDescription = "Tente novamente em alguns instantes";

      if (err.message?.includes("CPF")) {
        errorTitle = "CPF inválido";
        errorDescription = "Verifique o CPF digitado e tente novamente";
      } else if (err.message?.includes("email")) {
        errorTitle = "Email inválido";
        errorDescription = "Verifique o email digitado e tente novamente";
      } else if (err.message?.includes("não encontrado")) {
        errorTitle = "Serviço indisponível";
        errorDescription = "Este serviço não está disponível no momento";
      }

      toast.error(errorTitle, { description: errorDescription });
      setError(errorTitle);
      setPaymentStatus("idle");
    } finally {
      // Liberar flag após 1 segundo
      setTimeout(() => {
        console.log("[handlePixSubmit] Liberando isSubmittingRef");
        isSubmittingRef.current = false;
      }, 1000);
    }
  };

  // Listener Supabase Realtime para redirect_url após pagamento aprovado
  useEffect(() => {
    if (!open || (paymentStatus !== "approved" && paymentStatus !== "pending_pix")) {
      return;
    }

    console.log("[Realtime] Subscribing to appointments for email:", formData.email);

    const channel = supabase
      .channel("appointment-redirect")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "appointments",
          filter: `email=eq.${formData.email}`,
        },
        (payload) => {
          console.log("[Realtime] Received appointment:", payload);
          const appointment = payload.new as any;

          // 🔍 Verificar se é o appointment deste pagamento específico
          if (appointment.redirect_url && appointment.order_id && appointment.order_id === currentOrderId) {
            console.log("[Realtime] ✅ Appointment CORRETO detectado:", {
              appointment_id: appointment.appointment_id,
              order_id: appointment.order_id,
              redirect_url: appointment.redirect_url,
            });

            setRedirectUrl(appointment.redirect_url);
            toast.success("Agendamento confirmado! Redirecionando...");

            setTimeout(() => {
              window.location.href = appointment.redirect_url;
            }, 1500);
          } else {
            console.log("[Realtime] Appointment ignorado (order_id diferente):", {
              received_order_id: appointment.order_id,
              expected_order_id: currentOrderId,
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, paymentStatus, formData.email]);

  const handleTryAgain = () => {
    setShowSummary(true); // Voltar para o resumo
    setPaymentMethod(undefined);
    setPaymentStatus("idle");
    setError("");
    setUserMessage("");
    setPixData(null);
    if (cardPaymentBrickRef.current) {
      cardPaymentBrickRef.current.unmount();
      cardPaymentBrickRef.current = null;
      isBrickMountedRef.current = false;
    }
  };

  const handlePaymentMethodSelect = (method: "card" | "pix") => {
    console.log("[handlePaymentMethodSelect] Transição:", { method, currentShowSummary: showSummary });
    setPaymentMethod(method);
    setShowSummary(false); // Transicionar para tela de pagamento
    console.log("[handlePaymentMethodSelect] Após transição:", { method, newShowSummary: false });
  };

  const handleBackToSummary = () => {
    setShowSummary(true);
    setPaymentMethod(undefined);
    // Desmontar Brick se montado
    if (cardPaymentBrickRef.current) {
      try {
        cardPaymentBrickRef.current.unmount();
      } catch (err) {
        console.warn("[handleBackToSummary] Erro ao desmontar brick:", err);
      } finally {
        cardPaymentBrickRef.current = null;
        isBrickMountedRef.current = false;
      }
    }
  };

  // Mapeamento de status_detail para mensagens claras
  const getStatusMessage = (statusDetail: string) => {
    const statusMessages: Record<string, { title: string; message: string; showRetry: boolean; showPix: boolean }> = {
      cc_rejected_high_risk: {
        title: "🔒 Transação bloqueada por segurança",
        message:
          "O Mercado Pago bloqueou esta transação por medidas de segurança. Isso pode acontecer com cartões novos, compras de locais diferentes ou por histórico de fraudes. Tente usar outro cartão ou pague com PIX.",
        showRetry: true,
        showPix: true,
      },
      cc_rejected_bad_filled_security_code: {
        title: "🔒 Código de segurança incorreto",
        message: "O código CVV do cartão está incorreto. Verifique os 3 dígitos no verso do cartão.",
        showRetry: true,
        showPix: false,
      },
      cc_rejected_bad_filled_date: {
        title: "⚠️ Data de validade incorreta ou cartão vencido",
        message:
          "Verifique se você digitou a data de validade corretamente (MM/AA) e se o cartão não está vencido. Caso persista, use outro cartão ou pague via PIX.",
        showRetry: true,
        showPix: true,
      },
      cc_rejected_insufficient_amount: {
        title: "💳 Saldo insuficiente",
        message: "O cartão não tem limite disponível para esta compra. Tente outro cartão ou pague com PIX.",
        showRetry: true,
        showPix: true,
      },
      cc_rejected_call_for_authorize: {
        title: "📞 Autorização necessária",
        message:
          "O banco solicita que você entre em contato para autorizar esta compra. Ligue para o banco ou use outro cartão/PIX.",
        showRetry: true,
        showPix: true,
      },
    };

    return (
      statusMessages[statusDetail] || {
        title: "❌ Pagamento recusado",
        message:
          userMessage || "O pagamento foi recusado. Verifique os dados do cartão ou tente outro método de pagamento.",
        showRetry: true,
        showPix: true,
      }
    );
  };

  const renderStatus = () => {
    if (paymentStatus === "processing") {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-lg font-medium">Processando pagamento...</p>
        </div>
      );
    }

    if (paymentStatus === "approved") {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
          <p className="text-xl font-bold text-green-600 mb-2">Pagamento Aprovado!</p>
          <p className="text-muted-foreground">Redirecionando...</p>
        </div>
      );
    }

    if (paymentStatus === "rejected") {
      // Suprimir overlay em tela cheia para evitar "modal branco".
      console.log("[renderStatus] Rejected - suprimindo overlay no modal");
      return null;
    }

    if (paymentStatus === "in_process") {
      return (
        <div className="space-y-6 text-center py-8">
          <div className="flex justify-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
          <div>
            <p className="text-lg font-medium mb-2">
              {threeDSecureUrl ? "Autenticação Necessária" : "Pagamento em análise..."}
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              {threeDSecureUrl
                ? "Complete a autenticação do seu banco para finalizar o pagamento."
                : "Aguarde enquanto validamos seu pagamento. Você será notificado quando o pagamento for aprovado."}
            </p>
          </div>

          {threeDSecureUrl && (
            <Button
              onClick={() => (window.location.href = threeDSecureUrl)}
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

    if (paymentStatus === "pending_pix" && pixData) {
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
      {open && (paymentStatus === "processing" || paymentStatus === "in_process") && (
        <>
          {console.log("[Overlay] Rendering overlay:", { paymentStatus })}
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {paymentStatus === "processing" ? "Processando pagamento..." : "Aguardando confirmação..."}
              </p>
            </div>
          </div>
        </>
      )}

      <div className="flex flex-col space-y-1.5 text-center sm:text-left">
        <h2 className="text-lg font-semibold leading-none tracking-tight">
          {showSummary ? "Finalizar Compra" : serviceName}
        </h2>
        {!showSummary && (
          <p className="text-2xl font-bold text-primary">R$ {(amount / 100).toFixed(2).replace(".", ",")}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {userMessage && paymentStatus === "rejected" && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-600 text-sm">{userMessage}</p>
          </div>
        )}

        {renderStatus()}

        {/* Resumo da compra - tela inicial */}
        {paymentStatus === "idle" && showSummary && (
          <>
            {console.log("[UI] Renderizando resumo:", { showSummary, isLoadingUserData, paymentStatus })}

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

        {paymentStatus === "idle" && !showSummary && !error && (
          <div className="space-y-4">
            {/* Botão Voltar */}
            <Button onClick={handleBackToSummary} variant="ghost" size="sm" className="mb-2">
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
                    variant={paymentMethod === "card" ? "default" : "outline"}
                    onClick={() => setPaymentMethod("card")}
                    className="flex-1"
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Cartão
                  </Button>
                  <Button
                    type="button"
                    variant={paymentMethod === "pix" ? "default" : "outline"}
                    onClick={() => setPaymentMethod("pix")}
                    className="flex-1"
                  >
                    PIX
                  </Button>
                </div>

                {/* Switch para cartão de terceiros */}
                {paymentMethod === "card" && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <Label htmlFor="third-party-card" className="text-sm font-medium text-yellow-900">
                        💳 Pagar com cartão de outra pessoa
                      </Label>
                      <input
                        type="checkbox"
                        id="third-party-card"
                        checked={isThirdPartyCard}
                        onChange={(e) => setIsThirdPartyCard(e.target.checked)}
                        className="h-4 w-4"
                      />
                    </div>
                    <p className="text-xs text-yellow-700">
                      Ative se o cartão não estiver no CPF de {formData.name.split(" ")[0]}. Você precisará informar os
                      dados completos do titular.
                    </p>
                  </div>
                )}

                {/* Formulário do titular (cartão de terceiros) */}
                {paymentMethod === "card" && isThirdPartyCard && (
                  <div className="space-y-3 bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                    <h4 className="font-semibold text-sm text-blue-900">Dados do Titular do Cartão</h4>
                    <div>
                      <Label htmlFor="payer-name">Nome Completo</Label>
                      <Input
                        id="payer-name"
                        value={payerData.name}
                        onChange={(e) => setPayerData({ ...payerData, name: e.target.value })}
                        placeholder="Nome completo do titular"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="payer-cpf">CPF</Label>
                      <Input
                        id="payer-cpf"
                        value={payerData.cpf}
                        onChange={(e) => setPayerData({ ...payerData, cpf: e.target.value })}
                        placeholder="000.000.000-00"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="payer-phone">Telefone</Label>
                      <Input
                        id="payer-phone"
                        value={payerData.phone}
                        onChange={(e) => setPayerData({ ...payerData, phone: e.target.value })}
                        placeholder="+55 11 99999-9999"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="payer-cep">CEP</Label>
                      <Input
                        id="payer-cep"
                        value={payerData.cep}
                        onChange={(e) => setPayerData({ ...payerData, cep: e.target.value })}
                        placeholder="00000-000"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="payer-street">Logradouro</Label>
                      <Input
                        id="payer-street"
                        value={payerData.street_name}
                        onChange={(e) => setPayerData({ ...payerData, street_name: e.target.value })}
                        placeholder="Rua, Avenida, etc"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="payer-number">Número</Label>
                        <Input
                          id="payer-number"
                          value={payerData.street_number}
                          onChange={(e) => setPayerData({ ...payerData, street_number: e.target.value })}
                          placeholder="123"
                        />
                      </div>
                      <div>
                        <Label htmlFor="payer-neighborhood">Bairro</Label>
                        <Input
                          id="payer-neighborhood"
                          value={payerData.neighborhood}
                          onChange={(e) => setPayerData({ ...payerData, neighborhood: e.target.value })}
                          placeholder="Centro"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="payer-city">Cidade</Label>
                        <Input
                          id="payer-city"
                          value={payerData.city}
                          onChange={(e) => setPayerData({ ...payerData, city: e.target.value })}
                          placeholder="São Paulo"
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="payer-state">UF</Label>
                        <Input
                          id="payer-state"
                          value={payerData.state}
                          onChange={(e) => setPayerData({ ...payerData, state: e.target.value.toUpperCase() })}
                          placeholder="SP"
                          maxLength={2}
                          required
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Card Payment Brick */}
                {paymentMethod === "card" && (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <p className="text-sm text-blue-800">
                        💡 <strong>Dica:</strong> Certifique-se de digitar a data de validade no formato MM/AA (ex:
                        12/25) e que o cartão não esteja vencido.
                      </p>
                    </div>
                    <div
                      key={`brick-${paymentMethod}`}
                      id="cardPaymentBrick"
                      className="mp-brick-container min-h-[400px]"
                    ></div>
                  </>
                )}

                {/* Botão PIX */}
                {paymentMethod === "pix" && (
                  <>
                    <Button onClick={handlePixSubmit} className="w-full" size="lg">
                      Gerar QR Code PIX
                    </Button>

                    {isPollingPayment && (
                      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                          <span className="text-sm text-blue-800">Aguardando confirmação do pagamento...</span>
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

      {(paymentStatus === "processing" || paymentStatus === "in_process") && (
        <>
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center rounded-lg">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {paymentStatus === "processing" ? "Processando pagamento..." : "Aguardando confirmação..."}
              </p>
            </div>
          </div>
        </>
      )}

      <DialogHeader>
        <DialogTitle>{showSummary ? "Finalizar Compra" : serviceName}</DialogTitle>
        {!showSummary && (
          <p className="text-2xl font-bold text-primary">R$ {(amount / 100).toFixed(2).replace(".", ",")}</p>
        )}
      </DialogHeader>

      <div className="flex-1 overflow-y-auto">
        {userMessage && paymentStatus === "rejected" && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-600 text-sm">{userMessage}</p>
          </div>
        )}

        {renderStatus()}

        {/* Resumo da compra - tela inicial */}
        {paymentStatus === "idle" && showSummary && (
          <>
            {console.log("[UI] Renderizando resumo:", { showSummary, isLoadingUserData, paymentStatus })}

            {/* Indicador de loading durante transição */}
            {paymentMethod !== undefined && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                <span className="text-sm text-muted-foreground">Preparando pagamento...</span>
              </div>
            )}

            {/* Indicador de carregamento de dados */}
            {isLoadingUserData && paymentMethod === undefined && (
              <div className="flex items-center gap-2 p-4 bg-muted/50 rounded-lg mb-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Carregando seus dados...</span>
              </div>
            )}

            {/* PaymentSummary - só mostrar se não tiver método selecionado */}
            {paymentMethod === undefined && (
              <PaymentSummary
                serviceName={serviceName}
                amount={amount}
                formData={formData}
                recurring={recurring}
                frequency={frequency}
                frequencyType={frequencyType}
                onSelectPaymentMethod={handlePaymentMethodSelect}
              />
            )}
          </>
        )}

        {paymentStatus === "idle" && !showSummary && !error && (
          <div className="space-y-4">
            {/* Botão Voltar */}
            <Button onClick={handleBackToSummary} variant="ghost" size="sm" className="mb-2">
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
                    variant={paymentMethod === "card" ? "default" : "outline"}
                    onClick={() => setPaymentMethod("card")}
                    className="flex-1"
                  >
                    <CreditCard className="mr-2 h-4 w-4" />
                    Cartão
                  </Button>
                  <Button
                    type="button"
                    variant={paymentMethod === "pix" ? "default" : "outline"}
                    onClick={() => setPaymentMethod("pix")}
                    className="flex-1"
                  >
                    PIX
                  </Button>
                </div>

                {/* Card Payment Brick */}
                {paymentMethod === "card" && (
                  <>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <p className="text-sm text-blue-800">
                        💡 <strong>Dica:</strong> Certifique-se de digitar a data de validade no formato MM/AA (ex:
                        12/25) e que o cartão não esteja vencido.
                      </p>
                    </div>
                    <div
                      key={`brick-${paymentMethod}`}
                      id="cardPaymentBrick"
                      className="mp-brick-container min-h-[400px]"
                    ></div>
                  </>
                )}

                {/* Botão PIX */}
                {paymentMethod === "pix" && (
                  <>
                    <Button onClick={handlePixSubmit} className="w-full" size="lg">
                      Gerar QR Code PIX
                    </Button>

                    {isPollingPayment && (
                      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                          <span className="text-sm text-blue-800">Aguardando confirmação do pagamento...</span>
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

  const isInlineFallback = typeof window !== "undefined" && window.location.hostname.includes("lovableproject.com");

  if (!open) return null;

  if (isInlineFallback) {
    console.log("[PaymentModal] Inline fallback ativo");
    return (
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100]">
        <div
          className="absolute inset-0 bg-black/80"
          onClick={(e) => {
            // Não fechar se estiver processando
            if (paymentStatus === "processing" || paymentStatus === "in_process") {
              e.preventDefault();
              return;
            }
            setPaymentStatus("idle");
            onOpenChange(false);
          }}
        />
        <div className="fixed left-1/2 top-1/2 z-[100] w-full max-w-[500px] max-h-[90vh] -translate-x-1/2 -translate-y-1/2 border bg-background p-4 sm:p-6 shadow-lg sm:rounded-lg flex flex-col overflow-hidden">
          {modalBody}
        </div>
      </div>
    );
  }

  // Renderizar overlay de erro global (sempre visível por cima do modal)
  const renderErrorOverlay = () => {
    if (!showErrorOverlay) return null;

    return createPortal(
      <div
        className="fixed inset-0 z-[99999] flex items-center justify-center"
        role="alertdialog"
        aria-live="assertive"
      >
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-[100000] max-w-md w-[90%] rounded-lg bg-white p-5 shadow-2xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-base text-gray-900">Pagamento não aprovado</h3>
              <p className="text-sm text-gray-600 mt-1">{errorOverlayMessage}</p>
              <div className="mt-4 flex gap-2 flex-wrap">
                <Button
                  variant="secondary"
                  onClick={() => {
                    console.log("[Overlay] close modal now");
                    setShowErrorOverlay(false);
                    setErrorOverlayMessage("");
                    setPaymentStatus("idle");
                    onOpenChange(false);
                  }}
                >
                  Fechar modal
                </Button>
                <Button
                  onClick={() => {
                    console.log("[Overlay] retry flow");
                    setShowErrorOverlay(false);
                    setErrorOverlayMessage("");
                    setError("");
                    setUserMessage("");
                    setPaymentStatus("idle");
                    setShowSummary(true);
                    setPaymentMethod(undefined);
                  }}
                >
                  Tentar novamente
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-[500px] max-h-[90vh] flex flex-col p-4 sm:p-6"
          aria-describedby="payment-desc"
        >
          {modalBodyRadix}
        </DialogContent>
      </Dialog>
      {renderErrorOverlay()}
    </>
  );
}
