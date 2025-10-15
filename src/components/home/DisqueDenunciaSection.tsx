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
            Este canal foi criado para reforçar nosso compromisso com um ambiente de trabalho seguro, 
            saudável e respeitoso para todos.
          </p>
        </div>

        <Card className="p-8">
          <div className="space-y-4 mb-6">
            <p className="text-muted-foreground">
              Aqui, trabalhadores, colaboradores e parceiros podem relatar de forma confidencial situações relacionadas a:
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
              <li>Condições que possam representar riscos à saúde ou à segurança;</li>
              <li>Dúvidas sobre o uso de equipamentos de proteção ou sobre procedimentos de segurança;</li>
              <li>Sugestões de melhoria para o ambiente de trabalho.</li>
            </ul>
            
            <div className="flex items-start gap-3 mt-6 p-4 bg-primary/5 rounded-lg">
              <Shield className="h-5 w-5 text-primary flex-shrink-0 mt-1" />
              <div>
                <p className="text-sm font-semibold text-foreground mb-2">
                  📢 Todos os relatos são tratados com seriedade, responsabilidade e total sigilo.
                </p>
                <p className="text-sm text-muted-foreground">
                  Acreditamos que a comunicação transparente é essencial para prevenir acidentes e promover o 
                  aperfeiçoamento contínuo das condições de trabalho, em conformidade com as Normas Regulamentadoras 
                  do Ministério do Trabalho, como a NR 1.
                </p>
              </div>
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
