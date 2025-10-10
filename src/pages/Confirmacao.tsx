import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, MessageCircle } from "lucide-react";

const WEBAPP_EXEC = "https://script.google.com/macros/s/AKfycbz75MBiAKNvWLQi988cHmovasFE4KLWliRGxnAmfQuyNcx9ipJnkcj6N3cdzlkKWnWc/exec";
const WHATSAPP_FALLBACK = "https://wa.me/5511912345678?text=Preciso%20de%20ajuda%20ap%C3%B3s%20o%20pagamento";

// Mapa de SKU para especialidade
const SKU_TO_SPECIALTY: Record<string, string> = {
  "pronto_atendimento": "clinico",
  "consulta": "clinico",
  "ZXW2165": "clinico",
  "ZXW2166": "psicologia",
  "ZXW2167": "nutricao",
  "ZXW2168": "fisioterapia",
};

export default function Confirmacao() {
  const { sku } = useParams<{ sku?: string }>();
  const [countdown, setCountdown] = useState(30);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string>("");
  const [error, setError] = useState(false);

  useEffect(() => {
    // Coleta dados do localStorage
    const getVal = (keys: string[], fallback = "") => {
      for (const key of keys) {
        const value = localStorage.getItem(key);
        if (value) return value;
      }
      return fallback;
    };

    const onlyDigits = (s: string) => s.replace(/\D/g, "");

    const nome = getVal(["nome", "full_name", "first_name", "prontiaSaude_nome"]);
    const email = getVal(["email", "prontiaSaude_email"]);
    const cpf = onlyDigits(getVal(["cpf", "document", "prontiaSaude_cpf"]));
    const telefone = onlyDigits(getVal(["telefone", "phone", "prontiaSaude_phone"]));
    const skuNormalized = (sku || "pronto_atendimento").toLowerCase().trim();
    const especialidade = SKU_TO_SPECIALTY[skuNormalized] || "clinico";

    const payload = {
      sku: skuNormalized,
      email,
      nome,
      cpf,
      telefone,
      especialidade,
      horario_iso: new Date().toISOString(),
      plano_ativo: false
    };

    // Chamada ao Apps Script
    fetch(`${WEBAPP_EXEC}?path=site-schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(r => r.json())
      .then(data => {
        console.log("site-schedule response:", data);
        const link = data.meetingLink || data.queueURL || data.url || "";
        
        if (link) {
          setRedirectUrl(link);
        } else {
          setRedirectUrl(WHATSAPP_FALLBACK);
        }
      })
      .catch(err => {
        console.error("site-schedule error:", err);
        setError(true);
        setRedirectUrl(WHATSAPP_FALLBACK);
      });
  }, [sku]);

  useEffect(() => {
    if (!redirectUrl) return;

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
  }, [redirectUrl]);

  const handleRedirect = () => {
    setIsRedirecting(true);
    window.location.href = redirectUrl || WHATSAPP_FALLBACK;
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
              {error ? (
                <p className="text-lg text-muted-foreground mb-6">
                  Pagamento aprovado, mas não conseguimos iniciar automaticamente o atendimento.
                  Use o botão do WhatsApp abaixo para falar com nossa equipe.
                </p>
              ) : (
                <p className="text-lg text-muted-foreground mb-6">
                  Pagamento aprovado! Vamos te encaminhar para a plataforma de atendimento.
                  Caso não redirecione automaticamente, clique no botão abaixo.
                </p>
              )}

              {/* Timer de redirecionamento */}
              {redirectUrl && !error && (
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
                      className="flex-1"
                    >
                      {isRedirecting ? "Redirecionando..." : "Ir para o atendimento"}
                    </Button>
                    <Button 
                      asChild
                      variant="outline"
                      className="flex-1"
                    >
                      <a href={WHATSAPP_FALLBACK} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="mr-2 h-4 w-4" />
                        Falar no WhatsApp
                      </a>
                    </Button>
                  </div>
                </div>
              )}

              {/* Fallback apenas WhatsApp em caso de erro */}
              {error && (
                <div className="mb-6">
                  <Button 
                    asChild
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    <a href={WHATSAPP_FALLBACK} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Falar no WhatsApp
                    </a>
                  </Button>
                </div>
              )}
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
