import HeroChipsDesktop from "@/sections/HeroChipsDesktop";
import HeroChipsMobile from "@/sections/HeroChipsMobile";

export function BenefitsBar() {
  return (
    <div className="bg-gradient-to-r from-primary/5 via-secondary/5 to-accent/5 py-6 border-t border-border/50">
      <div className="container mx-auto px-4">
        {/* Mobile version with LogoLoop */}
        <HeroChipsMobile />
        
        {/* Desktop version with LogoLoop */}
        <HeroChipsDesktop />
      </div>
    </div>
  );
}