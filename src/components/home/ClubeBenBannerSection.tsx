import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Gift, ArrowRight } from "lucide-react";
import { PartnersLogoGallery } from "./PartnersLogoGallery";
export const ClubeBenBannerSection = () => {
  return <section className="py-16 bg-muted/30 md:bg-background" style={{ contentVisibility: 'auto', containIntrinsicSize: '400px' }}>
      <div className="container mx-auto">
          <div className="flex flex-col items-center gap-8">
            {/* Conteúdo */}
            <div className="w-full text-center">
              
              
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
                <Button disabled size="lg" variant="outline" className="cursor-not-allowed opacity-80">
                  EM BREVE!
                </Button>
              </div>
            </div>
          </div>
      </div>
    </section>;
};