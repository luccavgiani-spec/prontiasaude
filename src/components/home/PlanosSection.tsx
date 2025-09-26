import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CadastroModal } from "@/components/modais/CadastroModal";
import { PRICE_MAP } from "@/lib/constants";
import { formataPreco, getEmailAtual } from "@/lib/utils";
import { criarCheckout, redirecionarParaCheckout } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
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

export function PlanosSection() {
  const [duracaoSelecionada, setDuracaoSelecionada] = useState<string>("1");
  const [showEmpresarialForm, setShowEmpresarialForm] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [planoSelecionado, setPlanoSelecionado] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    telefone: "",
    descricao: ""
  });

  // Definição dos períodos de pagamento
  const periodos = [
    { meses: "1", label: "Mensal", desconto: 0 },
    { meses: "6", label: "Semestral", desconto: 20 },
    { meses: "12", label: "Anual", desconto: 40 }
  ];

  // Preços base para os novos planos (em centavos)
  const precosPlanosBase = {
    individual_com_especialistas: 14900, // R$ 149,00
    familiar_com_especialistas: 29900,   // R$ 299,00
    individual_sem_especialistas: 9900,  // R$ 99,00
    familiar_sem_especialistas: 19900    // R$ 199,00
  };

  // Função para calcular preço com desconto
  const calcularPreco = (precoBase: number, meses: number) => {
    const periodo = periodos.find(p => p.meses === meses.toString());
    if (!periodo) return precoBase;
    
    const desconto = periodo.desconto / 100;
    const precoComDesconto = precoBase * (1 - desconto);
    return precoComDesconto;
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
        { icone: <Shield className="h-5 w-5" />, texto: "Sem coparticipação e sem carência" },
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
        { icone: <Shield className="h-5 w-5" />, texto: "Sem coparticipação e sem carência" },
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
        { icone: <Shield className="h-5 w-5" />, texto: "Sem coparticipação e sem carência" },
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
        { icone: <Shield className="h-5 w-5" />, texto: "Sem coparticipação e sem carência" },
        { icone: <Percent className="h-5 w-5" />, texto: "Descontos em farmácias e exames médicos" },
        { icone: <Star className="h-5 w-5" />, texto: "Benefícios exclusivos" },
        { icone: <X className="h-5 w-5" />, texto: "Cancele a hora que quiser, sem multa (apenas no mensal)" }
      ]
    }
  ];

  const handleAssinar = async (planoId: string, email?: string) => {
    if (planoId === "empresarial") {
      setShowEmpresarialForm(true);
      return;
    }

    const emailParaUsar = email || (await getEmailAtual());
    if (!emailParaUsar) {
      setPlanoSelecionado(planoId);
      setIsModalOpen(true);
      return;
    }
    await processarCheckoutPlano(planoId, emailParaUsar);
  };

  const processarCheckoutPlano = async (planoId: string, email: string) => {
    setIsLoading(true);
    try {
      // Mapear plano ID para código do sistema existente
      const planoCodeMap: { [key: string]: string } = {
        individual_com_especialistas: "INDIVIDUAL",
        familiar_com_especialistas: "FAMILIAR",
        individual_sem_especialistas: "INDIVIDUAL",
        familiar_sem_especialistas: "FAMILIAR"
      };

      const planoCode = planoCodeMap[planoId];
      const priceId = PRICE_MAP[`plano_${planoCode.toLowerCase()}` as keyof typeof PRICE_MAP];
      
      if (!priceId || priceId === "price_xxx") {
        toast({
          title: "Plano em configuração",
          description: "Este plano ainda está sendo configurado. Tente novamente mais tarde.",
          variant: "destructive"
        });
        return;
      }

      const checkoutData = await criarCheckout({
        mode: "subscription",
        price_id: priceId,
        plan_code: planoCode,
        plan_duration_months: parseInt(duracaoSelecionada),
        email: email
      });

      if (checkoutData.error) {
        toast({
          title: "Erro no checkout",
          description: checkoutData.error,
          variant: "destructive"
        });
        return;
      }

      redirecionarParaCheckout(checkoutData);
    } catch (error) {
      toast({
        title: "Erro inesperado",
        description: "Não foi possível processar a assinatura. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowEmpresarialForm(false);
    setShowConfirmModal(true);
    setFormData({
      nome: "",
      email: "",
      telefone: "",
      descricao: ""
    });
  };

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Nossos Planos
          </h2>
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

        {/* Grid de planos */}
        <div className="grid md:grid-cols-4 gap-6 max-w-7xl mx-auto mb-12">
          {novosPlanosData.map((plano) => {
            const meses = parseInt(duracaoSelecionada);
            const precoComDesconto = calcularPreco(plano.precoBase, meses);
            const precoMensal = precoComDesconto / meses;
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
                    {periodo && periodo.desconto > 0 && (
                      <div className="text-xs text-muted-foreground mt-2">
                        <span className="line-through">
                          {formataPreco(plano.precoBase / 100)}
                        </span>
                        <span className="text-accent font-medium ml-2">
                          Economize {periodo.desconto}%
                        </span>
                      </div>
                    )}
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
                      disabled={isLoading}
                    >
                      {isLoading ? "Processando..." : "Assinar Plano"}
                      <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Plano Empresarial */}
        <div className="max-w-4xl mx-auto">
          <Card className="bg-gradient-to-br from-primary/5 to-secondary/10 border-primary/20">
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

              {/* Botões do plano empresarial */}
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
                  onClick={() => handleAssinar("empresarial")}
                  size="lg" 
                  className="px-8"
                >
                  Solicitar Proposta
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modal do formulário empresarial */}
        <Dialog open={showEmpresarialForm} onOpenChange={setShowEmpresarialForm}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Plano Empresarial</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleFormSubmit} className="space-y-4">
              <Input 
                placeholder="Nome" 
                value={formData.nome} 
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })} 
                required 
              />
              <Input 
                type="email" 
                placeholder="E-mail" 
                value={formData.email} 
                onChange={(e) => setFormData({ ...formData, email: e.target.value })} 
                required 
              />
              <Input 
                placeholder="Telefone" 
                value={formData.telefone} 
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} 
                required 
              />
              <Textarea 
                placeholder="Breve descrição do negócio" 
                value={formData.descricao} 
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })} 
                required 
              />
              <Button type="submit" className="w-full bg-green-600 hover:bg-green-700">
                Enviar Formulário
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal de confirmação */}
        <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
          <DialogContent className="sm:max-w-md text-center">
            <DialogHeader>
              <DialogTitle>Formulário Enviado!</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">
              Formulário preenchido. Em breve alguém entrará em contato.
            </p>
            <Button onClick={() => setShowConfirmModal(false)} className="w-full">
              OK
            </Button>
          </DialogContent>
        </Dialog>

        {/* CadastroModal */}
        <CadastroModal 
          open={isModalOpen} 
          onOpenChange={setIsModalOpen} 
          onSuccess={(email) => processarCheckoutPlano(planoSelecionado, email)} 
        />
      </div>
    </section>
  );
}