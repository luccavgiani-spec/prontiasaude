import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import logoImage from "@/assets/prontia-logo-navbar-master.webp";

const PAHeader = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header className={`fixed top-0 z-50 w-full transition-all duration-300 ${isScrolled ? "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border shadow-sm" : "bg-transparent border-b border-transparent"}`}>
      <div className="container px-4 sm:px-6 flex h-14 sm:h-16 items-center justify-center sm:justify-between">
        {/* Logo - centered on mobile */}
        <div className="flex items-center">
          <img src={logoImage} alt="Prontia Saúde" className="h-8 sm:h-10 w-auto" />
        </div>

        {/* Desktop Buttons */}
        <div className="hidden sm:flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <a href="/entrar">ENTRAR</a>
          </Button>
          <Button className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold" size="sm" asChild>
            <a href="/entrar">CONSULTAR AGORA</a>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default PAHeader;
