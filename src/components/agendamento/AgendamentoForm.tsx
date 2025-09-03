import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createCheckoutWithAppointment, generateAvailableSlots, formatDateTimeForBrazil } from '@/lib/appointments';
import { useToast } from '@/hooks/use-toast';

interface AgendamentoFormProps {
  onSuccess?: (appointmentId: string) => void;
}

const SERVICES = [
  { code: 'CONSULTA_CLINICA', name: 'Consulta Clínica Geral', duration: 30, priceId: 'price_1234567890' },
  { code: 'CONSULTA_PEDIATRICA', name: 'Consulta Pediátrica', duration: 45, priceId: 'price_0987654321' },
  { code: 'CONSULTA_CARDIOLOGICA', name: 'Consulta Cardiológica', duration: 60, priceId: 'price_1122334455' },
];

const AgendamentoForm: React.FC<AgendamentoFormProps> = ({ onSuccess }) => {
  const [formData, setFormData] = useState({
    email: '',
    service_code: '',
    date: '',
    time_slot: '',
  });
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const selectedService = SERVICES.find(s => s.code === formData.service_code);

  const handleServiceChange = (serviceCode: string) => {
    setFormData(prev => ({ ...prev, service_code: serviceCode, time_slot: '' }));
    
    const service = SERVICES.find(s => s.code === serviceCode);
    if (service && formData.date) {
      const selectedDate = new Date(formData.date);
      const slots = generateAvailableSlots(selectedDate, service.duration);
      setAvailableSlots(slots);
    }
  };

  const handleDateChange = (date: string) => {
    setFormData(prev => ({ ...prev, date, time_slot: '' }));
    
    if (selectedService && date) {
      const selectedDate = new Date(date);
      const slots = generateAvailableSlots(selectedDate, selectedService.duration);
      setAvailableSlots(slots);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.service_code || !formData.time_slot) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Criar agendamento + checkout
      const result = await createCheckoutWithAppointment({
        mode: 'payment',
        price_id: selectedService?.priceId,
        email: formData.email,
        service_code: formData.service_code,
        start_at_local: formData.time_slot,
        duration_min: selectedService?.duration || 30,
        product_name: selectedService?.name,
        product_sku: formData.service_code,
      });

      if (!result.success) {
        throw new Error(result.error || 'Erro ao criar agendamento');
      }

      toast({
        title: "Agendamento criado!",
        description: "Redirecionando para o pagamento...",
      });

      // Abrir Stripe checkout em nova aba
      if (result.url) {
        window.open(result.url, '_blank');
      }

      // Chamar callback de sucesso
      if (onSuccess && result.appointment_id) {
        onSuccess(result.appointment_id);
      }

      // Limpar formulário
      setFormData({
        email: '',
        service_code: '',
        date: '',
        time_slot: '',
      });
      setAvailableSlots([]);

    } catch (error) {
      console.error('Erro ao criar agendamento:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao criar agendamento. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Agendar Consulta</CardTitle>
        <CardDescription>
          Escolha o serviço, data e horário desejados
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="seu@email.com"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="service">Serviço</Label>
            <Select value={formData.service_code} onValueChange={handleServiceChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um serviço" />
              </SelectTrigger>
              <SelectContent>
                {SERVICES.map((service) => (
                  <SelectItem key={service.code} value={service.code}>
                    {service.name} ({service.duration}min)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Data</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => handleDateChange(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              required
            />
          </div>

          {availableSlots.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="time_slot">Horário</Label>
              <Select value={formData.time_slot} onValueChange={(value) => setFormData(prev => ({ ...prev, time_slot: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um horário" />
                </SelectTrigger>
                <SelectContent>
                  {availableSlots.map((slot) => (
                    <SelectItem key={slot} value={slot}>
                      {new Date(slot).toLocaleTimeString('pt-BR', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        timeZone: 'America/Sao_Paulo'
                      })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedService && (
            <div className="p-3 bg-muted rounded-lg">
              <h4 className="font-medium">{selectedService.name}</h4>
              <p className="text-sm text-muted-foreground">
                Duração: {selectedService.duration} minutos
              </p>
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full" 
            disabled={loading || !formData.email || !formData.service_code || !formData.time_slot}
          >
            {loading ? 'Criando agendamento...' : 'Agendar e Pagar'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default AgendamentoForm;