import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Gift, ArrowRight } from "lucide-react";
import { PartnersLogoGallery } from "./PartnersLogoGallery";
export const ClubeBenBannerSection = () => {
  return <section className="py-16 bg-muted/30">
      <div className="container mx-auto px-4">
          <div className="flex flex-col items-center gap-8">
            {/* Conteúdo */}
            <div className="w-full text-center">
              <div className="inline-flex items-center gap-2 bg-primary/10 px-4 py-2 rounded-full mb-4">
                <Gift className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-primary">Benefício Exclusivo</span>
              </div>
              
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Descontos exclusivos para quem é Prontìa</h2>
              
              {/* Galeria de Parceiros */}
              <div className="my-8 w-full">
                <PartnersLogoGallery />
              </div>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
          </div>
      </div>
    </section>;
};