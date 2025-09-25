import { useState } from "react";
import { ServicoCard } from "./ServicoCard";
import { Button } from "@/components/ui/button";
import { CATALOGO_SERVICOS } from "@/lib/constants";
export function ServicosSection() {
  const [tipoContratacao, setTipoContratacao] = useState<string>("MENSAL");
  
  const opcoesContratacao = [
    {
      code: "MENSAL",
      nome: "Mensal",
      desconto: 0
    },
    {
      code: "SEMESTRAL", 
      nome: "Semestral",
      desconto: 15
    },
    {
      code: "ANUAL",
      nome: "Anual", 
      desconto: 25
    }
  ];

  const descontoAtual = opcoesContratacao.find(opcao => opcao.code === tipoContratacao)?.desconto || 0;

  return <section id="servicos" className="py-16 bg-background">
      <div className="container mx-auto px-[25px]">
        {/* Header da seção */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Nossos Serviços
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">Escolha o serviço que precisa e conecte-se com um profissional qualificado.</p>

          {/* Simulador de contratação */}
          <div className="inline-block">
            <h3 className="text-sm font-medium text-foreground mb-3">
              Simular desconto por tipo de contratação:
            </h3>
            <div className="flex flex-wrap gap-2 justify-center">
              {opcoesContratacao.map(opcao => (
                <Button 
                  key={opcao.code} 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setTipoContratacao(opcao.code)} 
                  className={`${tipoContratacao === opcao.code ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90" : "hover:bg-accent hover:text-accent-foreground"}`}
                >
                  {opcao.nome}
                  {opcao.desconto > 0 && (
                    <span className="ml-1 text-xs">(-{opcao.desconto}%)</span>
                  )}
                </Button>
              ))}
            </div>
            {descontoAtual > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                * Simulação visual. Desconto de {descontoAtual}% aplicado na contratação {tipoContratacao.toLowerCase()}.
              </p>
            )}
          </div>
        </div>

        {/* Grid de serviços */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CATALOGO_SERVICOS.map(servico => (
            <ServicoCard 
              key={servico.slug} 
              servico={servico} 
              tipoContratacao={tipoContratacao}
              descontoContratacao={descontoAtual}
              showDesconto={descontoAtual > 0} 
            />
          ))}
        </div>
      </div>
    </section>;
}