/**
 * MercadoPagoCardForm - Componente React para formulário de cartão usando SDK oficial
 * 
 * ✅ PCI Compliance: Usa Secure Fields nativos do SDK
 * ✅ Device ID: Gerenciado automaticamente pelo SDK
 * ✅ SDK React: @mercadopago/sdk-react v1.0.6
 */

import { useCallback, useRef } from "react";
import { CardPayment } from "@mercadopago/sdk-react";
import { Loader2 } from "lucide-react";

// ✅ Tipos do SDK (copiados do type.d.ts para evitar problemas de import)
interface ICardPaymentBrickPayer {
  email?: string;
  identification?: {
    type: string;
    number: string;
  };
}

interface ICardPaymentFormData {
  token: string;
  issuer_id: string;
  payment_method_id: string;
  transaction_amount: number;
  installments: number;
  payer: ICardPaymentBrickPayer;
  payment_method_option_id?: string;
  processing_mode?: string;
}

interface IAdditionalData {
  bin: string;
  lastFourDigits: string;
  cardholderName?: string;
  paymentTypeId?: string;
}

interface IBrickError {
  type: string;
  cause: string;
  message: string;
}

// ✅ Tipos para os dados do formulário de cartão
export interface CardFormSubmitData {
  token: string;
  payment_method_id: string;
  installments: number;
  issuer_id?: string; // ✅ NOVO: Código do banco emissor (+2 pontos qualidade MP)
  deviceId?: string;
  additionalData?: IAdditionalData;
  payerOverride?: {
    first_name: string;
    last_name: string;
    cpf: string;
    phone: {
      area_code: string;
      number: string;
    };
    address: {
      zip_code: string;
      street_name: string;
      street_number?: string;
      neighborhood?: string;
      city: string;
      state: string;
    };
  };
}

// ✅ CORREÇÃO: Capturar Device ID da variável global do SDK
const getDeviceId = (): string | undefined => {
  if (typeof window !== 'undefined') {
    // O SDK React do Mercado Pago cria estas variáveis globais automaticamente
    return (window as any).MP_DEVICE_SESSION_ID || 
           (window as any).deviceId ||
           undefined;
  }
  return undefined;
};

interface MercadoPagoCardFormProps {
  amount: number; // em centavos
  payerEmail: string;
  payerCPF: string;
  onSubmit: (data: CardFormSubmitData) => Promise<void>;
  onReady?: () => void;
  onError?: (error: any) => void;
  isThirdPartyCard?: boolean;
  payerOverrideData?: {
    name: string;
    cpf: string;
    phone: string;
    cep: string;
    street_name: string;
    street_number: string;
    neighborhood: string;
    city: string;
    state: string;
  };
  isProcessing?: boolean;
}

