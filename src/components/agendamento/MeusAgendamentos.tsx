import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { getAppointments, AppointmentData } from '@/lib/appointments';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, ClockIcon, VideoIcon, RefreshCwIcon } from 'lucide-react';

const MeusAgendamentos: React.FC = () => {
  const [email, setEmail] = useState('');
  const [appointments, setAppointments] = useState<AppointmentData[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const { toast } = useToast();

  const handleSearch = async () => {
    if (!email) {
      toast({
        title: "E-mail obrigatório",
        description: "Digite seu e-mail para buscar os agendamentos.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const result = await getAppointments(email);
      
      if (!result.success) {
        throw new Error(result.error || 'Erro ao buscar agendamentos');
      }

      setAppointments(result.appointments || []);
      
      if (!result.appointments || result.appointments.length === 0) {
        toast({
          title: "Nenhum agendamento encontrado",
          description: "Não foram encontrados agendamentos para este e-mail.",
        });
      }

    } catch (error) {
      console.error('Erro ao buscar agendamentos:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar agendamentos. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const refreshAppointments = () => {
    if (email) {
      handleSearch();
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
      'scheduled': { variant: 'secondary' as const, label: 'Agendado' },
      'confirmed': { variant: 'default' as const, label: 'Confirmado' },
      'completed': { variant: 'outline' as const, label: 'Concluído' },
      'cancelled': { variant: 'destructive' as const, label: 'Cancelado' },
    };

    const statusInfo = statusMap[status as keyof typeof statusMap] || { variant: 'secondary' as const, label: status };
    
    return (
      <Badge variant={statusInfo.variant}>
        {statusInfo.label}
      </Badge>
    );
  };

  const getServiceName = (serviceCode: string) => {
    const serviceNames = {
      'CONSULTA_CLINICA': 'Consulta Clínica Geral',
      'CONSULTA_PEDIATRICA': 'Consulta Pediátrica',
      'CONSULTA_CARDIOLOGICA': 'Consulta Cardiológica',
    };
    
    return serviceNames[serviceCode as keyof typeof serviceNames] || serviceCode;
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Meus Agendamentos</CardTitle>
          <CardDescription>
            Digite seu e-mail para visualizar seus agendamentos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? 'Buscando...' : 'Buscar'}
              </Button>
              {searched && (
                <Button variant="outline" size="icon" onClick={refreshAppointments} disabled={loading}>
                  <RefreshCwIcon className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {searched && appointments.length === 0 && !loading && (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              Nenhum agendamento encontrado para este e-mail.
            </p>
          </CardContent>
        </Card>
      )}

      {appointments.length > 0 && (
        <div className="grid gap-4">
          {appointments.map((appointment) => (
            <Card key={appointment.appointment_id} className="relative">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      {getServiceName(appointment.service_code)}
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
                </div>

                {appointment.teams_join_url && (
                  <div className="pt-2 border-t">
                    <div className="flex items-center gap-2 mb-2">
                      <VideoIcon className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Link da Reunião</span>
                    </div>
                    <Button 
                      asChild 
                      variant="default" 
                      size="sm"
                      className="w-full sm:w-auto"
                    >
                      <a 
                        href={appointment.teams_join_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        Entrar na Reunião
                      </a>
                    </Button>
                  </div>
                )}

                {appointment.status === 'scheduled' && !appointment.teams_join_url && (
                  <div className="pt-2 border-t">
                    <p className="text-sm text-muted-foreground">
                      O link da reunião será disponibilizado após a confirmação do pagamento.
                    </p>
                  </div>
                )}

                {appointment.created_at && (
                  <div className="text-xs text-muted-foreground">
                    Criado em: {formatDateTime(appointment.created_at)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default MeusAgendamentos;