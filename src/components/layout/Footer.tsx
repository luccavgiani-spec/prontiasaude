import { Link } from "react-router-dom";
import { Mail, Phone, MapPin } from "lucide-react";
import { CATALOGO_SERVICOS } from "@/lib/constants";
import prontiaLogo from "@/assets/prontia-logo-branca.webp";

export function Footer() {
  return <footer className="bg-primary border-t border-primary-glow/20 mt-16">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo e Descrição */}
          <div className="md:col-span-2">
            <Link to="/" className="inline-block mb-4 transition-all duration-300 hover:scale-105">
              <img 
                src={prontiaLogo} 
                alt="Prontìa Saúde" 
                className="h-16 w-auto"
              />
            </Link>
            <p className="text-white/80 mb-4 max-w-md">
              Conectamos você aos melhores profissionais de saúde através de consultas online seguras e acessíveis.
            </p>
            <div className="flex flex-col gap-2 text-sm text-white/70">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-white" />
                <span>suporte@prontiasaude.com.br</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-white" />
                <a href="https://wa.me/5511933359187?text=Ol%C3%A1!" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">+55 11 93335-9187</a>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-white" />
                <span>São Paulo, SP - Brasil</span>
              </div>
            </div>
          </div>

          {/* Links Rápidos */}
          <div>
            <h3 className="font-semibold text-white mb-4">Links Rápidos</h3>
            <ul className="space-y-2 text-sm">
              {CATALOGO_SERVICOS.map((servico) => (
                <li key={servico.slug}>
                  <Link 
                    to={`/servicos/${servico.slug}`} 
                    className="text-white/70 hover:text-white transition-colors"
                  >
              {servico.nome}
            </Link>
          </li>
        ))}
      </ul>
          </div>

          {/* Institucional */}
          <div>
            <h3 className="font-semibold text-white mb-4">Institucional</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/planos" className="text-white/70 hover:text-white transition-colors">
                  Planos
                </Link>
              </li>
              <li>
                <Link to="/empresas" className="text-white/70 hover:text-white transition-colors">
                  Para Empresas
                </Link>
              </li>
              <li>
                <Link to="/empresasdobem" className="text-white/70 hover:text-white transition-colors">
                  Empresas do Bem
                </Link>
              </li>
              <li>
                <Link to="/quem-somos" className="text-white/70 hover:text-white transition-colors">
                  Quem Somos
                </Link>
              </li>
          <li>
            <Link to="/blogs-artigos" className="text-white/70 hover:text-white transition-colors">
              Blog
            </Link>
          </li>
          <li>
            <Link to="/trabalhe-conosco" className="text-white/70 hover:text-white transition-colors">
              Trabalhe Conosco
            </Link>
          </li>
          <li>
            <Link to="/seja-nosso-parceiro" className="text-white/70 hover:text-white transition-colors">
              Parcerias
            </Link>
          </li>
        </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/20 mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 text-sm text-white/70">
            <span>© 2024 Prontìa Saúde. Todos os direitos reservados.</span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <Link to="/termos" className="text-white/70 hover:text-white transition-colors">
              Termos de Uso
            </Link>
            <Link to="/privacidade" className="text-white/70 hover:text-white transition-colors">
              Política de Privacidade
            </Link>
          </div>
        </div>

        {/* Selos de Segurança */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-lg border border-white/20">
            <div className="w-2 h-2 bg-white rounded-full"></div>
            <span className="text-xs text-white/70">Dados Protegidos (SSL)</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-lg border border-white/20">
            <div className="w-2 h-2 bg-secondary rounded-full"></div>
            <span className="text-xs text-white/70">Plataforma Verificada</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-lg border border-white/20">
            <div className="w-2 h-2 bg-[#9b87f5] rounded-full"></div>
            <span className="text-xs text-white/70">Communicare</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-lg border border-white/20">
            <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
            <span className="text-xs text-white/70">Clicklife Saúde</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-white/10 rounded-lg border border-white/20">
            <div className="w-2 h-2 bg-[#009EE3] rounded-full"></div>
            <span className="text-xs text-white/70">Mercado Pago</span>
          </div>
        </div>
      </div>
    </footer>;
}
