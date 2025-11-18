import { Heart, Users, Award, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import quemSomosHero from "@/assets/quem-somos-hero.jpg";
const QuemSomos = () => {
  return <div className="py-0">
      <div className="container mx-auto px-4">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6 mx-0 py-[15px]">Prontìa Saúde</h1>
          
        </div>

        {/* Nossa Missão com Imagem */}
        <div className="mb-16">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <img src={quemSomosHero} alt="Equipe médica Prontia Saúde - Cuidado humanizado e acessível" className="rounded-2xl shadow-lg w-full" />
            </div>
            <div className="my-[32px]">
              
              
              <div className="text-muted-foreground mb-8 text-center mx-[13px] my-0 text-lg md:text-xl leading-relaxed">
                <p>A Prontìa Saúde nasceu de uma história de vida e de um legado de cuidado. Desde cedo, acompanhei meus pais em ações sociais, especialmente minha mãe, e aprendi que cuidar do próximo é um chamado.   </p>
              </div>
              
              <Button variant="medical" size="lg" asChild>
                
              </Button>
            </div>
          </div>
        </div>

        {/* Nossos Valores */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">Pilares</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="medical-card p-6 text-center">
              <Heart className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Cuidado Contínuo</h3>
              <p className="text-muted-foreground">
                A consulta não é o fim, mas o começo de uma relação. A Prontia acompanha, orienta e apoia o paciente em todas as fases de sua jornada de saúde.
              </p>
            </div>
            <div className="medical-card p-6 text-center">
              <Users className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Acessibilidade</h3>
              <p className="text-muted-foreground">
                Oferecer saúde de qualidade a preços justos, eliminando barreiras de tempo, distância e burocracia.
              </p>
            </div>
            <div className="medical-card p-6 text-center">
              <Heart className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Humanização</h3>
              <p className="text-muted-foreground">
                Atender de forma empática, próxima e respeitosa, garantindo que cada paciente se sinta único, ouvido e valorizado.
              </p>
            </div>
            <div className="medical-card p-6 text-center">
              <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Confiança</h3>
              <p className="text-muted-foreground">
                Construir relacionamentos sólidos baseados em ética, clareza e competência, transmitindo segurança em cada atendimento.
              </p>
            </div>
          </div>
        </div>

        {/* Nossa História */}
        <div className="bg-muted/30 rounded-2xl p-8 md:p-12 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-6">Missão</h2>
          <p className="text-muted-foreground max-w-3xl mx-auto mb-8">A missão da Prontia Saúde é democratizar o acesso à saúde de forma simples, humana e contínua. Mais do que consultas rápidas, a marca existe para transformar a experiência do paciente, unindo tecnologia e acolhimento em um cuidado que não se encerra no diagnóstico. 


Queremos que cada pessoa tenha acesso a profissionais de qualidade, receba acompanhamento real e se sinta amparada em todos os momentos: do atendimento clínico ao apoio emocional e educativo. Nossa missão é clara: oferecer saúde acessível e confiável, tornando o cuidado médico um gesto de proximidade, e não um privilégio distante.</p>
          
        </div>
      </div>
    </div>;
};
export default QuemSomos;