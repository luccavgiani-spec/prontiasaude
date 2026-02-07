import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./lib/gtag-events";
import { initializeMercadoPago } from "./lib/mercadopago-init";
import { loadMercadoPagoGlobal } from "./lib/mercadopago-global";

initializeMercadoPago();       // React SDK
loadMercadoPagoGlobal();       // SDK V2 global para o scanner MP

createRoot(document.getElementById("root")!).render(<App />);

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
