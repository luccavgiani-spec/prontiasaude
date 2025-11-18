import { formatCPF } from "@/lib/validations";
import { formatPlanName } from "@/lib/patient-plan";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { CheckCircle } from "lucide-react";

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
    <div className="w-full">
      <div 
        className="relative overflow-hidden rounded-2xl shadow-lg"
        style={{
          background: "linear-gradient(135deg, #00766A 0%, #005550 100%)"
        }}
      >
        {/* Pattern decorativo sutil */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(239, 227, 213, 0.1) 35px, rgba(239, 227, 213, 0.1) 70px)`
          }}
        />

        {/* Conteúdo principal */}
        <div className="relative z-10 p-6 md:p-8">
          <div className="grid md:grid-cols-[200px_1fr] gap-6 md:gap-8 items-center">
            
            {/* Coluna Esquerda: Logo */}
            <div className="flex justify-center md:justify-start">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-xl bg-white/10 backdrop-blur-sm p-4 flex items-center justify-center">
                <img 
                  src="/assets/prontia-logo-branca-200.avif"
                  alt="Prontìa Saúde"
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              </div>
            </div>

            {/* Coluna Direita: Dados do paciente */}
            <div className="space-y-4 text-white">
              {/* Selo "Carteirinha do Plano" */}
              <div className="inline-block mb-2">
                <span 
                  className="text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ backgroundColor: "#FBAA03", color: "#1a1a1a" }}
                >
                  Carteirinha do Plano Prontìa Saúde
                </span>
              </div>

              {/* Nome do paciente */}
              <div>
                <p className="text-sm text-white/70 mb-1">Nome do Titular</p>
                <p className="text-xl md:text-2xl font-bold tracking-wide">
                  {patientName.toUpperCase()}
                </p>
              </div>

              {/* Grid de informações */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {/* Tipo de Plano */}
                <div>
                  <p className="text-xs text-white/70 mb-1">Tipo de Plano</p>
                  <p className="text-base md:text-lg font-semibold" style={{ color: "#DE6545" }}>
                    {formatPlanName(planCode)}
                  </p>
                </div>

                {/* Data de Inscrição */}
                <div>
                  <p className="text-xs text-white/70 mb-1">Inscrito em</p>
                  <p className="text-base md:text-lg font-medium">
                    {formatInscriptionDate(planCreatedAt)}
                  </p>
                </div>

                {/* CPF */}
                <div>
                  <p className="text-xs text-white/70 mb-1">CPF</p>
                  <p className="text-base md:text-lg font-mono">
                    {formatCPF(cpf)}
                  </p>
                </div>

                {/* Status */}
                <div className="flex items-end">
                  <Badge 
                    className="bg-green-500/20 text-green-200 border-green-300/30 hover:bg-green-500/30"
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Plano Ativo
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Barra inferior decorativa */}
        <div 
          className="h-2"
          style={{
            background: "linear-gradient(90deg, #DE6545 0%, #FBAA03 100%)"
          }}
        />
      </div>
    </div>
  );
};
