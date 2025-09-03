import { Heart, Users, Award, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

const QuemSomos = () => {
  return (
    <div className="py-16">
      <div className="container mx-auto px-4">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Médicos do Bem
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Conectamos você aos melhores profissionais de saúde através de consultas online 
            seguras, acessíveis e de alta qualidade.
          </p>
        </div>

        {/* Nossa Missão */}
        <div className="grid md:grid-cols-2 gap-12 items-center mb-16">
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-6">Nossa Missão</h2>
            <p className="text-muted-foreground mb-4">
              Democratizar o atendimento médico no Brasil, levando cuidado de qualidade a qualquer 
              lugar do país, de forma simples, acessível e a baixo custo. Acreditamos que a tecnologia 
              pode aproximar médico e paciente, sem barreiras geográficas, sem esperas intermináveis, 
              sem exclusão.
            </p>
            <p className="text-muted-foreground mb-6">
              Nosso sonho é que cada pessoa, esteja onde estiver, possa sentir que tem um médico de 
              confiança ao seu lado. A Médicos do Bem é mais do que uma clínica de telemedicina: 
              é um compromisso com a dignidade, com a equidade e com o cuidado humano. É saúde sem 
              fronteiras, feita para todos.
            </p>
            <Button variant="medical" size="lg" asChild>
              <a href="/#servicos">Conheça Nossos Serviços</a>
            </Button>
          </div>
          <div className="bg-[var(--gradient-primary)] rounded-2xl p-8 text-center text-white">
            <Heart className="h-16 w-16 mx-auto mb-4" />
            <h3 className="text-2xl font-bold mb-4">Cuidar é Nossa Essência</h3>
            <p>
              Cada consulta é uma oportunidade de fazer a diferença na vida de alguém. 
              Tratamos cada paciente com o carinho e atenção que merece.
            </p>
          </div>
        </div>

        {/* Nossa História */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-foreground mb-6">Nossa História</h2>
          <div className="bg-muted/30 rounded-2xl p-8 md:p-12">
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Viemos de uma tradição familiar sempre envolvida em causas sociais — desde a infância 
              acompanhávamos ações de apoio a comunidades, onde vimos de perto a importância de 
              estender a mão a quem mais precisa. Esse olhar nos guiou também na medicina e nos 
              fez querer ser médicos.
            </p>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Desde nossa formação tivemos a oportunidade de trabalhar no SUS. Foi uma experiência 
              transformadora que trouxe uma vontade de mudança. Vimos de perto o quanto o sistema, 
              apesar de essencial e grandioso, ainda deixa tantas lacunas: filas intermináveis, 
              dificuldades de acesso e pessoas que, por viverem longe dos grandes centros, acabam 
              sem o cuidado de que precisam no tempo certo.
            </p>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Aos poucos, percebemos que, se por um lado não poderíamos mudar todo o sistema, por 
              outro, poderíamos buscar soluções reais para tornar o acesso à saúde mais justo e humano. 
              Foi assim que nasceu a Médicos do Bem: com o propósito de democratizar o atendimento 
              médico no Brasil.
            </p>
            <div className="text-center pt-6">
              <p className="text-lg font-semibold text-primary mb-4">
                "Saúde sem fronteiras, feita para todos"
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-2xl mx-auto">
                <div>
                  <div className="text-3xl font-bold text-primary mb-2">2K+</div>
                  <div className="text-sm text-muted-foreground">Atendimentos</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary mb-2">4.9★</div>
                  <div className="text-sm text-muted-foreground">Avaliação</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary mb-2">50+</div>
                  <div className="text-sm text-muted-foreground">Especialistas</div>
                </div>
                <div>
                  <div className="text-3xl font-bold text-primary mb-2">24/7</div>
                  <div className="text-sm text-muted-foreground">Disponibilidade</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Nossos Valores */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-foreground mb-12">
            Nossos Valores
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="medical-card p-6 text-center">
              <Users className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Acessibilidade</h3>
              <p className="text-muted-foreground">
                Tornamos o acesso à saúde mais fácil e acessível para todos, 
                independente de localização ou condição socioeconômica.
              </p>
            </div>
            <div className="medical-card p-6 text-center">
              <Award className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Qualidade</h3>
              <p className="text-muted-foreground">
                Todos os nossos profissionais são rigorosamente selecionados e 
                possuem certificações reconhecidas pelos órgãos competentes.
              </p>
            </div>
            <div className="medical-card p-6 text-center">
              <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">Segurança</h3>
              <p className="text-muted-foreground">
                Utilizamos as melhores práticas de segurança digital para proteger 
                suas informações pessoais e médicas.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default QuemSomos;