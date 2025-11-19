import React from 'react';
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import './lib/gtag-events'; // Registra helper global de eventos do Google

createRoot(document.getElementById("root")!).render(<App />);

// Register Service Worker (apenas em produção)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(registration => {
        console.log('[SW] Registered successfully:', registration.scope);
      })
      .catch(error => {
        console.log('[SW] Registration failed:', error);
      });
  });
}
