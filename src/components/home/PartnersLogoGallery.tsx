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

const partnerLogos = [
  { id: 'hering', src: heringLogo, alt: 'Hering' },
  { id: 'nike', src: nikeLogo, alt: 'Nike' },
  { id: 'netshoes', src: netshoesLogo, alt: 'Netshoes' },
  { id: 'lavoisier', src: lavoisierLogo, alt: 'Lavoisier' },
  { id: 'cinemark', src: cinemarkLogo, alt: 'Cinemark' },
  { id: 'dsp', src: dspLogo, alt: 'Drogaria São Paulo' },
  { id: 'labi', src: labiLogo, alt: 'Labi Exames' },
  { id: 'buddhaspa', src: buddhaspaLogo, alt: 'Buddha Spa' },
  { id: 'drogasil', src: drogasilLogo, alt: 'Drogasil' },
  { id: 'drogaraia', src: drogaraiaLogo, alt: 'Droga Raia' },
  // Placeholders para os 3 restantes
  { id: 'pacheco', src: 'https://via.placeholder.com/512x512/4169E1/FFFFFF?text=Pacheco', alt: 'Pacheco' },
  { id: 'carrefour', src: 'https://via.placeholder.com/512x512/0066CC/FFFFFF?text=Carrefour', alt: 'Carrefour' },
  { id: 'riachuelo', src: 'https://via.placeholder.com/512x512/E53935/FFFFFF?text=Riachuelo', alt: 'Riachuelo' },
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
              className="partner-logo-item"
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
