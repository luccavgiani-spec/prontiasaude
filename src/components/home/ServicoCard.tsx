import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CadastroModal } from "@/components/modais/CadastroModal";
import { formataPreco } from "@/lib/utils";
import { openInfinitePayCheckout } from "@/lib/infinitepay-link-resolver";
import { useToast } from "@/hooks/use-toast";
import { trackLead } from "@/lib/meta-tracking";
import { Clock, Users, CheckCircle, Stethoscope, Pill, Heart, UserCheck, FileText, X, Apple, Dumbbell, Brain } from "lucide-react";
interface Servico {
  slug: string;
  nome: string;
  precoBase: number;
  sku: string;
  descricao: string;
  tempo: string;
  inclui: string[];
  naoInclui?: string[];
  variantes?: Array<{
    valor: number;
    nome: string;
    sku: string;
    consultas?: number;
  }>;
}
interface ServicoCardProps {
  servico: Servico;
  tipoContratacao?: string;
  descontoContratacao?: number;
  showDesconto?: boolean;
}
export function ServicoCard({
  servico,
  tipoContratacao,
  descontoContratacao = 0,
  showDesconto = false
}: ServicoCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const {
    toast
  } = useToast();

  // Cálculo do desconto baseado no tipo de contratação
  const precoComDesconto = showDesconto && descontoContratacao > 0 ? servico.precoBase * (1 - descontoContratacao / 100) : servico.precoBase;

  // Função para obter ícone do serviço
  const getServicoIcon = (slug: string) => {
    switch (slug) {
      case "consulta":
        return <Stethoscope className="h-12 w-12 text-primary mb-4" />;
      case "renovacao_receitas":
        return <Pill className="h-12 w-12 text-primary mb-4" />;
      case "solicitacao_exames":
        return <FileText className="h-12 w-12 text-primary mb-4" />;
      case "psicologa":
        return <Brain className="h-12 w-12 text-primary mb-4" />;
      case "medicos_especialistas":
        return <UserCheck className="h-12 w-12 text-primary mb-4" />;
      case "laudos_psicologicos":
        return <FileText className="h-12 w-12 text-primary mb-4" />;
      default:
        return <Stethoscope className="h-12 w-12 text-primary mb-4" />;
    }
  };

  // Função para obter texto do botão
  const getButtonText = (slug: string) => {
    switch (slug) {
      case "consulta":
        return "Consulte agora";
      case "renovacao_receitas":
        return "Renovar agora";
      case "solicitacao_exames":
        return "Solicitar exames";
      default:
        return "Agendar agora";
    }
  };
  const handleAgendar = async () => {
    setIsLoading(true);
    try {
      // Track Lead event when user clicks to schedule
      trackLead({
        value: precoComDesconto,
        content_name: servico.nome
      });

      // Open InfinitePay checkout with redirect to /confirmacao
      const success = await openInfinitePayCheckout(servico.sku, servico.nome, precoComDesconto);
      if (!success) {
        toast({
          title: "Erro",
          description: "Não foi possível abrir o checkout. Tente novamente.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro no checkout:', error);
      toast({
        title: "Erro no checkout",
        description: "Não foi possível iniciar o pagamento. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  return <>
      <div className="bg-card/50 border border-border/50 rounded-xl p-6 hover:shadow-lg transition-all duration-300 group hover:border-primary/20 h-full flex flex-col">
        {/* Ícone do Serviço */}
        <div className="text-center mb-4">
          {getServicoIcon(servico.slug)}
        </div>

        {/* Header do Card */}
        <div className="text-center mb-4">
          <h3 className="text-xl font-semibold text-foreground mb-2">
            {servico.nome}
          </h3>
          {servico.slug !== "laudos_psicologicos" && (
            <p className="text-sm text-muted-foreground">
              {servico.slug === "solicitacao_exames" 
                ? "Obtenha solicitações de exames laboratoriais sem sair de casa." 
                : servico.slug === "renovacao_receitas" 
                ? "Renove agora sua receita válida em todo país." 
                : servico.descricao}
            </p>
          )}
          {showDesconto && descontoContratacao > 0 && <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 mt-2">
              {descontoContratacao}% OFF na contratação {tipoContratacao?.toLowerCase()}
            </Badge>}
        </div>

        {/* Seção especial para Laudos Psicológicos */}
        {servico.slug === "laudos_psicologicos" && <div className="mb-6 space-y-4 flex-grow">
            <div>
              <h4 className="text-sm font-medium text-foreground mb-2">Inclui:</h4>
              <ul className="space-y-1">
                {servico.inclui.map((item, index) => <li key={index} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CheckCircle className="h-3 w-3 text-primary flex-shrink-0" />
                    <span>{item}</span>
                  </li>)}
                
                
              </ul>
            </div>
            {servico.naoInclui && <div>
                <div className="bg-orange-50 border border-orange-300 rounded-lg p-3">
                  <p className="text-sm font-bold text-orange-700">
                    Necessário consulta psicológica prévia!
                  </p>
                </div>
              </div>}
          </div>}

        {/* Spacer para empurrar o preço e botão para baixo */}
        <div className="flex-grow"></div>

        {/* Preço e CTA */}
        <div className="text-center pt-4 border-t border-border mt-auto">
          <div className="mb-4">
            {showDesconto && descontoContratacao > 0 ? <div>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-lg font-medium text-muted-foreground line-through">
                    {formataPreco(servico.precoBase)}
                  </span>
                  <span className="text-2xl font-bold text-green-600">
                    {formataPreco(precoComDesconto)}
                  </span>
                </div>
                <p className="text-xs text-green-600 font-medium">
                  Economize {descontoContratacao}% na contratação {tipoContratacao?.toLowerCase()}
                </p>
              </div> : <div>
                {(servico.slug === "psicologa" || servico.slug === "medicos_especialistas" || servico.slug === "laudos_psicologicos" || servico.slug === "solicitacao_exames") && <p className="text-sm text-muted-foreground mb-1">a partir de</p>}
                <span className="text-2xl font-bold text-foreground">
                  {servico.slug === "psicologa" ? formataPreco(38.49) : servico.slug === "renovacao_receitas" ? formataPreco(9.99) : formataPreco(servico.precoBase)}
                </span>
              </div>}
          </div>
          <div className="space-y-2">
            <Button onClick={() => handleAgendar()} variant="outline" size="default" disabled={isLoading} className="bg-green-600 text-white border-green-600 hover:bg-green-700 w-full group-hover:scale-105 transition-transform" data-sku={servico.sku}>
              {isLoading ? "Processando..." : getButtonText(servico.slug)}
            </Button>
            <Link to={`/servicos/${servico.slug}`}>
              <Button variant="outline" className="w-full group-hover:border-primary transition-colors">
                Ver Detalhes
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <CadastroModal open={isModalOpen} onOpenChange={setIsModalOpen} onSuccess={handleAgendar} />
    </>;
}