import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TermosContent from "@/components/legal/TermosContent";

const Termos = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-center">
              Termo de Consentimento Livre e Esclarecido para Atendimento via Telemedicina
            </CardTitle>
            <p className="text-muted-foreground text-center mt-2">
              Prontia Saúde
            </p>
          </CardHeader>
          <CardContent>
            <TermosContent />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Termos;
