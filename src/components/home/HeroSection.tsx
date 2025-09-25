import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-doctor-realistic.jpg";
import { ArrowRight, CheckCircle } from "lucide-react";
export function HeroSection() {
  const scrollToServicos = () => {
    const element = document.getElementById('servicos');
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth'
      });
    }
  };

  const scrollToComoFunciona = () => {
    const element = document.querySelector('section[class*="py-10"][class*="bg-gradient-to-br"]');
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth'
      });
    }
  };
  return <section className="relative min-h-[500px] md:min-h-[700px] bg-gradient-to-br from-background via-primary-light/20 to-background overflow-hidden">
      {/* Modern geometric background */}
      <div className="absolute inset-0 geometric-pattern" />
      <div className="absolute top-20 right-20 w-72 h-72 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-full blur-3xl floating-animation" />
      <div className="absolute bottom-32 left-16 w-56 h-56 bg-gradient-to-r from-accent/15 to-primary/15 rounded-full blur-2xl floating-animation" style={{
      animationDelay: '2s'
    }} />
      
      <div className="container mx-auto px-4 py-6 md:py-10 relative z-10">
        <div className="grid lg:grid-cols-2 gap-8 md:gap-16 items-center min-h-[500px] md:min-h-[600px]">
          {/* Content Column */}
          <div className="space-y-6 md:space-y-10">
            {/* Modern badge */}
            <div className="inline-flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 rounded-full bg-gradient-to-r from-primary/10 to-secondary/10 backdrop-blur-sm border border-primary/20 text-primary font-medium shadow-lg text-sm md:text-base">
              <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
              Plataforma Médica Certificada
            </div>
            
            {/* Modern headline */}
            <div className="space-y-3 md:space-y-6">
              <h1 className="text-3xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight animate-fade-in">
                <span className="medical-gradient-text">Seu Médico Online a qualquer hora!</span>
              </h1>
              
              {/* Button between title and subtitle */}
              <div className="flex justify-center pt-4 md:pt-6 animate-fade-in delay-300">
                <Button onClick={scrollToServicos} size="xl" className="medical-button-primary text-base md:text-lg px-8 md:px-12 py-4 md:py-8 rounded-2xl shadow-2xl group">
                  Consulte Agora
                  <ArrowRight className="ml-2 md:ml-3 w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
              
              <p className="hero-subtitle text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-2xl leading-relaxed font-light animate-fade-in delay-200">
                Cuidado imediato para quem precisa.<br />
                Evite filas, cuide da sua saúde de maneira segura, prática, com cuidado que vai além das telas!
              </p>
            </div>
            
            
            {/* Social proof removed */}
          </div>
          
          {/* Modern Image Column */}
          <div className="relative flex justify-center lg:justify-end animate-fade-in delay-600">
            <div className="relative">
              {/* Enhanced background effects */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-secondary/20 to-accent/20 rounded-3xl blur-3xl scale-110 pulse-glow" />
              
              {/* Modern doctor image container */}
              <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl transform hover:scale-105 transition-all duration-700 hover:rotate-1">
                <div className="absolute inset-0 bg-gradient-to-t from-primary/20 via-transparent to-transparent z-10" />
                <img src={heroImage} alt="Médico especialista em consulta online" className="w-full max-w-lg h-auto object-cover" />
              </div>
              
              {/* Modern floating badges */}
              
              
              
              
              
            </div>
          </div>
        </div>
      </div>
    </section>;
}