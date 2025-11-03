import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Gift, Pill, Stethoscope, Dumbbell, Apple, ArrowRight } from "lucide-react";
export const ClubeBenBannerSection = () => {
  return <section className="py-16 bg-gradient-to-br from-primary/5 via-secondary/5 to-primary/10">
      <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Conteúdo */}
            <div className="flex-1 text-center md:text-left">
              <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-4">
                <Gift className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-primary">Benefício Exclusivo</span>
              </div>
              
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Descontos exclusivos para quem é Prontìa</h2>
              
              <p className="text-lg text-muted-foreground mb-6">
                Farmácias, exames, fitness e bem-estar com vantagens reais. 
                Centenas de parceiros em todo o Brasil.
              </p>

              {/* Ícones de benefícios */}
              <div className="flex flex-wrap gap-6 mb-6 justify-center md:justify-start">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Pill className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-sm font-medium">Farmácias</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Stethoscope className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-sm font-medium">Exames</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Dumbbell className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-sm font-medium">Fitness</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Apple className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-sm font-medium">Alimentação</span>
                </div>
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                <Button asChild size="lg">
                  <Link to="/clubeben">
                    Conheça o Clube
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/planos">
                    Assinar Plano
                  </Link>
                </Button>
              </div>
            </div>

            {/* Imagem/Visual */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-3xl blur-3xl"></div>
                
              </div>
            </div>
          </div>
      </div>
    </section>;
};