import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, ThumbsUp, Lock } from "lucide-react";

const LPPriceBanner = () => {
  const navigate = useNavigate();

  const trustBadges = [
    { icon: Shield, label: "Compra Segura" },
    { icon: ThumbsUp, label: "Satisfação Garantida" },
    { icon: Lock, label: "Privacidade Protegida" },
  ];

  return (
    <section className="bg-gradient-to-r from-primary to-[#1A8C7D] py-6 md:py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
          {/* Price Section */}
          <div className="flex items-center gap-4">
            <div className="text-white">
              <span className="text-sm md:text-base opacity-90">Se consulte</span>
              <br />
              <span className="text-sm md:text-base opacity-90">agora mesmo:</span>
            </div>
            <span className="text-3xl md:text-4xl lg:text-5xl font-bold text-white">
              R$ 39,90
            </span>
          </div>

          {/* CTA Button */}
          <Button
            onClick={() => navigate("/entrar")}
            size="lg"
            className="bg-[#E85D3F] hover:bg-[#d04e32] text-white font-bold text-lg px-8 py-6 rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
          >
            CONSULTAR AGORA
          </Button>
        </div>

        {/* Trust Badges */}
        <div className="flex flex-wrap items-center justify-center gap-4 md:gap-8 mt-4 md:mt-6">
          {trustBadges.map((badge, index) => (
            <div
              key={index}
              className="flex items-center gap-2 text-white/90"
            >
              <badge.icon className="w-4 h-4 md:w-5 md:h-5" />
              <span className="text-xs md:text-sm">{badge.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default LPPriceBanner;
