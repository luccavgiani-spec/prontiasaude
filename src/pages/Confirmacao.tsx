import { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, Mail, Calendar, Clock } from "lucide-react";
import { getAppointments, AppointmentData } from "@/lib/appointments";
import { requireAuth } from "@/lib/auth";
import { trackPurchase } from "@/lib/meta-tracking";

const Confirmacao = () => {
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [foundAppointment, setFoundAppointment] = useState<AppointmentData | null>(null);
  const [pollingCountdown, setPollingCountdown] = useState(30);
  const [isPolling, setIsPolling] = useState(true);
  const email = searchParams.get('email');
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const authResult = await requireAuth();
      if (!authResult) {
        navigate('/entrar');
        return;
      }
      setUser(authResult.user);
      
      // Track purchase on confirmation page load
      const orderValue = parseFloat(searchParams.get('value') || '0');
      const orderId = searchParams.get('order_id') || `order_${Date.now()}`;
      
      if (orderValue > 0) {
        trackPurchase({
          value: orderValue,
          order_id: orderId,
          content_name: 'Consulta ou Plano',
          contents: [{
            id: orderId,
            quantity: 1,
            item_price: orderValue
          }]
        });
      }
    };
    
    checkAuth();
  }, [navigate, searchParams]);

  useEffect(() => {
    if (user?.email) {
      // Iniciar polling para encontrar a consulta criada
      const pollInterval = setInterval(pollForAppointment, 3000);
      const countdownInterval = setInterval(() => {
        setPollingCountdown(prev => {
          if (prev <= 1) {
            setIsPolling(false);
            clearInterval(pollInterval);
            clearInterval(countdownInterval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        clearInterval(pollInterval);
        clearInterval(countdownInterval);
      };
    }
  }, [user]);

  const pollForAppointment = async () => {
    if (!user?.email) return;

    try {
      const result = await getAppointments(user.email);
      if (!result.success || !result.appointments) return;

      // Procurar por consultas confirmadas criadas nas últimas 3 horas
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const recentConfirmedAppointment = result.appointments.find(apt => {
        const createdAt = apt.created_at ? new Date(apt.created_at) : null;
        return apt.status === 'confirmed' && 
               createdAt && 
               createdAt >= threeHoursAgo &&
               apt.teams_join_url;
      });

      if (recentConfirmedAppointment) {
        setFoundAppointment(recentConfirmedAppointment);
        setIsPolling(false);
      }
    } catch (error) {
      console.error('Erro durante polling:', error);
    }
  };

  const handleGoToConsultas = () => {
    navigate('/area-do-paciente#consultas');
  };

  const formatDateTime = (dateTimeStr: string) => {
    if (!dateTimeStr) return 'Data não definida';
    
    try {
      const date = new Date(dateTimeStr);
      return date.toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Data inválida';
    }
  };

  return (
    <div className="py-16">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="medical-card p-8 md:p-12 text-center">
          {/* Ícone de sucesso */}
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-12 w-12 text-primary" />
          </div>

          {/* Título */}
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Obrigado pela sua compra!
          </h1>

          {/* Status da consulta */}
          {foundAppointment ? (
            <div className="mb-8">
              <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6">
                <h2 className="text-xl font-semibold text-green-800 mb-2">🎉 Consulta Agendada!</h2>
                <p className="text-green-700 mb-4">
                  Sua consulta foi agendada para: <strong>{formatDateTime(foundAppointment.start_at_local)}</strong>
                </p>
                {foundAppointment.teams_join_url && (
                  <Button 
                    asChild 
                    className="w-full sm:w-auto"
                    size="lg"
                  >
                    <a 
                      href={foundAppointment.teams_join_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      Entrar na Consulta
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ) : isPolling ? (
            <div className="mb-8">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <h2 className="text-xl font-semibold text-blue-800">Agendando sua consulta...</h2>
                </div>
                <p className="text-blue-700 mb-2">
                  Estamos processando seu agendamento para daqui a 30 minutos.
                </p>
                <p className="text-sm text-blue-600">
                  Aguardando confirmação... ({pollingCountdown}s)
                </p>
              </div>
            </div>
          ) : (
            <div className="mb-8">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                <h2 className="text-xl font-semibold text-amber-800 mb-2">Seu agendamento está quase pronto</h2>
                <p className="text-amber-700 mb-4">
                  Ele aparecerá em "Minhas Consultas" nos próximos instantes.
                </p>
                <Button 
                  onClick={() => window.location.reload()}
                  variant="outline"
                  size="sm"
                >
                  Atualizar Página
                </Button>
              </div>
            </div>
          )}

          {/* Próximos passos */}
          <div className="bg-muted/30 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">Como funciona:</h2>
            <div className="space-y-3 text-left">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">1</div>
                <span className="text-muted-foreground">Pagamento confirmado automaticamente</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">2</div>
                <span className="text-muted-foreground">Te enviaremos o link da sua consulta no WhatsApp</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">3</div>
                <span className="text-muted-foreground">Link da reunião gerado automaticamente</span>
              </div>
            </div>
          </div>

          {/* Informações importantes */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8 p-4 bg-accent/10 rounded-lg border border-accent/20">
            <div className="flex items-center gap-2 text-accent-foreground">
              <Mail className="h-5 w-5" />
              <span className="text-sm font-medium">Email de confirmação enviado</span>
            </div>
            <div className="flex items-center gap-2 text-accent-foreground">
              <Clock className="h-5 w-5" />
              <span className="text-sm font-medium">Consulta automática em 30min</span>
            </div>
          </div>

          {/* Ações */}
          <div className="mb-6 space-y-3">
            <Button 
              onClick={handleGoToConsultas}
              size="lg"
              className="w-full sm:w-auto"
            >
              Ver Minhas Consultas
            </Button>
            
            {/* Botão para antecedentes médicos se ainda não preenchido */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                Para um atendimento ainda melhor, complete seus antecedentes médicos
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/intake/antecedentes">Completar Antecedentes Médicos</Link>
              </Button>
            </div>
          </div>

          {/* Links adicionais */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="outline" asChild>
              <Link to="/">Voltar ao Início</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/servicos">Nova Consulta</Link>
            </Button>
          </div>

          {/* Suporte */}
          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Dúvidas ou problemas? Entre em contato pelo email{" "}
              <a href="mailto:suporte@prontiasaude.com.br" className="text-primary hover:underline">
                suporte@prontiasaude.com.br
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Confirmacao;