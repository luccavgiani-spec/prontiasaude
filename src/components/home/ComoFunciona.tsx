import { Calendar, CreditCard, Video } from "lucide-react";

export function ComoFunciona() {
  const passos = [
    {
      icon: Calendar,
      titulo: "1. Escolha o Serviço",
      descricao: "Selecione o tipo de consulta ou serviço que precisa"
    },
    {
      icon: CreditCard,
      titulo: "2. Pague com Segurança",
      descricao: "Pagamento rápido e seguro através do Stripe"
    },
    {
      icon: Video,
      titulo: "3. Conecte-se Online",
      descricao: "Receba o link da consulta e conecte-se com o profissional"
    }
  ];

  return (
    <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Como Funciona
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Processo simples e rápido para conectar você aos melhores profissionais de saúde
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          {passos.map((passo, index) => (
            <div key={index} className="text-center">
              <div className="relative mb-6">
                {/* Linha conectora (apenas no desktop) */}
                {index < passos.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 left-full w-full h-0.5 bg-primary/20 -translate-y-1/2 z-0" />
                )}
                
                {/* Ícone */}
                <div className="relative z-10 inline-flex items-center justify-center w-16 h-16 bg-[var(--gradient-primary)] rounded-full mx-auto shadow-[var(--shadow-medical)]">
                  <passo.icon className="h-8 w-8 text-white" />
                </div>
              </div>

              <h3 className="text-xl font-semibold text-foreground mb-3">
                {passo.titulo}
              </h3>
              <p className="text-muted-foreground">
                {passo.descricao}
              </p>
            </div>
          ))}
        </div>

        {/* Mapa Mental Visual */}
        <div className="mt-16 bg-muted/30 rounded-2xl p-8">
          <h3 className="text-2xl font-bold text-center text-foreground mb-8">
            Fluxo Completo do Atendimento
          </h3>
          
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8 max-w-6xl mx-auto">
            {/* Nó 1 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                <span className="text-primary font-bold">1</span>
              </div>
              <span className="text-sm font-medium text-foreground">Escolha o serviço</span>
            </div>
            
            {/* Seta */}
            <div className="hidden md:block">
              <svg className="w-8 h-4 text-primary" viewBox="0 0 32 16" fill="currentColor">
                <path d="M24 0l8 8-8 8v-4H0V4h24V0z"/>
              </svg>
            </div>
            <div className="md:hidden">
              <svg className="w-4 h-8 text-primary" viewBox="0 0 16 32" fill="currentColor">
                <path d="M0 24l8 8 8-8h-4V0h-8v24H0z"/>
              </svg>
            </div>

            {/* Nó 2 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                <span className="text-primary font-bold">2</span>
              </div>
              <span className="text-sm font-medium text-foreground">Pagamento seguro</span>
            </div>

            {/* Seta */}
            <div className="hidden md:block">
              <svg className="w-8 h-4 text-primary" viewBox="0 0 32 16" fill="currentColor">
                <path d="M24 0l8 8-8 8v-4H0V4h24V0z"/>
              </svg>
            </div>
            <div className="md:hidden">
              <svg className="w-4 h-8 text-primary" viewBox="0 0 16 32" fill="currentColor">
                <path d="M0 24l8 8 8-8h-4V0h-8v24H0z"/>
              </svg>
            </div>

            {/* Nó 3 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                <span className="text-primary font-bold">3</span>
              </div>
              <span className="text-sm font-medium text-foreground">Link do Teams</span>
            </div>

            {/* Seta */}
            <div className="hidden md:block">
              <svg className="w-8 h-4 text-primary" viewBox="0 0 32 16" fill="currentColor">
                <path d="M24 0l8 8-8 8v-4H0V4h24V0z"/>
              </svg>
            </div>
            <div className="md:hidden">
              <svg className="w-4 h-8 text-primary" viewBox="0 0 16 32" fill="currentColor">
                <path d="M0 24l8 8 8-8h-4V0h-8v24H0z"/>
              </svg>
            </div>

            {/* Nó 4 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                <span className="text-primary font-bold">4</span>
              </div>
              <span className="text-sm font-medium text-foreground">Teleconsulta</span>
            </div>

            {/* Seta */}
            <div className="hidden md:block">
              <svg className="w-8 h-4 text-primary" viewBox="0 0 32 16" fill="currentColor">
                <path d="M24 0l8 8-8 8v-4H0V4h24V0z"/>
              </svg>
            </div>
            <div className="md:hidden">
              <svg className="w-4 h-8 text-primary" viewBox="0 0 16 32" fill="currentColor">
                <path d="M0 24l8 8 8-8h-4V0h-8v24H0z"/>
              </svg>
            </div>

            {/* Nó 5 */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                <span className="text-primary font-bold">5</span>
              </div>
              <span className="text-sm font-medium text-foreground">Pós-consulta</span>
            </div>
          </div>
        </div>

        {/* Imagem do médico online */}
        <div className="mt-16 text-center">
          <img 
            src="/src/assets/doctor-online-consultation.jpg" 
            alt="Médico realizando consulta online pelo computador"
            className="rounded-2xl shadow-[var(--shadow-medical)] mx-auto max-w-2xl w-full h-auto"
            loading="lazy"
          />
          <p className="text-muted-foreground mt-4 text-lg">
            Atendimento profissional no conforto da sua casa
          </p>
        </div>
      </div>
    </section>
  );
}