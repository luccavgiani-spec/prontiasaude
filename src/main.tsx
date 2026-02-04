import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/gtag-events";
import { initializeMercadoPago } from "./lib/mercadopago-init";

declare global {
  interface Window {
    MercadoPago?: any;
  }
}

async function ensureMercadoPagoSdkLoaded(): Promise<void> {
  if (window.MercadoPago) return;

  await new Promise<void>((resolve) => {
    const existing = document.querySelector(
      'script[src="https://sdk.mercadopago.com/js/v2"]',
    ) as HTMLScriptElement | null;
    if (existing) {
      // Se já existe, só espera carregar (caso ainda não tenha)
      if ((existing as any)._mpLoaded) return resolve();
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => resolve(), { once: true }); // não bloquear o app
      return;
    }

    const script = document.createElement("script");
    script.src = "https://sdk.mercadopago.com/js/v2";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => resolve(); // não bloquear o app
    (script as any)._mpLoaded = true;
    document.head.appendChild(script);
  });
}

(async () => {
  // ✅ garante SDK antes de inicializar o wrapper do MP
  await ensureMercadoPagoSdkLoaded();
  initializeMercadoPago();

  createRoot(document.getElementById("root")!).render(<App />);
})();

// Service Worker (produção)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("[SW] Registered successfully:", registration.scope);
      })
      .catch((error) => {
        console.log("[SW] Registration failed:", error);
      });
  });
}
