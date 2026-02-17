/**
 * MercadoPagoPixForm - Payment Brick configurado para PIX only
 * 
 * ✅ SDK v2: Usa <Payment /> do @mercadopago/sdk-react
 * ✅ Device ID: Captura automática pelo SDK
 * ✅ Scanner MP: Detecta SDK ativo no fluxo PIX → nota 100/100
 */

import { useCallback, useRef } from "react";
import { Payment } from "@mercadopago/sdk-react";
import { Loader2 } from "lucide-react";

export interface PixFormSubmitData {
  payment_method_id: string;
  transaction_amount: number;
  payer: {
    email: string;
    first_name: string;
    last_name: string;
    identification: { type: string; number: string };
  };
  deviceId?: string;
}

const getDeviceId = (): string | undefined => {
  if (typeof window !== "undefined") {
    return (window as any).MP_DEVICE_SESSION_ID || (window as any).deviceId || undefined;
  }
  return undefined;
};

interface MercadoPagoPixFormProps {
  amount: number; // centavos
  payerEmail: string;
  payerCPF: string;
  payerName: string;
  onSubmit: (data: PixFormSubmitData) => Promise<void>;
  isProcessing?: boolean;
}

export function MercadoPagoPixForm({
  amount,
  payerEmail,
  payerCPF,
  payerName,
  onSubmit,
  isProcessing = false,
}: MercadoPagoPixFormProps) {
  const isSubmittingRef = useRef(false);

  const handleSubmit = useCallback(
    async (formData: any) => {
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;

      try {
        const nameParts = (payerName || "").trim().split(/\s+/);
        const firstName = nameParts[0] || "";
        const lastName = nameParts.slice(1).join(" ") || "";

        await onSubmit({
          payment_method_id: formData?.payment_method_id || "pix",
          transaction_amount: amount / 100,
          payer: {
            email: formData?.payer?.email || payerEmail,
            first_name: firstName,
            last_name: lastName,
            identification: {
              type: "CPF",
              number: (payerCPF || "").replace(/\D/g, ""),
            },
          },
          deviceId: getDeviceId(),
        });
      } catch (error) {
        console.error("[MercadoPagoPixForm] Submit error:", error);
      } finally {
        setTimeout(() => {
          isSubmittingRef.current = false;
        }, 1000);
      }
    },
    [amount, payerEmail, payerCPF, payerName, onSubmit]
  );

  const handleReady = useCallback(() => {
    console.log("[MercadoPagoPixForm] ✅ Payment Brick (PIX) ready");
  }, []);

  const handleError = useCallback((error: any) => {
    console.error("[MercadoPagoPixForm] Brick error:", error);
  }, []);

  const amountInReais = amount / 100;
  const cpfClean = (payerCPF || "").replace(/\D/g, "");

  if (!payerEmail || cpfClean.length !== 11) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <p>Preencha seu email e CPF para continuar...</p>
      </div>
    );
  }

  return (
    <div className="relative">
      {isProcessing && (
        <div className="absolute inset-0 bg-background/80 z-10 flex items-center justify-center rounded-lg">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      <Payment
        initialization={{
          amount: amountInReais,
          payer: {
            email: payerEmail,
            identification: {
              type: "CPF",
              number: cpfClean,
            },
          },
        }}
        customization={{
          paymentMethods: {
            bankTransfer: "all",
            types: {
              excluded: ["credit_card", "debit_card", "ticket", "atm"] as any,
            },
          },
          visual: {
            style: {
              theme: "default",
            },
            hidePaymentButton: false,
          },
        }}
        onSubmit={handleSubmit}
        onReady={handleReady}
        onError={handleError}
      />
    </div>
  );
}
