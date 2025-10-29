import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Clock, AlertCircle, ExternalLink } from "lucide-react";
import { requireAuth, getPatient } from "@/lib/auth";
import { invokeEdgeFunction } from "@/lib/supabase-wrapper";
const WHATSAPP_LINK = "https://api.whatsapp.com/send/?phone=5511933359187&text=Ol%C3%A1%21&type=phone_number&app_absent=0";

export default function Confirmacao() {
  const { sku } = useParams<{ sku?: string }>();
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(30);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string>("");
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [skuError, setSkuError] = useState(false);

  // ========== DIAGNÓSTICO: Log do SKU capturado ==========
  console.log('🔍 [DIAGNÓSTICO] SKU capturado do useParams:', sku);
  console.log('🔍 [DIAGNÓSTICO] Tipo do SKU:', typeof sku);
  console.log('🔍 [DIAGNÓSTICO] SKU é undefined?', sku === undefined);
  console.log('🔍 [DIAGNÓSTICO] SKU é ":sku"?', sku === ':sku');

  useEffect(() => {
    const checkAuthAndProfile = async () => {
      // ========== VALIDAÇÃO DO SKU ==========
      console.log('🔍 [VALIDAÇÃO] Iniciando validação do SKU...');
      
      if (!sku || sku === ':sku' || sku.trim() === '') {
        console.error('❌ [ERRO] SKU inválido detectado:', { sku, isEmpty: !sku, isPlaceholder: sku === ':sku' });
        setSkuError(true);
        setErrorMessage('SKU do produto não foi identificado na URL. Por favor, verifique o link de acesso.');
        setIsLoading(false);
        return;
      }

      console.log('✅ [VALIDAÇÃO] SKU válido:', sku);

      const auth = await requireAuth();
      if (!auth) {
        console.log('⚠️ [AUTH] Usuário não autenticado, redirecionando para login');
        navigate('/entrar');
        return;
      }

      console.log('✅ [AUTH] Usuário autenticado:', auth.user.id);

      const patient = await getPatient(auth.user.id);
      if (!patient || !patient.profile_complete) {
        console.log('⚠️ [PERFIL] Perfil incompleto, solicitando completar cadastro');
        setProfileIncomplete(true);
        setIsLoading(false);
        return;
      }

      console.log('✅ [PERFIL] Perfil completo, iniciando chamada schedule-redirect');
      setIsLoading(false);
      callScheduleRedirect(patient.cpf || '', patient.first_name || '', patient.last_name || '', auth.user.email || '');
    };

    checkAuthAndProfile();
  }, [sku, navigate]);

  const callScheduleRedirect = async (cpf: string, firstName: string, lastName: string, email: string) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const payload = {
        sku: sku || '',
        cpf: cpf,
        email: email,
        nome: `${firstName} ${lastName}`,
        telefone: '',
        plano_ativo: false
      };
      
      console.log('[Schedule-Redirect] Calling schedule-redirect:', payload);

      const { data, error } = await invokeEdgeFunction('schedule-redirect', {
        body: payload
      });

      clearTimeout(timeoutId);
      
      console.log('[Schedule-Redirect] Response:', data);

      if (data && data.ok && data.url) {
        console.log('✅ URL obtida:', data.url);
        setRedirectUrl(data.url);
      } else {
        console.error('❌ Erro:', data?.error || 'URL não retornada');
        setErrorMessage(data?.error || 'O servidor não retornou uma URL de redirecionamento válida.');
        setError(true);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          console.error('❌ Timeout: A chamada excedeu 10 segundos');
          setErrorMessage('A conexão com o servidor demorou muito. Por favor, tente novamente.');
        } else {
          console.error('❌ Exceção capturada:', err);
          setErrorMessage(`Erro ao conectar: ${err.message}`);
        }
      } else {
        console.error('❌ Erro desconhecido:', err);
        setErrorMessage('Erro desconhecido ao tentar conectar.');
      }
      
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
                  <p className="text-base text-muted-foreground mb-4">
                    Seu pagamento foi aprovado. {errorMessage || 'Por favor, entre em contato com nosso suporte para prosseguir.'}
                  </p>
                  <Button 
                    asChild
                    size="lg"
                    className="w-full"
                  >
                    <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
                      <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                      Falar com Suporte via WhatsApp
                    </a>
                  </Button>
                </div>
              )}

              {/* Erro de SKU inválido */}
              {skuError && (
                <div className="bg-red-50 border-2 border-red-300 rounded-xl p-8 mb-6">
                  <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-foreground mb-3">
                    Erro no redirecionamento
                  </p>
                  <p className="text-base text-muted-foreground mb-4">
                    Não foi possível completar o redirecionamento automaticamente. Por favor, entre em contato com nosso suporte para dar continuidade ao seu atendimento.
                  </p>
                  <Button 
                    asChild
                    size="lg"
                    className="w-full"
                  >
                    <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer">
                      <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                      </svg>
                      Falar com Suporte via WhatsApp
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
