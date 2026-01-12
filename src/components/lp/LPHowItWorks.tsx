import { UserPlus, CreditCard, Video } from "lucide-react";

const LPHowItWorks = () => {
  const steps = [
    {
      number: 1,
      icon: UserPlus,
      title: "Faça seu cadastro",
      description:
        "Cadastre-se em nossa plataforma de forma rápida e simples, sem burocracia.",
      image:
        "https://prontia-landing-page-publicada.vercel.app/assets/step-cadastro-BPDbVjd0.png",
    },
    {
      number: 2,
      icon: CreditCard,
      title: "Realize o pagamento",
      description:
        "Pague de forma segura com cartão de crédito ou PIX. Processo 100% online.",
      image:
        "https://prontia-landing-page-publicada.vercel.app/assets/step-pagamento-BPDbVjd0.png",
    },
    {
      number: 3,
      icon: Video,
      title: "Inicie sua consulta",
      description:
        "Conecte-se com um médico disponível e inicie sua consulta por vídeo.",
      image:
        "https://prontia-landing-page-publicada.vercel.app/assets/step-iniciar-consulta-BPDbVjd0.png",
    },
  ];

  return (
    <section className="py-12 md:py-20 bg-muted/30">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-10 md:mb-14">
          <span className="text-primary font-semibold text-sm tracking-wider uppercase">
            Simples e Rápido
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-2">
            Como Funciona?
          </h2>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 md:gap-6">
          {steps.map((step, index) => (
            <div
              key={index}
              className="relative bg-card rounded-2xl p-6 md:p-8 shadow-sm hover:shadow-lg transition-all duration-300 border border-border/50"
            >
              {/* Step Number */}
              <div className="absolute -top-4 left-6 w-10 h-10 rounded-full bg-primary text-white font-bold flex items-center justify-center shadow-lg">
                {step.number}
              </div>

              {/* Content */}
              <div className="mt-4 space-y-4">
                <div className="flex items-center gap-3">
                  <step.icon className="w-6 h-6 text-primary" />
                  <h3 className="text-xl font-semibold text-foreground">
                    {step.title}
                  </h3>
                </div>
                <p className="text-muted-foreground">{step.description}</p>

                {/* Step Image */}
                <div className="mt-4 rounded-lg overflow-hidden bg-muted/50">
                  <img
                    src={step.image}
                    alt={step.title}
                    className="w-full h-auto object-contain"
                    loading="lazy"
                  />
                </div>
              </div>

              {/* Connector line for desktop */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-3 w-6 h-0.5 bg-primary/30" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LPHowItWorks;
