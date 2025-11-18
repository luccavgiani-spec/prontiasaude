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
              className="w-52 md:w-64 h-auto object-contain"
            />
            <div className="text-right">
              <div className="text-xs md:text-sm font-medium" style={{ color: '#fbaa03' }}>Plano de Saúde</div>
              <div className="text-base md:text-lg font-bold">Plano Ativo</div>
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

          <div className="absolute bottom-4 right-4 w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center" 
            style={{ 
              background: 'linear-gradient(135deg, #fbaa03 0%, rgba(251,170,3,0.8) 100%)',
              boxShadow: '0 4px 12px rgba(251,170,3,0.3)'
            }}
          >
            <img 
              src="/favicon.png" 
              alt="Prontia" 
              className="w-8 h-8 md:w-10 md:h-10"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
