import prontiaLogo from "@/assets/prontia-logo-horizontal-verde.webp";

interface PlanCardProps {
  patientName: string;
  planCode: string;
  planCreatedAt: string;
  cpf: string;
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

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div 
        className="relative w-full overflow-hidden rounded-2xl shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, hsl(172, 100%, 23%) 0%, hsl(172, 100%, 28%) 100%)'
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary to-primary-glow/80" />
        
        <div className="relative z-10 p-4 md:p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <img 
              src={prontiaLogo}
              alt="Prontia Saúde"
              className="w-40 md:w-48 h-auto object-contain"
            />
            <div className="text-right">
              <div className="text-xs md:text-sm font-medium opacity-90">Plano de Saúde</div>
              <div className="text-base md:text-lg font-bold">Plano Ativo</div>
            </div>
          </div>

          <div className="w-full h-[1px] bg-white/30 mb-2" />

          <div className="space-y-4">
            <div className="mb-4">
              <div className="text-xs md:text-sm font-medium opacity-80 mb-1">Nome do Titular</div>
              <div className="text-lg md:text-xl font-bold">{props.patientName}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs md:text-sm font-medium opacity-80 mb-1">Código do Plano</div>
                <div className="text-sm md:text-base font-semibold">{props.planCode}</div>
              </div>
              
              <div>
                <div className="text-xs md:text-sm font-medium opacity-80 mb-1">CPF</div>
                <div className="text-sm md:text-base font-semibold">
                  {props.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs md:text-sm font-medium opacity-80 mb-1">Data de Inscrição</div>
              <div className="text-sm md:text-base font-semibold">{formatInscriptionDate(props.planCreatedAt)}</div>
            </div>
          </div>

          <img 
            src="/favicon.png" 
            alt="Prontia" 
            className="absolute bottom-4 right-4 h-8 w-8 md:h-10 md:w-10 opacity-70"
          />
        </div>
      </div>
    </div>
  );
};
