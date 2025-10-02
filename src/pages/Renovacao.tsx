import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pill, CheckCircle, ArrowLeft, Clock, Shield, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { formataPreco } from "@/lib/utils";
import { openCheckoutModal, getProductKeyFromSlug, getCurrentCustomerData } from "@/lib/infinitepay-checkout";
import { useToast } from "@/hooks/use-toast";
import { trackLead } from "@/lib/meta-tracking";

const Renovacao = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleAgendar = async () => {
    setIsLoading(true);
    try {
      const productKey = getProductKeyFromSlug("renovacao_receitas");
      if (!productKey) {
        toast({
          title: "Erro",
          description: "Serviço não encontrado.",
          variant: "destructive"
        });
        return;
      }

      trackLead({
        value: 34.90,
        content_name: "Renovação de Receitas e Atestados"
      });

      const customerData = await getCurrentCustomerData();

      openCheckoutModal(productKey, customerData, () => {
        window.location.href = '/confirmacao';
      }, () => {
        toast({
          title: "Tempo esgotado",
          description: "O tempo de pagamento expirou. Por favor, tente novamente.",
          variant: "destructive"
        });
      });
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

  return (
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
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Pill className="h-8 w-8 text-primary" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">
                Renovação de Receitas e Atestados
              </h1>
            </div>
            
            <p className="text-xl text-muted-foreground mb-8">
              Assim que o pagamento for aprovado, um de nossos médicos vai entrar em contato com você pelo WhatsApp, solicitar a foto da receita ou atestado e dar prosseguimento imediato ao atendimento.
            </p>

            {/* Informações básicas */}
            <div className="flex items-center gap-6 mb-8 text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                <span className="font-medium">Atendimento Imediato</span>
              </div>
            </div>

            {/* O que inclui */}
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-4">
                O que está incluso:
              </h2>
              <ul className="space-y-3">
                <li className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">Contato via WhatsApp</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">Avaliação médica</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">Nova receita digital</span>
                </li>
                <li className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                  <span className="text-muted-foreground">Atendimento rápido</span>
                </li>
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
                    <h3 className="font-semibold text-foreground mb-1">Realize o pagamento</h3>
                    <p className="text-muted-foreground">Efetue o pagamento de forma segura através da nossa plataforma</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                    2
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Envie sua receita</h3>
                    <p className="text-muted-foreground">Nosso médico entrará em contato via WhatsApp para solicitar a foto da receita ou atestado anterior</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                    3
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">Receba sua nova receita</h3>
                    <p className="text-muted-foreground">Após avaliação médica, você receberá sua receita ou atestado renovado de forma digital</p>
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
                  Médicos certificados e experientes
                </li>
                <li className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-accent fill-current flex-shrink-0" />
                  Receita digital válida e segura
                </li>
                <li className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-accent fill-current flex-shrink-0" />
                  Atendimento rápido via WhatsApp
                </li>
              </ul>
            </div>
          </div>

          {/* Card de pagamento */}
          <div className="lg:sticky lg:top-24">
            <div className="medical-card p-6">
              <div className="text-center mb-6">
                <div className="text-3xl font-bold text-foreground mb-2">
                  {formataPreco(34.90)}
                </div>
                <p className="text-muted-foreground">Pagamento único</p>
              </div>

              <Button 
                onClick={handleAgendar} 
                variant="outline" 
                size="lg" 
                className="bg-green-600 text-white border-green-600 hover:bg-green-700 w-full mb-4" 
                disabled={isLoading}
              >
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default Renovacao;
