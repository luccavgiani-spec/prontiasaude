import { useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
const PaymentModal = lazy(() => import("@/components/payment/PaymentModal").then(m => ({ default: m.PaymentModal })));
import { getHybridSession } from "@/lib/auth-hybrid";
import { checkPatientPlanActive } from "@/lib/patient-plan";
import { scheduleWithActivePlan } from "@/lib/schedule-service";
import { checkProfileComplete } from "@/lib/patients";
import { toast } from "sonner";
import { ArrowRight, CheckCircle } from "lucide-react";
export function HeroSection() {
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const navigate = useNavigate();
  const handleCTA = async () => {
    // ✅ CORREÇÃO: Usar sessão híbrida para detectar ambiente correto
    const { session, environment } = await getHybridSession();
    const user = session?.user;
    
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

    // Verificar se perfil está completo (com fallback cross-environment)
    const { profileComplete, patient } = await checkProfileComplete(user.id, user.email!, environment);
    
    if (!profileComplete) {
      localStorage.setItem('returnUrl', '/');
      localStorage.setItem('pendingService', JSON.stringify({
        sku: 'ITC6534',
        name: 'Pronto Atendimento',
        amount: 4390
      }));
      navigate('/completar-perfil');
      return;
    }

    // Verificar plano ativo
    const planStatus = await checkPatientPlanActive(user.email!);
    if (planStatus.canBypassPayment) {
      if (!patient || !patient.cpf || !patient.first_name || !patient.phone_e164 || !patient.gender) {
        toast.error('Complete seu cadastro antes de agendar');
        navigate('/completar-perfil');
        return;
      }

      // Mapear gender para 'M' ou 'F'
      const mapSexo = (g?: string) => g?.toUpperCase().startsWith('F') ? 'F' : 'M';
      toast('Redirecionando para agendamento...', {
        duration: 2000
      });
      const result = await scheduleWithActivePlan({
        cpf: patient.cpf,
        email: user.email!,
        nome: `${patient.first_name} ${patient.last_name || ''}`.trim(),
        telefone: patient.phone_e164,
        sku: 'ITC6534',
        plano_ativo: true,
        sexo: mapSexo(patient.gender)
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
  return <section className="hero-section relative bg-muted/30 overflow-hidden" style={{
    minHeight: '600px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }}>
      {/* Modern geometric background - Using transform for GPU acceleration to prevent CLS */}
      <div className="absolute inset-0 geometric-pattern" />
      <div className="absolute top-20 right-20 w-72 h-72 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-full blur-3xl" style={{
      transform: 'translate3d(0, 0, 0)',
      willChange: 'transform'
    }} />
      <div className="absolute bottom-32 left-16 w-56 h-56 bg-gradient-to-r from-accent/15 to-primary/15 rounded-full blur-2xl" style={{
      transform: 'translate3d(0, 0, 0)',
      willChange: 'transform'
    }} />
      
      <div className="container mx-auto px-4 py-6 md:py-10 relative z-10">
        <div className="grid lg:grid-cols-2 gap-8 md:gap-16 items-center min-h-[500px] md:min-h-[600px]">
          {/* Content Column */}
          <div className="space-y-6 md:space-y-10">
            {/* Modern badge with fixed height to prevent CLS */}
            <div className="inline-flex items-center gap-2 px-4 md:px-6 py-2 md:py-3 rounded-full bg-gradient-to-r from-primary/10 to-secondary/10 backdrop-blur-sm border border-primary/20 text-primary font-medium shadow-lg text-sm md:text-base" style={{
            height: '44px'
          }}>
              <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
              Plataforma Médica Certificada
            </div>
            
            {/* Modern headline */}
            <div className="space-y-3 md:space-y-6">
              <h1 className="text-3xl md:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight">
                <span className="text-foreground">Médico 24 horas por dia,</span>
                <br />
                <span className="text-foreground">consulta online imediata por apenas</span>
                <br />
                <span className="font-black text-4xl md:text-6xl lg:text-7xl xl:text-8xl text-green-600">R$39,90!</span>
              </h1>
              
              <p className="hero-subtitle text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-2xl leading-relaxed font-light">
                Cuidado imediato para quem precisa.<br />
                Evite filas, cuide da sua saúde de maneira segura, prática, com cuidado que vai além das telas!
              </p>
            </div>
            
            {/* Modern CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 md:gap-6 pt-2 md:pt-4" style={{
            minHeight: '56px'
          }}>
              <Button onClick={handleCTA} size="xl" className="bg-green-600 text-white border-green-600 hover:bg-green-700 text-base md:text-lg px-8 md:px-12 rounded-2xl shadow-2xl group hero-button" style={{
              height: '56px',
              minWidth: '220px'
            }}>
                Consulte Agora
                <ArrowRight className="ml-2 md:ml-3 w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-1 transition-transform" />
              </Button>
            </div>
            
            {/* Social proof removed */}
          </div>
          
          {/* Modern Image Column */}
          <div className="relative flex justify-center lg:justify-end">
            <div className="relative w-full" style={{
            width: '100%',
            maxWidth: '100%',
            minHeight: '288px',
            contain: 'layout'
          }}>
              {/* Enhanced background effects */}
              <div className="hidden sm:block absolute inset-0 bg-gradient-to-br from-primary/30 via-secondary/20 to-accent/20 rounded-3xl blur-3xl scale-110 pulse-glow" />
              
              {/* Modern doctor image container - NO animations on image */}
          <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl h-full">
            <div className="absolute inset-0 bg-gradient-to-t from-primary/20 via-transparent to-transparent z-10 pointer-events-none" />
            <picture className="hero-picture">
              {/* WebP otimizado com srcset responsivo */}
              <source 
                type="image/webp" 
                srcSet="/assets/hero-mobile-420.webp 420w, /assets/hero-tablet-768.webp 768w, /assets/hero-desktop-1600.webp 1600w" 
                sizes="(max-width: 600px) 100vw, (max-width: 1024px) 50vw, 800px" 
              />
              <img 
                src="/assets/hero-mobile-420.webp" 
                alt="Médico profissional sorridente em consulta online, pronto para atendê-lo com qualidade e empatia" 
                className="w-full h-full object-contain object-center" 
                width={672} 
                height={416} 
                loading="eager" 
                fetchPriority="high" 
                decoding="async" 
                style={{
                  aspectRatio: '672/416',
                  objectFit: 'contain',
                  maxHeight: '400px'
                }} 
              />
            </picture>
          </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal - lazy loaded to avoid vendor-mp in critical path */}
      <Suspense fallback={null}>
        <PaymentModal open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen} sku="ITC6534" serviceName="Pronto Atendimento" amount={3990} onSuccess={() => {}} />
      </Suspense>
    </section>;
}