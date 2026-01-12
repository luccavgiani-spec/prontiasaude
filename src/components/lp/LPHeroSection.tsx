import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Stethoscope, FileText, CreditCard, Users } from "lucide-react";

const LPHeroSection = () => {
  const navigate = useNavigate();

  const features = [
    { icon: Stethoscope, label: "Médicos 24h" },
    { icon: FileText, label: "Atestado e receitas" },
    { icon: CreditCard, label: "Pagamento seguro" },
    { icon: Users, label: "Todas as idades" },
  ];

  return (
    <section className="relative min-h-[90vh] md:min-h-screen bg-gradient-to-br from-[#FDF5E6] via-[#FDF8F0] to-[#E8F5E9] pt-20 md:pt-24 overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Large cross pattern */}
        <div className="absolute top-1/4 left-1/4 w-64 h-64 opacity-5">
          <svg viewBox="0 0 100 100" className="w-full h-full fill-primary">
            <rect x="40" y="10" width="20" height="80" />
            <rect x="10" y="40" width="80" height="20" />
          </svg>
        </div>
        {/* Floating hearts */}
        <div className="absolute top-1/3 right-1/4 text-primary/20 text-6xl animate-pulse">
          ♡
        </div>
        <div className="absolute top-1/2 right-1/3 text-primary/15 text-4xl animate-pulse delay-500">
          ♡
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 md:py-16">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Left Content */}
          <div className="space-y-6 md:space-y-8 z-10">
            <div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary leading-tight">
                Médico on-line
                <br />
                24h por dia
              </h1>
              <p className="text-lg md:text-xl text-[#E85D3F] font-semibold mt-2 tracking-wide">
                CONSULTA NA HORA
              </p>
            </div>

            {/* Feature badges */}
            <div className="flex flex-wrap gap-3 md:gap-4">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="flex flex-col items-center gap-2 bg-white/80 backdrop-blur-sm rounded-xl p-3 md:p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <feature.icon className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                  </div>
                  <span className="text-xs md:text-sm font-medium text-foreground/80 text-center">
                    {feature.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Mobile CTA */}
            <div className="md:hidden">
              <Button
                onClick={() => navigate("/entrar")}
                size="lg"
                className="w-full bg-[#E85D3F] hover:bg-[#d04e32] text-white font-bold text-lg py-6 rounded-full shadow-lg"
              >
                CONSULTAR AGORA - R$ 39,90
              </Button>
            </div>
          </div>

          {/* Right Content - Doctor Image */}
          <div className="relative flex justify-center md:justify-end">
            <div className="relative">
              <img
                src="https://prontia-landing-page-publicada.vercel.app/assets/hero-doctor-C2t2QcAv.webp"
                alt="Médica sorrindo pronta para atender"
                className="w-full max-w-md md:max-w-lg lg:max-w-xl h-auto object-contain"
                loading="eager"
              />
              {/* Floating icons around doctor */}
              <div className="absolute top-10 right-10 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center animate-bounce">
                <span className="text-primary text-2xl">♡</span>
              </div>
              <div className="absolute bottom-1/3 left-0 w-14 h-14 bg-white rounded-full shadow-lg flex items-center justify-center">
                <Stethoscope className="w-7 h-7 text-primary" />
              </div>
              <div className="absolute bottom-1/4 right-5 w-14 h-14 bg-primary rounded-full shadow-lg flex items-center justify-center">
                <FileText className="w-7 h-7 text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LPHeroSection;
