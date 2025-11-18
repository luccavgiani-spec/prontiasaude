import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import prontiaLogoMobile from "@/assets/prontia-logo-header-mobile.webp";
import prontiaLogoDesktop from "@/assets/prontia-logo-header-desktop.webp";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navItems = [{
    href: "/",
    label: "Início"
  }, {
    href: "/servicos",
    label: "Serviços"
  }, {
    href: "/planos",
    label: "Planos"
  }, {
    href: "/empresas",
    label: "Para Empresas"
  }, {
    href: "/empresasdobem",
    label: "Empresas do Bem"
  }, {
    href: "/blogs-artigos",
    label: "Blog"
  }, {
    href: "/quem-somos",
    label: "Quem somos"
  }];
  const isActive = (href: string) => location.pathname === href;
  
  const handleHomeClick = (e: React.MouseEvent) => {
    if (location.pathname === "/") {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };
  return <nav 
      className="sticky top-0 z-50 backdrop-blur-md border-b border-primary-glow/20 shadow-lg" 
      style={{ 
        minHeight: '80px',
        backgroundColor: 'hsl(172, 85%, 30%)'
      }}
    >
      <div className="container mx-auto sm:px-8 lg:px-12 px-[16px] my-[12px]">
        <div className="flex justify-between items-center h-16 lg:h-20">
          {/* Logo Prontìa Oficial */}
          <Link to="/" className="flex items-center group" onClick={handleHomeClick}>
            {/* Mobile Logo - 48px */}
            <img 
              src={prontiaLogoMobile} 
              alt="Prontìa Saúde" 
              className="block lg:hidden h-12 w-auto transition-all duration-300 group-hover:scale-[1.02]"
              width="180"
              height="48"
              loading="eager"
              fetchPriority="high"
            />
            {/* Desktop Logo - 64px */}
            <img 
              src={prontiaLogoDesktop} 
              alt="Prontìa Saúde" 
              className="hidden lg:block h-16 w-auto transition-all duration-300 group-hover:scale-[1.02]"
              width="240"
              height="64"
              loading="eager"
              fetchPriority="high"
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center justify-center gap-4 lg:gap-6 flex-1">
            {navItems.map(item => <Link key={item.href} to={item.href} onClick={item.href === "/" ? handleHomeClick : undefined} className={cn("text-xs lg:text-sm font-medium transition-all duration-300 relative group text-center whitespace-nowrap px-2", isActive(item.href) ? "text-white font-semibold" : "text-white/80 hover:text-white")}>
                {item.label}
                <span className={cn("absolute -bottom-1 left-0 h-0.5 bg-white transition-all duration-300", isActive(item.href) ? "w-full" : "w-0 group-hover:w-full")} />
              </Link>)}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden lg:flex items-center gap-2 lg:gap-3">
            <Link to="/area-do-paciente">
              <Button variant="outline" size="sm" className="text-xs lg:text-sm px-3 lg:px-4 py-2 lg:py-3 rounded-lg bg-white/10 text-white border-white/30 hover:bg-white/20 hover:border-white/50 transition-all duration-300">
                Área do Paciente
              </Button>
            </Link>
            <Link to="/servicos">
              <Button size="sm" className="bg-white text-primary hover:bg-white/90 text-xs lg:text-sm px-3 lg:px-4 py-2 lg:py-3 rounded-lg font-semibold">
                Consulte Agora
              </Button>
            </Link>
          </div>

          {/* Tablet CTAs */}
          <div className="hidden md:flex lg:hidden items-center gap-2">
            <Link to="/area-do-paciente">
              <Button variant="outline" size="sm" className="text-xs px-3 py-2 rounded-lg bg-white/10 text-white border-white/30 hover:bg-white/20 hover:border-white/50 transition-all duration-300">
                Área do Paciente
              </Button>
            </Link>
            <Link to="/servicos">
              <Button size="sm" className="bg-white text-primary hover:bg-white/90 text-xs px-3 py-2 rounded-lg font-semibold">
                Consulte Agora
              </Button>
            </Link>
          </div>

          {/* Mobile & Tablet Menu Button */}
          <button 
            onClick={() => setIsOpen(!isOpen)} 
            className="lg:hidden p-3 rounded-xl hover:bg-white/10 transition-colors duration-300 text-white"
            aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Enhanced Mobile & Tablet Navigation */}
        {isOpen && <div 
          id="mobile-menu"
          className="lg:hidden py-4 border-t border-white/20 bg-primary-glow/30 rounded-b-2xl"
        >
            <div className="flex flex-col gap-3">
              {navItems.map(item => <Link key={item.href} to={item.href} onClick={(e) => {
                  setIsOpen(false);
                  if (item.href === "/") handleHomeClick(e);
                }} className={cn("text-sm font-medium transition-all duration-300 px-4 py-2 rounded-xl", isActive(item.href) ? "text-white bg-white/20 border border-white/30 font-semibold" : "text-white/80 hover:text-white hover:bg-white/10")}>
                  {item.label}
                </Link>)}
              {/* Mobile-only CTAs in dropdown */}
              <div className="md:hidden flex flex-col gap-2 pt-3 border-t border-white/20">
                <Link to="/area-do-paciente" onClick={() => setIsOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full text-sm py-3 rounded-xl bg-white/10 text-white border-white/30 hover:bg-white/20">
                    Área do Paciente
                  </Button>
                </Link>
                <Link to="/servicos" onClick={() => setIsOpen(false)}>
                  <Button size="sm" className="bg-white text-primary hover:bg-white/90 w-full text-sm py-3 rounded-xl font-semibold">
                    Consulte Agora
                  </Button>
                </Link>
              </div>
            </div>
          </div>}
      </div>
    </nav>;
}
