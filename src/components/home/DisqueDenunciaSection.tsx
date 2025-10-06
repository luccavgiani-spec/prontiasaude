import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle, Shield } from "lucide-react";
import { Link } from "react-router-dom";

export const DisqueDenunciaSection = () => {
  return (
    <section className="py-16 px-4 bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20">
      <div className="container mx-auto max-w-4xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-500 to-orange-600 rounded-full mb-4">
            <AlertTriangle className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Disque Denúncia
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A Prontia Saúde preza pela qualidade e ética em todos os atendimentos. 
            Se você identificou alguma inconsistência nos serviços ou conduta profissional inadequada, 
            utilize nosso canal de denúncia.
          </p>
        </div>

        <Card className="p-8">
          <div className="flex items-start gap-4 mb-6">
            <Shield className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
            <div>
              <h3 className="font-semibold text-foreground mb-2">Confidencialidade Garantida</h3>
              <p className="text-muted-foreground">
                Todas as denúncias são tratadas com total sigilo e seriedade. Sua identidade será protegida 
                e tomaremos as providências necessárias para investigar e resolver a situação.
              </p>
            </div>
          </div>

          <div className="text-center">
            <Link to="/disque-denuncia">
              <Button size="lg" variant="outline" className="border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">
                Fazer uma Denúncia
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </section>
  );
};
