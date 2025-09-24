import { Link } from "react-router-dom";
import { Heart, Mail, Phone, MapPin } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-muted/30 border-t border-border mt-16">
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
                <span>+55 11 93350-5652</span>
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
              <li>
                <Link to="/servicos" className="text-muted-foreground hover:text-primary transition-colors">
                  Nossos Serviços
                </Link>
              </li>
              <li>
                <Link to="/planos" className="text-muted-foreground hover:text-primary transition-colors">
                  Planos
                </Link>
              </li>
              <li>
                <Link to="/quem-somos" className="text-muted-foreground hover:text-primary transition-colors">
                  Quem Somos
                </Link>
              </li>
              <li>
                <Link to="/paciente" className="text-muted-foreground hover:text-primary transition-colors">
                  Área do Paciente
                </Link>
              </li>
            </ul>
          </div>

          {/* Serviços */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Serviços</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/servicos/consulta" className="text-muted-foreground hover:text-primary transition-colors">
                  Consulta Clínica
                </Link>
              </li>
              <li>
                <Link to="/servicos/psicologa" className="text-muted-foreground hover:text-primary transition-colors">
                  Psicologia
                </Link>
              </li>
              <li>
                <Link to="/servicos/psiquiatria" className="text-muted-foreground hover:text-primary transition-colors">
                  Psiquiatria
                </Link>
              </li>
              <li>
                <Link to="/servicos/renovacao" className="text-muted-foreground hover:text-primary transition-colors">
                  Renovação de Receita
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
        <div className="mt-6 flex items-center justify-center gap-6">
          <div className="flex items-center gap-2 px-3 py-1 bg-card rounded-lg border border-border">
            <div className="w-2 h-2 bg-primary rounded-full"></div>
            <span className="text-xs text-muted-foreground">Pagamento Seguro (Stripe)</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 bg-card rounded-lg border border-border">
            <div className="w-2 h-2 bg-accent rounded-full"></div>
            <span className="text-xs text-muted-foreground">Plataforma Verificada</span>
          </div>
        </div>
      </div>
    </footer>
  );
}