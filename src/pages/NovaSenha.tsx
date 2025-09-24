import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, Lock, AlertCircle } from "lucide-react";
import { PasswordChecklist, isPasswordValid } from "@/components/auth/PasswordChecklist";

const NovaSenha = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    let mounted = true;

    const handleSessionSetup = async () => {
      console.log('🔍 Verificando sessão para nova senha...');
      
      // 1. Verificar se há código de troca (PKCE flow)
      const code = searchParams.get('code');
      const type = searchParams.get('type');
      const token_hash = searchParams.get('token_hash');

      try {
        if (code) {
          console.log('🔄 Trocando código por sessão...');
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          
          if (mounted) {
            setIsValidSession(true);
            setSessionChecked(true);
          }
          return;
        }

        // 2. Verificar fluxo legado com token_hash
        if (token_hash && type === 'recovery') {
          console.log('🔐 Fluxo legado detectado');
          if (mounted) {
            setIsValidSession(true);
            setSessionChecked(true);
          }
          return;
        }

        // 3. Verificar sessão existente
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!mounted) return;

        if (session?.user) {
          console.log('✅ Sessão válida encontrada');
          setIsValidSession(true);
        } else {
          console.log('❌ Nenhuma sessão válida encontrada');
          toast({
            title: "Link inválido ou expirado",
            description: "O link de reset de senha é inválido ou expirou. Solicite um novo reset.",
            variant: "destructive",
          });
          setTimeout(() => navigate('/entrar'), 2000);
        }
        
        setSessionChecked(true);
      } catch (error: any) {
        console.error('❌ Erro ao configurar sessão:', error);
        if (mounted) {
          toast({
            title: "Erro ao processar link",
            description: error.message || "Ocorreu um erro ao processar o link de reset.",
            variant: "destructive",
          });
          setTimeout(() => navigate('/entrar'), 2000);
          setSessionChecked(true);
        }
      }
    };

    // Listener para mudanças de estado de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 Auth state change:', event);
      
      if (event === 'PASSWORD_RECOVERY') {
        console.log('🔐 PASSWORD_RECOVERY event detected');
        if (mounted) {
          setIsValidSession(true);
          setSessionChecked(true);
        }
      } else if (event === 'SIGNED_IN' && session) {
        console.log('✅ User signed in after password reset');
        if (mounted) {
          setIsValidSession(true);
          setSessionChecked(true);
        }
      }
    });

    handleSessionSetup();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate, toast, searchParams]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isPasswordValid(password)) {
      toast({
        title: "Senha inválida",
        description: "A senha deve atender a todos os critérios de segurança.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Senhas não coincidem",
        description: "Por favor, confirme sua senha corretamente.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    console.log('🔄 Tentando atualizar senha...');
    
    const { error } = await supabase.auth.updateUser({
      password: password
    });

    if (error) {
      console.error('❌ Erro ao atualizar senha:', error);
      toast({
        title: "Erro ao redefinir senha",
        description: error.message === "Auth session missing!" 
          ? "Sessão expirada. Solicite um novo link de reset." 
          : error.message,
        variant: "destructive",
      });
    } else {
      console.log('✅ Senha atualizada com sucesso');
      toast({
        title: "Senha redefinida",
        description: "Sua senha foi alterada com sucesso.",
      });
      navigate('/area-do-paciente');
    }
    
    setIsLoading(false);
  };

  // Loading state while checking session
  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Verificando link de reset...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid session state
  if (!isValidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle className="text-2xl font-bold text-foreground">Link Inválido</CardTitle>
            <CardDescription>
              O link de reset de senha é inválido ou expirou.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/entrar')} 
              className="w-full"
            >
              Voltar para Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-foreground">Criar nova senha</CardTitle>
          <CardDescription>
            Defina sua nova senha para acessar sua conta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Digite sua nova senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            
            {password && (
              <PasswordChecklist password={password} />
            )}
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirme sua senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary/90" 
              disabled={isLoading || !isPasswordValid(password) || password !== confirmPassword}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar e acessar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default NovaSenha;