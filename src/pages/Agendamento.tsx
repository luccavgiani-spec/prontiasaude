import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AgendamentoForm from '@/components/agendamento/AgendamentoForm';
import MeusAgendamentos from '@/components/agendamento/MeusAgendamentos';
import { CalendarIcon, ClockIcon } from 'lucide-react';

const Agendamento: React.FC = () => {
  const [activeTab, setActiveTab] = useState('novo');

  const handleAppointmentSuccess = (appointmentId: string) => {
    console.log('Agendamento criado com sucesso:', appointmentId);
    // Optionally switch to "meus" tab
    setActiveTab('meus');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Agendamento de Consultas
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Agende suas consultas médicas de forma prática e segura. 
            Após o pagamento, você receberá o link da reunião automaticamente.
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="bg-primary/10 p-3 rounded-full">
                <CalendarIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Agendamento Simples</h3>
                <p className="text-sm text-muted-foreground">
                  Escolha data, horário e faça o pagamento online
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="bg-primary/10 p-3 rounded-full">
                <ClockIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Reunião Automática</h3>
                <p className="text-sm text-muted-foreground">
                  Link do Teams é gerado automaticamente após pagamento
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card className="max-w-6xl mx-auto">
          <CardHeader>
            <CardTitle className="text-center">Sistema de Agendamentos</CardTitle>
            <CardDescription className="text-center">
              Crie novos agendamentos ou visualize seus agendamentos existentes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="novo">Novo Agendamento</TabsTrigger>
                <TabsTrigger value="meus">Meus Agendamentos</TabsTrigger>
              </TabsList>
              
              <TabsContent value="novo" className="mt-6">
                <div className="flex justify-center">
                  <AgendamentoForm onSuccess={handleAppointmentSuccess} />
                </div>
              </TabsContent>
              
              <TabsContent value="meus" className="mt-6">
                <MeusAgendamentos />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Instructions */}
        <Card className="max-w-4xl mx-auto mt-8">
          <CardHeader>
            <CardTitle>Como Funciona</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6 text-sm">
              <div className="text-center">
                <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-primary font-bold">1</span>
                </div>
                <h4 className="font-semibold mb-2">Agende</h4>
                <p className="text-muted-foreground">
                  Escolha o serviço, data e horário desejados no formulário
                </p>
              </div>
              
              <div className="text-center">
                <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-primary font-bold">2</span>
                </div>
                <h4 className="font-semibold mb-2">Pague</h4>
                <p className="text-muted-foreground">
                  Realize o pagamento seguro através do Stripe em nova aba
                </p>
              </div>
              
              <div className="text-center">
                <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-primary font-bold">3</span>
                </div>
                <h4 className="font-semibold mb-2">Participe</h4>
                <p className="text-muted-foreground">
                  Acesse o link da reunião do Teams que será enviado automaticamente
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Agendamento;