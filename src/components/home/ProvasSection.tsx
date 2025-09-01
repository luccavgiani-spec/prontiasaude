import { Star, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEPOIMENTOS, CONTADORES } from "@/lib/constants";
import { useState } from "react";

export function ProvasSection() {
  const [depoimentoAtivo, setDepoimentoAtivo] = useState(0);

  const proximoDepoimento = () => {
    setDepoimentoAtivo((prev) => (prev + 1) % DEPOIMENTOS.length);
  };

  const depoimentoAnterior = () => {
    setDepoimentoAtivo((prev) => (prev - 1 + DEPOIMENTOS.length) % DEPOIMENTOS.length);
  };

  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-4">
        {/* Contadores */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
            Confiança Comprovada
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-2xl mx-auto mb-12">
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-2">
                {CONTADORES.atendimentos}
              </div>
              <div className="text-muted-foreground">Atendimentos realizados</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 mb-2">
                <span className="text-3xl md:text-4xl font-bold text-primary">
                  {CONTADORES.avaliacao}
                </span>
                <Star className="h-6 w-6 text-accent fill-current" />
              </div>
              <div className="text-muted-foreground">Avaliação dos pacientes</div>
            </div>
            <div className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary mb-2">
                {CONTADORES.medicos}
              </div>
              <div className="text-muted-foreground">Especialistas qualificados</div>
            </div>
          </div>
        </div>

        {/* Carrossel de Depoimentos */}
        <div className="max-w-2xl mx-auto">
          <h3 className="text-2xl font-bold text-center text-foreground mb-8">
            O que nossos pacientes dizem
          </h3>
          
          <div className="relative">
            <div className="medical-card p-8 text-center">
              {/* Estrelas */}
              <div className="flex justify-center gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star 
                    key={i} 
                    className="h-5 w-5 text-accent fill-current" 
                  />
                ))}
              </div>
              
              {/* Depoimento */}
              <blockquote className="text-lg text-muted-foreground mb-6 italic">
                "{DEPOIMENTOS[depoimentoAtivo].texto}"
              </blockquote>
              
              {/* Autor */}
              <cite className="text-foreground font-semibold">
                {DEPOIMENTOS[depoimentoAtivo].nome}
              </cite>
            </div>

            {/* Controles do carrossel */}
            <div className="flex justify-center items-center gap-4 mt-6">
              <Button
                variant="outline"
                size="icon"
                onClick={depoimentoAnterior}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              {/* Indicadores */}
              <div className="flex gap-2">
                {DEPOIMENTOS.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setDepoimentoAtivo(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === depoimentoAtivo 
                        ? 'bg-primary' 
                        : 'bg-muted-foreground/30'
                    }`}
                  />
                ))}
              </div>
              
              <Button
                variant="outline"
                size="icon"
                onClick={proximoDepoimento}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Selos de Segurança */}
        <div className="mt-12 flex items-center justify-center gap-6 flex-wrap">
          <div className="flex items-center gap-2 px-4 py-2 bg-card rounded-lg border border-border shadow-sm">
            <div className="w-3 h-3 bg-primary rounded-full"></div>
            <span className="text-sm text-muted-foreground font-medium">Pagamento Seguro (Stripe)</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-card rounded-lg border border-border shadow-sm">
            <div className="w-3 h-3 bg-accent rounded-full"></div>
            <span className="text-sm text-muted-foreground font-medium">Plataforma Verificada</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-card rounded-lg border border-border shadow-sm">
            <div className="w-3 h-3 bg-secondary rounded-full"></div>
            <span className="text-sm text-muted-foreground font-medium">Profissionais Certificados</span>
          </div>
        </div>
      </div>
    </section>
  );
}