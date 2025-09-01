import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { CheckCircle, Mail, Calendar } from "lucide-react";

const Confirmacao = () => {
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(3);
  const email = searchParams.get('email');

  useEffect(() => {
    if (email) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            window.location.href = `/paciente?email=${encodeURIComponent(email)}`;
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [email]);

  const handleRedirectManual = () => {
    if (email) {
      window.location.href = `/paciente?email=${encodeURIComponent(email)}`;
    } else {
      const emailInput = prompt("Por favor, informe seu email para acessar a área do paciente:");
      if (emailInput) {
        window.location.href = `/paciente?email=${encodeURIComponent(emailInput)}`;
      }
    }
  };

  return (
    <div className="py-16">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="medical-card p-8 md:p-12 text-center">
          {/* Ícone de sucesso */}
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-12 w-12 text-primary" />
          </div>

          {/* Título */}
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Obrigado pela sua compra!
          </h1>

          {/* Mensagem */}
          <p className="text-lg text-muted-foreground mb-8">
            Seu pagamento foi processado com sucesso. Em breve você receberá um email 
            com as instruções para acessar sua consulta.
          </p>

          {/* Próximos passos */}
          <div className="bg-muted/30 rounded-xl p-6 mb-8">
            <h2 className="text-xl font-semibold text-foreground mb-4">Próximos Passos:</h2>
            <div className="space-y-3 text-left">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">1</div>
                <span className="text-muted-foreground">Você receberá um email de confirmação</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">2</div>
                <span className="text-muted-foreground">Nossa equipe entrará em contato para agendar</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-semibold">3</div>
                <span className="text-muted-foreground">Você receberá o link da videochamada</span>
              </div>
            </div>
          </div>

          {/* Informações importantes */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8 p-4 bg-accent/10 rounded-lg border border-accent/20">
            <div className="flex items-center gap-2 text-accent-foreground">
              <Mail className="h-5 w-5" />
              <span className="text-sm font-medium">Verifique sua caixa de email</span>
            </div>
            <div className="flex items-center gap-2 text-accent-foreground">
              <Calendar className="h-5 w-5" />
              <span className="text-sm font-medium">Consulta em até 24h</span>
            </div>
          </div>

          {/* Redirecionamento */}
          {email ? (
            <div className="mb-6">
              <p className="text-muted-foreground mb-3">
                Redirecionando para a área do paciente em <strong>{countdown}s</strong>...
              </p>
              <Button 
                onClick={handleRedirectManual}
                variant="medical" 
                size="lg"
              >
                Ir para Área do Paciente
              </Button>
            </div>
          ) : (
            <div className="mb-6">
              <p className="text-muted-foreground mb-3">
                Acesse sua área do paciente para acompanhar o agendamento
              </p>
              <Button 
                onClick={handleRedirectManual}
                variant="medical" 
                size="lg"
              >
                Acessar Área do Paciente
              </Button>
            </div>
          )}

          {/* Links adicionais */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="outline" asChild>
              <Link to="/">Voltar ao Início</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/servicos">Agendar Nova Consulta</Link>
            </Button>
          </div>

          {/* Suporte */}
          <div className="mt-8 pt-6 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Dúvidas ou problemas? Entre em contato pelo email{" "}
              <a href="mailto:contato@medicosdobem.com.br" className="text-primary hover:underline">
                contato@medicosdobem.com.br
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Confirmacao;