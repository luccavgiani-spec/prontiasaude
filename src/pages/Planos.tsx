import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentModal } from "@/components/payment/PaymentModal";
import { formataPreco } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { checkPatientPlanActive } from "@/lib/patient-plan";
import { scheduleWithActivePlan } from "@/lib/schedule-service";
import { toast as sonnerToast } from "sonner";
import { trackViewContent } from "@/lib/meta-tracking";
import type { DirectSchedulePayload } from "@/lib/types/plan";
import { 
  Check, 
  Star, 
  ArrowRight, 
  Users, 
  Crown, 
  Heart,
  Stethoscope,
  Phone,
  Shield,
  Pill,
  Activity,
  Brain,
  Apple,
  Dumbbell,
  Percent,
  X,
  Calendar,
  Clock
} from "lucide-react";

const Planos = () => {
  const [duracaoSelecionada, setDuracaoSelecionada] = useState<string>("1");
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [userHasActivePlan, setUserHasActivePlan] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<{
    sku: string;
    name: string;
    amount: number;
    recurring?: boolean;
    frequency?: number;
    frequencyType?: 'months' | 'days';
  } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    trackViewContent({
      content_name: 'Página de Planos',
      content_category: 'Planos',
      content_ids: ['planos']
    });
    checkActivePlan();
  }, []);

  const checkActivePlan = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return;
      
      const planStatus = await checkPatientPlanActive(user.email);
      setUserHasActivePlan(planStatus.canBypassPayment);
    } catch (error) {
      console.error('Error checking plan:', error);
    }
  };

  // Definição dos períodos de pagamento
  const periodos = [
    { meses: "1", label: "Mensal", desconto: 0 },
    { meses: "6", label: "Semestral", desconto: 0 },
    { meses: "12", label: "Anual", desconto: 0 }
  ];

  // Preços base para os novos planos (em reais, convertidos para centavos)
  const precosPlanosBase = {
    individual_com_especialistas: 2399, // R$ 23,99
    familiar_com_especialistas: 3999,   // R$ 39,99
    individual_sem_especialistas: 1999,  // R$ 19,99
    familiar_sem_especialistas: 2990    // R$ 29,90
  };

  // Função para calcular preço (sem desconto, valores já são finais)
  const calcularPreco = (planoId: string, meses: number) => {
    // Mapeamento direto dos preços finais por plano e duração
    const precosPorPlanoEDuracao: { [key: string]: { [meses: string]: number } } = {
      "individual_com_especialistas": {
        "1": 2399,  // R$ 23,99
        "6": 1799,  // R$ 17,99
        "12": 1599  // R$ 15,99
      },
      "familiar_com_especialistas": {
        "1": 3999,  // R$ 39,99
        "6": 3399,  // R$ 33,99
        "12": 2990  // R$ 29,90
      },
      "individual_sem_especialistas": {
        "1": 1999,  // R$ 19,99
        "6": 1599,  // R$ 15,99
        "12": 1399  // R$ 13,99
      },
      "familiar_sem_especialistas": {
        "1": 2990,  // R$ 29,90
        "6": 2690,  // R$ 26,90
        "12": 2430  // R$ 24,30
      }
    };
    
    return precosPorPlanoEDuracao[planoId]?.[meses.toString()] || precosPlanosBase[planoId as keyof typeof precosPlanosBase] || 0;
  };

  // Definição dos novos planos
  const novosPlanosData = [
    {
      id: "individual_com_especialistas",
      nome: "Individual com Especialistas",
      icone: <Users className="h-12 w-12 text-primary" />,
      popular: true,
      precoBase: precosPlanosBase.individual_com_especialistas,
      beneficios: [
        { icone: <Stethoscope className="h-5 w-5" />, texto: "Atendimento ilimitado" },
        { icone: <Clock className="h-5 w-5" />, texto: "Consultas com clínico geral 24h/dia" },
        { icone: <Heart className="h-5 w-5" />, texto: "Especialidades exclusivas: Cardiologia, Dermatologia, Endocrinologia, Gastroenterologia, Ginecologia, Oftalmologia, Ortopedia, Otorrinolaringologia, Pediatria, Psiquiatria, Urologia, Fisioterapia" },
        { icone: <Apple className="h-5 w-5" />, texto: "Nutrição e personal trainer*" },
        { icone: <Brain className="h-5 w-5" />, texto: "Psicólogo quinzenal" },
        { icone: <Shield className="h-5 w-5" />, texto: "Sem coparticipação e carência na telemedicina" },
        { icone: <Percent className="h-5 w-5" />, texto: "Descontos em farmácias e exames médicos" },
        { icone: <Star className="h-5 w-5" />, texto: "Benefícios exclusivos" },
        { icone: <X className="h-5 w-5" />, texto: "Cancele a hora que quiser, sem multa (apenas no mensal)" }
      ]
    },
    {
      id: "familiar_com_especialistas",
      nome: "Familiar com Especialistas",
      icone: <Crown className="h-12 w-12 text-primary" />,
      popular: false,
      precoBase: precosPlanosBase.familiar_com_especialistas,
      beneficios: [
        { icone: <Users className="h-5 w-5" />, texto: "Atendimento para até 4 familiares" },
        { icone: <Stethoscope className="h-5 w-5" />, texto: "Atendimento ilimitado" },
        { icone: <Clock className="h-5 w-5" />, texto: "Consultas com clínico geral 24h/dia" },
        { icone: <Heart className="h-5 w-5" />, texto: "Especialidades exclusivas: Cardiologia, Dermatologia, Endocrinologia, Gastroenterologia, Ginecologia, Oftalmologia, Ortopedia, Otorrinolaringologia, Pediatria, Psiquiatria, Urologia, Fisioterapia" },
        { icone: <Apple className="h-5 w-5" />, texto: "Nutrição e personal trainer*" },
        { icone: <Brain className="h-5 w-5" />, texto: "Psicólogo quinzenal" },
        { icone: <Shield className="h-5 w-5" />, texto: "Sem coparticipação e carência na telemedicina" },
        { icone: <Percent className="h-5 w-5" />, texto: "Descontos em farmácias e exames médicos" },
        { icone: <Star className="h-5 w-5" />, texto: "Benefícios exclusivos" },
        { icone: <X className="h-5 w-5" />, texto: "Cancele a hora que quiser, sem multa (apenas no mensal)" }
      ]
    },
    {
      id: "individual_sem_especialistas",
      nome: "Individual sem Especialistas",
      icone: <Activity className="h-12 w-12 text-primary" />,
      popular: false,
      precoBase: precosPlanosBase.individual_sem_especialistas,
      beneficios: [
        { icone: <Stethoscope className="h-5 w-5" />, texto: "Atendimento ilimitado" },
        { icone: <Clock className="h-5 w-5" />, texto: "Consultas com clínico geral 24h/dia" },
        { icone: <Shield className="h-5 w-5" />, texto: "Sem coparticipação e carência na telemedicina" },
        { icone: <Percent className="h-5 w-5" />, texto: "Descontos em farmácias e exames médicos" },
        { icone: <Star className="h-5 w-5" />, texto: "Benefícios exclusivos" },
        { icone: <X className="h-5 w-5" />, texto: "Cancele a hora que quiser, sem multa (apenas no mensal)" }
      ]
    },
    {
      id: "familiar_sem_especialistas",
      nome: "Familiar sem Especialistas",
      icone: <Users className="h-12 w-12 text-primary" />,
      popular: false,
      precoBase: precosPlanosBase.familiar_sem_especialistas,
      beneficios: [
        { icone: <Users className="h-5 w-5" />, texto: "Atendimento para até 4 familiares" },
        { icone: <Stethoscope className="h-5 w-5" />, texto: "Atendimento ilimitado" },
        { icone: <Clock className="h-5 w-5" />, texto: "Consultas com clínico geral 24h/dia" },
        { icone: <Shield className="h-5 w-5" />, texto: "Sem coparticipação e carência na telemedicina" },
        { icone: <Percent className="h-5 w-5" />, texto: "Descontos em farmácias e exames médicos" },
        { icone: <Star className="h-5 w-5" />, texto: "Benefícios exclusivos" },
        { icone: <X className="h-5 w-5" />, texto: "Cancele a hora que quiser, sem multa (apenas no mensal)" }
      ]
    }
  ];

  // Mapa de conversão de IDs para SKUs padronizados
  const skuPrefixMap: Record<string, string> = {
    'individual_com_especialistas': 'IND_COM_ESP',
    'individual_sem_especialistas': 'IND_SEM_ESP',
    'familiar_com_especialistas': 'FAM_COM_ESP',
    'familiar_sem_especialistas': 'FAM_SEM_ESP',
  };

  const handleAssinar = async (planoId: string) => {
    // 1. Verificar login PRIMEIRO
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      localStorage.setItem('returnUrl', '/planos');
      localStorage.setItem('pendingPlan', JSON.stringify({ planoId }));
      navigate('/area-do-paciente');
      return;
    }

    const plano = novosPlanosData.find(p => p.id === planoId);
    if (!plano) return;

    const precoMensal = calcularPreco(planoId, parseInt(duracaoSelecionada));
    const meses = parseInt(duracaoSelecionada);
    
    // 2. BYPASS: Se usuário tem plano ativo, agenda direto
    if (userHasActivePlan) {
      try {
        const { data: patient } = await supabase
          .from('patients')
          .select('*')
          .eq('id', user.id)
          .single();

        if (!patient) {
          sonnerToast.error('Dados do paciente não encontrados');
          return;
        }

        sonnerToast.loading('Redirecionando para atendimento...');

        const schedulePayload: DirectSchedulePayload = {
          cpf: patient.cpf || '',
          email: user.email,
          nome: `${patient.first_name || ''} ${patient.last_name || ''}`.trim(),
          telefone: patient.phone_e164 || '',
          sku: `${skuPrefixMap[planoId]}_${duracaoSelecionada}M`,
          plano_ativo: true,
        };

        const result = await scheduleWithActivePlan(schedulePayload);

        if (result.ok && result.url) {
          window.location.href = result.url;
        } else {
          sonnerToast.error(result.error || 'Não foi possível agendar. Tente novamente.');
        }
      } catch (error) {
        console.error('Bypass error:', error);
        sonnerToast.error('Erro ao processar. Tente novamente.');
      }
      return;
    }

    // 3. Sem plano ativo: abrir modal de assinatura
    // Calcular valor total = precoMensal × meses (em centavos)
    const valorTotal = precoMensal * meses;
    const duracaoLabel = duracaoSelecionada === '1' ? 'Mensal' : duracaoSelecionada === '6' ? 'Semestral' : 'Anual';
    
    setSelectedPlan({
      sku: `${skuPrefixMap[planoId]}_${duracaoSelecionada}M`,
      name: `${plano.nome} - ${duracaoLabel}`,
      amount: valorTotal,
      recurring: true,
      frequency: meses,
      frequencyType: 'months',
    });
    setIsPaymentModalOpen(true);
  };

  return (
    <>
      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <section className="py-16 px-4 bg-gradient-to-br from-primary/5 to-secondary/5">
          <div className="container mx-auto max-w-6xl text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              Escolha o plano perfeito para você
            </h1>
            <p className="text-xl text-muted-foreground mb-12 max-w-3xl mx-auto">
              Atendimento ilimitado, especialistas e benefícios exclusivos para você e sua família
            </p>

            {/* Simulador de preços dinâmico */}
            <div className="flex justify-center mb-12">
              <div className="inline-flex bg-white rounded-2xl p-2 shadow-lg border-2 border-primary/20">
                {periodos.map((periodo) => (
                  <button
                    key={periodo.meses}
                    onClick={() => setDuracaoSelecionada(periodo.meses)}
                    className={`relative px-8 py-4 rounded-xl text-base font-semibold transition-all duration-300 ${
                      duracaoSelecionada === periodo.meses
                        ? "bg-primary text-primary-foreground shadow-lg scale-105 z-10"
                        : "text-muted-foreground hover:text-foreground hover:bg-primary/5"
                    }`}
                  >
                    {periodo.label}
                    {periodo.desconto > 0 && (
                      <Badge 
                        variant="secondary" 
                        className="absolute -top-3 -right-3 bg-green-500 text-white text-xs px-3 py-1 font-bold shadow-md"
                      >
                        -{periodo.desconto}%
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Planos Section */}
        <section className="py-16 px-4">
          <div className="container mx-auto max-w-7xl">
            {/* Planos Individuais e Familiares */}
            <div className="space-y-12">
              {/* Todos os 4 planos em uma linha */}
              <div className="grid md:grid-cols-4 gap-6">
                {novosPlanosData.map((plano) => {
                  const meses = parseInt(duracaoSelecionada);
                  const precoMensal = calcularPreco(plano.id, meses);
                  const precoDiario = precoMensal / 30;
                  const periodo = periodos.find(p => p.meses === duracaoSelecionada);
                  
                  return (
                    <Card 
                      key={plano.id} 
                      className={`relative transition-all duration-300 hover:shadow-lg flex flex-col h-full ${
                        plano.popular 
                          ? "ring-2 ring-primary shadow-lg border-primary/20" 
                          : "hover:border-primary/30"
                      }`}
                    >
                      {plano.popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <Badge className="bg-primary text-primary-foreground px-4 py-1">
                            <Star className="h-3 w-3 mr-1" />
                            Mais Popular
                          </Badge>
                        </div>
                      )}

                      <CardHeader className="text-center pb-4">
                        <div className="flex justify-center mb-4">
                          {plano.icone}
                        </div>
                        <CardTitle className="text-lg font-bold text-foreground">
                          {plano.nome}
                        </CardTitle>
                        <div className="text-center">
                          <div className="text-2xl font-bold text-primary mb-2">
                            {formataPreco(precoMensal / 100)}
                            <span className="text-sm font-normal text-muted-foreground">/mês</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Equivale a {formataPreco(precoDiario / 100)}/dia
                          </div>
                        </div>
                      </CardHeader>

                       <CardContent className="flex flex-col flex-grow">
                        <ul className="space-y-2 flex-grow">
                          {plano.beneficios
                            .filter(beneficio => {
                              // Se não for plano mensal, remove o benefício de cancelamento
                              if (duracaoSelecionada !== "1" && beneficio.texto.includes("Cancele a hora que quiser")) {
                                return false;
                              }
                              return true;
                            })
                            .map((beneficio, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <div className="text-primary mt-0.5 flex-shrink-0">
                                {beneficio.icone}
                              </div>
                              <span className="text-xs text-muted-foreground leading-relaxed">
                                {beneficio.texto.includes("Cancele a hora que quiser") && duracaoSelecionada === "1" 
                                  ? "Cancele a hora que quiser, sem multa" 
                                  : beneficio.texto}
                              </span>
                            </li>
                          ))}
                        </ul>

                        <div className="pt-4 mt-auto">
                          <Button
                            onClick={() => handleAssinar(plano.id)}
                            size="sm"
                            className="w-full group bg-green-600 hover:bg-green-700 text-white border-green-600 hover:border-green-700"
                          >
                            Assinar Plano
                            <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-1" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* Plano Empresarial */}
              <div>
                <h3 className="text-2xl font-bold text-center text-foreground mb-8">
                  Plano Empresarial
                </h3>
                <Card className="mx-auto max-w-4xl bg-gradient-to-br from-primary/5 to-secondary/10 border-primary/20">
                  <CardHeader className="text-center pb-6">
                    <div className="flex justify-center mb-4">
                      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                        <Crown className="h-10 w-10 text-primary" />
                      </div>
                    </div>
                    <CardTitle className="text-3xl font-bold text-foreground mb-4">
                      Plano Empresarial
                    </CardTitle>
                    <CardDescription className="text-lg text-muted-foreground">
                      Cuidado médico ágil a um clique da sua equipe
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-8">
                    {/* Benefícios do plano empresarial */}
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">Plano personalizado</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">Reduza as faltas na sua empresa</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">Em conformidade com a nova NR1, diminuindo processos trabalhistas</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">Atendimento humanizado e rápido</span>
                        </div>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">Plataforma simples, segura e intuitiva</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">Conteúdos exclusivos de saúde e prevenção</span>
                        </div>
                        <div className="flex items-start gap-3">
                          <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                          <span className="text-muted-foreground">Disque denúncia e acompanhamento de riscos</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
                      <Button 
                        asChild
                        variant="outline" 
                        size="lg" 
                        className="px-8"
                      >
                        <a href="/empresas">
                          Saiba Mais
                        </a>
                      </Button>
                      <Button 
                        asChild
                        size="lg" 
                        className="px-8"
                      >
                        <a href="/empresas">
                          Solicitar Proposta
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Seção de benefícios adicionais */}
        <section className="py-16 px-4 bg-gradient-to-br from-secondary/5 to-primary/5">
          <div className="container mx-auto max-w-6xl text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-6">
              Por que escolher nossos planos?
            </h2>
            <p className="text-lg text-muted-foreground mb-12 max-w-3xl mx-auto">
              Oferecemos atendimento médico de qualidade com tecnologia avançada, 
              especialistas qualificados e benefícios exclusivos para cuidar da sua saúde.
            </p>
            
            <div className="grid md:grid-cols-3 gap-8 mb-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Phone className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Atendimento 24h
                </h3>
                <p className="text-muted-foreground">
                  Consultas médicas disponíveis a qualquer hora do dia, 
                  todos os dias da semana.
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Sem Carência
                </h3>
                <p className="text-muted-foreground">
                  Comece a usar seu plano imediatamente após a contratação, 
                  sem períodos de espera.
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Star className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  Especialistas
                </h3>
                <p className="text-muted-foreground">
                  Acesso a mais de 10 especialidades médicas com profissionais 
                  altamente qualificados.
                </p>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground">
              * Nutrição e personal trainer disponíveis mediante agendamento e sujeitos à disponibilidade.
            </p>
          </div>
        </section>
      </div>

      {/* Subscription Modal */}
      {selectedPlan && (
        <PaymentModal
          open={isPaymentModalOpen}
          onOpenChange={setIsPaymentModalOpen}
          sku={selectedPlan.sku}
          serviceName={selectedPlan.name}
          amount={selectedPlan.amount}
          recurring={selectedPlan.recurring}
          frequency={selectedPlan.frequency}
          frequencyType={selectedPlan.frequencyType}
          onSuccess={() => {
            window.location.href = '/area-do-paciente';
          }}
        />
      )}
    </>
  );
};

export default Planos;