import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, Link } from "react-router-dom";
import { User, Heart, Baby, Pill, Stethoscope, CheckCircle, AlertCircle, Edit, LogOut, Phone, MapPin, Calendar, Shield, Leaf, BookOpen, Headphones, UtensilsCrossed, Gift, ExternalLink, Dumbbell, Apple, ArrowRight, PhoneCall } from "lucide-react";
import MeusAgendamentos from "@/components/agendamento/MeusAgendamentos";
import { requireAuth, getPatient, Patient } from "@/lib/auth";
import { getPatientPlan, formatPlanName, formatPlanExpiry, PatientPlan } from "@/lib/patient-plan";
import { scheduleWithActivePlan } from "@/lib/schedule-service";
import { formatCPF } from "@/lib/validations";
import { DisqueDenunciaSection } from "@/components/home/DisqueDenunciaSection";
const AreaDoPaciente = () => {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [patientPlan, setPatientPlan] = useState<PatientPlan | null>(null);
  const [accessingClub, setAccessingClub] = useState(false);
  const [redirectingConsulta, setRedirectingConsulta] = useState(false);
  const [redirectingReceita, setRedirectingReceita] = useState(false);
  const {
    toast
  } = useToast();
  const navigate = useNavigate();
  useEffect(() => {
    const loadPatientData = async () => {
      const {
        data: {
          session
        }
      } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        window.location.replace('/entrar');
        return;
      }
      setCurrentUser(session.user);
      const {
        data,
        error
      } = await supabase.from('patients').select('*').eq('id', session.user.id).maybeSingle();
      if (error) {
        console.error('Fetch patient error:', error);
        window.location.replace('/completar-perfil');
        return;
      }
      if (!data?.profile_complete) {
        window.location.replace('/completar-perfil');
        return;
      }
      setPatient(data as Patient);

      // Load patient plan
      try {
        const planData = await getPatientPlan(session.user.email);
        setPatientPlan(planData);
      } catch (error) {
        console.error('Erro ao carregar plano do paciente:', error);
      }
      setIsLoading(false);

      // Verificar returnUrl após login
      const returnUrl = localStorage.getItem('returnUrl');
      const pendingService = localStorage.getItem('pendingService');
      const pendingPlan = localStorage.getItem('pendingPlan');
      if (returnUrl) {
        localStorage.removeItem('returnUrl');
        localStorage.removeItem('pendingService');
        localStorage.removeItem('pendingPlan');
        toast({
          title: "✅ Cadastro concluído com sucesso!",
          description: "Você pode finalizar a compra do serviço escolhido agora.",
          variant: "default"
        });

        // Redirecionar após 2s
        setTimeout(() => {
          navigate(returnUrl);
        }, 2000);
      }
    };
    loadPatientData();
  }, [navigate, toast]);
  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado com sucesso."
    });
    navigate('/entrar');
  };
  const handleAccessClubeBen = async () => {
    try {
      setAccessingClub(true);

      // ✅ GARANTIR SYNC ANTES DE REDIRECIONAR
      // Se usuário tem plano mas clubeben_status != 'active', disparar sync
      if (patientPlan && patient?.clubeben_status !== 'active') {
        console.log('[ClubeBen] User has plan but not synced yet, triggering sync...');
        const {
          data: syncData,
          error: syncError
        } = await supabase.functions.invoke('clubeben-sync', {
          body: {
            user_id: currentUser?.id,
            user_email: currentUser?.email,
            trigger_source: 'area_do_paciente_access'
          }
        });
        if (syncError) {
          console.error('[ClubeBen] Sync error:', syncError);
          toast({
            title: "Ativação em andamento",
            description: "Seu acesso está sendo preparado. Tente novamente em alguns instantes.",
            variant: "default"
          });
          return;
        }
      }

      // Gerar JWT e redirecionar
      const {
        data,
        error
      } = await supabase.functions.invoke('clubeben-auth-bridge', {
        body: {
          user_id: currentUser?.id
        }
      });
      if (error) throw error;
      if (data?.redirect_url) {
        window.location.href = data.redirect_url;
        toast({
          title: "Redirecionando",
          description: "Você está sendo direcionado ao Clube de Benefícios."
        });
      } else {
        throw new Error('URL de redirecionamento não recebida');
      }
    } catch (error) {
      console.error('[ClubeBen] Access error:', error);
      toast({
        title: "Erro ao acessar",
        description: "Não foi possível acessar o Clube de Benefícios. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setAccessingClub(false);
    }
  };
  const handleDirectSchedule = async (sku: string, serviceName: string) => {
    if (!patient || !currentUser) return;
    const isConsulta = sku === 'ITC6534';
    const setLoading = isConsulta ? setRedirectingConsulta : setRedirectingReceita;
    setLoading(true);
    try {
      const payload = {
        cpf: patient.cpf || '',
        email: currentUser.email || '',
        nome: `${patient.first_name} ${patient.last_name}`,
        telefone: patient.phone_e164 || '',
        sku,
        plano_ativo: true as const,
        sexo: patient.gender
      };
      const response = await scheduleWithActivePlan(payload);
      if (response.ok && response.url) {
        toast({
          title: "✅ Redirecionando",
          description: `Abrindo ${serviceName}...`
        });
        window.location.href = response.url;
      } else {
        throw new Error(response.error || 'Erro ao redirecionar');
      }
    } catch (error) {
      console.error('[Direct Schedule Error]:', error);
      toast({
        title: "❌ Erro",
        description: "Não foi possível redirecionar. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  const getPregnancyStatusText = (status?: string) => {
    switch (status) {
      case 'never':
        return 'Nunca esteve grávida';
      case 'pregnant_now':
        return 'Gestante atualmente';
      case 'pregnant_past':
        return 'Gestação anterior';
      default:
        return 'Não informado';
    }
  };
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <User className="h-8 w-8 animate-pulse mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Carregando seus dados...</p>
        </div>
      </div>;
  }
  const canScheduleAppointments = patient?.profile_complete;
  return <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Área do Paciente
            </h1>
            <p className="text-muted-foreground">
              Bem-vindo(a), {patient?.first_name || currentUser?.email}
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>

        {/* Status Alert */}
        {!patient?.intake_complete && <Alert className="mb-8 border-blue-200 bg-blue-50">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              Complete seus antecedentes médicos para melhorar a qualidade do seu atendimento.
            </AlertDescription>
          </Alert>}

        {/* Quick Actions Section */}
        <div className="mb-8">
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <h2 className="text-2xl font-semibold text-foreground">Nossos Serviços</h2>
                <p className="text-muted-foreground">
                  Escolha o atendimento que você precisa
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-2xl mx-auto">
                  {patientPlan ?
                // ✅ USUÁRIO COM PLANO ATIVO - Redirecionamentos diretos
                <>
                      <Button onClick={() => handleDirectSchedule('ITC6534', 'Pronto Atendimento')} size="lg" className="flex-1" disabled={redirectingConsulta}>
                        <Stethoscope className="h-5 w-5 mr-2" />
                        {redirectingConsulta ? "Redirecionando..." : "Nova consulta"}
                      </Button>
                      
                      <Button onClick={() => window.location.href = 'https://wa.me/5508000008780?text=Olá!%20Gostaria%20de%20agendar%20uma%20consulta%20com%20especialista'} variant="outline" size="lg" className="flex-1">
                        <PhoneCall className="h-5 w-5 mr-2" />
                        Agendar Especialidades
                      </Button>
                      
                      <Button onClick={() => handleDirectSchedule('RZP5755', 'Renovação de Receitas')} variant="outline" size="lg" className="flex-1" disabled={redirectingReceita}>
                        <Pill className="h-5 w-5 mr-2" />
                        {redirectingReceita ? "Redirecionando..." : "Renovar Receitas"}
                      </Button>
                    </> :
                // ❌ USUÁRIO SEM PLANO - Comportamento normal
                <>
                      <Button asChild size="lg" className="flex-1">
                        <Link to="/servicos">
                          <Stethoscope className="h-5 w-5 mr-2" />
                          Nova consulta
                        </Link>
                      </Button>
                      <Button asChild variant="outline" size="lg" className="flex-1">
                        <Link to="/servicos/renovacao_receitas">
                          <Pill className="h-5 w-5 mr-2" />
                          Renovar Receitas
                        </Link>
                      </Button>
                    </>}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Dados Pessoais */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Dados Pessoais
                <Badge variant={patient?.profile_complete ? "default" : "secondary"}>
                  {patient?.profile_complete ? <><CheckCircle className="h-3 w-3 mr-1" /> Completo</> : <><AlertCircle className="h-3 w-3 mr-1" /> Pendente</>}
                </Badge>
              </CardTitle>
              <CardDescription>
                Suas informações básicas de cadastro
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Nome</Label>
                  <p className="text-foreground">{patient?.first_name} {patient?.last_name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                  <p className="text-foreground">{currentUser?.email}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">CPF</Label>
                  <p className="text-foreground">{patient?.cpf ? formatCPF(patient.cpf) : 'Não informado'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Data de Nascimento</Label>
                  <p className="text-foreground">
                    {patient?.birth_date ? new Date(patient.birth_date).toLocaleDateString('pt-BR') : 'Não informado'}
                  </p>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Telefone
                </Label>
                <p className="text-foreground">{patient?.phone_e164 || 'Não informado'}</p>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Endereço
                </Label>
                <p className="text-foreground">{patient?.address_line || 'Não informado'}</p>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Shield className="h-3 w-3" /> Plano
                </Label>
                <p className="text-foreground">
                  {formatPlanName(patientPlan?.plan_code)}
                  {patientPlan?.plan_expires_at && <span className="text-xs ml-2 text-muted-foreground">
                      (válido até {formatPlanExpiry(patientPlan.plan_expires_at)})
                    </span>}
                </p>
              </div>
              
              <div>
                
                <p className="text-foreground">
                  {patient?.terms_accepted_at ? new Date(patient.terms_accepted_at).toLocaleDateString('pt-BR') : 'Não aceito'}
                </p>
              </div>
              
              <Button asChild variant="outline" className="w-full">
                <Link to="/completar-perfil">
                  <Edit className="h-4 w-4 mr-2" />
                  Editar perfil
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Clube de Benefícios */}
          <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20 md:bg-background md:border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-primary" />
                Clube de Benefícios Prontìa Saúde!
                {patientPlan && <Badge variant="default">Disponível</Badge>}
              </CardTitle>
              
            </CardHeader>
            <CardContent className="space-y-4">
              {patientPlan ?
            // ✅ USUÁRIO TEM PLANO ATIVO
            <>
                  <p className="text-sm text-muted-foreground">
                    Mais de 450 descontos exclusivos para quem é Prontìa Saúde
                  </p>
                  
                  {/* Mostrar status de sincronização se estiver pendente */}
                  {patient?.clubeben_status === 'pending' && <Alert className="border-blue-200 bg-blue-50">
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800 text-sm">
                        Seu acesso está sendo ativado. Pode levar alguns minutos.
                      </AlertDescription>
                    </Alert>}
                  
                  {/* Botão idêntico ao da /clubeben */}
                  <Button onClick={handleAccessClubeBen} className="w-full" disabled={accessingClub}>
                    {accessingClub ? <>Redirecionando...</> : <>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Acessar Clube
                      </>}
                  </Button>
                </> :
            // ❌ USUÁRIO NÃO TEM PLANO - RENDERIZAR BANNER PROMOCIONAL
            <>
                  <div className="space-y-4">
                    
                    
                    
                    
                    <p className="text-sm text-muted-foreground">Mais de 450 descontos exclusivos para quem é Prontìa Saúde.</p>

                    {/* Grid de ícones de benefícios */}
                    <div className="grid grid-cols-4 gap-3 py-4">
                      <div className="flex flex-col items-center gap-1 text-center">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Pill className="h-5 w-5 text-primary" />
                        </div>
                        <span className="text-xs font-medium">Farmácias</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 text-center">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Stethoscope className="h-5 w-5 text-primary" />
                        </div>
                        <span className="text-xs font-medium">Exames</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 text-center">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Dumbbell className="h-5 w-5 text-primary" />
                        </div>
                        <span className="text-xs font-medium">Fitness</span>
                      </div>
                      <div className="flex flex-col items-center gap-1 text-center">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Apple className="h-5 w-5 text-primary" />
                        </div>
                        <span className="text-xs font-medium">Alimentação</span>
                      </div>
                    </div>

                    {/* CTAs */}
                    <div className="flex flex-col gap-2 pt-2">
                      <Button asChild size="sm">
                        <Link to="/planos">
                          <ArrowRight className="h-4 w-4 mr-2" />
                          Assinar Plano
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/clubeben">
                          Conheça o Clube
                        </Link>
                      </Button>
                    </div>
                  </div>
                </>}
            </CardContent>
          </Card>

          {/* Antecedentes Médicos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-destructive" />
                Antecedentes Médicos
                <Badge variant={patient?.intake_complete ? "default" : "secondary"}>
                  {patient?.intake_complete ? <><CheckCircle className="h-3 w-3 mr-1" /> Completo</> : <><AlertCircle className="h-3 w-3 mr-1" /> Pendente</>}
                </Badge>
              </CardTitle>
              <CardDescription>
                Informações importantes para seu atendimento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Heart className="h-3 w-3" /> Alergias
                </Label>
                <p className="text-foreground">
                  {patient?.has_allergies ? patient.allergies || 'Sim, mas não especificado' : 'Não possui alergias'}
                </p>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Baby className="h-3 w-3" /> Status de gestação
                </Label>
                <p className="text-foreground">
                  {getPregnancyStatusText(patient?.pregnancy_status)}
                </p>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Stethoscope className="h-3 w-3" /> Comorbidades
                </Label>
                <p className="text-foreground">
                  {patient?.has_comorbidities ? patient.comorbidities || 'Sim, mas não especificado' : 'Não possui comorbidades'}
                </p>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Pill className="h-3 w-3" /> Medicamentos contínuos
                </Label>
                <p className="text-foreground">
                  {patient?.has_chronic_meds ? patient.chronic_meds || 'Sim, mas não especificado' : 'Não usa medicamentos contínuos'}
                </p>
              </div>
              
              <Button asChild variant="outline" className="w-full">
                <Link to="/intake/antecedentes">
                  <Edit className="h-4 w-4 mr-2" />
                  Editar antecedentes
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Minhas Consultas */}
        <div className="mt-8" id="consultas">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Minhas Consultas
              </CardTitle>
              
            </CardHeader>
            <CardContent>
              {currentUser?.email && <MeusAgendamentos userEmail={currentUser.email} />}
            </CardContent>
          </Card>
        </div>

        {/* Rótulos de Bem-Estar */}
        <div className="mt-8">
          <div className="flex flex-wrap gap-3 justify-center">
            <Link to="/saude-mental" className="group">
              <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-green-500/10 to-teal-500/10 border border-green-200 rounded-full hover:from-green-500/20 hover:to-teal-500/20 hover:border-green-300 transition-all duration-200 hover:shadow-md">
                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-teal-600 rounded-full flex items-center justify-center">
                  <Leaf className="h-4 w-4 text-white" />
                </div>
                <span className="font-medium text-foreground group-hover:text-green-700">Saúde Mental</span>
              </div>
            </Link>
            
            <Link to="/livros" className="group">
              <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 border border-blue-200 rounded-full hover:from-blue-500/20 hover:to-indigo-500/20 hover:border-blue-300 transition-all duration-200 hover:shadow-md">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                  <BookOpen className="h-4 w-4 text-white" />
                </div>
                <span className="font-medium text-foreground group-hover:text-blue-700">Livros</span>
              </div>  
            </Link>
            
            <Link to="/playlists" className="group">
              <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-200 rounded-full hover:from-purple-500/20 hover:to-pink-500/20 hover:border-purple-300 transition-all duration-200 hover:shadow-md">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
                  <Headphones className="h-4 w-4 text-white" />
                </div>
                <span className="font-medium text-foreground group-hover:text-purple-700">Playlists</span>
              </div>
            </Link>
            
            <Link to="/receitas-saudaveis" className="group">
              <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-200 rounded-full hover:from-orange-500/20 hover:to-red-500/20 hover:border-orange-300 transition-all duration-200 hover:shadow-md">
                <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center">
                  <UtensilsCrossed className="h-4 w-4 text-white" />
                </div>
                <span className="font-medium text-foreground group-hover:text-orange-700">Receitas Saudáveis</span>
              </div>
            </Link>
          </div>
        </div>

        {/* Disque Denúncia Section - Only for users with active plan */}
        {patientPlan?.plan_code && patientPlan?.status === 'active' && <div className="mt-8">
            <DisqueDenunciaSection />
          </div>}
      </div>
    </div>;
};

// Helper Label component
const Label = ({
  children,
  className = ""
}: {
  children: React.ReactNode;
  className?: string;
}) => <span className={`block ${className}`}>{children}</span>;
export default AreaDoPaciente;