export function MercadoPagoCardForm({
  amount,
  payerEmail,
  payerCPF,
  onSubmit,
  onReady,
  onError,
  isThirdPartyCard = false,
  payerOverrideData,
  isProcessing = false,
}: MercadoPagoCardFormProps) {
  const isSubmittingRef = useRef(false);
  const brickReadyRef = useRef(false);

  // ✅ Handler para submit do CardPayment Brick
  const handleCardPaymentSubmit = useCallback(
    async (formData: ICardPaymentFormData, additionalData?: IAdditionalData) => {
      // Prevenir múltiplos submits
      if (isSubmittingRef.current) {
        console.warn("[MercadoPagoCardForm] Submit already in progress, ignoring");
        return;
      }

      isSubmittingRef.current = true;

      try {
        console.log("[MercadoPagoCardForm] onSubmit triggered:", {
          token: formData.token,
          payment_method_id: formData.payment_method_id,
          installments: formData.installments,
          additionalData,
        });

        // Preparar payerOverride se for cartão de terceiro
        let payerOverride: CardFormSubmitData["payerOverride"] = undefined;

        if (isThirdPartyCard && payerOverrideData) {
          const phoneClean = payerOverrideData.phone.replace(/\D/g, "");
          const areaCode = phoneClean.startsWith("55")
            ? phoneClean.substring(2, 4)
            : phoneClean.substring(0, 2);
          const phoneNumber = phoneClean.startsWith("55")
            ? phoneClean.substring(4)
            : phoneClean.substring(2);

          payerOverride = {
            first_name: payerOverrideData.name.split(" ")[0],
            last_name: payerOverrideData.name.split(" ").slice(1).join(" "),
            cpf: payerOverrideData.cpf.replace(/\D/g, ""),
            phone: {
              area_code: areaCode,
              number: phoneNumber,
            },
            address: {
              zip_code: payerOverrideData.cep.replace(/\D/g, ""),
              street_name: payerOverrideData.street_name,
              street_number: payerOverrideData.street_number,
              neighborhood: payerOverrideData.neighborhood,
              city: payerOverrideData.city,
              state: payerOverrideData.state,
            },
          };
        }

        // ✅ Device ID é gerenciado automaticamente pelo SDK React
        // O SDK envia o device_id nos headers internamente
        // Não precisamos capturá-lo manualmente

        // Enviar dados para o handler do modal
        await onSubmit({
          token: formData.token,
          payment_method_id: formData.payment_method_id,
          installments: formData.installments,
          issuer_id: formData.issuer_id, // ✅ NOVO: Enviar código do emissor (+2 pontos)
          deviceId: getDeviceId(), // ✅ CORREÇÃO: Capturar Device ID real da variável global
          additionalData,
          payerOverride,
        });
      } catch (error) {
        console.error("[MercadoPagoCardForm] Submit error:", error);
        onError?.(error);
      } finally {
        // Liberar flag após 1 segundo (para evitar submits duplicados muito rápidos)
        setTimeout(() => {
          isSubmittingRef.current = false;
        }, 1000);
      }
    },
    [onSubmit, onError, isThirdPartyCard, payerOverrideData]
  );

  // ✅ Handler para quando o Brick está pronto
  const handleReady = useCallback(() => {
    console.log("[MercadoPagoCardForm] ✅ CardPayment Brick ready");
    brickReadyRef.current = true;
    onReady?.();
  }, [onReady]);

  // ✅ Handler para erros do Brick
  const handleError = useCallback(
    (error: IBrickError) => {
      console.error("[MercadoPagoCardForm] Brick error:", error);
      
      // Erros de setup de campos seguros - não são críticos
      const cause = error?.cause || "";
      const message: string = error?.message || "";
      const isSecureFieldsFailure =
        cause === "fields_setup_failed_after_3_tries" ||
        cause === "fields_setup_failed" ||
        message.toLowerCase().includes("secure fields failed");

      if (isSecureFieldsFailure) {
        console.warn("[MercadoPagoCardForm] Secure Fields setup failure - usually recoverable");
        // Não propagar - deixar o usuário tentar novamente
        return;
      }

      // Propagar outros erros
      onError?.(error);
    },
    [onError]
  );

  // Validação de dados mínimos
  const hasMinimalData = payerEmail && payerCPF && payerCPF.replace(/\D/g, "").length === 11;

  if (!hasMinimalData) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <p>Preencha seu email e CPF para continuar...</p>
      </div>
    );
  }

  // Calcular valor em reais (SDK espera valor em reais, não centavos)
  const amountInReais = amount / 100;

  return (
    <div className="relative">
      {isProcessing && (
        <div className="absolute inset-0 bg-background/80 z-10 flex items-center justify-center rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      
      <CardPayment
        initialization={{
          amount: amountInReais,
          payer: {
            email: payerEmail,
            identification: {
              type: "CPF",
              number: payerCPF.replace(/\D/g, ""),
            },
          },
        }}
        customization={{
          paymentMethods: {
            maxInstallments: 12,
            minInstallments: 1,
          },
          visual: {
            style: {
              theme: "default",
            },
          },
        }}
        onSubmit={handleCardPaymentSubmit}
        onReady={handleReady}
        onError={handleError}
      />
    </div>
  );
}
