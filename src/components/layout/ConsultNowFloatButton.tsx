import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Stethoscope, Clock, Users, MessageCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PaymentModal } from '@/components/payment/PaymentModal';
import { CATALOGO_SERVICOS } from '@/lib/constants';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
const ConsultNowFloatButton = () => {
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Get Pronto Atendimento service
  const prontoAtendimento = CATALOGO_SERVICOS.find(s => s.slug === 'consulta');
  const handleConsultNow = async () => {
    if (!prontoAtendimento) return;
    setIsLoading(true);
    try {
      // 1. Verificar se usuário está logado
      const {
        data: {
          user
        }
      } = await supabase.auth.getUser();
      if (!user) {
        // Salvar returnUrl e serviço pendente
        localStorage.setItem('returnUrl', window.location.pathname);
        localStorage.setItem('pendingService', JSON.stringify({
          sku: prontoAtendimento.sku,
          name: prontoAtendimento.nome,
          amount: Math.round(prontoAtendimento.precoBase * 100)
        }));
        setIsChatOpen(false);
        navigate('/area-do-paciente');
        return;
      }

      // 2. Verificar se perfil está completo
      const {
        data: patient
      } = await supabase.from('patients').select('profile_complete, cpf, first_name, last_name, phone_e164, gender').eq('id', user.id).maybeSingle();
      if (!patient?.profile_complete) {
        localStorage.setItem('returnUrl', window.location.pathname);
        localStorage.setItem('pendingService', JSON.stringify({
          sku: prontoAtendimento.sku,
          name: prontoAtendimento.nome,
          amount: Math.round(prontoAtendimento.precoBase * 100)
        }));
        setIsChatOpen(false);
        navigate('/completar-perfil');
        return;
      }

      // 3. Verificar se tem plano ativo
      const {
        checkPatientPlanActive
      } = await import('@/lib/patient-plan');
      const planStatus = await checkPatientPlanActive(user.email!);
      if (planStatus.canBypassPayment) {
        // ✅ COM PLANO ATIVO: Redirecionar direto para agendamento
        if (!patient.cpf || !patient.first_name || !patient.phone_e164 || !patient.gender) {
          toast('Complete seu cadastro antes de agendar');
          setIsChatOpen(false);
          navigate('/completar-perfil');
          return;
        }
        const mapSexo = (g?: string) => g?.toUpperCase().startsWith('F') ? 'F' : 'M';
        toast('Redirecionando para agendamento...', {
          duration: 2000
        });
        const {
          scheduleWithActivePlan
        } = await import('@/lib/schedule-service');
        const result = await scheduleWithActivePlan({
          cpf: patient.cpf,
          email: user.email!,
          nome: `${patient.first_name} ${patient.last_name || ''}`.trim(),
          telefone: patient.phone_e164,
          sku: prontoAtendimento.sku,
          plano_ativo: true,
          sexo: mapSexo(patient.gender)
        });
        if (result.ok && result.url) {
          setIsChatOpen(false);
          window.location.href = result.url;
        } else {
          toast.error(result.error || 'Erro ao agendar');
        }
        return;
      }

      // ❌ SEM PLANO: Abrir modal de pagamento
      setIsChatOpen(false);
      setShowPaymentModal(true);
    } catch (error) {
      console.error('Erro ao processar consulta:', error);
      toast.error('Erro ao processar. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };
  const floatButton = <>
      {/* Float Button - above WhatsApp (bottom-6 + h-16 + gap = ~28) */}
      <button onClick={() => setIsChatOpen(true)} className="fixed bottom-28 right-6 z-[9999] flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-2xl transition-all duration-300 hover:scale-110 hover:shadow-[0_20px_40px_rgba(0,118,106,0.4)] animate-pulse hover:animate-none" aria-label="Consulte agora">
        <Stethoscope className="h-7 w-7 text-primary-foreground" />
      </button>

      {/* Chat Modal */}
      {isChatOpen && <div className="fixed bottom-28 right-6 z-[10000] w-80 max-w-[calc(100vw-3rem)] animate-in slide-in-from-bottom-4 fade-in duration-300">
          <div className="bg-card rounded-2xl shadow-2xl border border-border overflow-hidden">
            {/* Header */}
            <div className="bg-primary px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary-foreground/20 rounded-full flex items-center justify-center">
                  <Stethoscope className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-primary-foreground font-semibold text-sm">Prontia Saúde</h3>
                  <span className="text-primary-foreground/80 text-xs flex items-center gap-1">
                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                    Online agora
                  </span>
                </div>
              </div>
              <button onClick={() => setIsChatOpen(false)} className="text-primary-foreground/80 hover:text-primary-foreground transition-colors" aria-label="Fechar chat">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Chat Content */}
            <div className="p-4 bg-muted/30">
              {/* Automated Message */}
              <div className="bg-card rounded-xl p-4 shadow-sm border border-border">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Stethoscope className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-accent" />
                        Fila de espera estimada: <span className="font-semibold text-foreground">3 minutos</span>
                      </p>
                      <p className="flex items-center gap-2">Atendimento 24h por dia<Users className="h-4 w-4 text-primary" />
                        Atendimento 24h por dia
                      </p>
                    </div>
                  </div>
                </div>

                {/* Price Tag */}
                <div className="bg-primary/5 rounded-lg p-3 mb-4 border border-primary/10">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Consulta online</span>
                    <span className="text-lg font-bold text-primary">
                      R$ {prontoAtendimento?.precoBase.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>

                {/* CTA Button */}
                <Button onClick={handleConsultNow} disabled={isLoading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all" size="lg">
                  {isLoading ? <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Carregando...
                    </> : <>
                      <MessageCircle className="h-5 w-5 mr-2" />
                      Consulte agora
                    </>}
                </Button>
              </div>
            </div>
          </div>
        </div>}
    </>;
  return <>
      {createPortal(floatButton, document.body)}
      
      {/* Payment Modal */}
      {showPaymentModal && prontoAtendimento && <PaymentModal open={showPaymentModal} onOpenChange={setShowPaymentModal} serviceName={prontoAtendimento.nome} amount={Math.round(prontoAtendimento.precoBase * 100)} sku={prontoAtendimento.sku} />}
    </>;
};
export default ConsultNowFloatButton;