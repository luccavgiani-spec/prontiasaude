import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import prontiaLogo from "@/assets/prontia-logo-horizontal-misto.webp";

const LPHeader = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleConsultClick = () => {
    navigate("/entrar");
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-background/95 backdrop-blur-md shadow-md"
          : "bg-transparent"
      }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/lp" className="flex-shrink-0">
            <img
              src={prontiaLogo}
              alt="Prontia Saúde"
              className="h-8 md:h-10 w-auto"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-4">
            <Link
              to="/entrar"
              className="text-foreground/80 hover:text-primary transition-colors font-medium"
            >
              ENTRAR
            </Link>
            <Button
              onClick={handleConsultClick}
              className="bg-[#E85D3F] hover:bg-[#d04e32] text-white font-semibold px-6 py-2 rounded-full shadow-lg hover:shadow-xl transition-all"
            >
              CONSULTAR AGORA
            </Button>
          </nav>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2 text-foreground"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-16 left-0 right-0 bg-background shadow-lg border-t">
            <div className="flex flex-col p-4 gap-4">
              <Link
                to="/entrar"
                className="text-foreground/80 hover:text-primary transition-colors font-medium py-2"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                ENTRAR
              </Link>
              <Button
                onClick={() => {
                  handleConsultClick();
                  setIsMobileMenuOpen(false);
                }}
                className="bg-[#E85D3F] hover:bg-[#d04e32] text-white font-semibold px-6 py-3 rounded-full shadow-lg w-full"
              >
                CONSULTAR AGORA
              </Button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default LPHeader;
