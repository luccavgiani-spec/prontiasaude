/* ⛔⛔⛔ NÃO ALTERAR ESTE ARQUIVO ⛔⛔⛔
 * Especialmente as props fullFill e bgClass das logos Drogasil e Netshoes
 * Qualquer alteração quebrará o layout circular dessas logos
 */

import React from 'react';
import './PartnersLogoGallery.css';

// Imports das imagens dos parceiros
import labiLogo from '@/assets/partners/labi.webp';
import dspLogo from '@/assets/partners/dsp.webp';
import cinemarkLogo from '@/assets/partners/cinemark.webp';
import lavoisierLogo from '@/assets/partners/lavoisier.webp';
import netshoesLogo from '@/assets/partners/netshoes.webp';
import nikeLogo from '@/assets/partners/nike.webp';
import heringLogo from '@/assets/partners/hering.webp';
import drogaraiaLogo from '@/assets/partners/drogaraia.webp';
import drogasilLogo from '@/assets/partners/drogasil.webp';
import buddhaspaLogo from '@/assets/partners/buddhaspa.webp';
import pachecoLogo from '@/assets/partners/pacheco.webp';
import carrefourLogo from '@/assets/partners/carrefour.webp';
import riachueloLogo from '@/assets/partners/riachuelo.webp';

// ⛔ NÃO ALTERAR: fullFill e bgClass são CRÍTICOS para Netshoes e Drogasil
const partnerLogos = [
  { id: 'hering', src: heringLogo, alt: 'Hering', fullFill: true },
  { id: 'nike', src: nikeLogo, alt: 'Nike', fullFill: true },
  { id: 'netshoes', src: netshoesLogo, alt: 'Netshoes', fullFill: true, bgClass: 'bg-netshoes' }, // ⛔ NÃO REMOVER bgClass
  { id: 'lavoisier', src: lavoisierLogo, alt: 'Lavoisier', fullFill: true },
  { id: 'cinemark', src: cinemarkLogo, alt: 'Cinemark', fullFill: true },
  { id: 'dsp', src: dspLogo, alt: 'Drogaria São Paulo', fullFill: true },
  { id: 'labi', src: labiLogo, alt: 'Labi Exames', fullFill: true },
  { id: 'buddhaspa', src: buddhaspaLogo, alt: 'Buddha Spa', fullFill: true },
  { id: 'drogasil', src: drogasilLogo, alt: 'Drogasil', fullFill: true, bgClass: 'bg-drogasil' }, // ⛔ NÃO REMOVER bgClass
  { id: 'drogaraia', src: drogaraiaLogo, alt: 'Droga Raia', fullFill: true },
  { id: 'pacheco', src: pachecoLogo, alt: 'Pacheco', fullFill: true },
  { id: 'carrefour', src: carrefourLogo, alt: 'Carrefour', fullFill: true },
  { id: 'riachuelo', src: riachueloLogo, alt: 'Riachuelo', fullFill: true },
];

export const PartnersLogoGallery: React.FC = () => {
  // Duplicar array múltiplas vezes para loop infinito fluido
  const extendedLogos = [...partnerLogos, ...partnerLogos, ...partnerLogos];

  return (
    <section 
      className="partners-logo-gallery-section"
      aria-label="Galeria de marcas parceiras"
      role="region"
    >
      <div className="partners-logo-gallery-wrapper">
        <div className="partners-logo-track">
          {extendedLogos.map((logo, index) => (
            <div 
              key={`${logo.id}-${index}`} 
              className={`partner-logo-item ${logo.fullFill ? 'full-fill' : ''} ${logo.bgClass || ''}`}
            >
              <img
                src={logo.src}
                alt={logo.alt}
                width="120"
                height="120"
                loading="lazy"
                className="partner-logo-image"
                style={{ aspectRatio: '1/1' }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
