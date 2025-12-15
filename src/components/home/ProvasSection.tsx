import { Star, ChevronLeft, ChevronRight, Quote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEPOIMENTOS } from "@/lib/constants";
import { useState, useEffect, useCallback } from "react";

export function ProvasSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  const nextSlide = useCallback(() => {
    setActiveIndex(prev => (prev + 1) % DEPOIMENTOS.length);
  }, []);

  const prevSlide = useCallback(() => {
    setActiveIndex(prev => (prev - 1 + DEPOIMENTOS.length) % DEPOIMENTOS.length);
  }, []);

  // Auto-play carousel
  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(nextSlide, 5000);
    return () => clearInterval(interval);
  }, [isAutoPlaying, nextSlide]);

  // Get visible cards (3 at a time on desktop, 1 on mobile)
  const getVisibleIndices = () => {
    const indices = [];
    for (let i = -1; i <= 1; i++) {
      indices.push((activeIndex + i + DEPOIMENTOS.length) % DEPOIMENTOS.length);
    }
    return indices;
  };

  const visibleIndices = getVisibleIndices();

  return (
    <section 
      className="py-16 md:py-20 bg-gradient-to-b from-background to-muted/30"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '600px' }}
    >
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4">
            Depoimentos Reais
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            O que nossos pacientes dizem
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Mais de 2.000 atendimentos realizados com nota média de 4.9 estrelas
          </p>
        </div>

        {/* Carousel Container */}
        <div 
          className="relative max-w-6xl mx-auto"
          onMouseEnter={() => setIsAutoPlaying(false)}
          onMouseLeave={() => setIsAutoPlaying(true)}
          role="region"
          aria-label="Carrossel de depoimentos"
        >
          {/* Cards Container */}
          <div className="flex items-center justify-center gap-4 md:gap-6 overflow-hidden py-4">
            {/* Mobile: Show only active card */}
            <div className="block md:hidden w-full max-w-sm">
              <TestimonialCard 
                depoimento={DEPOIMENTOS[activeIndex]} 
                isActive={true}
              />
            </div>

            {/* Desktop: Show 3 cards with animation */}
            <div className="hidden md:flex items-center justify-center gap-6">
              {visibleIndices.map((index, position) => (
                <div 
                  key={index}
                  className={`transition-all duration-500 ease-out ${
                    position === 1 
                      ? 'scale-100 opacity-100 z-10' 
                      : 'scale-90 opacity-60 z-0'
                  }`}
                  style={{
                    transform: position === 1 ? 'scale(1)' : 'scale(0.9)',
                  }}
                >
                  <TestimonialCard 
                    depoimento={DEPOIMENTOS[index]} 
                    isActive={position === 1}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Navigation Buttons */}
          <Button
            variant="outline"
            size="icon"
            onClick={prevSlide}
            className="absolute left-0 md:-left-4 top-1/2 -translate-y-1/2 z-20 bg-background/80 backdrop-blur-sm hover:bg-background shadow-lg"
            aria-label="Depoimento anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={nextSlide}
            className="absolute right-0 md:-right-4 top-1/2 -translate-y-1/2 z-20 bg-background/80 backdrop-blur-sm hover:bg-background shadow-lg"
            aria-label="Próximo depoimento"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Dot Indicators */}
        <div className="flex justify-center gap-2 mt-8">
          {DEPOIMENTOS.map((_, index) => (
            <button
              key={index}
              onClick={() => setActiveIndex(index)}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                index === activeIndex 
                  ? 'bg-primary w-8' 
                  : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
              }`}
              aria-label={`Ir para depoimento ${index + 1}`}
              aria-current={index === activeIndex ? 'true' : 'false'}
            />
          ))}
        </div>

        {/* Trust Badges */}
        <div className="mt-12 flex items-center justify-center gap-4 md:gap-6 flex-wrap">
          <div className="flex items-center gap-2 px-4 py-2 bg-card rounded-lg border border-border shadow-sm">
            <div className="w-3 h-3 bg-primary rounded-full animate-pulse"></div>
            <span className="text-sm text-muted-foreground font-medium">Pagamento Seguro</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-card rounded-lg border border-border shadow-sm">
            <div className="w-3 h-3 bg-accent rounded-full"></div>
            <span className="text-sm text-muted-foreground font-medium">Plataforma Verificada</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-card rounded-lg border border-border shadow-sm">
            <div className="w-3 h-3 bg-secondary rounded-full"></div>
            <span className="text-sm text-muted-foreground font-medium">+50 Profissionais</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// Testimonial Card Component
interface TestimonialCardProps {
  depoimento: {
    nome: string;
    avaliacao: number;
    texto: string;
  };
  isActive: boolean;
}

function TestimonialCard({ depoimento, isActive }: TestimonialCardProps) {
  return (
    <div 
      className={`bg-card rounded-2xl p-6 md:p-8 shadow-lg border border-border w-full max-w-sm transition-all duration-300 ${
        isActive ? 'shadow-xl border-primary/20' : ''
      }`}
    >
      {/* Quote Icon */}
      <Quote className="h-8 w-8 text-primary/20 mb-4" />
      
      {/* Stars */}
      <div className="flex gap-1 mb-4">
        {[...Array(5)].map((_, i) => (
          <Star 
            key={i} 
            className={`h-5 w-5 ${
              i < depoimento.avaliacao 
                ? 'text-accent fill-accent' 
                : 'text-muted-foreground/20'
            }`}
          />
        ))}
      </div>
      
      {/* Testimonial Text */}
      <blockquote className="text-foreground/90 mb-6 leading-relaxed min-h-[80px]">
        "{depoimento.texto}"
      </blockquote>
      
      {/* Author */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-primary font-semibold text-sm">
            {depoimento.nome.charAt(0)}
          </span>
        </div>
        <cite className="text-foreground font-medium not-italic">
          {depoimento.nome}
        </cite>
      </div>
    </div>
  );
}
