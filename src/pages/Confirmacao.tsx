import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock } from "lucide-react";

const GAS_REDIRECT_URL = "https://script.google.com/macros/s/AKfycbwxZbuVgiyqd3dsoFe6azhxc_kYhCTTZEAqN9M0DljZpLP_GpPWvFu2ci2rN7gKz1jd/exec";

export default function Confirmacao() {
  const { sku } = useParams<{ sku?: string }>();
  const [countdown, setCountdown] = useState(30);
  const [isRedirecting, setIsRedirecting] = useState(false);

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
    // Build redirect URL with SKU parameter if available
    const redirectUrl = sku 
      ? `${GAS_REDIRECT_URL}?sku=${sku}`
      : GAS_REDIRECT_URL;
    window.location.href = redirectUrl;
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
              ✅ Pagamento aprovado com sucesso!
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-lg text-muted-foreground mb-6">
                Seu pagamento foi processado com sucesso. Em breve você receberá mais informações no seu WhatsApp.
              </p>

              {/* Timer de redirecionamento */}
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-6 mb-6">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <Clock className="h-6 w-6 text-primary" />
                  <span className="text-2xl font-bold text-primary">{countdown}s</span>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  Você será redirecionado automaticamente em {countdown} segundos...
                </p>
                <Button 
                  onClick={handleRedirect} 
                  disabled={isRedirecting}
                  className="w-full"
                >
                  {isRedirecting ? "Redirecionando..." : "Pular e ir agora"}
                </Button>
              </div>
            </div>

            <div className="border-t pt-6 space-y-4">
              <h3 className="font-semibold text-foreground text-center">Próximos Passos</h3>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-xs">1</span>
                  <span>Você receberá uma confirmação no WhatsApp com mais detalhes</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-xs">2</span>
                  <span>Nossa equipe entrará em contato para agendar sua consulta ou prosseguir com o serviço solicitado</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-xs">3</span>
                  <span>Mantenha seu WhatsApp ativo para receber as instruções de acesso</span>
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
