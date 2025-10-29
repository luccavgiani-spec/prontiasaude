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

  // Separar consultas próximas e anteriores
  const now = new Date();
  const upcomingAppointments = appointments.filter(apt => {
    if (!apt.start_at_local) return false;
    const appointmentDate = new Date(apt.start_at_local);
    return appointmentDate >= now && ['scheduled', 'confirmed'].includes(apt.status || '');
  }).sort((a, b) => new Date(a.start_at_local).getTime() - new Date(b.start_at_local).getTime());
  const pastAppointments = appointments.filter(apt => {
    if (!apt.start_at_local) return false;
    const appointmentDate = new Date(apt.start_at_local);
    return appointmentDate < now;
  }).sort((a, b) => new Date(b.start_at_local).getTime() - new Date(a.start_at_local).getTime());
  return <div className="w-full space-y-6">
      

      {appointments.length === 0 && !loading && <Card>
          <CardContent className="text-center py-12">
            <div className="bg-muted/30 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <CalendarIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <h4 className="font-semibold mb-2">Nenhuma consulta encontrada</h4>
            <p className="text-muted-foreground">
              Você ainda não tem consultas. Clique em "Nova Consulta" para contratar um serviço.
            </p>
          </CardContent>
        </Card>}

      {loading && <Card>
          <CardContent className="text-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Carregando consultas...</p>
          </CardContent>
        </Card>}

      {/* Próximas Consultas */}
      {upcomingAppointments.length > 0 && <div className="space-y-4">
          <h4 className="font-semibold text-primary">Próximas Consultas</h4>
          {upcomingAppointments.map(appointment => <Card key={appointment.appointment_id} className="border-primary/20">
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

                {appointment.status === 'confirmed' && !appointment.teams_join_url && <div className="pt-2 border-t">
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

                {appointment.status === 'scheduled' && !appointment.teams_join_url && <div className="pt-2 border-t">
                    <div className="bg-accent/10 rounded-lg p-3">
                      <p className="text-sm text-muted-foreground">
                        ⏱️ O link da reunião será disponibilizado automaticamente após a confirmação do pagamento.
                      </p>
                    </div>
                  </div>}
              </CardContent>
            </Card>)}
        </div>}

      {/* Consultas Anteriores */}
      {pastAppointments.length > 0 && <div className="space-y-4">
          <h4 className="font-semibold text-muted-foreground">Consultas Anteriores</h4>
          {pastAppointments.map(appointment => <Card key={appointment.appointment_id} className="opacity-75">
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

              {appointment.redirect_url && <div className="pt-2 border-t">
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

              {appointment.created_at && <div className="text-xs text-muted-foreground">
                  Realizada em: {formatDateTime(appointment.start_at_local)}
                </div>}
            </CardContent>
          </Card>)}
        </div>}
    </div>;
};
export default MeusAgendamentos;