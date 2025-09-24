import React from 'react';
import './CircularGallery.css';

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
      title: "Instituto Viva a Vida",
      description: "Apoio a pacientes com câncer e suas famílias",
      image: "/api/placeholder/300/200"
    },
    {
      title: "ONG Amigos do Bem",
      description: "Combate à fome e à miséria no sertão nordestino",
      image: "/api/placeholder/300/200"
    },
    {
      title: "Fundação Abrinq",
      description: "Proteção e promoção dos direitos das crianças",
      image: "/api/placeholder/300/200"
    },
    {
      title: "Instituto Ronald McDonald",
      description: "Apoio a adolescentes e jovens com câncer",
      image: "/api/placeholder/300/200"
    },
    {
      title: "APAE Brasil",
      description: "Atendimento a pessoas com deficiência intelectual",
      image: "/api/placeholder/300/200"
    },
    {
      title: "Casa Hope",
      description: "Acolhimento para crianças em tratamento médico",
      image: "/api/placeholder/300/200"
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