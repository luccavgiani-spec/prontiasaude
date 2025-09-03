import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { requireAuth } from '@/lib/auth';

const Agendamento = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      const authResult = await requireAuth();
      if (!authResult) {
        navigate('/entrar');
        return;
      }
      // Redirecionar para a área do paciente, seção de consultas
      navigate('/area-do-paciente#consultas', { replace: true });
    };
    
    checkAuthAndRedirect();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Redirecionando para suas consultas...</p>
      </div>
    </div>
  );
};

export default Agendamento;