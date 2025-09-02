import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CadastroModal } from "@/components/modais/CadastroModal";
import { CATALOGO_SERVICOS, PRICE_MAP } from "@/lib/constants";
import { formataPreco, getEmailAtual } from "@/lib/utils";
import { criarCheckout, redirecionarParaCheckout } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Clock, Users, CheckCircle, Star, Shield } from "lucide-react";

const ServicoDetalhe = () => {
  const { slug } = useParams<{ slug: string }>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const servico = CATALOGO_SERVICOS.find(s => s.slug === slug);

  if (!servico) {
    return (
      <div className="py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-4">Serviço não encontrado</h1>
          <p className="text-muted-foreground mb-6">O serviço solicitado não existe.</p>
          <Button asChild>
            <Link to="/servicos">Ver Todos os Serviços</Link>
          </Button>
        </div>
      </div>
    );
  }

  const handleAgendar = async (email?: string) => {
    const emailParaUsar = email || await getEmailAtual();
    
    if (!emailParaUsar) {
      setIsModalOpen(true);
      return;
    }

    await processarCheckout(emailParaUsar);
  };

  const processarCheckout = async (email: string) => {
    setIsLoading(true);
    
    try {
      const priceId = PRICE_MAP[servico.slug as keyof typeof PRICE_MAP];
      
      if (!priceId || priceId === "price_xxx") {
        toast({
          title: "Serviço em configuração",
          description: "Este serviço ainda está sendo configurado. Tente novamente mais tarde.",
          variant: "destructive",
        });
        return;
      }

      const checkoutData = await criarCheckout({
        mode: "payment",
        price_id: priceId,
        product_sku: servico.sku,
        email: email
      });

      if (checkoutData.error) {
        toast({
          title: "Erro no checkout",
          description: checkoutData.error,
          variant: "destructive",
        });
        return;
      }

      redirecionarParaCheckout(checkoutData);
      
    } catch (error) {
      toast({
        title: "Erro inesperado",
        description: "Não foi possível processar o agendamento. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
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
                {servico.descricao}
              </p>

              {/* Informações básicas */}
              <div className="flex items-center gap-6 mb-8 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  <span className="font-medium">{servico.tempo}</span>
                </div>
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
                  {servico.inclui.map((item, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Como funciona */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">
                  Como funciona:
                </h2>
                <div className="space-y-4">
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
                      <p className="text-muted-foreground">Receba o link da videochamada por email</p>
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
                <div className="text-center mb-6">
                  <div className="text-3xl font-bold text-foreground mb-2">
                    {formataPreco(servico.precoBase)}
                  </div>
                  <p className="text-muted-foreground">Pagamento único</p>
                </div>

                <Button 
                  onClick={() => handleAgendar()}
                  variant="medical"
                  size="lg"
                  className="w-full mb-4"
                  disabled={isLoading}
                >
                  {isLoading ? "Processando..." : "Agendar Agora"}
                </Button>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    Pagamento seguro via Stripe
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

      <CadastroModal 
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onSuccess={handleAgendar}
      />
    </>
  );
};

export default ServicoDetalhe;