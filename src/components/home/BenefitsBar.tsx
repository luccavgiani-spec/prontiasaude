import { Clock, FileCheck, Headphones, Shield, Users, Award } from "lucide-react";
import SpotlightCard from "@/components/bits/SpotlightCard";

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
        <div className="grid grid-cols-2 gap-3 md:flex md:flex-wrap md:justify-center md:items-center md:gap-6 lg:gap-8">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <SpotlightCard key={index} className="rounded-full" spotlightColor="rgba(22, 163, 74, 0.18)">
                <div className="flex flex-col md:flex-row items-center gap-1 md:gap-2 text-sm md:text-sm font-medium text-muted-foreground p-1 md:p-0">
                  <div className="p-1.5 md:p-2 bg-primary/10 rounded-full">
                    <Icon className="h-3 w-3 md:h-5 md:w-5 text-primary" />
                  </div>
                  <span className="text-center md:whitespace-nowrap text-sm md:text-sm">{benefit.text}</span>
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}