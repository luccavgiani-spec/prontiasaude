import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";
import PrivacidadeContent from "@/components/legal/PrivacidadeContent";

const Privacidade = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <Card>
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-primary/10 rounded-full">
                <Shield className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold text-center">
              Política de Privacidade — Prontia Saúde
            </CardTitle>
            <p className="text-muted-foreground text-center mt-2">
              Última atualização: 01 de abril de 2026
            </p>
          </CardHeader>
          <CardContent>
            <PrivacidadeContent />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Privacidade;
