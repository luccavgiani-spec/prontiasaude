import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-doctor-modern.jpg";
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
    const element = document.querySelector('section[class*="py-20"][class*="bg-gradient-to-br"]');
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth'
      });
    }
  };
  return <section className="relative min-h-[700px] bg-gradient-to-br from-background via-primary-light/20 to-background overflow-hidden">
      {/* Modern geometric background */}
      <div className="absolute inset-0 geometric-pattern" />
      <div className="absolute top-20 right-20 w-72 h-72 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-full blur-3xl floating-animation" />
      <div className="absolute bottom-32 left-16 w-56 h-56 bg-gradient-to-r from-accent/15 to-primary/15 rounded-full blur-2xl floating-animation" style={{
      animationDelay: '2s'
    }} />
      
      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center min-h-[600px]">
          {/* Content Column */}
          <div className="space-y-10">
            {/* Modern badge */}
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-primary/10 to-secondary/10 backdrop-blur-sm border border-primary/20 text-primary font-medium shadow-lg">
              <CheckCircle className="w-5 h-5" />
              Plataforma Médica Certificada
            </div>
            
            {/* Modern headline */}
            <div className="space-y-6">
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-tight">
                <span className="text-foreground">Saúde digital</span>
                <br />
                <span className="medical-gradient-text">Consultas</span>
                <br />
                <span className="text-foreground">clínicas</span>
                <br />
                <span className="text-primary text-6xl md:text-7xl lg:text-8xl">R$ 49</span>
              </h1>
              
              <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl leading-relaxed font-light">
                Conecte-se com médicos especialistas e realize consultas online.
              </p>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl leading-relaxed font-light mt-4">
                Evite filas e burocracia, cuide da sua saúde de maneira segura e prática!
              </p>
            </div>
            
            {/* Modern CTAs */}
            <div className="flex flex-col sm:flex-row gap-6 pt-4">
              <Button onClick={scrollToServicos} size="xl" className="medical-button-primary text-lg px-12 py-8 rounded-2xl shadow-2xl group">
                Agendar Consulta
                <ArrowRight className="ml-3 w-6 h-6 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button onClick={scrollToComoFunciona} variant="outline" size="xl" className="text-lg px-12 py-8 rounded-2xl border-2 hover:bg-primary/5 hover:border-primary/30 transition-all duration-300">
                Saiba Como Funciona
              </Button>
            </div>
            
            {/* Enhanced social proof */}
            <div className="grid grid-cols-3 gap-8 pt-12 border-t border-border/50">
              <div className="text-center group">
                <div className="text-4xl font-bold medical-gradient-text mb-2 group-hover:scale-110 transition-transform">15k+</div>
                <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Atendimentos</div>
              </div>
              <div className="text-center group">
                <div className="text-4xl font-bold medical-gradient-text mb-2 group-hover:scale-110 transition-transform">4.9★</div>
                <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Avaliação</div>
              </div>
              <div className="text-center group">
                <div className="text-4xl font-bold medical-gradient-text mb-2 group-hover:scale-110 transition-transform">200+</div>
                <div className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Especialistas</div>
              </div>
            </div>
          </div>
          
          {/* Modern Image Column */}
          <div className="relative flex justify-center lg:justify-end">
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