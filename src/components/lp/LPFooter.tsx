import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import prontiaLogo from "@/assets/prontia-logo-branca.webp";

const LPFooter = () => {
  const navigate = useNavigate();

  return (
    <footer className="bg-primary text-white">
      {/* Final CTA Section */}
      <div className="py-12 md:py-16 text-center border-b border-white/10">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">
            Consulte agora com um médico online
          </h2>
          <p className="text-white/80 mb-6 max-w-xl mx-auto">
            Atendimento humanizado, rápido e acessível. Cuide da sua saúde sem
            sair de casa.
          </p>
          <Button
            onClick={() => navigate("/entrar")}
            size="lg"
            className="bg-[#E85D3F] hover:bg-[#d04e32] text-white font-bold text-lg px-10 py-6 rounded-full shadow-lg hover:shadow-xl transition-all transform hover:scale-105"
          >
            CONSULTAR AGORA - R$ 39,90
          </Button>
        </div>
      </div>

      {/* Footer Links */}
      <div className="py-8 md:py-10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Logo */}
            <Link to="/lp">
              <img
                src={prontiaLogo}
                alt="Prontia Saúde"
                className="h-8 md:h-10 w-auto"
              />
            </Link>

            {/* Links */}
            <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6 text-sm">
              <Link
                to="/termos"
                className="text-white/80 hover:text-white transition-colors"
              >
                Termos de Uso
              </Link>
              <Link
                to="/privacidade"
                className="text-white/80 hover:text-white transition-colors"
              >
                Política de Privacidade
              </Link>
              <a
                href="mailto:suporte@prontiasaude.com.br"
                className="text-white/80 hover:text-white transition-colors"
              >
                suporte@prontiasaude.com.br
              </a>
            </div>

            {/* Copyright */}
            <p className="text-white/60 text-sm">
              © {new Date().getFullYear()} Prontia Saúde
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default LPFooter;
