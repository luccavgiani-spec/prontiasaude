import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, AlertCircle, ExternalLink } from "lucide-react";
import { requireAuth, getPatient } from "@/lib/auth";

const GAS_ENDPOINT = "https://script.google.com/macros/s/AKfycbz75MBiAKNvWLQi988cHmovasFE4KLWliRGxnAmfQuyNcx9ipJnkcj6N3cdzlkKWnWc/exec";

export default function Confirmacao() {
  const { sku } = useParams<{ sku?: string }>();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(30);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string>("");
  const [error, setError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [profileIncomplete, setProfileIncomplete] = useState(false);

  useEffect(() => {
    const checkAuthAndProfile = async () => {
      const auth = await requireAuth();
      if (!auth) {
        navigate('/entrar');
        return;
      }

      const patient = await getPatient(auth.user.id);
      if (!patient || !patient.profile_complete) {
        setProfileIncomplete(true);
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      callAppScript(patient.cpf || '', patient.first_name || '', patient.last_name || '');
    };

    checkAuthAndProfile();
  }, [sku, navigate]);

  const callAppScript = async (cpf: string, firstName: string, lastName: string) => {
    try {
      console.log('Calling App Script with SKU:', sku);
      
      const url = `${GAS_ENDPOINT}?path=redirect&sku=${encodeURIComponent(sku || '')}&cpf=${encodeURIComponent(cpf)}&nome=${encodeURIComponent(`${firstName} ${lastName}`)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('App Script response:', result);

      if (result.success && result.url) {
        setRedirectUrl(result.url);
      } else {
        console.warn('No redirect URL received from App Script');
        setError(true);
      }
    } catch (err) {
      console.error('Exception calling App Script:', err);
      setError(true);
    }
  };

  useEffect(() => {
    if (!redirectUrl || error) return;

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
  }, [redirectUrl, error]);

  const handleRedirect = () => {
    setIsRedirecting(true);
    window.location.href = redirectUrl;
  };

  const handleCompleteProfile = () => {
    navigate(`/completar-perfil?redirect=/confirmacao/${sku || ''}`);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background py-16">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card className="shadow-xl">
            <CardContent className="py-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Carregando...</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Profile incomplete state
  if (profileIncomplete) {
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
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
                <AlertCircle className="h-12 w-12 text-amber-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Complete seu cadastro para continuar
                </h3>
                <p className="text-muted-foreground mb-4">
                  Para acessar o atendimento, precisamos que você complete todas as suas informações na Área do Paciente.
                </p>
                <Button 
                  onClick={handleCompleteProfile}
                  className="w-full"
                  size="lg"
                >
                  Completar Cadastro Agora
                </Button>
              </div>

              <div className="border-t pt-6 space-y-4">
                <h3 className="font-semibold text-foreground text-center">Por que preciso completar meu cadastro?</h3>
                <ol className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-xs">1</span>
                    <span>Seus dados completos são necessários para a equipe médica</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-xs">2</span>
                    <span>Com o cadastro completo, você será redirecionado automaticamente para o atendimento</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-xs">3</span>
                    <span>Leva apenas 2 minutos para preencher</span>
                  </li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Success state with redirect
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
              <p className="text-xl text-foreground font-semibold mb-4">
                Pagamento aprovado com sucesso! 🎉
              </p>
              
              <p className="text-base text-muted-foreground mb-8">
                Você será redirecionado automaticamente para sua consulta do serviço escolhido.
              </p>

              {/* Loading enquanto busca URL */}
              {!redirectUrl && !error && (
                <div className="bg-muted/50 border border-border rounded-xl p-8 mb-6">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-base text-muted-foreground">
                    Preparando seu redirecionamento...
                  </p>
                </div>
              )}

              {/* Timer de redirecionamento */}
              {redirectUrl && !error && (
                <div className="bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/30 rounded-xl p-10 mb-6 shadow-lg">
                  <div className="flex items-center justify-center gap-4 mb-5">
                    <Clock className="h-10 w-10 text-primary animate-pulse" />
                    <span className="text-6xl font-bold text-primary tabular-nums">{countdown}</span>
                  </div>
                  <p className="text-lg font-semibold text-foreground mb-2">
                    Redirecionando em {countdown} segundos
                  </p>
                  <p className="text-sm text-muted-foreground mb-6">
                    Aguarde enquanto preparamos seu acesso...
                  </p>
                  <Button 
                    onClick={handleRedirect} 
                    disabled={isRedirecting}
                    size="lg"
                    className="w-full"
                  >
                    <ExternalLink className="mr-2 h-5 w-5" />
                    {isRedirecting ? "Redirecionando..." : "Acessar Agora"}
                  </Button>
                </div>
              )}

              {/* Fallback em caso de erro */}
              {error && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-8 mb-6">
                  <AlertCircle className="h-12 w-12 text-amber-600 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-foreground mb-3">
                    Não foi possível conectar automaticamente
                  </p>
                  <p className="text-base text-muted-foreground mb-6">
                    Seu pagamento foi aprovado. Por favor, entre em contato com nosso suporte para prosseguir.
                  </p>
                </div>
              )}
            </div>

            <div className="border-t pt-6 space-y-4">
              <h3 className="font-semibold text-foreground text-center">Próximos Passos</h3>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-xs">1</span>
                  <span>Você será redirecionado para a plataforma de atendimento</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-xs">2</span>
                  <span>Aguarde o profissional para iniciar sua consulta</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-xs">3</span>
                  <span>Tenha em mãos seus documentos e histórico médico se necessário</span>
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
