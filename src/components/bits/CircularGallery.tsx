import React from 'react';
import './CircularGallery.css';
import samaLogo from '@/assets/sama-logo.png';
import institutoCaminhosLogo from '@/assets/instituto-caminhos-da-luz-logo.png';

interface CircularGalleryProps {
  bend?: number;
  textColor?: string;
  borderRadius?: number;
  scrollEase?: number;
}

const CircularGallery: React.FC<CircularGalleryProps> = ({ 
  bend = 3, 
  textColor = "#ffffff", 
  borderRadius = 0.05, 
  scrollEase = 0.02 
}) => {
  const items = [
    {
      title: "SAMA",
      description: "No coração de Bragança Paulista, o SAMA é um refúgio onde crianças e adolescentes encontram amor, cuidado e uma segunda chance. Em situações de risco ou negligência, oferecemos um abrigo temporário, acompanhamento emocional e cuidados médicos, garantindo um desenvolvimento saudável.",
      image: samaLogo
    },
    {
      title: "Instituto Caminhos da Luz",
      description: "Localizado em São Paulo, o Instituto Caminhos da Luz é um porto seguro para crianças e adolescentes em vulnerabilidade social. Oferecemos acolhimento especializado, apoio psicológico e cuidados integrais, criando um ambiente de proteção e desenvolvimento. Nossa missão é reconstruir esperanças e abrir caminhos para um futuro digno e promissor.",
      image: institutoCaminhosLogo
    }
  ];

  React.useEffect(() => {
    const container = document.querySelector('.circular-gallery-container') as HTMLElement;
    if (!container) return;

    container.style.setProperty('--bend', bend.toString());
    container.style.setProperty('--text-color', textColor);
    container.style.setProperty('--border-radius', borderRadius.toString());
    container.style.setProperty('--scroll-ease', scrollEase.toString());
  }, [bend, textColor, borderRadius, scrollEase]);

  return (
    <div className="circular-gallery-container">
      <div className="circular-gallery">
        <div className="gallery-track">
          {items.concat(items).map((item, index) => (
            <div key={index} className="gallery-item">
              <div className="item-image">
                <img src={item.image} alt={item.title} loading="lazy" />
              </div>
              <div className="item-content">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CircularGallery;