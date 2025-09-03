import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import MeusAgendamentos from '@/components/agendamento/MeusAgendamentos';
import { requireAuth } from '@/lib/auth';
import { useNavigate } from 'react-router-dom';
import { ClockIcon, PlusIcon } from 'lucide-react';

const Agendamento: React.FC = () => {
  const [activeTab, setActiveTab] = useState('meus');
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const authResult = await requireAuth();
      if (!authResult) {
        navigate('/entrar');
        return;
      }
      setUser(authResult.user);
    };
    
    checkAuth();
  }, [navigate]);

  const handleNovaConsulta = () => {
    navigate('/servicos');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted/20 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Minhas Consultas
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Suas consultas médicas são agendadas automaticamente 30 minutos após a confirmação do pagamento.
          </p>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="bg-primary/10 p-3 rounded-full">
                <PlusIcon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Consultas Automáticas</h3>
                <p className="text-sm text-muted-foreground">
                  Escolha o serviço e pague - o agendamento é automático
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
                <h3 className="font-semibold">Reunião em 30min</h3>
                <p className="text-sm text-muted-foreground">
                  Link do Teams disponível 30min após pagamento confirmado
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card className="max-w-6xl mx-auto">
          <CardHeader>
            <CardTitle className="text-center">Área do Paciente</CardTitle>
            <CardDescription className="text-center">
              Gerencie suas consultas médicas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="nova" onClick={handleNovaConsulta}>Nova Consulta</TabsTrigger>
                <TabsTrigger value="meus">Minhas Consultas</TabsTrigger>
              </TabsList>
              
              <TabsContent value="nova" className="mt-6">
                <div className="text-center py-12">
                  <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                    <PlusIcon className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-4">Contratar Nova Consulta</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Escolha o serviço desejado e realize o pagamento. Sua consulta será agendada automaticamente.
                  </p>
                  <Button onClick={handleNovaConsulta} size="lg">
                    Escolher Serviço
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="meus" className="mt-6">
                <MeusAgendamentos userEmail={user.email} />
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
                <h4 className="font-semibold mb-2">Escolha</h4>
                <p className="text-muted-foreground">
                  Selecione o serviço médico desejado na página de Serviços
                </p>
              </div>
              
              <div className="text-center">
                <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-primary font-bold">2</span>
                </div>
                <h4 className="font-semibold mb-2">Pague</h4>
                <p className="text-muted-foreground">
                  Realize o pagamento seguro através do Stripe
                </p>
              </div>
              
              <div className="text-center">
                <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-primary font-bold">3</span>
                </div>
                <h4 className="font-semibold mb-2">Participe</h4>
                <p className="text-muted-foreground">
                  Sua consulta será agendada para 30min depois automaticamente
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