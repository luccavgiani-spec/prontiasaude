import { useParams, Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CadastroModal } from "@/components/modais/CadastroModal";
import { PaymentModal } from "@/components/payment/PaymentModal";
import { PackageSelectionModal } from "@/components/payment/PackageSelectionModal";
import { CATALOGO_SERVICOS } from "@/lib/constants";
import { formataPreco } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Clock, Users, CheckCircle, Star, Shield } from "lucide-react";
import { trackViewContent, trackLead } from "@/lib/meta-tracking";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
interface Variante {
  valor: number;
  nome: string;
  sku: string;
  consultas?: number;
}
const ServicoDetalhe = () => {
  const {
    slug
  } = useParams<{
    slug: string;
  }>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPackageModalOpen, setIsPackageModalOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<{ sku: string; nome: string; valor: number } | null>(null);
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const servico = CATALOGO_SERVICOS.find(s => s.slug === slug);

  // Set default variant on load
  useEffect(() => {
    if (servico?.variantes && servico.variantes.length > 0) {
      setSelectedVariant(servico.variantes[0].nome);
    }
  }, [servico]);

  // Get current variant price (per session if multiple sessions)
  const getCurrentPrice = () => {
    if (!servico?.variantes) return servico?.precoBase || 0;
    const variant = servico.variantes.find(v => v.nome === selectedVariant) as Variante | undefined;
    if (!variant) return servico.precoBase;
    const consultas = variant.consultas || 1;
    return consultas > 1 ? variant.valor / consultas : variant.valor;
  };

  // Get total price (variant.valor is already the total)
  const getTotalPrice = () => {
    if (!servico?.variantes) return servico?.precoBase || 0;
    const variant = servico.variantes.find(v => v.nome === selectedVariant);
    return variant?.valor || servico.precoBase;
  };
  const getCurrentSku = () => {
    if (!servico?.variantes) return servico?.sku;
    const variant = servico.variantes.find(v => v.nome === selectedVariant);
    return variant?.sku || servico.sku;
  };

  // Track ViewContent when service is loaded
  useEffect(() => {
    if (servico) {
      trackViewContent({
        content_name: servico.nome,
        content_category: 'Serviços',
        content_ids: [servico.slug],
        value: servico.precoBase / 100 // Convert cents to reais
      });
    }
  }, [servico]);
  if (!servico) {
    return <div className="py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-4">Serviço não encontrado</h1>
          <p className="text-muted-foreground mb-6">O serviço solicitado não existe.</p>
          <Button asChild>
            <Link to="/servicos">Ver Todos os Serviços</Link>
          </Button>
        </div>
      </div>;
  }
  const handleAgendar = async () => {
    // Se for psicóloga, abrir modal de seleção de pacote primeiro
    if (servico.slug === "psicologa" && servico.variantes) {
      setIsPackageModalOpen(true);
      return;
    }

    // Track Lead event
    trackLead({
      value: getTotalPrice() / 100,
      content_name: servico.nome + (selectedVariant ? ` - ${selectedVariant}` : '')
    });

    // Verificar se usuário está logado
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Salvar serviço pendente e redirecionar para login
      const pendingService = {
        sku: getCurrentSku(),
        serviceName: servico.nome + (selectedVariant ? ` - ${selectedVariant}` : ''),
        amount: getTotalPrice(),
        especialidade: selectedVariant || servico.nome,
        timestamp: Date.now()
      };
      localStorage.setItem('pendingService', JSON.stringify(pendingService));
      navigate('/area-do-paciente');
      return;
    }

    // Verificar se perfil está completo
    const { data: patient } = await supabase
      .from('patients')
      .select('profile_complete')
      .eq('id', user.id)
      .maybeSingle();

    if (!patient?.profile_complete) {
      const pendingService = {
        sku: getCurrentSku(),
        serviceName: servico.nome + (selectedVariant ? ` - ${selectedVariant}` : ''),
        amount: getTotalPrice(),
        especialidade: selectedVariant || servico.nome,
        timestamp: Date.now()
      };
      localStorage.setItem('pendingService', JSON.stringify(pendingService));
      navigate('/completar-perfil');
      return;
    }

    // Verificar plano ativo
    const { checkPatientPlanActive } = await import('@/lib/patient-plan');
    const planStatus = await checkPatientPlanActive(user.email!);

    if (planStatus.canBypassPayment) {
      // Tem plano ativo: buscar dados completos do paciente
      const { data: patient } = await supabase
        .from('patients')
        .select('cpf, first_name, last_name, phone_e164, gender')
        .eq('id', user.id)
        .maybeSingle();

      if (!patient || !patient.cpf || !patient.first_name || !patient.phone_e164 || !patient.gender) {
        toast({
          description: 'Complete seu cadastro antes de agendar',
          variant: 'destructive'
        });
        navigate('/completar-perfil');
        return;
      }

      // Mapear gender para 'M' ou 'F'
      const mapSexo = (g?: string) => (g?.toUpperCase().startsWith('F') ? 'F' : 'M');

      toast({
        description: 'Redirecionando para agendamento...',
        duration: 2000
      });
      
      const { scheduleWithActivePlan } = await import('@/lib/schedule-service');
      const result = await scheduleWithActivePlan({
        cpf: patient.cpf,
        email: user.email!,
        nome: `${patient.first_name} ${patient.last_name || ''}`.trim(),
        telefone: patient.phone_e164,
        especialidade: selectedVariant || servico.nome,
        sku: getCurrentSku(),
        plano_ativo: true,
        sexo: mapSexo(patient.gender)
      });

      if (result.ok && result.url) {
        window.location.href = result.url;
      } else {
        toast({
          description: result.error || 'Erro ao agendar',
          variant: 'destructive'
        });
      }
      return;
    }

    // Usuário logado sem plano: abrir modal de pagamento
    setIsPaymentModalOpen(true);
  };

  const handlePackageSelect = async (pkg: { sku: string; nome: string; valor: number }) => {
    setSelectedPackage(pkg);
    
    // Track Lead event
    trackLead({
      value: pkg.valor,
      content_name: `${servico.nome} - ${pkg.nome}`
    });

    // Verificar se usuário está logado
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      // Salvar serviço pendente e redirecionar para login
      const pendingService = {
        sku: pkg.sku,
        serviceName: `${servico.nome} - ${pkg.nome}`,
        amount: pkg.valor * 100,
        especialidade: pkg.nome,
        timestamp: Date.now()
      };
      localStorage.setItem('pendingService', JSON.stringify(pendingService));
      navigate('/area-do-paciente');
      return;
    }

    // Verificar se perfil está completo
    const { data: patient } = await supabase
      .from('patients')
      .select('profile_complete')
      .eq('id', user.id)
      .maybeSingle();

    if (!patient?.profile_complete) {
      const pendingService = {
        sku: pkg.sku,
        serviceName: `${servico.nome} - ${pkg.nome}`,
        amount: pkg.valor * 100,
        especialidade: pkg.nome,
        timestamp: Date.now()
      };
      localStorage.setItem('pendingService', JSON.stringify(pendingService));
      navigate('/completar-perfil');
      return;
    }

    // Verificar plano ativo
    const { checkPatientPlanActive } = await import('@/lib/patient-plan');
    const planStatus = await checkPatientPlanActive(user.email!);

    if (planStatus.canBypassPayment) {
      // Tem plano ativo: buscar dados completos do paciente
      const { data: patient } = await supabase
        .from('patients')
        .select('cpf, first_name, last_name, phone_e164, gender')
        .eq('id', user.id)
        .maybeSingle();

      if (!patient || !patient.cpf || !patient.first_name || !patient.phone_e164 || !patient.gender) {
        toast({
          description: 'Complete seu cadastro antes de agendar',
          variant: 'destructive'
        });
        navigate('/completar-perfil');
        return;
      }

      // Mapear gender para 'M' ou 'F'
      const mapSexo = (g?: string) => (g?.toUpperCase().startsWith('F') ? 'F' : 'M');

      toast({
        description: 'Redirecionando para agendamento...',
        duration: 2000
      });
      
      const { scheduleWithActivePlan } = await import('@/lib/schedule-service');
      const result = await scheduleWithActivePlan({
        cpf: patient.cpf,
        email: user.email!,
        nome: `${patient.first_name} ${patient.last_name || ''}`.trim(),
        telefone: patient.phone_e164,
        especialidade: pkg.nome,
        sku: pkg.sku,
        plano_ativo: true,
        sexo: mapSexo(patient.gender)
      });

      if (result.ok && result.url) {
        window.location.href = result.url;
      } else {
        toast({
          description: result.error || 'Erro ao agendar',
          variant: 'destructive'
        });
      }
      return;
    }

    // Usuário logado sem plano: abrir modal de pagamento
    setIsPaymentModalOpen(true);
  };
  return <>
      <div className="py-16">
        <div className="container mx-auto px-4">
          {/* Navegação */}
          <div className="mb-8">
            <Link to="/servicos" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-4">
              <ArrowLeft className="h-4 w-4" />
              Voltar aos serviços
            </Link>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            {/* Conteúdo principal */}
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
                {servico.nome}
              </h1>
              {servico.slug === "laudos_psicologicos" && (
                <p className="text-xl text-muted-foreground mb-8">
                  Necessário consulta prévia com psicólogo
                </p>
              )}
              {servico.slug !== "laudos_psicologicos" && (
                <p className="text-xl text-muted-foreground mb-8">
                  {servico.slug === "renovacao_receitas" ? "Renove agora sua receita com validade para todo o território nacional, de maneira rápida e prática." : servico.slug === "solicitacao_exames" ? "Peça seus exames de forma prática: solicitação médica online, assinada digitalmente e aceita em qualquer laboratório, sem sair de casa." : servico.descricao}
                </p>
              )}

              {/* Informações básicas */}
              {servico.slug !== "renovacao_receitas" && servico.slug !== "solicitacao_exames" && servico.slug !== "laudos_psicologicos" && <div className="mb-8">
                <div className="flex items-center gap-6 text-muted-foreground">
                  {servico.slug === "psicologa" && <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      <span className="font-medium">30 minutos</span>
                    </div>}
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    <span className="font-medium">Consulta Online</span>
                  </div>
                </div>
              </div>}

              {/* O que inclui */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">
                  O que está incluso:
                </h2>
                <ul className="space-y-3">
                  {servico.slug === "renovacao_receitas" ? <>
                      <li className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="text-muted-foreground">Nova receita digital válida em todo país</span>
                      </li>
                    </> : servico.slug === "solicitacao_exames" ? <>
                      <li className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="text-muted-foreground">Atendimento ágil via WhatsApp</span>
                      </li>
                      <li className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                        <span className="text-muted-foreground">Pedido de exames digital válido em todo Brasil</span>
                      </li>
                    </> : servico.slug === "laudos_psicologicos" || servico.slug === "consulta" ? servico.inclui.map((item, index) => <li key={index} className="flex items-center gap-3">
                          <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                          <span className="text-muted-foreground">{item}</span>
                        </li>) : <li className="flex items-center gap-3">
                          <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                          <span className="text-muted-foreground">
                            {servico.slug === "medicos_especialistas" ? "Uma consulta agendada com o médico especialista de sua escolha" : servico.inclui[0]}
                          </span>
                        </li>}
                </ul>
              </div>

              {/* Como funciona */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">
                  Como funciona:
                </h2>
                <div className="space-y-4">
                  {servico.slug === "laudos_psicologicos" ? <>
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                          1
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">Avaliação online</h3>
                          <p className="text-muted-foreground">Primeiro, o paciente realiza uma avaliação online com um de nossos psicólogos credenciados</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                          2
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">Análise e aprovação</h3>
                          <p className="text-muted-foreground">O profissional avalia a necessidade e, se estiver tudo de acordo, autoriza a emissão do laudo</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                          3
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">Emissão do laudo</h3>
                          <p className="text-muted-foreground">Com a aprovação, o laudo psicológico é elaborado e enviado ao paciente, pronto para ser utilizado em procedimentos como cirurgia bariátrica, laqueadura, ou vasectomia.</p>
                        </div>
                      </div>
                    </> : servico.slug === "renovacao_receitas" || servico.slug === "solicitacao_exames" ? <>
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                          1
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">Realize o pagamento</h3>
                          <p className="text-muted-foreground">Após o pagamento, envie sua receita anterior (no máximo 3 meses).</p>
                        </div>
                      </div>
                      {servico.slug === "solicitacao_exames" ? <>
                        <div className="flex gap-4">
                          <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                            2
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground mb-1">Escolha seus exames</h3>
                            <p className="text-muted-foreground">Informe quais exames você deseja realizar no WhatsApp.</p>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                            3
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground mb-1">Contato com nosso time médico</h3>
                            <p className="text-muted-foreground">Nossa equipe entrará em contato para confirmar suas informações.</p>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                            4
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground mb-1">Emissão do pedido médico</h3>
                            <p className="text-muted-foreground">Após a análise, o médico responsável emitirá a solicitação assinada digitalmente.</p>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                            5
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground mb-1">Receba sua requisição</h3>
                            <p className="text-muted-foreground">Você receberá o pedido dos exames por WhatsApp ou e-mail, pronto para usar em qualquer laboratório.</p>
                          </div>
                        </div>
                      </> : <>
                        <div className="flex gap-4">
                          <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                            2
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground mb-1">Agendamento</h3>
                            <p className="text-muted-foreground">Nosso médico avalia sua receita digital com assinatura médica.</p>
                          </div>
                        </div>
                        <div className="flex gap-4">
                          <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                            3
                          </div>
                          <div>
                            <h3 className="font-semibold text-foreground mb-1">Consulta</h3>
                            <p className="text-muted-foreground">Receba sua nova receita sigital com assinatura médica.</p>
                          </div>
                        </div>
                      </>}
                    </> : servico.slug === "psicologa" ? <>
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                          1
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">Pagamento</h3>
                          <p className="text-muted-foreground">Realize o pagamento do serviço desejado.</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                          2
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">Confirmação</h3>
                          <p className="text-muted-foreground">Após recebermos a confirmação do pagamento, você será redirecionado automaticamente para uma de nossas plataformas parceiras.</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                          3
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">Consulta</h3>
                          <p className="text-muted-foreground">Após entrar na fila de atendimento, um psicólogo te chamará para iniciar a sua sessão contratada.</p>
                        </div>
                      </div>
                    </> : <>
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                          1
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">Pagamento</h3>
                          <p className="text-muted-foreground">Realize o pagamento do serviço desejado.</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                          2
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">Confirmação</h3>
                          <p className="text-muted-foreground">Após recebermos a confirmação do pagamento, você será redirecionado automaticamente para uma de nossas plataformas parceiras.</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                          3
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">Consulta</h3>
                          <p className="text-muted-foreground">Após entrar na fila de atendimento, um médico responsável te chamará para ouvir suas necessidades.</p>
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">
                          4
                        </div>
                        <div>
                          <h3 className="font-semibold text-foreground mb-1">Pós consulta</h3>
                          <p className="text-muted-foreground">Você receberá pedido de exames, receitas e atestados por WhatsApp, prontos para usar em qualquer lugar do território nacional.</p>
                        </div>
                      </div>
                    </>}
                </div>
              </div>

              {/* Garantias */}
              <div className="bg-muted/30 rounded-xl p-6">
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Nossas Garantias
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-accent fill-current flex-shrink-0" />
                    Profissionais certificados e experientes
                  </li>
                  <li className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-accent fill-current flex-shrink-0" />
                    Plataforma segura e confiável
                  </li>
                  <li className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-accent fill-current flex-shrink-0" />
                    Suporte técnico disponível
                  </li>
                </ul>
              </div>
            </div>

            {/* Card de agendamento */}
            <div className="lg:sticky lg:top-24">
              <div className="medical-card p-6">
                {/* Dropdown for variants - APENAS para médicos especialistas e exames */}
                {servico.variantes && servico.variantes.length > 0 && servico.slug !== "solicitacao_exames" && servico.slug !== "psicologa" && <div className="mb-4">
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      Selecione a especialidade:
                    </label>
                    <Select value={selectedVariant} onValueChange={setSelectedVariant}>
                      <SelectTrigger className="w-full bg-background">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {servico.variantes.map(variante => {
                      return <SelectItem key={variante.nome} value={variante.nome}>
                                  {variante.nome} - {formataPreco(variante.valor)}
                            </SelectItem>;
                    })}
                      </SelectContent>
                    </Select>
                  </div>}
                
                <div className="text-center mb-6">
                  {(servico.slug === "psicologa" || servico.slug === "medicos_especialistas") && !selectedVariant && <p className="text-muted-foreground mb-2">À partir de</p>}
                  <div className="text-3xl font-bold text-foreground mb-2">
                    {servico.slug === "renovacao_receitas" ? formataPreco(9.99) : formataPreco(getTotalPrice())}
                  </div>
                  {servico.slug === "psicologa" && selectedVariant && (() => {
                  const variant = servico.variantes?.find(v => v.nome === selectedVariant) as Variante | undefined;
                  const consultas = variant?.consultas || 1;
                  return consultas > 1 ? <p className="text-sm text-muted-foreground">
                        {formataPreco(getCurrentPrice())}/consulta × {consultas} sessões
                      </p> : null;
                })()}
                  <p className="text-muted-foreground">Pagamento único</p>
                </div>

                <Button onClick={() => {
                handleAgendar();
              }} variant="outline" size="lg" className="bg-green-600 text-white border-green-600 hover:bg-green-700 w-full mb-4" disabled={isLoading} data-sku={getCurrentSku()}>
                  {isLoading ? "Processando..." : servico.slug === "solicitacao_exames" ? "Solicitar exames" : "Agendar agora"}
                </Button>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    Pagamento seguro e criptografado
                  </p>
                  <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <div className="w-2 h-2 bg-primary rounded-full"></div>
                    <span>SSL Certificado</span>
                    <div className="w-2 h-2 bg-accent rounded-full"></div>
                    <span>Dados Protegidos</span>
                  </div>
                </div>
              </div>

              
            </div>
          </div>
        </div>
      </div>

      {/* Package Selection Modal (Psicóloga) */}
      {servico.slug === "psicologa" && servico.variantes && (
        <PackageSelectionModal
          open={isPackageModalOpen}
          onOpenChange={setIsPackageModalOpen}
          packages={servico.variantes}
          onPackageSelect={handlePackageSelect}
        />
      )}

      <PaymentModal
        open={isPaymentModalOpen}
        onOpenChange={setIsPaymentModalOpen}
        sku={selectedPackage?.sku || getCurrentSku() || ''}
        serviceName={selectedPackage ? `${servico.nome} - ${selectedPackage.nome}` : servico.nome + (selectedVariant ? ` - ${selectedVariant}` : '')}
        amount={selectedPackage ? Math.round(selectedPackage.valor * 100) : Math.round(getTotalPrice() * 100)}
        especialidade={selectedPackage?.nome || selectedVariant || servico.nome}
        onSuccess={() => {
          setIsPaymentModalOpen(false);
          toast({
            title: "Sucesso!",
            description: "Pagamento processado com sucesso"
          });
        }}
      />

      <CadastroModal open={isModalOpen} onOpenChange={setIsModalOpen} onSuccess={handleAgendar} />
    </>;
};
export default ServicoDetalhe;