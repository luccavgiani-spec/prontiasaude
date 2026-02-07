import { MP_PUBLIC_KEY } from "./constants";

const MP_DEBUG = import.meta.env.DEV;
const SCRIPT_ID = "mp-sdk-v2";
const SDK_URL = "https://sdk.mercadopago.com/js/v2";

function initGlobalInstance(): void {
  try {
    if (window.MercadoPago && !window.__mpGlobal) {
      window.__mpGlobal = new window.MercadoPago(MP_PUBLIC_KEY, { locale: "pt-BR" });
    }
    if (MP_DEBUG) {
      console.log("[MP-Global] typeof MercadoPago:", typeof window.MercadoPago);
      console.log("[MP-Global] __mpGlobal:", typeof window.__mpGlobal);
      console.log("[MP-Global] MP_DEVICE_SESSION_ID:", window.MP_DEVICE_SESSION_ID ?? "not yet");
    }
  } catch (e) {
    if (MP_DEBUG) console.error("[MP-Global] init error:", e);
  }
}

export function loadMercadoPagoGlobal(): Promise<void> {
  // Already available
  if (window.MercadoPago) {
    initGlobalInstance();
    return Promise.resolve();
  }

  // Script tag exists but still loading
  const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
  if (existing) {
    return new Promise<void>((resolve) => {
      existing.addEventListener("load", () => { initGlobalInstance(); resolve(); });
      // If already loaded by the time we attach
      if (window.MercadoPago) { initGlobalInstance(); resolve(); }
    });
  }

  // Create script
  return new Promise<void>((resolve) => {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SDK_URL;
    script.async = true;
    script.onload = () => { initGlobalInstance(); resolve(); };
    script.onerror = () => {
      if (MP_DEBUG) console.error("[MP-Global] Failed to load SDK V2");
      resolve(); // non-blocking
    };
    document.head.appendChild(script);
  });
}
