import prontiaLogo from "@/assets/prontia-icon-misto.webp";
import prontiaIcon from "@/assets/prontia-icon-misto.webp";
import { formatPlanName } from "@/lib/patient-plan";
import { RefreshCw, Calendar } from "lucide-react";

interface PlanCardProps {
  patientName: string;
  planCode: string;
  planCreatedAt: string;
  cpf: string;
  isRecurring?: boolean;
  nextPaymentDate?: string;
}

export const PlanCard = (props: PlanCardProps) => {
  const formatInscriptionDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatNextPayment = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div 
        className="relative w-full overflow-hidden rounded-2xl shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, hsl(172, 100%, 23%) 0%, hsl(172, 80%, 30%) 50%, hsl(172, 100%, 23%) 100%)'
        }}
      >
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#fbaa03] rounded-full blur-3xl opacity-20" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#fbaa03] rounded-full blur-3xl opacity-10" />
        </div>
        
        <div className="relative z-10 p-4 md:p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <img 
              src={prontiaLogo}
              alt="Prontia Saúde"
              className="w-32 md:w-40 h-auto object-contain"
            />
            <div className="text-right">
              <div className="text-xs md:text-sm font-medium" style={{ color: '#fbaa03' }}>Plano de Saúde</div>
              <div className="text-base md:text-lg font-bold">Plano Ativo</div>
              {props.isRecurring && (
                <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: '#fbaa03' }}>
                  <RefreshCw className="w-3 h-3" />
                  Renovação Automática
                </div>
              )}
            </div>
          </div>

          <div className="w-full h-[2px] mb-2" style={{
            background: 'linear-gradient(90deg, #fbaa03 0%, rgba(251,170,3,0.3) 50%, #fbaa03 100%)'
          }} />

          <div className="space-y-4">
            <div className="mb-4">
              <div className="text-xs md:text-sm font-medium opacity-80 mb-1">Nome do Titular</div>
              <div className="text-lg md:text-xl font-bold">{props.patientName}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs md:text-sm font-medium opacity-80 mb-1">Plano</div>
                <div className="text-sm md:text-base font-semibold">{formatPlanName(props.planCode)}</div>
              </div>
              
              <div>
                <div className="text-xs md:text-sm font-medium opacity-80 mb-1">CPF</div>
                <div className="text-sm md:text-base font-semibold">
                  {props.cpf && props.cpf.length >= 11 
                    ? props.cpf.replace(/\D/g, '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
                    : 'Não informado'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs md:text-sm font-medium opacity-80 mb-1">Data de Inscrição</div>
                <div className="text-sm md:text-base font-semibold">{formatInscriptionDate(props.planCreatedAt)}</div>
              </div>
              
              {props.isRecurring && props.nextPaymentDate && (
                <div>
                  <div className="text-xs md:text-sm font-medium opacity-80 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> Próxima Cobrança
                  </div>
                  <div className="text-sm md:text-base font-semibold">{formatNextPayment(props.nextPaymentDate)}</div>
                </div>
              )}
            </div>
          </div>

          <img 
            src={prontiaIcon} 
            alt="Prontia" 
            className="absolute bottom-4 right-4 w-24 h-24 md:w-28 md:h-28"
          />
        </div>
      </div>
    </div>
  );
};
