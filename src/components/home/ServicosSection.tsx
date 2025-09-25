import { useState } from "react";
import { ServicoCard } from "./ServicoCard";
import { Button } from "@/components/ui/button";
import { CATALOGO_SERVICOS, PLANOS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
export function ServicosSection() {
  const [planoSelecionado, setPlanoSelecionado] = useState<string>("SEM_PLANO");
  const opcoes = [{
    code: "SEM_PLANO",
    nome: "Sem plano"
  }, ...PLANOS.filter(p => p.precoMensal !== null)];
  return <section id="servicos" className="py-16 bg-background">
      <div className="container mx-auto px-[25px]">
        {/* Header da seção */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Nossos Serviços
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">Escolha o serviço que precisa e conecte-se com um profissional qualificado.</p>

          {/* Simulador de plano */}
          <div className="inline-block">
            <h3 className="text-sm font-medium text-foreground mb-3">
              Simular com plano:
            </h3>
            <div className="flex flex-wrap gap-2 justify-center">
              {opcoes.map(opcao => <Button key={opcao.code} variant="outline" size="sm" onClick={() => setPlanoSelecionado(opcao.code)} className={`relative ${planoSelecionado === opcao.code ? "bg-green-600 text-white border-green-600 hover:bg-green-700" : "bg-white text-green-700 border-green-600 hover:bg-green-50"}`}>
                  {opcao.nome}
                  {opcao.code === "FAMILIAR" && <Badge variant="secondary" className="absolute -top-2 -right-2 bg-accent text-accent-foreground text-xs px-1">
                      Popular
                    </Badge>}
                </Button>)}
            </div>
            {planoSelecionado !== "SEM_PLANO" && <p className="text-xs text-muted-foreground mt-2">
                * Simulação visual. Descontos aplicados na assinatura do plano.
              </p>}
          </div>
        </div>

        {/* Grid de serviços */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {CATALOGO_SERVICOS.map(servico => <ServicoCard key={servico.slug} servico={servico} planoSelecionado={planoSelecionado !== "SEM_PLANO" ? planoSelecionado : undefined} showDesconto={planoSelecionado !== "SEM_PLANO"} />)}
        </div>

        {/* CTA para planos */}
        {planoSelecionado !== "SEM_PLANO"}
      </div>
    </section>;
}