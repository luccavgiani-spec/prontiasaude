import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, MessageCircle, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { requireAuth, getPatient } from "@/lib/auth";

const WHATSAPP_FALLBACK = "https://wa.me/5511912345678?text=Preciso%20de%20ajuda%20ap%C3%B3s%20o%20pagamento";

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
      // Check authentication
      const auth = await requireAuth();
      if (!auth) {
        navigate('/entrar');
        return;
      }

      // Check if profile is complete
      const patient = await getPatient(auth.user.id);
      if (!patient || !patient.profile_complete) {
        setProfileIncomplete(true);
        setIsLoading(false);
        return;
      }

      // Profile is complete, proceed to schedule redirect
      setIsLoading(false);
      callScheduleRedirect(auth.user.id);
    };

    checkAuthAndProfile();
  }, [sku, navigate]);

  const callScheduleRedirect = async (userId: string) => {
    try {
      console.log('Calling schedule_redirect with userId:', userId, 'sku:', sku);
      
      const { data, error } = await supabase.functions.invoke('patient-operations', {
        body: {
          operation: 'schedule_redirect',
          user_id: userId,
          sku: sku || ''
        }
      });

      console.log('schedule_redirect response:', data, error);

      if (error) {
        console.error('Error calling schedule_redirect:', error);
        setError(true);
        return;
      }

      const link = data?.meetingLink || data?.queueURL || data?.url || "";
      
      if (link) {
        setRedirectUrl(link);
      } else {
        console.warn('No redirect link received from App Script');
        setError(true);
      }
    } catch (err) {
      console.error('Exception calling schedule_redirect:', err);
      setError(true);
    }
  };

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
