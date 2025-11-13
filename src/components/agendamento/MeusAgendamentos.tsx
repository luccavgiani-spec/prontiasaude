import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getAppointments, AppointmentData } from '@/lib/appointments';
import { getServiceNameFromSKU } from '@/lib/sku-mapping';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, ClockIcon, VideoIcon, RefreshCwIcon, CopyIcon } from 'lucide-react';

interface MeusAgendamentosProps {
  userEmail: string;
}
const MeusAgendamentos: React.FC<MeusAgendamentosProps> = ({
  userEmail
}) => {
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(false);
  const {
    toast
  } = useToast();
  useEffect(() => {
    if (userEmail) {
      loadAppointments();
    }
  }, [userEmail]);
  const loadAppointments = async () => {
    setLoading(true);
    try {
      const result = await getAppointments(userEmail);
      if (!result.success) {
        console.error('Failed to load appointments:', result.error);
        toast({
          title: "Erro",
          description: result.error || "Erro ao buscar consultas. Verifique sua conexão e tente novamente.",
          variant: "destructive"
        });
        return;
      }
      // Log detalhado para debug
      console.log('[MeusAgendamentos] Raw appointments data:', result.appointments);
      result.appointments?.forEach((apt, idx) => {
        console.log(`[MeusAgendamentos] Appointment ${idx}:`, {
          id: apt.appointment_id,
          service: apt.service_code,
          redirect_url: apt.redirect_url,
          teams_join_url: apt.teams_join_url,
          provider: apt.provider,
          has_redirect: !!apt.redirect_url,
          has_teams: !!apt.teams_join_url
        });
      });
      
      setAppointments(result.appointments || []);
    } catch (error) {
      console.error('Exception loading appointments:', error);
      toast({
        title: "Erro de Conexão",
        description: "Não foi possível conectar ao servidor. Tente novamente em alguns instantes.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const refreshAppointments = () => {
    loadAppointments();
  };
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Link copiado!",
        description: "O link da reunião foi copiado para a área de transferência."
      });
    } catch (error) {
      toast({
        title: "Erro ao copiar",
        description: "Não foi possível copiar o link.",
        variant: "destructive"
      });
    }
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
  const getStatusBadge = (status: string) => {
    const statusMap = {
      'scheduled': {
        variant: 'secondary' as const,
        label: 'Agendado'
      },
      'confirmed': {
        variant: 'default' as const,
        label: 'Confirmado'
      },
      'completed': {
        variant: 'outline' as const,
        label: 'Concluído'
      },
      'cancelled': {
        variant: 'destructive' as const,
        label: 'Cancelado'
      }
    };
    const statusInfo = statusMap[status as keyof typeof statusMap] || {
      variant: 'secondary' as const,
      label: status
    };
    return <Badge variant={statusInfo.variant}>
        {statusInfo.label}
      </Badge>;
  };

  // Filtrar apenas consultas criadas nas últimas 24 horas
  const now = new Date();
  const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  const recentAppointments = appointments.filter(apt => {
    if (!apt.created_at) return false;
    const createdDate = new Date(apt.created_at);
    const isRecent = createdDate >= last24Hours;
    
    // ✅ FILTRAR APENAS COMMUNICARE (baseado no campo provider)
    // Excluir: ClickLife (provider='clicklife') e WhatsApp (outros valores)
    const isCommunicare = apt.provider?.toLowerCase() === 'communicare';
    
    // Log de comparação de datas
    console.log('[MeusAgendamentos] Recent filter:', {
      appointment_id: apt.appointment_id,
      created_at: createdDate.toISOString(),
      last_24h: last24Hours.toISOString(),
      is_recent: isRecent,
      provider: apt.provider,
      is_communicare: isCommunicare,
      has_teams: !!apt.teams_join_url,
      has_redirect: !!apt.redirect_url,
      status: apt.status
    });
    
    return isRecent && isCommunicare;
  }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return <div className="w-full space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-semibold">Minhas Consultas</h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={refreshAppointments}
          disabled={loading}
        >
          <RefreshCwIcon className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar Consultas
        </Button>
      </div>

      {appointments.length === 0 && !loading && <Card>
          <CardContent className="text-center py-12">
            <div className="bg-muted/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <CalendarIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <h4 className="font-semibold mb-2">Nenhuma consulta agendada nas últimas 24h</h4>
            <p className="text-muted-foreground">
              Você não tem consultas agendadas recentemente. As consultas aparecem aqui por até 24 horas após o agendamento.
            </p>
          </CardContent>
        </Card>}

      {loading && <Card>
          <CardContent className="text-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando consultas...</p>
          </CardContent>
        </Card>}

      {/* Consultas Agendadas nas Últimas 24h */}
      {recentAppointments.length > 0 && <div className="space-y-4">
          <h4 className="font-semibold text-primary">Consultas Agendadas nas Últimas 24h ({recentAppointments.length})</h4>
          {recentAppointments.map(appointment => <Card key={appointment.appointment_id} className="border-primary/20">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      {getServiceNameFromSKU(appointment.service_code)}
                    </CardTitle>
                    <CardDescription>
                      ID: {appointment.appointment_id}
                    </CardDescription>
                  </div>
                  {getStatusBadge(appointment.status || 'scheduled')}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {formatDateTime(appointment.start_at_local)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <ClockIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      {appointment.duration_min} minutos
                    </span>
                  </div>

                  {/* Show provider if available from GAS */}
                  {appointment.teams_meeting_id && (
                    <div className="flex items-center gap-2 md:col-span-2">
                      <Badge variant="outline" className="text-xs">
                        Provedor: {appointment.teams_meeting_id.includes('communicare') ? 'Communicare' : 'Clicklife'}
                      </Badge>
                    </div>
                  )}
                </div>

                {appointment.teams_join_url && <div className="pt-2 border-t">
                    <div className="flex items-center gap-2 mb-3">
                      <VideoIcon className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Link da Reunião Disponível</span>
                    </div>
                    <div className="flex gap-2">
                      <Button asChild variant="default" size="sm" className="flex-1">
                        <a href={appointment.teams_join_url} target="_blank" rel="noopener noreferrer">
                          Entrar na Consulta
                        </a>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => copyToClipboard(appointment.teams_join_url)}>
                        <CopyIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>}

                {appointment.redirect_url && !appointment.teams_join_url && <div className="pt-2 border-t">
                    <div className="flex items-center gap-2 mb-3">
                      <VideoIcon className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Link de Acesso Disponível</span>
                    </div>
                    <Button asChild variant="default" size="sm" className="w-full">
                      <a href={appointment.redirect_url} target="_blank" rel="noopener noreferrer">
                        Acessar Consulta
                      </a>
                    </Button>
                  </div>}

                {appointment.status === 'confirmed' && !appointment.teams_join_url && !appointment.redirect_url && <div className="pt-2 border-t">
                    <div className="bg-muted/20 rounded-lg p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          ⏱️ Gerando link da reunião...
                        </p>
                        <Button variant="outline" size="sm" onClick={refreshAppointments}>
                          Atualizar
                        </Button>
                      </div>
                    </div>
                  </div>}

                {appointment.status === 'scheduled' && !appointment.teams_join_url && !appointment.redirect_url && <div className="pt-2 border-t">
                    <div className="bg-accent/10 rounded-lg p-3">
                      <p className="text-sm text-muted-foreground">
                        ⏱️ O link da reunião será disponibilizado automaticamente após a confirmação do pagamento.
                      </p>
                    </div>
                  </div>}
              </CardContent>
            </Card>)}
        </div>}

    </div>;
};
export default MeusAgendamentos;