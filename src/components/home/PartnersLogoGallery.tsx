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

const partnerLogos = [
  { id: 'hering', src: heringLogo, alt: 'Hering', fullFill: false },
  { id: 'nike', src: nikeLogo, alt: 'Nike', fullFill: false },
  { id: 'netshoes', src: netshoesLogo, alt: 'Netshoes', fullFill: false },
  { id: 'lavoisier', src: lavoisierLogo, alt: 'Lavoisier', fullFill: false },
  { id: 'cinemark', src: cinemarkLogo, alt: 'Cinemark', fullFill: false },
  { id: 'dsp', src: dspLogo, alt: 'Drogaria São Paulo', fullFill: false },
  { id: 'labi', src: labiLogo, alt: 'Labi Exames', fullFill: true }, // Colorido - preenchimento total
  { id: 'buddhaspa', src: buddhaspaLogo, alt: 'Buddha Spa', fullFill: true }, // Colorido - preenchimento total
  { id: 'drogasil', src: drogasilLogo, alt: 'Drogasil', fullFill: false },
  { id: 'drogaraia', src: drogaraiaLogo, alt: 'Droga Raia', fullFill: false },
  { id: 'pacheco', src: pachecoLogo, alt: 'Pacheco', fullFill: false },
  { id: 'carrefour', src: carrefourLogo, alt: 'Carrefour', fullFill: false },
  { id: 'riachuelo', src: riachueloLogo, alt: 'Riachuelo', fullFill: false },
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
              className={`partner-logo-item ${logo.fullFill ? 'full-fill' : ''}`}
            >
              <img
                src={logo.src}
                alt={logo.alt}
                loading="lazy"
                className="partner-logo-image"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
