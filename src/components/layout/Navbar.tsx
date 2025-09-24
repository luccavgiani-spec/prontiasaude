import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
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
  return <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/80 border-b border-border/50 shadow-sm">
      <div className="container mx-auto sm:px-8 lg:px-12 px-[16px] my-[8px]">
        <div className="flex justify-between items-center h-12 lg:h-14">
          {/* Modern Logo */}
          <Link to="/" className="flex items-center gap-2 text-lg lg:text-xl font-bold text-primary group">
            <div className="p-2 bg-gradient-to-br from-primary to-primary-glow rounded-lg shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
              <Heart className="h-4 w-4 text-white" />
            </div>
            <span className="hidden sm:inline bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              PRONTIA SAÚDE
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center justify-center gap-4 lg:gap-6 flex-1">
            {navItems.map(item => <Link key={item.href} to={item.href} className={cn("text-xs lg:text-sm font-medium transition-all duration-300 relative group text-center whitespace-nowrap px-2", isActive(item.href) ? "text-primary" : "text-muted-foreground hover:text-primary")}>
                {item.label}
                <span className={cn("absolute -bottom-1 left-0 h-0.5 bg-gradient-to-r from-primary to-secondary transition-all duration-300", isActive(item.href) ? "w-full" : "w-0 group-hover:w-full")} />
              </Link>)}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden lg:flex items-center gap-2 lg:gap-3">
            <Link to="/area-do-paciente">
              <Button variant="outline" size="sm" className="text-xs lg:text-sm px-3 lg:px-4 py-2 lg:py-3 rounded-lg hover:bg-primary/10 hover:border-primary/50 transition-all duration-300">
                Área do Paciente
              </Button>
            </Link>
            <Link to="/servicos">
              <Button size="sm" className="medical-button-primary text-xs lg:text-sm px-3 lg:px-4 py-2 lg:py-3 rounded-lg">
                Consulte Agora
              </Button>
            </Link>
          </div>

          {/* Tablet CTAs */}
          <div className="hidden md:flex lg:hidden items-center gap-2">
            <Link to="/area-do-paciente">
              <Button variant="outline" size="sm" className="text-xs px-3 py-2 rounded-lg hover:bg-primary/10 hover:border-primary/50 transition-all duration-300">
                Área do Paciente
              </Button>
            </Link>
            <Link to="/servicos">
              <Button size="sm" className="medical-button-primary text-xs px-3 py-2 rounded-lg">
                Consulte Agora
              </Button>
            </Link>
          </div>

          {/* Mobile & Tablet Menu Button */}
          <button onClick={() => setIsOpen(!isOpen)} className="lg:hidden p-3 rounded-xl hover:bg-primary/10 transition-colors duration-300">
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Enhanced Mobile & Tablet Navigation */}
        {isOpen && <div className="lg:hidden py-4 border-t border-border/50 bg-gradient-to-b from-background to-muted/30 rounded-b-2xl">
            <div className="flex flex-col gap-3">
              {navItems.map(item => <Link key={item.href} to={item.href} onClick={() => setIsOpen(false)} className={cn("text-sm font-medium transition-all duration-300 px-4 py-2 rounded-xl", isActive(item.href) ? "text-primary bg-primary/10 border border-primary/20" : "text-muted-foreground hover:text-primary hover:bg-primary/5")}>
                  {item.label}
                </Link>)}
              {/* Mobile-only CTAs in dropdown */}
              <div className="md:hidden flex flex-col gap-2 pt-3 border-t border-border/50">
                <Link to="/area-do-paciente" onClick={() => setIsOpen(false)}>
                  <Button variant="outline" size="sm" className="w-full text-sm py-3 rounded-xl">
                    Área do Paciente
                  </Button>
                </Link>
                <Link to="/servicos" onClick={() => setIsOpen(false)}>
                  <Button size="sm" className="medical-button-primary w-full text-sm py-3 rounded-xl">
                    Consulte Agora
                  </Button>
                </Link>
              </div>
            </div>
          </div>}
      </div>
    </nav>;
}