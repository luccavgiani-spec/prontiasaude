import { Link } from "react-router-dom";
import { Heart, Mail, Phone, MapPin } from "lucide-react";
import { CATALOGO_SERVICOS } from "@/lib/constants";
export function Footer() {
  return <footer className="bg-muted/30 border-t border-border mt-16">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Logo e Descrição */}
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2 text-xl font-bold text-primary mb-4">
              <div className="p-2 bg-[var(--gradient-primary)] rounded-lg">
                <Heart className="h-5 w-5 text-white" />
              </div>
              Prontia Saúde
            </Link>
            <p className="text-muted-foreground mb-4 max-w-md">
              Conectamos você aos melhores profissionais de saúde através de consultas online seguras e acessíveis.
            </p>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <span>suporte@prontiasaude.com.br</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <a href="https://wa.me/5511933359187?text=Ol%C3%A1!" target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">+55 11 93335-9187</a>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>São Paulo, SP - Brasil</span>
              </div>
            </div>
          </div>

          {/* Links Rápidos */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Links Rápidos</h3>
            <ul className="space-y-2 text-sm">
              {CATALOGO_SERVICOS.map((servico) => (
                <li key={servico.slug}>
                  <Link 
                    to={`/servicos/${servico.slug}`} 
                    className="text-muted-foreground hover:text-primary transition-colors"
                  >
              {servico.nome}
            </Link>
          </li>
        ))}
      </ul>
          </div>

          {/* Institucional */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Institucional</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/planos" className="text-muted-foreground hover:text-primary transition-colors">
                  Planos
                </Link>
              </li>
              <li>
                <Link to="/empresas" className="text-muted-foreground hover:text-primary transition-colors">
                  Para Empresas
                </Link>
              </li>
              <li>
                <Link to="/empresasdobem" className="text-muted-foreground hover:text-primary transition-colors">
                  Empresas do Bem
                </Link>
              </li>
              <li>
                <Link to="/quem-somos" className="text-muted-foreground hover:text-primary transition-colors">
                  Quem Somos
                </Link>
              </li>
          <li>
            <Link to="/blogs-artigos" className="text-muted-foreground hover:text-primary transition-colors">
              Blog
            </Link>
          </li>
          <li>
            <Link to="/trabalhe-conosco" className="text-muted-foreground hover:text-primary transition-colors">
              Trabalhe Conosco
            </Link>
          </li>
          <li>
            <Link to="/seja-nosso-parceiro" className="text-muted-foreground hover:text-primary transition-colors">
              Parcerias
            </Link>
          </li>
        </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-border mt-8 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>© 2024 Prontia Saúde. Todos os direitos reservados.</span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <Link to="/termos" className="text-muted-foreground hover:text-primary transition-colors">
              Termos de Uso
            </Link>
            <Link to="/privacidade" className="text-muted-foreground hover:text-primary transition-colors">
              Política de Privacidade
            </Link>
          </div>
        </div>

        {/* Selos de Segurança */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-card rounded-lg border border-border">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span className="text-xs text-muted-foreground">Dados Protegidos (SSL)</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-card rounded-lg border border-border">
            <div className="w-2 h-2 bg-accent rounded-full"></div>
            <span className="text-xs text-muted-foreground">Plataforma Verificada</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-card rounded-lg border border-border">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span className="text-xs text-muted-foreground">Communicare</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-card rounded-lg border border-border">
            <div className="w-2 h-2 bg-accent rounded-full"></div>
            <span className="text-xs text-muted-foreground">Clicklife Saúde</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-card rounded-lg border border-border">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span className="text-xs text-muted-foreground">Mercado Pago</span>
          </div>
        </div>
      </div>
    </footer>;
}