import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { buscarResumosPaciente } from "@/lib/api";
import { getEmailAtual, setEmailAtual, formatarData, formatarDataHora, formataPreco, isEmailValid } from "@/lib/utils";
import { CATALOGO_SERVICOS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";
import { User, Calendar, History, Crown, RefreshCw, Video, Clock, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import type { PatientSummaryResponse } from "@/lib/api";

const Paciente = () => {
  const [email, setEmail] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [dadosPaciente, setDadosPaciente] = useState<PatientSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const emailSalvo = getEmailAtual();
    if (emailSalvo) {
      setEmail(emailSalvo);
      setIsLoggedIn(true);
      carregarDadosPaciente(emailSalvo);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isEmailValid(email)) {
      toast({
        title: "Email inválido",
        description: "Por favor, informe um email válido.",
        variant: "destructive",
      });
      return;
    }

    setEmailAtual(email);
    setIsLoggedIn(true);
    await carregarDadosPaciente(email);
  };

  const carregarDadosPaciente = async (emailPaciente: string) => {
    setIsLoading(true);
    try {
      const dados = await buscarResumosPaciente(emailPaciente);
      setDadosPaciente(dados);
      if (!dados) {
        toast({
          title: "Dados não encontrados",
          description: "Não encontramos informações para este email. Verifique se já realizou algum atendimento.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar suas informações. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    carregarDadosPaciente(email);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setEmail("");
    setDadosPaciente(null);
    localStorage.removeItem('medicosDoBem_email');
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado com sucesso.",
    });
  };

  const mapearSku = (sku: string) => {
    const servico = CATALOGO_SERVICOS.find(s => s.sku === sku);
    return servico?.nome || sku;
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'confirmed':
      case 'paid':
        return <Badge className="bg-primary/10 text-primary">Confirmado</Badge>;
      case 'completed':
        return <Badge className="bg-accent/10 text-accent-foreground">Concluído</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelado</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pendente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="py-16">
        <div className="container mx-auto px-4 max-w-md">
          <div className="medical-card p-8 text-center">
            <User className="h-16 w-16 text-primary mx-auto mb-6" />
            <h1 className="text-3xl font-bold text-foreground mb-4">
              Área do Paciente
            </h1>
            <p className="text-muted-foreground mb-8">
              Acesse suas consultas, histórico e informações do plano
            </p>
            
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2 text-left">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl"
                  required
                />
              </div>
              <Button type="submit" variant="medical" size="lg" className="w-full">
                Entrar
              </Button>
            </form>

            <p className="text-sm text-muted-foreground mt-4">
              Novo por aqui? <a href="/" className="text-primary hover:underline">Agende sua primeira consulta</a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-16">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-bold text-foreground mb-2">
              Área do Paciente
            </h1>
            <p className="text-muted-foreground">Bem-vindo(a), {email}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Sair
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-3 gap-8">
            {[1, 2, 3].map((i) => (
              <div key={i} className="medical-card p-6">
                <Skeleton className="h-6 w-32 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : dadosPaciente ? (
          <div className="grid md:grid-cols-3 gap-8">
            {/* Próximas Consultas */}
            <div className="medical-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Próximas Consultas</h2>
              </div>
              
              {dadosPaciente.appointments?.length > 0 ? (
                <div className="space-y-3">
                  {dadosPaciente.appointments.map((consulta) => (
                    <div key={consulta.id} className="border border-border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-foreground">{consulta.service_name}</h3>
                        {getStatusBadge(consulta.status)}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                        <Clock className="h-4 w-4" />
                        <span>{formatarDataHora(consulta.scheduled_date)}</span>
                      </div>
                      {consulta.join_url && consulta.status.toLowerCase() === 'confirmed' && (
                        <Button size="sm" variant="medical" className="w-full" asChild>
                          <a href={consulta.join_url} target="_blank" rel="noopener noreferrer">
                            <Video className="h-4 w-4 mr-2" />
                            Entrar na Consulta
                            <ExternalLink className="h-4 w-4 ml-2" />
                          </a>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground mb-4">Nenhuma consulta agendada</p>
                  <Button variant="outline" size="sm" asChild>
                    <a href="/#servicos">Agendar Consulta</a>
                  </Button>
                </div>
              )}
            </div>

            {/* Histórico */}
            <div className="medical-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <History className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Histórico</h2>
              </div>
              
              {dadosPaciente.orders?.length > 0 ? (
                <div className="space-y-3">
                  {dadosPaciente.orders.map((pedido) => (
                    <div key={pedido.id} className="border border-border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-medium text-foreground">{mapearSku(pedido.sku)}</h3>
                        {getStatusBadge(pedido.status)}
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">{formatarData(pedido.created_at)}</span>
                        <span className="font-medium text-foreground">{formataPreco(pedido.amount / 100)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <History className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground">Nenhum histórico encontrado</p>
                </div>
              )}
            </div>

            {/* Meu Plano */}
            <div className="medical-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <Crown className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-semibold text-foreground">Meu Plano</h2>
              </div>
              
              {dadosPaciente.subscription ? (
                <div className="space-y-4">
                  <div className="text-center p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <Crown className="h-8 w-8 text-primary mx-auto mb-2" />
                    <h3 className="font-semibold text-foreground mb-1">
                      {dadosPaciente.subscription.plan_code}
                    </h3>
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle className="h-4 w-4 text-primary" />
                      <span className="text-sm text-muted-foreground">Ativo</span>
                    </div>
                  </div>
                  <div className="text-sm">
                    <p className="text-muted-foreground mb-1">Válido até:</p>
                    <p className="font-medium text-foreground">
                      {formatarData(dadosPaciente.subscription.current_period_end)}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="w-full" asChild>
                    <a href="/planos">Fazer Upgrade</a>
                  </Button>
                </div>
              ) : (
                <div className="text-center py-6">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                  <p className="text-muted-foreground mb-4">Sem plano ativo</p>
                  <Button variant="medical" size="sm" asChild>
                    <a href="/planos">Assinar Plano</a>
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-16">
            <User className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Nenhum dado encontrado</h2>
            <p className="text-muted-foreground mb-6">
              Não encontramos informações para este email. Que tal agendar sua primeira consulta?
            </p>
            <Button variant="medical" size="lg" asChild>
              <a href="/#servicos">Agendar Primeira Consulta</a>
            </Button>
          </div>
        )}

        {/* CTA para nova consulta */}
        {dadosPaciente && (
          <div className="text-center mt-12 p-6 bg-primary/5 border border-primary/20 rounded-xl">
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Precisa de uma nova consulta?
            </h3>
            <p className="text-muted-foreground mb-4">
              Agende facilmente através da nossa plataforma
            </p>
            <Button variant="medical" size="lg" asChild>
              <a href="/#servicos">Agendar Nova Consulta</a>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Paciente;