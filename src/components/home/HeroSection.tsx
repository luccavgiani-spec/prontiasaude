import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Clock, Star } from "lucide-react";

export function HeroSection() {
  const scrollToServicos = () => {
    const element = document.getElementById('servicos');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative py-16 md:py-24 bg-[var(--gradient-subtle)] overflow-hidden">
      {/* Background decorativo */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-10 w-32 h-32 bg-primary rounded-full blur-xl"></div>
        <div className="absolute bottom-20 right-10 w-48 h-48 bg-secondary rounded-full blur-xl"></div>
        <div className="absolute top-40 right-20 w-24 h-24 bg-accent rounded-full blur-xl"></div>
      </div>

      <div className="container mx-auto px-4 relative">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-sm font-medium text-primary mb-6">
            <Shield className="h-4 w-4" />
            <span>Plataforma Médica Verificada</span>
          </div>

          {/* Título principal */}
          <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
            Consulta online a partir de{" "}
            <span className="text-primary bg-[var(--gradient-primary)] bg-clip-text text-transparent">
              R$ 15,90
            </span>
          </h1>

          {/* Imagem da médica com prancheta */}
          <div className="max-w-2xl mx-auto mb-8">
            <img 
              src="/src/assets/hero-doctor-clipboard.jpg" 
              alt="Médica profissional segurando prancheta e sorrindo"
              className="rounded-2xl shadow-[var(--shadow-medical)] w-full h-auto"
              loading="eager"
            />
          </div>

          {/* Subtítulo */}
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Conecte-se com médicos qualificados através de consultas online seguras, 
            rápidas e acessíveis. Sua saúde em primeiro lugar.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
            <Button 
              onClick={scrollToServicos}
              variant="hero" 
              size="xl"
              className="group"
            >
              Agendar Consulta Agora
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button 
              variant="outline" 
              size="xl"
              asChild
            >
              <a href="/quem-somos">Como Funciona</a>
            </Button>
          </div>

          {/* Proof points */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 md:gap-8 max-w-3xl mx-auto">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Clock className="h-5 w-5 text-primary" />
              <span className="text-sm md:text-base">
                <strong className="text-foreground">+2.000</strong> atendimentos
              </span>
            </div>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Star className="h-5 w-5 text-accent fill-current" />
              <span className="text-sm md:text-base">
                <strong className="text-foreground">4.9★</strong> avaliação
              </span>
            </div>
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-sm md:text-base">
                <strong className="text-foreground">+50</strong> especialistas
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}