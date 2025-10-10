import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, MessageCircle, ExternalLink } from "lucide-react";

const WA_LINK = "https://wa.me/5511933359187?text=Quero%20renovar%20minha%20receita!";

export default function ConfirmacaoReceitas() {
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(30);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const receiptUrl = searchParams.get("receipt_url");

  useEffect(() => {
    // Start countdown
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleRedirect();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleRedirect = () => {
    setIsRedirecting(true);
    window.location.href = WA_LINK;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background py-16">
      <div className="container mx-auto px-4 max-w-2xl">
        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-12 w-12 text-green-600" />
            </div>
            <CardTitle className="text-3xl font-bold text-foreground">
              ✅ Pagamento aprovado!
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-lg text-muted-foreground mb-6">
                Vamos dar sequência pelo WhatsApp.<br />
                Você pode clicar no botão abaixo ou aguardar o redirecionamento automático.
              </p>

              {/* Timer de redirecionamento */}
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-6 mb-6">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <Clock className="h-6 w-6 text-primary" />
                  <span className="text-2xl font-bold text-primary">{countdown}s</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Encaminhando em {countdown} segundos...
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    onClick={handleRedirect} 
                    disabled={isRedirecting}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    {isRedirecting ? "Redirecionando..." : "Falar no WhatsApp"}
                  </Button>
                  {receiptUrl && (
                    <Button 
                      asChild
                      variant="outline"
                      className="flex-1"
                    >
                      <a href={receiptUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Ver comprovante
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t pt-6 space-y-4">
              <h3 className="font-semibold text-foreground text-center">Próximos Passos</h3>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-xs">1</span>
                  <span>Nossa equipe vai entrar em contato pelo WhatsApp</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-xs">2</span>
                  <span>Iremos solicitar os dados necessários para renovar sua receita</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-xs">3</span>
                  <span>Em breve você receberá sua receita renovada</span>
                </li>
              </ol>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button asChild variant="default" className="flex-1">
                <Link to="/">Voltar ao Início</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link to="/servicos">Ver Outros Serviços</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
