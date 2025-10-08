import { Link } from "react-router-dom";
import { ServicoCard } from "@/components/home/ServicoCard";

import { Button } from "@/components/ui/button";
import { CATALOGO_SERVICOS } from "@/lib/constants";
import { ArrowLeft, Clock, Users, CheckCircle } from "lucide-react";
const Servicos = () => {
  return <div className="py-16">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-4">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao início
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
            Nossos Serviços
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl">Consulta médica online na hora com atestado médico, atestado de aptidão física, renovação de receitas, solicitação de exames, atestado de piscina e laudos psicológicos válidos em todo país.</p>
        </div>

        {/* Especialidades Dinâmicas */}
        <div className="mb-12">
          
        </div>

        {/* Grid de serviços */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {CATALOGO_SERVICOS.map(servico => <ServicoCard key={servico.slug} servico={servico} />)}
        </div>

        {/* Vantagens dos serviços online */}
        <div className="bg-muted/30 rounded-2xl p-8 md:p-12">
          <h2 className="text-3xl font-bold text-center text-foreground mb-8">
            Por que escolher consultas online?
          </h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <Clock className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Agilidade
              </h3>
              <p className="text-muted-foreground">
                Agende e realize sua consulta no mesmo dia, sem filas ou esperas desnecessárias.
              </p>
            </div>
            <div className="text-center">
              <Users className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Conveniência
              </h3>
              <p className="text-muted-foreground">
                Consulte-se no conforto da sua casa, eliminando deslocamentos e economizando tempo.
              </p>
            </div>
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-3">
                Qualidade
              </h3>
              <p className="text-muted-foreground">Profissionais qualificados e experientes, com a mesma qualidade do atendimento presencial.</p>
            </div>
          </div>
        </div>

        {/* CTA final */}
        <div className="text-center mt-12">
          <h2 className="text-2xl font-bold text-foreground mb-4">
            Pronto para cuidar da sua saúde?
          </h2>
          <p className="text-muted-foreground mb-6">
            Escolha o serviço que precisa e agende sua consulta agora mesmo.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mx-auto">
            <Button variant="medical" size="lg" asChild>
              <a href="/#servicos">Agendar agora</a>
            </Button>
          <Button variant="outline" size="lg" asChild>
            <Link to="/planos">Ver Planos</Link>
          </Button>
          </div>
        </div>
      </div>
    </div>;
};
export default Servicos;