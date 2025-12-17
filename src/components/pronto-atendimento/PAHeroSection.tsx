import { Button } from "@/components/ui/button";
import { Stethoscope, ClipboardList, CreditCard, Users } from "lucide-react";

const benefits = [
  { icon: Stethoscope, label: "Médicos 24h" },
  { icon: ClipboardList, label: "Atestado e receitas" },
  { icon: CreditCard, label: "Pagamento seguro" },
  { icon: Users, label: "Todas as idades" },
];

const PAHeroSection = () => {
  return (
    <section 
      className="relative overflow-hidden pt-16 pb-0"
      style={{
        background: 'linear-gradient(135deg, hsl(35 35% 91%) 0%, hsl(40 30% 96%) 100%)'
      }}
    >
      <div className="container px-4 sm:px-6 pt-8 sm:pt-12 lg:pt-20 pb-0">
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-center">
          {/* Left content */}
          <div className="text-center lg:text-left">
            <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-primary leading-tight mb-3 sm:mb-4 animate-fade-in [animation-delay:0.1s] [animation-fill-mode:both]">
              Médico on-line 24h por dia
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl font-bold text-accent mb-6 sm:mb-8 animate-fade-in [animation-delay:0.3s] [animation-fill-mode:both]">
              CONSULTA NA HORA
            </p>

            {/* Benefits grid */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-3 sm:gap-4 mb-6 sm:mb-8">
              {benefits.map((benefit, index) => (
                <div 
                  key={index} 
                  className="flex flex-col items-center gap-2 sm:gap-3 text-center animate-fade-in [animation-fill-mode:both]" 
                  style={{ animationDelay: `${0.4 + index * 0.1}s` }}
                >
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/10 flex items-center justify-center hover:scale-105 transition-transform border-2 border-primary/20">
                    <benefit.icon className="w-6 h-6 sm:w-8 sm:h-8 text-primary" strokeWidth={1.5} />
                  </div>
                  <span className="text-[10px] sm:text-xs font-semibold text-primary leading-tight max-w-[70px] sm:max-w-none">
                    {benefit.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right content - Doctor image */}
          <div className="relative flex justify-center lg:justify-end animate-scale-in [animation-delay:0.2s] [animation-fill-mode:both]">
            <div className="relative">
              <img 
                src="/assets/hero-doctor-realistic-1200.webp" 
                alt="Médica sorrindo pronta para atender" 
                className="w-full max-w-[280px] sm:max-w-sm md:max-w-lg lg:max-w-2xl object-contain drop-shadow-2xl" 
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PAHeroSection;
