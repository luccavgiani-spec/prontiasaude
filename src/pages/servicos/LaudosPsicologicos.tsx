import { Link, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { PaymentModal } from "@/components/payment/PaymentModal";
import { CATALOGO_SERVICOS } from "@/lib/constants";
import { formataPreco } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, Star, Shield } from "lucide-react";
import { trackViewContent, trackLead } from "@/lib/meta-tracking";
import { supabase } from "@/integrations/supabase/client";

export default function LaudosPsicologicos() {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const servico = CATALOGO_SERVICOS.find(s => s.slug === 'laudos_psicologicos');

  useEffect(() => {
    if (servico) {
      trackViewContent({
        content_name: servico.nome,
        content_category: 'Serviços',
        content_ids: [servico.slug],
        value: servico.precoBase / 100
      });
    }
  }, [servico]);

  if (!servico) {
    return (
      <div className="py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-4">Serviço não encontrado</h1>
          <Button asChild><Link to="/servicos">Ver Todos os Serviços</Link></Button>
        </div>
      </div>
    );
  }

  const handleAgendar = async () => {
    trackLead({
      value: servico.precoBase / 100,
      content_name: servico.nome
    });

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      const pendingService = {
        sku: servico.sku,
        serviceName: servico.nome,
        amount: servico.precoBase,
        especialidade: servico.nome,
        timestamp: Date.now()
      };
      localStorage.setItem('pendingService', JSON.stringify(pendingService));
      navigate('/area-do-paciente');
      return;
    }

    const { data: patient } = await supabase
      .from('patients')
      .select('profile_complete')
      .eq('id', user.id)
      .maybeSingle();

    if (!patient?.profile_complete) {
      const pendingService = {
        sku: servico.sku,
        serviceName: servico.nome,
        amount: servico.precoBase,
        especialidade: servico.nome,
        timestamp: Date.now()
      };
      localStorage.setItem('pendingService', JSON.stringify(pendingService));
      navigate('/completar-perfil');
      return;
    }

    // ✅ EXCEÇÃO: Laudos psicológicos SEMPRE cobram, mesmo com plano ativo
    // Motivo: Exame específico não incluso no plano padrão
    const { checkPatientPlanActive } = await import('@/lib/patient-plan');
    const planStatus = await checkPatientPlanActive(user.email!);

    // Laudos psicológicos não permitem bypass de pagamento
    if (false && planStatus.canBypassPayment) { // Desabilitado para laudos
      const { data: patient } = await supabase
        .from('patients')
        .select('cpf, first_name, last_name, phone_e164, gender')
        .eq('id', user.id)
        .maybeSingle();

      if (!patient || !patient.cpf || !patient.first_name || !patient.phone_e164 || !patient.gender) {
        toast({ description: 'Complete seu cadastro antes de agendar', variant: 'destructive' });
        navigate('/completar-perfil');
        return;
      }

      const mapSexo = (g?: string) => g?.toUpperCase().startsWith('F') ? 'F' : 'M';
      toast({ description: 'Redirecionando para agendamento...', duration: 2000 });

      const { scheduleWithActivePlan } = await import('@/lib/schedule-service');
      const result = await scheduleWithActivePlan({
        cpf: patient.cpf,
        email: user.email!,
        nome: `${patient.first_name} ${patient.last_name || ''}`.trim(),
        telefone: patient.phone_e164,
        especialidade: servico.nome,
        sku: servico.sku,
        plano_ativo: true,
        sexo: mapSexo(patient.gender)
      });

      if (result.ok && result.url) {
        window.location.href = result.url;
      } else {
        toast({ description: result.error || 'Erro ao agendar', variant: 'destructive' });
      }
      return;
    }

    setIsPaymentModalOpen(true);
  };

  return (
    <>
      <div className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-8">
            <Link to="/servicos" className="inline-flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors mb-4">
              <ArrowLeft className="h-4 w-4" />
              Voltar aos serviços
            </Link>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">{servico.nome}</h1>
              <p className="text-xl text-muted-foreground mb-8">Necessário consulta prévia com psicólogo.</p>

              <div className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">O que está incluso:</h2>
                <ul className="space-y-3">
                  {servico.inclui.map((item, index) => (
                    <li key={index} className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                      <span className="text-muted-foreground">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Como funciona - EXCLUSIVO DA PÁGINA LAUDOS PSICOLÓGICOS */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-foreground mb-4">Como funciona:</h2>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">1</div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">Avaliação online</h3>
                      <p className="text-muted-foreground">Primeiro, o paciente realiza uma avaliação online com um de nossos psicólogos credenciados</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">2</div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">Análise e aprovação</h3>
                      <p className="text-muted-foreground">O profissional avalia a necessidade e, se estiver tudo de acordo, autoriza a emissão do laudo</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0">3</div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">Emissão do laudo</h3>
                      <p className="text-muted-foreground">Com a aprovação, o laudo psicológico é elaborado e enviado ao paciente, pronto para ser utilizado em procedimentos como cirurgia bariátrica, laqueadura, ou vasectomia.</p>
                    </div>
                  </div>
                </div>
              </div>

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

            <div className="lg:sticky lg:top-24">
              <div className="medical-card p-6">
                <div className="text-center mb-6">
                  <div className="text-3xl font-bold text-foreground mb-2">
                    {formataPreco(servico.precoBase)}
                  </div>
                  <p className="text-muted-foreground">Pagamento único</p>
                </div>

                <Button
                  onClick={handleAgendar}
                  variant="outline"
                  size="lg"
                  className="bg-green-600 text-white border-green-600 hover:bg-green-700 w-full mb-4"
                  data-sku={servico.sku}
                >
                  Agendar agora
                </Button>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground mb-2">Pagamento seguro e criptografado</p>
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

      <PaymentModal
        open={isPaymentModalOpen}
        onOpenChange={setIsPaymentModalOpen}
        sku={servico.sku}
        serviceName={servico.nome}
        amount={Math.round(servico.precoBase * 100)}
        especialidade={servico.nome}
        onSuccess={() => {
          setIsPaymentModalOpen(false);
          
          // ✅ Redirecionar para WhatsApp APENAS após pagamento aprovado
          const message = encodeURIComponent("Olá! Gostaria de agendar uma consulta para emissão de laudo psicológico.");
          const whatsappUrl = `https://wa.me/5511933359187?text=${message}`;
          
          console.log('[Laudo] Redirecting to WhatsApp after approval:', whatsappUrl);
          
          toast({ 
            title: "Pagamento aprovado!", 
            description: "Redirecionando para WhatsApp em 2 segundos...",
            duration: 3000
          });
          
          setTimeout(() => {
            window.location.href = whatsappUrl;
          }, 2000);
        }}
      />
    </>
  );
}
