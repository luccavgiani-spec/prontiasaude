import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Clock, Zap, ThumbsUp } from "lucide-react";

const LPStatsSection = () => {
  const navigate = useNavigate();

  const stats = [
    { icon: Zap, label: "Sem filas" },
    { icon: Clock, label: "Atendimento Imediato" },
    { icon: ThumbsUp, label: "Satisfação Garantida" },
  ];

  return (
    <section className="py-12 md:py-20 bg-gradient-to-br from-primary/5 via-background to-primary/10">
      <div className="container mx-auto px-4 text-center">
        {/* Header */}
        <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-8">
          A melhor plataforma de telemedicina do Brasil
        </h2>

        {/* Stats */}
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12 mb-10">
          {stats.map((stat, index) => (
            <div key={index} className="flex items-center gap-2 text-foreground">
              <stat.icon className="w-5 h-5 text-primary" />
              <span className="font-medium">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* CTA Box */}
        <div className="inline-flex flex-col sm:flex-row items-center gap-4 sm:gap-6 bg-card rounded-2xl p-6 md:p-8 shadow-lg border border-border/50">
          <div className="text-left">
            <span className="text-muted-foreground">Se consulte</span>
            <br />
            <span className="text-muted-foreground">agora mesmo:</span>
          </div>
          <span className="text-4xl md:text-5xl font-bold text-primary">
            R$ 39,90
          </span>
          <Button
            onClick={() => navigate("/entrar")}
            size="lg"
            className="bg-[#E85D3F] hover:bg-[#d04e32] text-white font-bold text-lg px-8 py-6 rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
          >
            CONSULTAR AGORA
          </Button>
        </div>
      </div>
    </section>
  );
};

export default LPStatsSection;
