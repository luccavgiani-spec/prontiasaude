import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CadastroModal } from "@/components/modais/CadastroModal";
import { formataPreco, getEmailAtual, getPhone } from "@/lib/utils";
import { startCheckout, getProductKeyFromSlug } from "@/lib/stripe-checkout";
import { useToast } from "@/hooks/use-toast";
import { Clock, Users, CheckCircle } from "lucide-react";
interface Servico {
  slug: string;
  nome: string;
  precoBase: number;
  sku: string;
  descricao: string;
  tempo: string;
  inclui: string[];
}
interface ServicoCardProps {
  servico: Servico;
  planoSelecionado?: string;
  showDesconto?: boolean;
}
export function ServicoCard({
  servico,
  planoSelecionado,
  showDesconto = false
}: ServicoCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const {
    toast
  } = useToast();

  // Cálculo do desconto visual de 45% para assinantes de plano
  const precoComDesconto = showDesconto && planoSelecionado ? servico.precoBase * 0.55 : servico.precoBase;
  const handleAgendar = async (email?: string) => {
    const emailParaUsar = email || (await getEmailAtual());
    if (!emailParaUsar) {
      setIsModalOpen(true);
      return;
    }
    await processarCheckout(emailParaUsar);
  };
  const processarCheckout = async (email: string) => {
    try {
      setIsLoading(true);
      
      const productKey = getProductKeyFromSlug(servico.slug);
      if (!productKey) {
        toast({
          title: "Erro no produto",
          description: "Produto não encontrado no catálogo",
          variant: "destructive",
        });
        return;
      }

      const phone = await getPhone();
      
      await startCheckout({
        email,
        productKey,
        quantity: 1,
        phoneE164: phone || ''
      });
      
    } catch (error) {
      console.error('Erro no checkout:', error);
      // O toast de erro já é mostrado pela função startCheckout
    } finally {
      setIsLoading(false);
    }
  };
  return <>
      <div className="medical-card p-6 hover:shadow-[var(--shadow-medical)] transition-all duration-300 group">
        {/* Header do Card */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {servico.nome}
            </h3>
            <div className="mb-3">
              <p className="text-sm text-muted-foreground">
                {servico.descricao}
              </p>
              {(servico.slug === "laudo_bariatrica" || servico.slug === "laudo_laq_vas") && (
                <p className="text-xs text-muted-foreground mt-1">
                  * Este é apenas o valor do laudo. É necessária uma consulta psicológica antes.
                </p>
              )}
            </div>
          </div>
          {showDesconto && planoSelecionado && <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200">
              45% OFF para assinantes
            </Badge>}
        </div>

        {/* Informações do serviço */}
        <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            <span>{servico.tempo}</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>dOnline</span>
          </div>
        </div>

        {/* O que inclui */}
        <div className="mb-6">
          <h4 className="text-sm font-medium text-foreground mb-2">Inclui:</h4>
          <ul className="space-y-1">
            {servico.inclui.map((item, index) => <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-3 w-3 text-primary flex-shrink-0" />
                <span>{item}</span>
              </li>)}
          </ul>
        </div>

        {/* Preço e CTA */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="flex-1">
            {showDesconto && planoSelecionado ? <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-medium text-muted-foreground line-through">
                    {formataPreco(servico.precoBase)}
                  </span>
                  <span className="text-2xl font-bold text-green-600">
                    {formataPreco(precoComDesconto)}
                  </span>
                </div>
                <p className="text-xs text-green-600 font-medium">
                  Economize 45% com o plano
                </p>
              </div> : <div>
                <span className="text-2xl font-bold text-foreground">
                  {formataPreco(servico.precoBase)}
                </span>
                <p className="text-xs text-muted-foreground">
                  Sem desconto do plano
                </p>
              </div>}
          </div>
          <Button onClick={() => handleAgendar()} variant="outline" size="default" disabled={isLoading} className="bg-green-600 text-white border-green-600 hover:bg-green-700 ml-4 group-hover:scale-105 transition-transform">
            {isLoading ? "Processando..." : "Agendar"}
          </Button>
        </div>
      </div>

      <CadastroModal open={isModalOpen} onOpenChange={setIsModalOpen} onSuccess={handleAgendar} />
    </>;
}