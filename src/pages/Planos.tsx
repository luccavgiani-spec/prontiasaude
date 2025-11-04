import { useEffect } from "react";
import { PlanosSection } from "@/components/home/PlanosSection";
import { trackViewContent } from "@/lib/meta-tracking";
import { Phone, Shield, Star } from "lucide-react";
const Planos = () => {
  useEffect(() => {
    trackViewContent({
      content_name: 'Página de Planos',
      content_category: 'Planos',
      content_ids: ['planos']
    });
  }, []);
  return <>
      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <section className="py-16 px-4 bg-gradient-to-br from-primary/5 to-secondary/5">
          <div className="container mx-auto max-w-6xl text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Escolha o plano perfeito para você
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
              Atendimento ilimitado, especialistas e benefícios exclusivos para você e sua família
            </p>
          </div>
        </section>

        {/* Planos Section */}
        <PlanosSection />

        {/* Seção de benefícios adicionais */}
        <section className="py-16 px-4 bg-gradient-to-br from-secondary/5 to-primary/5">
          <div className="container mx-auto max-w-6xl text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Por que escolher nossos planos?
            </h2>
            <p className="text-lg text-muted-foreground mb-12 max-w-3xl mx-auto">
              Oferecemos atendimento médico de qualidade com tecnologia avançada, 
              especialistas qualificados e benefícios exclusivos para cuidar da sua saúde.
            </p>
            
            <div className="grid md:grid-cols-3 gap-8 mb-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Phone className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Atendimento 24h
                </h3>
                <p className="text-muted-foreground">
                  Consultas médicas disponíveis a qualquer hora do dia, 
                  todos os dias da semana.
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Sem Carência
                </h3>
                <p className="text-muted-foreground">
                  Comece a usar seu plano imediatamente após a contratação, 
                  sem períodos de espera.
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Star className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Especialistas
                </h3>
                <p className="text-muted-foreground">
                  Acesso a mais de 10 especialidades médicas com profissionais 
                  altamente qualificados.
                </p>
              </div>
            </div>
            
            
          </div>
        </section>
      </div>

    </>;
};
export default Planos;