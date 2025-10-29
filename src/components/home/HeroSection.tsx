import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PaymentModal } from "@/components/payment/PaymentModal";
import { supabase } from "@/integrations/supabase/client";
import { checkPatientPlanActive } from "@/lib/patient-plan";
import { scheduleWithActivePlan } from "@/lib/schedule-service";
import { toast } from "sonner";
import heroImage from "@/assets/hero-doctor-realistic.jpg";
import { ArrowRight, CheckCircle } from "lucide-react";
export function HeroSection() {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const navigate = useNavigate();
  
  const handleCTA = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      localStorage.setItem('returnUrl', '/');
      localStorage.setItem('pendingService', JSON.stringify({
        sku: 'ITC6534',
        name: 'Pronto Atendimento',
        amount: 4390
      }));
      navigate('/area-do-paciente');
      return;
    }
    
    // Verificar plano ativo
    const planStatus = await checkPatientPlanActive(user.email!);
    
    if (planStatus.canBypassPayment) {
      // Tem plano ativo: buscar dados e agendar direto
      toast('Redirecionando para agendamento...', { duration: 2000 });
      
      const { data: patient } = await supabase
        .from('patients')
        .select('cpf, first_name, last_name, phone_e164')
        .eq('id', user.id)
        .maybeSingle();
      
      const result = await scheduleWithActivePlan({
        cpf: patient?.cpf || '',
        email: user.email!,
        nome: patient ? `${patient.first_name || ''} ${patient.last_name || ''}`.trim() : '',
        telefone: patient?.phone_e164 || '',
        sku: 'ITC6534',
        plano_ativo: true
      });
      
      if (result.ok && result.url) {
        window.location.href = result.url;
      } else {
        toast.error(result.error || 'Erro ao agendar');
      }
      return;
    }
    
    // Sem plano: abrir checkout
    setIsPaymentModalOpen(true);
  };
  
  const scrollToServicos = () => {
    const element = document.getElementById('servicos');
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth'
      });
    }
  };

  const scrollToComoFunciona = () => {
    const element = document.querySelector('section[class*="py-10"][class*="bg-gradient-to-br"]');
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth'
      });
    }
  };
  return <section className="relative min-h-[500px] md:min-h-[700px] bg-gradient-to-br from-background via-primary-light/20 to-background overflow-hidden">
      {/* Modern geometric background */}
      <div className="absolute inset-0 geometric-pattern" />
      <div className="absolute top-20 right-20 w-72 h-72 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-full blur-3xl floating-animation" />
      <div className="absolute bottom-32 left-16 w-56 h-56 bg-gradient-to-r from-accent/15 to-primary/15 rounded-full blur-2xl floating-animation" style={{
      animationDelay: '2s'
    }} />
      
      <div className="container mx-auto px-4 py-6 md:py-10 relative z-10">
        <div className="grid lg:grid-cols-2 gap-8 md:gap-16 items-center min-h-[500px] md:min-h-[600px]">
          {/* Content Column */}
          <div className="space-y-6 md:space-y-10">
            {/* Modern badge */}
            <div className="inline-flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 rounded-full bg-gradient-to-r from-primary/10 to-secondary/10 backdrop-blur-sm border border-primary/20 text-primary font-medium shadow-lg text-sm md:text-base">
              <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
              Plataforma Médica Certificada
            </div>
            
            {/* Modern headline */}
            <div className="space-y-3 md:space-y-6">
              <h1 className="text-3xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight animate-fade-in">
                <span className="text-foreground">Médico 24 horas por dia,</span>
                <br />
                <span className="text-foreground">consulta imediata por apenas</span>
                <br />
                <span className="font-black text-4xl md:text-6xl lg:text-7xl xl:text-8xl text-primary">
                  R$13,99!
                </span>
              </h1>
              
              <p className="hero-subtitle text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-2xl leading-relaxed font-light animate-fade-in delay-200">
                Cuidado imediato para quem precisa.<br />
                Evite filas, cuide da sua saúde de maneira segura, prática, com cuidado que vai além das telas!
              </p>
            </div>
            
            {/* Modern CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 md:gap-6 pt-2 md:pt-4 animate-fade-in delay-400">
              <Button onClick={handleCTA} size="xl" className="medical-button-primary text-base md:text-lg px-8 md:px-12 py-4 md:py-8 rounded-2xl shadow-2xl group">
                Consulte Agora
                <ArrowRight className="ml-2 md:ml-3 w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
            
            {/* Social proof removed */}
          </div>
          
          {/* Modern Image Column */}
          <div className="relative flex justify-center lg:justify-end animate-fade-in delay-600">
            <div className="relative">
              {/* Enhanced background effects */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/30 via-secondary/20 to-accent/20 rounded-3xl blur-3xl scale-110 pulse-glow" />
              
              {/* Modern doctor image container */}
              <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl transform hover:scale-105 transition-all duration-700 hover:rotate-1">
                <div className="absolute inset-0 bg-gradient-to-t from-primary/20 via-transparent to-transparent z-10" />
                <img 
                  src={heroImage}
                  alt="Médico especialista em telemedicina realizando consulta online"
                  width="512"
                  height="682"
                  loading="eager"
                  className="w-full max-w-lg h-auto object-cover"
                />
              </div>
              
              {/* Modern floating badges */}
              
              
              
              
              
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      <PaymentModal
        open={isPaymentModalOpen}
        onOpenChange={setIsPaymentModalOpen}
        sku="ITC6534"
        serviceName="Pronto Atendimento"
        amount={4390}
        onSuccess={() => window.location.href = '/confirmacao/ITC6534'}
      />
    </section>;
}