import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const ClubeBenAuth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    handleAuth();
  }, []);

  const handleAuth = async () => {
    const redirect_uri = searchParams.get('redirect_uri') || 
      'https://clubeprontiasaude.clubeben.com.br';

    try {
      // Verificar sessão
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // Salvar returnUrl e redirecionar para login
        const returnUrl = `/auth?redirect_uri=${encodeURIComponent(redirect_uri)}`;
        localStorage.setItem('returnUrl', returnUrl);
        navigate('/entrar');
        return;
      }

      // Usuário logado: gerar JWT via edge function
      const { data, error } = await supabase.functions.invoke('clubeben-auth-bridge', {
        body: { 
          user_id: session.user.id,
        }
      });

      // ✅ TRATAR ERRO DE PLANO NECESSÁRIO
      if (data?.error === 'plan_required') {
        toast({
          title: "Plano Necessário",
          description: "O Clube de Benefícios é exclusivo para assinantes com plano ativo.",
          variant: "default"
        });
        navigate('/area-do-paciente');
        return;
      }

      if (error || !data?.redirect_url) {
        if (data?.needs_completion) {
          toast({
            title: "Complete seu cadastro",
            description: "Precisamos do seu CPF e data de nascimento.",
          });
          navigate('/completar-perfil?from=clubeben');
          return;
        }
        throw new Error('Erro ao gerar token');
      }

      // Adicionar redirect_uri ao URL final se fornecido
      const finalUrl = redirect_uri !== 'https://clubeprontiasaude.clubeben.com.br'
        ? `${data.redirect_url}&redirect_uri=${encodeURIComponent(redirect_uri)}`
        : data.redirect_url;

      window.location.href = finalUrl;
    } catch (error) {
      console.error('[ClubeBenAuth] Error:', error);
      toast({
        title: "Erro de autenticação",
        description: "Não foi possível acessar o Clube. Tente novamente.",
        variant: "destructive",
      });
      navigate('/area-do-paciente');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Redirecionando para o Clube de Benefícios...</p>
      </div>
    </div>
  );
};

export default ClubeBenAuth;
