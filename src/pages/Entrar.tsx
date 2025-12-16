import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { validateEmail } from "@/lib/validations";

const Entrar = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        handleSuccessfulLogin();
      }
    };
    checkSession();
    
    // Load Google Identity Services dynamically
    if (!document.querySelector('script[src*="accounts.google.com"]')) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }, [navigate]);

  const handleSuccessfulLogin = () => {
    // ✅ Verificar convite familiar PRIMEIRO (sessionStorage + localStorage fallback)
    const pendingFamilyToken = sessionStorage.getItem('pending_family_invite_token') 
      || localStorage.getItem('pending_family_invite_token');
    if (pendingFamilyToken) {
      sessionStorage.removeItem('pending_family_invite_token');
      localStorage.removeItem('pending_family_invite_token');
      console.log('[Entrar] Redirecting with family invite token');
      window.location.href = `/completar-perfil?token_familiar=${pendingFamilyToken}`;
      return;
    }
    
    // Verificar se há convite empresarial pendente (sessionStorage + localStorage fallback)
    const pendingToken = sessionStorage.getItem('pending_invite_token')
      || localStorage.getItem('pending_invite_token');
    if (pendingToken) {
      sessionStorage.removeItem('pending_invite_token');
      localStorage.removeItem('pending_invite_token');
      console.log('[Entrar] Redirecting with employee invite token');
      window.location.href = `/completar-perfil?token=${pendingToken}`;
      return;
    }
    
    navigate('/auth/callback');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(email)) {
      toast({
        title: "Email inválido",
        description: "Por favor, informe um email válido.",
        variant: "warning",
      });
      return;
    }

    setIsLoading(true);
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Show user-friendly error messages only (don't log sensitive auth details)
      if (error.message === "Invalid login credentials") {
        toast({
          title: "❌ Erro no login",
          description: "Email ou senha incorretos. Verifique seus dados e tente novamente.",
          variant: "warning",
          duration: 5000,
        });
      } else if (error.message.includes("Email not confirmed")) {
        toast({
          title: "⚠️ Email não confirmado",
          description: "Verifique sua caixa de entrada para confirmar seu email.",
          variant: "warning",
          duration: 5000,
        });
      } else {
        toast({
          title: "❌ Erro no login",
          description: "Não foi possível fazer login. Tente novamente.",
          variant: "warning",
          duration: 5000,
        });
      }
    } else {
      handleSuccessfulLogin();
    }
    
    setIsLoading(false);
  };

  // Fallback: usar OAuth tradicional se GSI falhar
  const handleGoogleLoginFallback = async () => {
    console.log('[Google Login] Usando fallback OAuth...');
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      }
    });
    
    if (error) {
      console.error('[Google Login] Fallback OAuth error:', error);
      toast({
        title: "Erro no login",
        description: "Não foi possível fazer login com Google. Tente novamente.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    console.log('[Google Login] Iniciando login com Google...');
    
    try {
      // ✅ Aguardar GSI ser carregado (máximo 5 segundos)
      let gsiAttempts = 0;
      console.log('[Google Login] Aguardando GSI carregar...');
      
      // @ts-ignore - Google Identity Services global
      while (typeof google === 'undefined' || !google?.accounts) {
        if (gsiAttempts >= 50) { // 5 segundos (100ms * 50)
          console.warn('[Google Login] GSI não carregou após 5s, usando fallback OAuth');
          await handleGoogleLoginFallback();
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
        gsiAttempts++;
      }
      
      console.log('[Google Login] GSI carregado após', gsiAttempts * 100, 'ms');
      
      const nonce = Math.random().toString(36).substring(2);
      const clientId = '640368297459-abnkvkvjhshvv5kg89a31kgmnlp9oqe3.apps.googleusercontent.com';
      
      console.log('[Google Login] Inicializando com client_id:', clientId.substring(0, 20) + '...');

      // @ts-ignore
      google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: any) => {
          console.log('[Google Login] Callback recebido, processando token...');
          try {
            const { data, error } = await supabase.auth.signInWithIdToken({
              provider: 'google',
              token: response.credential,
              nonce
            });

            if (error) {
              console.error('[Google Login] Erro signInWithIdToken:', error.message);
              toast({
                title: "Erro no login",
                description: "Não foi possível fazer login com Google. Tente novamente.",
                variant: "warning",
              });
              setIsLoading(false);
              return;
            }

            console.log('[Google Login] Token aceito, aguardando sessão...');
            
            // ✅ Aguardar sessão ser estabelecida (até 3 segundos)
            let attempts = 0;
            const maxAttempts = 30; // 3 segundos (100ms * 30)
            
            const checkSession = async (): Promise<boolean> => {
              const { data: { session } } = await supabase.auth.getSession();
              
                if (session?.user) {
                console.log('[Google Login] ✅ Sessão estabelecida para:', session.user.email);
                
                // ✅ Verificar convite familiar PRIMEIRO
                const pendingFamilyToken = sessionStorage.getItem('pending_family_invite_token');
                if (pendingFamilyToken) {
                  sessionStorage.removeItem('pending_family_invite_token');
                  console.log('[Google Login] Redirecionando para completar-perfil com token familiar');
                  window.location.href = `/completar-perfil?token_familiar=${pendingFamilyToken}`;
                  return true;
                }
                
                // Verificar convite empresarial
                const pendingToken = sessionStorage.getItem('pending_invite_token');
                if (pendingToken) {
                  sessionStorage.removeItem('pending_invite_token');
                  console.log('[Google Login] Redirecionando para completar-perfil com token empresarial');
                  window.location.href = `/completar-perfil?token=${pendingToken}`;
                  return true;
                }
                
                console.log('[Google Login] Redirecionando para /auth/callback');
                window.location.href = '/auth/callback';
                return true;
              }
              
              attempts++;
              if (attempts >= maxAttempts) {
                console.error('[Google Login] Timeout aguardando sessão após 3s');
                toast({
                  title: "Erro de autenticação",
                  description: "Tempo esgotado. Tente novamente.",
                  variant: "destructive",
                });
                setIsLoading(false);
                return false;
              }
              
              await new Promise(resolve => setTimeout(resolve, 100));
              return checkSession();
            };
            
            await checkSession();
          } catch (err) {
            console.error('[Google Login] Erro no callback:', err);
            toast({
              title: "Erro no login",
              description: "Não foi possível fazer login com Google.",
              variant: "destructive",
            });
            setIsLoading(false);
          }
        },
        nonce,
      });

      console.log('[Google Login] Chamando prompt()...');
      
      // @ts-ignore - Callback de diagnóstico para entender falhas
      google.accounts.id.prompt((notification: any) => {
        console.log('[Google Login] Notification recebida:', notification);
        
        if (notification.isNotDisplayed()) {
          const reason = notification.getNotDisplayedReason();
          console.warn('[Google Login] ❌ Prompt NÃO exibido. Motivo:', reason);
          
          // Mapear motivos para mensagens amigáveis
          const reasonMessages: Record<string, string> = {
            'browser_not_supported': 'Navegador não suportado',
            'invalid_client': 'Configuração inválida do cliente',
            'missing_client_id': 'Client ID não encontrado',
            'opt_out_or_no_session': 'Usuário optou por não usar ou sem sessão Google',
            'suppressed_by_user': 'Bloqueado temporariamente (cooldown)',
            'unregistered_origin': 'Origem não registrada no Google Console',
            'unknown_reason': 'Motivo desconhecido',
          };
          
          const friendlyMessage = reasonMessages[reason] || reason;
          
          toast({
            title: "Login com Google indisponível",
            description: `${friendlyMessage}. Usando método alternativo...`,
            variant: "warning",
          });
          
          // Usar fallback OAuth automaticamente
          console.log('[Google Login] Ativando fallback OAuth devido a:', reason);
          handleGoogleLoginFallback();
        }
        
        if (notification.isSkippedMoment()) {
          const reason = notification.getSkippedReason();
          console.log('[Google Login] Momento pulado. Motivo:', reason);
          setIsLoading(false);
        }
        
        if (notification.isDismissedMoment()) {
          const reason = notification.getDismissedReason();
          console.log('[Google Login] Usuário fechou o prompt. Motivo:', reason);
          setIsLoading(false);
        }
      });
      
    } catch (error) {
      console.error('[Google Login] Erro geral:', error);
      toast({
        title: "Erro no login",
        description: "Não foi possível carregar o Google Login. Tentando método alternativo...",
        variant: "warning",
      });
      // Tentar fallback em caso de erro
      await handleGoogleLoginFallback();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-foreground">Entrar</CardTitle>
          <CardDescription>
            Acesse sua conta para continuar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Sua senha"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Entrar
                </Button>
              </form>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Ou</span>
                </div>
              </div>
              
              <Button 
                onClick={handleGoogleLogin} 
                variant="outline" 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                )}
                Entrar com Google
              </Button>
              
              <div className="text-center space-y-2">
                <Link 
                  to="/esqueci-senha"
                  className="text-sm text-muted-foreground hover:text-primary block"
                >
                  Esqueci minha senha
                </Link>
                <p className="text-sm text-muted-foreground">
                  Não tem uma conta?{" "}
                  <Link to="/cadastrar" className="text-primary hover:underline">
                    Criar conta
                  </Link>
                </p>
              </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Entrar;