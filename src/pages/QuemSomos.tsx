import { Heart, Users, Award, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import quemSomosHero from "@/assets/quem-somos-hero.jpg";
const QuemSomos = () => {
  return <div className="py-0">
      <div className="container mx-auto px-4">
        {/* Hero */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
            Prontia Saúde
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Conectamos você aos melhores profissionais de saúde através de consultas online 
            seguras, acessíveis e de alta qualidade.
          </p>
        </div>

        {/* Nossa Missão com Imagem */}
        <div className="mb-16">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <img src={quemSomosHero} alt="Equipe Prontia Saúde" className="rounded-2xl shadow-lg w-full" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-6 text-center">Quem somos nós?</h2>
              <p className="text-muted-foreground mb-4">
                Tornar o cuidado com a saúde mais acessível, conveniente e eficiente para todos. 
                Acreditamos que o acesso a profissionais qualificados de saúde não deveria ser um privilégio, 
                mas um direito fundamental.
              </p>
              <p className="text-muted-foreground mb-6">
                Nossa plataforma conecta pacientes a médicos, psicólogos e outros especialistas 
                através de consultas online seguras, eliminando barreiras geográficas e reduzindo custos.
              </p>
              <Button variant="medical" size="lg" asChild>
                <a href="/#servicos">Conheça Nossos Serviços</a>
              </Button>
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

        {/* Nossa História */}
        <div className="bg-muted/30 rounded-2xl p-8 md:p-12 text-center">
          <h2 className="text-3xl font-bold text-foreground mb-6">Nossa História</h2>
          <p className="text-muted-foreground max-w-3xl mx-auto mb-8">
            Fundada com o propósito de democratizar o acesso à saúde de qualidade, 
            a Médicos do Bem nasceu da necessidade de conectar profissionais qualificados 
            a pacientes que buscam cuidado médico conveniente e acessível.
          </p>
          <p className="text-muted-foreground max-w-3xl mx-auto">
            Desde nossa fundação, já realizamos mais de 2.000 atendimentos, 
            mantendo uma avaliação média de 4.9 estrelas de nossos pacientes satisfeitos.
          </p>
        </div>
      </div>
    </div>;
};
export default QuemSomos;