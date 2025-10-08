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
              <img src={quemSomosHero} alt="Equipe Prontia Saúde" className="rounded-2xl shadow-lg w-full" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-6 text-center">Quem somos nós?</h2>
              
              <div className="space-y-4 text-muted-foreground mb-8 text-center">
                <p>
                  A Prontìa Saúde nasceu de uma história de vida e de um legado de cuidado. Desde muito cedo, aprendi que cuidar do próximo é um chamado.
                </p>
                
                <p>
                  Cresci acompanhando meus pais em ações sociais, onde observei como um gesto simples pode transformar a realidade de alguém. Esse olhar sensível foi reforçado pelo exemplo da minha mãe, uma mulher dedicada, generosa e incansável, que sempre trabalhou auxiliando pessoas e me ensinou, na prática, o verdadeiro sentido da empatia.
                </p>
                
                <p>
                  Foi dela que herdei a vontade de fazer a diferença e a certeza de que o cuidado vai muito além da medicina — ele começa no coração. Inspirada por seu exemplo e pelos valores que ela me transmitiu, encontrei na medicina o meu propósito de vida.
                </p>
                
                <p>
                  Minha trajetória no SUS foi fundamental para compreender tanto a grandeza quanto os desafios do sistema público. Acompanhei filas extensas, pacientes que aguardavam meses por atendimento e famílias que, por estarem distantes dos grandes centros, não conseguiam acesso a cuidados básicos no tempo adequado. Percebi, então, que não seria possível mudar todo o sistema sozinha, mas que poderia desenvolver alternativas concretas para levar saúde de forma justa, ágil e humanizada a quem mais precisa.
                </p>
                
                <p>
                  Assim surgiu a Prontìa Saúde: um projeto construído com amor, propósito e parceria. Ao lado da minha mãe — que hoje é também minha sócia e grande inspiração — transformamos um sonho em realidade. Ela trouxe sua experiência de vida, sua sensibilidade e sua visão acolhedora para cada decisão e para cada cuidado que oferecemos.
                </p>
                
                <p>
                  Nosso objetivo é democratizar o acesso à saúde no Brasil, oferecendo atendimento médico de qualidade, de forma simples, acessível e a baixo custo. Acreditamos na tecnologia como instrumento para aproximar pessoas, superar barreiras geográficas e fortalecer a relação médico-paciente.
                </p>
                
                <p>
                  A Prontìa Saúde não é apenas telemedicina. É um compromisso com dignidade, inclusão e eficiência. É o resultado de um amor que passou de mãe para filha e se transformou em uma missão: levar saúde sem fronteiras, acessível a todos.
                </p>
              </div>
              
              <Button variant="medical" size="lg" asChild>
                <a href="/#servicos">Conheça Nossos Serviços</a>
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