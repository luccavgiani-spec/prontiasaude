import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, FileText, ExternalLink } from "lucide-react";

export default function Confirmacao() {
  const [searchParams] = useSearchParams();
  const [orderData, setOrderData] = useState({
    receipt_url: searchParams.get("receipt_url") || "",
    order_nsu: searchParams.get("order_nsu") || "",
    slug: searchParams.get("slug") || "",
    capture_method: searchParams.get("capture_method") || "",
    transaction_nsu: searchParams.get("transaction_nsu") || ""
  });

  useEffect(() => {
    // Atualizar dados quando os parâmetros mudarem
    setOrderData({
      receipt_url: searchParams.get("receipt_url") || "",
      order_nsu: searchParams.get("order_nsu") || "",
      slug: searchParams.get("slug") || "",
      capture_method: searchParams.get("capture_method") || "",
      transaction_nsu: searchParams.get("transaction_nsu") || ""
    });
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background py-16">
      <div className="container mx-auto px-4 max-w-2xl">
        <Card className="shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-3xl font-bold text-foreground">
              Pagamento Confirmado!
            </CardTitle>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="text-center">
              <p className="text-lg text-muted-foreground mb-4">
                Seu pagamento foi processado com sucesso. Em breve você receberá mais informações no seu WhatsApp.
              </p>
            </div>

            {orderData.order_nsu && (
              <div className="bg-muted/30 rounded-lg p-4">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Detalhes do Pedido
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Número do Pedido:</span>
                    <span className="font-medium text-foreground">{orderData.order_nsu}</span>
                  </div>
                  {orderData.transaction_nsu && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">NSU da Transação:</span>
                      <span className="font-medium text-foreground">{orderData.transaction_nsu}</span>
                    </div>
                  )}
                  {orderData.capture_method && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Método de Captura:</span>
                      <span className="font-medium text-foreground capitalize">{orderData.capture_method}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {orderData.receipt_url && (
              <div className="text-center">
                <Button asChild variant="outline" className="gap-2">
                  <a href={orderData.receipt_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                    Ver Comprovante
                  </a>
                </Button>
              </div>
            )}

            <div className="border-t pt-6 space-y-4">
              <h3 className="font-semibold text-foreground text-center">Próximos Passos</h3>
              <ol className="space-y-3 text-sm text-muted-foreground">
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-xs">1</span>
                  <span>Você receberá uma confirmação no WhatsApp com mais detalhes</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-xs">2</span>
                  <span>Nossa equipe entrará em contato para agendar sua consulta ou prosseguir com o serviço solicitado</span>
                </li>
                <li className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold text-xs">3</span>
                  <span>Mantenha seu WhatsApp ativo para receber as instruções de acesso</span>
                </li>
              </ol>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button asChild variant="default" className="flex-1">
                <Link to="/">Voltar ao Início</Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link to="/servicos">Ver Outros Serviços</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
