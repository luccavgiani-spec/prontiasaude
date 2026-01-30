import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Mail, Lock, Eye, EyeOff } from "lucide-react";
import { validateEmail } from "@/lib/validations";
import { hybridSignIn, getHybridSession } from "@/lib/auth-hybrid";

const Entrar = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if user is already logged in (in either environment)
    const checkSession = async () => {
      const { session, environment } = await getHybridSession();
      if (session) {
        console.log('[Entrar] Already logged in via:', environment);
        handleSuccessfulLogin(environment || 'cloud');
      }
    };
    checkSession();
  }, [navigate]);

  const handleSuccessfulLogin = (environment: 'cloud' | 'production' = 'cloud') => {
    console.log('[Entrar] Login successful via:', environment);
    
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
    
    // Salvar ambiente de login para uso posterior
    sessionStorage.setItem('auth_environment', environment);
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
    
    // Usar login híbrido que verifica onde o email existe
    const result = await hybridSignIn(email, password);

    if (!result.success) {
      // Show user-friendly error messages
      if (result.error?.includes('não encontrado')) {
        toast({
          title: "❌ Email não cadastrado",
          description: "Este email não está cadastrado. Crie uma conta para continuar.",
          variant: "warning",
          duration: 5000,
        });
      } else if (result.error?.includes('incorretos')) {
        toast({
          title: "❌ Erro no login",
          description: "Email ou senha incorretos. Verifique seus dados e tente novamente.",
          variant: "warning",
          duration: 5000,
        });
      } else if (result.error?.includes('Email not confirmed')) {
        toast({
          title: "⚠️ Email não confirmado",
          description: "Verifique sua caixa de entrada para confirmar seu email.",
          variant: "warning",
          duration: 5000,
        });
      } else {
        toast({
          title: "❌ Erro no login",
          description: result.error || "Não foi possível fazer login. Tente novamente.",
          variant: "warning",
          duration: 5000,
        });
      }
    } else {
      console.log('[Entrar] Login successful via:', result.environment);
      handleSuccessfulLogin(result.environment || 'cloud');
    }
    
    setIsLoading(false);
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