import { formatCPF } from "@/lib/cpf-validator";
import { formatPlanName } from "@/lib/patient-plan";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle } from "lucide-react";
import prontiaLogo from "@/assets/prontia-logo-horizontal-misto.webp";

interface PlanCardProps {
  patientName: string;
  planCode: string;
  planCreatedAt: string;
  cpf: string;
}

export const PlanCard = ({ patientName, planCode, planCreatedAt, cpf }: PlanCardProps) => {
  const formatInscriptionDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd/MM/yyyy", { locale: ptBR });
    } catch {
      return "Data não disponível";
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Container da carteirinha */}
      <div 
        className="relative overflow-hidden rounded-xl shadow-2xl"
        style={{
          background: "linear-gradient(135deg, #00766A 0%, #009688 50%, #00766A 100%)",
          border: "1px solid rgba(255, 255, 255, 0.2)"
        }}
      >
        {/* Barra superior colorida */}
        <div 
          className="h-2 md:h-3"
          style={{
            background: "linear-gradient(90deg, #DE6545 0%, #FBAA03 100%)"
          }}
        />

        {/* Conteúdo principal */}
        <div className="relative p-6 md:p-8">
          {/* Header: Logo + Título */}
          <div className="flex items-start justify-between mb-3">
            <img 
              src={prontiaLogo}
              alt="Prontìa Saúde"
              className="w-32 md:w-40 h-auto object-contain"
              loading="lazy"
            />
            <p className="text-xs md:text-sm text-white/80 uppercase tracking-wide font-semibold text-right">
              Carteirinha de<br />Plano de Saúde
            </p>
          </div>

          {/* Linha divisória */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/30 to-transparent mb-6" />

          {/* Nome do Titular */}
          <div className="mb-6">
            <p className="text-xs text-white/70 mb-1 uppercase tracking-wide">Nome do Titular</p>
            <p className="text-2xl md:text-3xl font-bold text-white tracking-wide">
              {patientName.toUpperCase()}
            </p>
          </div>

          {/* Grid de informações (2 colunas) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* Tipo de Plano */}
            <div>
              <p className="text-xs text-white/70 mb-1 uppercase tracking-wide">Plano</p>
              <p className="text-base md:text-lg font-semibold text-white">
                {formatPlanName(planCode)}
              </p>
            </div>

            {/* CPF */}
            <div>
              <p className="text-xs text-white/70 mb-1 uppercase tracking-wide">CPF</p>
              <p className="text-base md:text-lg font-mono font-semibold text-white">
                {formatCPF(cpf)}
              </p>
            </div>

            {/* Data de Inscrição */}
            <div>
              <p className="text-xs text-white/70 mb-1 uppercase tracking-wide">Inscrito em</p>
              <p className="text-base md:text-lg font-medium text-white">
                {formatInscriptionDate(planCreatedAt)}
              </p>
            </div>

            {/* Status */}
            <div>
              <p className="text-xs text-white/70 mb-1 uppercase tracking-wide">Status</p>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-300" />
                <span className="text-base md:text-lg font-semibold text-green-300">
                  Plano Ativo
                </span>
              </div>
            </div>
          </div>

          {/* Favicon no canto inferior direito */}
          <img 
            src="/favicon.png"
            alt="Prontìa"
            className="absolute bottom-4 right-4 h-8 w-8 md:h-10 md:w-10 opacity-60"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
};
