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
        <div className="flex flex-wrap justify-center items-center gap-6 md:gap-8">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <SpotlightCard key={index} className="rounded-full" spotlightColor="rgba(22, 163, 74, 0.18)">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <div className="p-2 bg-primary/10 rounded-full">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="whitespace-nowrap">{benefit.text}</span>
                </div>
              </SpotlightCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}