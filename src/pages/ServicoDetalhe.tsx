import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CadastroModal } from "@/components/modais/CadastroModal";
import { CATALOGO_SERVICOS } from "@/lib/constants";
import { formataPreco } from "@/lib/utils";
import { openCheckoutModal, getProductKeyFromSlug, getCurrentCustomerData } from "@/lib/infinitepay-checkout";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Clock, Users, CheckCircle, Star, Shield } from "lucide-react";
import { trackViewContent, trackLead } from "@/lib/meta-tracking";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
const ServicoDetalhe = () => {
  const {
    slug
  } = useParams<{
    slug: string;
  }>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const {
    toast
  } = useToast();
  const servico = CATALOGO_SERVICOS.find(s => s.slug === slug);
  
  // Set default variant on load
  useEffect(() => {
    if (servico?.variantes && servico.variantes.length > 0) {
      setSelectedVariant(servico.variantes[0].nome);
    }
  }, [servico]);
  
  // Get current variant price
  const getCurrentPrice = () => {
    if (!servico?.variantes) return servico?.precoBase || 0;
    const variant = servico.variantes.find(v => v.nome === selectedVariant);
    return variant?.valor || servico.precoBase;
  };
  
  const getCurrentSku = () => {
    if (!servico?.variantes) return servico?.sku;
    const variant = servico.variantes.find(v => v.nome === selectedVariant);
    return variant?.sku || servico.sku;
  };
  
  // Track ViewContent when service is loaded
  useEffect(() => {
    if (servico) {
      trackViewContent({
        content_name: servico.nome,
        content_category: 'Serviços',
        content_ids: [servico.slug],
        value: servico.precoBase / 100 // Convert cents to reais
      });
    }
  }, [servico]);
  
  if (!servico) {
    return <div className="py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-4">Serviço não encontrado</h1>
          <p className="text-muted-foreground mb-6">O serviço solicitado não existe.</p>
          <Button asChild>
            <Link to="/servicos">Ver Todos os Serviços</Link>
          </Button>
        </div>
      </div>;
  }
  const handleAgendar = async () => {
    setIsLoading(true);
    try {
      const productKey = getProductKeyFromSlug(servico.slug);
      
      if (!productKey) {
        toast({
          title: "Erro",
          description: "Serviço não encontrado.",
          variant: "destructive",
        });
        return;
      }
      
      // Track Lead event with current price
      trackLead({
        value: getCurrentPrice(),
        content_name: servico.nome + (selectedVariant ? ` - ${selectedVariant}` : ''),
      });
      
      // Get customer data
      const customerData = await getCurrentCustomerData();
      
      // Open InfinitePay modal
      openCheckoutModal(
        productKey,
        customerData,
        () => {
          // Success callback - redirect to confirmation page
          window.location.href = '/confirmacao';
        },
        () => {
          // Timeout callback
          toast({
            title: "Tempo esgotado",
            description: "O tempo de pagamento expirou. Por favor, tente novamente.",
            variant: "destructive",
          });
        }
      );
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
      <div className="py-16">
        <div className="container mx-auto px-4">
          {/* Navegação */}
          <div className="mb-8">
            <Link to="/servicos" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-4">
              <ArrowLeft className="h-4 w-4" />
              Voltar aos serviços
            </Link>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Conteúdo principal */}
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                {servico.nome}
              </h1>
              <p className="text-xl text-muted-foreground mb-8">
                {servico.slug === "renovacao" ? "Para renovar sua receita, é necessário enviar uma receita médica anterior com no máximo 3 meses de emissão. Assim, nosso médico poderá avaliar e liberar a nova prescrição com segurança." : servico.slug === "laudos_psicologicos" ? "Necessário consulta prévia com psicólogo." : `${servico.descricao}.`}
              </p>

              {/* Informações básicas */}
              <div className="flex items-center gap-6 mb-8 text-muted-foreground">
                {servico.slug === "psicologa" && <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    <span className="font-medium">30 minutos</span>
                  </div>}
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  <span className="font-medium">Consulta Online</span>
                </div>
              </div>

              {/* O que inclui */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">
                  O que está incluso:
                </h2>
                <ul className="space-y-3">
                  {servico.slug === "laudos_psicologicos" || servico.slug === "consulta" || servico.slug === "renovacao" ? servico.inclui.map((item, index) => <li key={index} className="flex items-center gap-3">
                          <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                          <span className="text-muted-foreground">{item}</span>
                        </li>) : <li className="flex items-center gap-3">
                          <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                          <span className="text-muted-foreground">
                            {servico.slug === "medicos_especialistas" ? "Uma consulta agendada com o médico especialista de sua escolha" : servico.inclui[0]}
                          </span>
                        </li>}
                </ul>
              </div>

              {/* Como funciona */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">
                  Como funciona:
                </h2>
                <div className="space-y-4">
                  {servico.slug === "laudos_psicologicos" ? <>
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                          1
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">Avaliação online</h3>
                          <p className="text-muted-foreground">Primeiro, o paciente realiza uma avaliação online com um de nossos psicólogos credenciados</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                          2
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">Análise e aprovação</h3>
                          <p className="text-muted-foreground">O profissional avalia a necessidade e, se estiver tudo de acordo, autoriza a emissão do laudo</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                          3
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">Emissão do laudo</h3>
                          <p className="text-muted-foreground">Com a aprovação, o laudo psicológico é elaborado e enviado ao paciente, pronto para ser utilizado em procedimentos como cirurgia bariátrica, laqueadura, vasectomia</p>
                        </div>
                      </div>
                    </> : servico.slug === "renovacao" ? <>
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                          1
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">Envio da receita</h3>
                          <p className="text-muted-foreground">Após o pagamento, envie sua receita anterior (máximo 3 meses) </p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                          2
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">Avaliação médica</h3>
                          <p className="text-muted-foreground">Nosso médico avalia sua receita</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                          3
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">Nova receita</h3>
                          <p className="text-muted-foreground">Receba sua nova receita digital com assinatura médica</p>
                        </div>
                      </div>
                    </> : <>
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                          1
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">Agendamento</h3>
                          <p className="text-muted-foreground">Realize o pagamento e agende sua consulta</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                          2
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">Confirmação</h3>
                          <p className="text-muted-foreground">Receba o link da videochamada no seu WhatsApp</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                          3
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">Consulta</h3>
                          <p className="text-muted-foreground">Conecte-se no horário agendado com o profissional</p>
                        </div>
                      </div>
                    </>}
                </div>
              </div>

              {/* Garantias */}
              <div className="bg-muted/30 rounded-xl p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Nossas Garantias
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-accent fill-current flex-shrink-0" />
                    Profissionais certificados e experientes
                  </li>
                  <li className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-accent fill-current flex-shrink-0" />
                    Plataforma segura e confiável
                  </li>
                  <li className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-accent fill-current flex-shrink-0" />
                    Suporte técnico disponível
                  </li>
                </ul>
              </div>
            </div>

            {/* Card de agendamento */}
            <div className="lg:sticky lg:top-24">
              <div className="medical-card p-6">
                {/* Dropdown for variants */}
                {servico.variantes && servico.variantes.length > 0 && (
                  <div className="mb-4">
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      {servico.slug === "psicologa" ? "Selecione o plano:" : "Selecione a especialidade:"}
                    </label>
                    <Select value={selectedVariant} onValueChange={setSelectedVariant}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {servico.variantes.map((variante) => {
                          const isPsychologist = servico.slug === "psicologa";
                          const consultas = variante.consultas || 1;
                          const valorTotal = variante.valor * consultas;
                          
                          return (
                            <SelectItem key={variante.nome} value={variante.nome}>
                              {isPsychologist && consultas > 1 ? (
                                <>
                                  {variante.nome} - {formataPreco(variante.valor)}/consulta 
                                  <span className="text-muted-foreground text-xs ml-1">
                                    (Total: {formataPreco(valorTotal)})
                                  </span>
                                </>
                              ) : (
                                <>
                                  {variante.nome} - {formataPreco(variante.valor)}
                                </>
                              )}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div className="text-center mb-6">
                  {(servico.slug === "psicologa" || servico.slug === "medicos_especialistas") && !selectedVariant && <p className="text-muted-foreground mb-2">À partir de</p>}
                  <div className="text-3xl font-bold text-foreground mb-2">
                    {formataPreco(getCurrentPrice())}
                  </div>
                  <p className="text-muted-foreground">Pagamento único</p>
                </div>

                <Button onClick={() => {
                handleAgendar();
              }} variant="outline" size="lg" className="bg-green-600 text-white border-green-600 hover:bg-green-700 w-full mb-4" disabled={isLoading} data-sku={getCurrentSku()}>
                  {isLoading ? "Processando..." : "Agendar agora"}
                </Button>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    Pagamento seguro via InfinitePay
                  </p>
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span>SSL Certificado</span>
                    <div className="w-2 h-2 bg-accent rounded-full"></div>
                    <span>Dados Protegidos</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Tem dúvidas sobre este serviço?
                </p>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/quem-somos">Fale Conosco</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CadastroModal open={isModalOpen} onOpenChange={setIsModalOpen} onSuccess={handleAgendar} />
    </>;
};
export default ServicoDetalhe;