import { Button } from "@/components/ui/button";
import { ShieldCheck, ThumbsUp, Lock } from "lucide-react";

const trustBadges = [
  { icon: ShieldCheck, label: "Compra Segura" },
  { icon: ThumbsUp, label: "Satisfação Garantida" },
  { icon: Lock, label: "Privacidade Protegida" },
];

const PAPriceBanner = () => {
  return (
    <section 
      className="py-6"
      style={{
        background: 'linear-gradient(90deg, hsl(168 70% 35%) 0%, hsl(168 76% 32%) 100%)'
      }}
    >
      <div className="container">
        <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10">
          <div className="flex items-center gap-4">
            <div className="text-primary-foreground">
              <p className="text-sm font-medium opacity-90">Se consulte</p>
              <p className="text-sm font-bold">agora mesmo:</p>
            </div>
            <div className="text-primary-foreground">
              <span className="text-3xl md:text-4xl font-heading font-extrabold">
                R$ 39,90
              </span>
            </div>
          </div>

          <Button 
            className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-base" 
            size="lg" 
            asChild
          >
            <a href="/entrar">CONSULTAR AGORA</a>
          </Button>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap justify-center gap-6 mt-4">
          {trustBadges.map((badge, index) => (
            <div key={index} className="flex items-center gap-2 text-primary-foreground/80">
              <badge.icon className="w-4 h-4" />
              <span className="text-xs font-medium">{badge.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PAPriceBanner;
