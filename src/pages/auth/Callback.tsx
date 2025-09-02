import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { checkAuthFlow } from "@/lib/auth";
import { Loader2 } from "lucide-react";

const AuthCallback = () => {
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          navigate('/entrar');
          return;
        }

        // Check where to redirect the user based on their profile completion
        const redirectPath = await checkAuthFlow(session.user.id);
        navigate(redirectPath);
      } catch (error) {
        console.error('Auth callback error:', error);
        navigate('/entrar');
      } finally {
        setIsLoading(false);
      }
    };

    handleAuthCallback();
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Processando autenticação...</p>
        </div>
      </div>
    );
  }

  return null;
};

export default AuthCallback;