import { Clock, FileCheck, Headphones, Shield, Users, Award } from "lucide-react";
import SpotlightCard from "@/components/bits/SpotlightCard";
import HeroChipsDesktop from "@/sections/HeroChipsDesktop";

const benefits = [
  { icon: Clock, text: "Médico 24h" },
  { icon: FileCheck, text: "Atestado e Receitas Digitais" },
  { icon: Headphones, text: "Suporte Rápido" },
  { icon: Award, text: "Emissão de Laudos" },
  { icon: Shield, text: "Pagamento Seguro" },
  { icon: Users, text: "Para Todas as Idades" }
];

export function BenefitsBar() {
  return (
    <div className="bg-gradient-to-r from-primary/5 via-secondary/5 to-accent/5 py-6 border-t border-border/50">
      <div className="container mx-auto px-4">
        {/* Mobile version with SpotlightCard */}
        <div className="md:hidden grid grid-cols-2 gap-3">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <SpotlightCard key={index} className="rounded-full" spotlightColor="rgba(22, 163, 74, 0.18)">
                <div className="flex flex-col items-center gap-1 text-base font-medium text-muted-foreground p-1">
                  <div className="p-1.5 bg-primary/10 rounded-full">
                    <Icon className="h-3 w-3 text-primary" />
                  </div>
                  <span className="text-center text-sm">{benefit.text}</span>
                </div>
              </SpotlightCard>
            );
          })}
        </div>
        
        {/* Desktop version with LogoLoop */}
        <HeroChipsDesktop />
      </div>
    </div>
  );
}