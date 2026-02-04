/**
 * Inicialização global do SDK Mercado Pago React
 * 
 * ✅ PCI Compliance: Secure Fields gerenciados pelo SDK
 * ✅ Device ID: Captura automática pelo SDK
 * ✅ SDK v2: Usando pacote oficial @mercadopago/sdk-react
 */

import { initMercadoPago } from "@mercadopago/sdk-react";
import { MP_PUBLIC_KEY } from "@/lib/constants";

let isInitialized = false;

/**
 * Inicializa o SDK do Mercado Pago globalmente.
 * Deve ser chamado uma única vez no carregamento da aplicação.
 */
export function initializeMercadoPago(): void {
  if (isInitialized) {
    console.log("[MercadoPago SDK] Already initialized, skipping");
    return;
  }

  if (!MP_PUBLIC_KEY) {
    console.error("[MercadoPago SDK] MP_PUBLIC_KEY not configured!");
    return;
  }

  try {
    initMercadoPago(MP_PUBLIC_KEY, {
      locale: "pt-BR",
    });
    
    isInitialized = true;
    console.log("[MercadoPago SDK] ✅ Initialized successfully with React SDK");
  } catch (error) {
    console.error("[MercadoPago SDK] Failed to initialize:", error);
  }
}

/**
 * Verifica se o SDK foi inicializado
 */
export function isMercadoPagoInitialized(): boolean {
  return isInitialized;
}
