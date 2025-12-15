import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Stethoscope, Clock, Users, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PaymentModal } from '@/components/payment/PaymentModal';
import { CATALOGO_SERVICOS } from '@/lib/constants';

const ConsultNowFloatButton = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Get Pronto Atendimento service
  const prontoAtendimento = CATALOGO_SERVICOS.find(s => s.slug === 'consulta');

  const handleConsultNow = () => {
    setIsChatOpen(false);
    setShowPaymentModal(true);
  };

  const floatButton = (
    <>
      {/* Float Button - above WhatsApp (bottom-6 + h-16 + gap = ~28) */}
      <button
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-28 right-6 z-[9999] flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-2xl transition-all duration-300 hover:scale-110 hover:shadow-[0_20px_40px_rgba(0,118,106,0.4)] animate-pulse hover:animate-none"
        aria-label="Consulte agora"
      >
        <Stethoscope className="h-7 w-7 text-primary-foreground" />
      </button>

      {/* Chat Modal */}
      {isChatOpen && (
        <div className="fixed bottom-28 right-6 z-[10000] w-80 max-w-[calc(100vw-3rem)] animate-in slide-in-from-bottom-4 fade-in duration-300">
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
              <button
                onClick={() => setIsChatOpen(false)}
                className="text-primary-foreground/80 hover:text-primary-foreground transition-colors"
                aria-label="Fechar chat"
              >
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
                    <p className="text-foreground font-medium text-sm mb-1">
                      Médico disponível agora! 🩺
                    </p>
                    <div className="space-y-2 text-sm text-muted-foreground">
                      <p className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-accent" />
                        Fila de espera estimada: <span className="font-semibold text-foreground">3 minutos</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
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
                <Button 
                  onClick={handleConsultNow}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all"
                  size="lg"
                >
                  <MessageCircle className="h-5 w-5 mr-2" />
                  Consulte agora
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <>
      {createPortal(floatButton, document.body)}
      
      {/* Payment Modal */}
      {showPaymentModal && prontoAtendimento && (
        <PaymentModal
          open={showPaymentModal}
          onOpenChange={setShowPaymentModal}
          serviceName={prontoAtendimento.nome}
          amount={prontoAtendimento.precoBase}
          sku={prontoAtendimento.sku}
        />
      )}
    </>
  );
};

export default ConsultNowFloatButton;
