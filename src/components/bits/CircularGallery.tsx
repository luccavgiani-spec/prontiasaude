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
      description: "O Instituto Caminhos da Luz, fundado em 2017, é uma organização da sociedade civil que acredita no poder do cuidado e da empatia para transformar vidas. O propósito é promover dignidade, cidadania e inclusão social, criando oportunidades para pessoas em situação de vulnerabilidade. Com sede em Bragança Paulista (SP), desenvolve projetos nas áreas de assistência social, saúde mental, educação, igualdade racial, geração de renda e valorização cultural. Mais do que oferecer ajuda imediata, busca construir caminhos duradouros, fortalecendo famílias e comunidades por meio de ações solidárias e transformadoras. Acredita que toda mudança começa quando escolhemos enxergar o outro com amor, respeito e esperança. 💛",
      image: institutoCaminhosLogo
    }
  ];

  // Cria múltiplas cópias para loop infinito fluido
  const repeatedItems = [...items, ...items, ...items, ...items];

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
          {repeatedItems.map((item, index) => (
            <div key={index} className="gallery-item">
              <div className="item-image">
                <img src={item.image} alt={item.title} loading="lazy" />
              </div>
              <div className="item-content">
                <p className="text-sm leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CircularGallery;