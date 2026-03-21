import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import { validateEmail } from "@/lib/validations";
import { supabase } from "@/integrations/supabase/client";

const Entrar = () => {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showResetHint, setShowResetHint] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        handleSuccessfulLogin();
      }
    };
    checkSession();
  }, []);

  const handleSuccessfulLogin = () => {
    const pendingFamilyToken = sessionStorage.getItem('pending_family_invite_token') 
      || localStorage.getItem('pending_family_invite_token');
    if (pendingFamilyToken) {
      sessionStorage.removeItem('pending_family_invite_token');
      localStorage.removeItem('pending_family_invite_token');
      window.location.href = `/completar-perfil?token_familiar=${pendingFamilyToken}`;
      return;
    }
    
    const pendingToken = sessionStorage.getItem('pending_invite_token')
      || localStorage.getItem('pending_invite_token');
    if (pendingToken) {
      sessionStorage.removeItem('pending_invite_token');
      localStorage.removeItem('pending_invite_token');
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
    setShowResetHint(false);
    
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.message?.includes('Invalid login credentials') || error.message?.includes('invalid_credentials')) {
        // Mostrar hint de reset para usuários que podem ter sido afetados pela migração
        setShowResetHint(true);
        toast({
          title: "❌ Erro no login",
          description: "Email ou senha incorretos.",
          variant: "warning",
          duration: 4000,
        });
      } else if (error.message?.includes('Email not confirmed')) {
        toast({
          title: "⚠️ Email não confirmado",
          description: "Verifique sua caixa de entrada para confirmar seu email.",
          variant: "warning",
          duration: 5000,
        });
      } else {
        toast({
          title: "❌ Erro no login",
          description: error.message || "Não foi possível fazer login. Tente novamente.",
          variant: "warning",
          duration: 5000,
        });
      }
    } else {
      handleSuccessfulLogin();
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

          {/* Hint de reset — aparece só após erro de credenciais */}
          {showResetHint && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
              <div>
                <p className="font-medium">Primeira vez acessando o sistema atualizado?</p>
                <p className="mt-0.5 text-amber-700">
                  Nosso sistema foi migrado. Clique em{" "}
                  <Link to={`/esqueci-senha${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="font-semibold underline hover:text-amber-900">
                    Redefinir senha
                  </Link>{" "}
                  para criar uma nova senha e continuar acessando.
                </p>
              </div>
            </div>
          )}
          
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
