import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, ExternalLink } from "lucide-react";

const WA_LINK = "https://wa.me/5511933359187?text=Quero%20renovar%20minha%20receita!";

const WhatsAppIcon = () => (
  <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);

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
                    <WhatsAppIcon />
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
