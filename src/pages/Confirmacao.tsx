import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { INFINITEPAY_CONFIG } from '@/lib/infinitepay-checkout';
import { trackPurchase } from '@/lib/meta-tracking';

const Confirmacao = () => {
  const [countdown, setCountdown] = useState(30);
  const [searchParams] = useSearchParams();

  // Extrair dados da URL se disponíveis
  const orderNsu = searchParams.get('order_nsu');
  const receiptUrl = searchParams.get('receipt_url');
  const productName = searchParams.get('product_name');
  const productValue = searchParams.get('value');

  useEffect(() => {
    // Track Purchase event
    if (orderNsu && productValue) {
      trackPurchase({
        value: parseFloat(productValue) / 100, // Converter centavos para reais
        order_id: orderNsu,
        content_name: productName || 'Serviço Médico',
        content_category: 'servico_medico',
        contents: [{
          id: orderNsu,
          quantity: 1,
          item_price: parseFloat(productValue) / 100,
        }],
      });
    }

    // Timer regressivo
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleRedirect();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [orderNsu, productValue, productName]);

  const handleRedirect = () => {
    window.location.href = INFINITEPAY_CONFIG.partnerRedirectUrl;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-8 text-center space-y-6">
        {/* Ícone de sucesso */}
        <div className="flex justify-center">
          <div className="rounded-full bg-green-100 dark:bg-green-900/20 p-6">
            <CheckCircle className="h-16 w-16 text-green-600 dark:text-green-400" />
          </div>
        </div>

        {/* Título */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            Pagamento Aprovado!
          </h1>
          <p className="text-lg text-muted-foreground">
            Estamos preparando seu acesso.
          </p>
        </div>

        {/* Detalhes do pedido */}
        {orderNsu && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              Número do Pedido
            </p>
            <p className="text-sm font-mono font-semibold">
              {orderNsu}
            </p>
          </div>
        )}

        {/* Timer */}
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-4">
            <div className="relative">
              <svg className="transform -rotate-90 w-24 h-24">
                <circle
                  cx="48"
                  cy="48"
                  r="44"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  className="text-muted"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="44"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 44}`}
                  strokeDashoffset={`${2 * Math.PI * 44 * (1 - countdown / 30)}`}
                  className="text-primary transition-all duration-1000 ease-linear"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl font-bold">{countdown}</span>
              </div>
            </div>
          </div>

          <p className="text-muted-foreground">
            Estamos preparando o redirecionamento para a plataforma parceira de consultas e agendamentos.
          </p>
        </div>

        {/* Botões de ação */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            onClick={handleRedirect}
            className="min-w-[200px]"
          >
            Ir Agora
          </Button>

          {receiptUrl && (
            <Button
              size="lg"
              variant="outline"
              onClick={() => window.open(receiptUrl, '_blank')}
              className="min-w-[200px]"
            >
              Ver Comprovante
            </Button>
          )}
        </div>

        {/* Informações adicionais */}
        <div className="pt-6 border-t space-y-4">
          <h3 className="font-semibold text-lg">Próximos Passos</h3>
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <div className="space-y-2">
              <div className="text-2xl">📧</div>
              <p className="font-medium">Verifique seu e-mail</p>
              <p className="text-muted-foreground">
                Enviamos a confirmação e instruções
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-2xl">📱</div>
              <p className="font-medium">Acesse a plataforma</p>
              <p className="text-muted-foreground">
                Você será redirecionado automaticamente
              </p>
            </div>
            <div className="space-y-2">
              <div className="text-2xl">🩺</div>
              <p className="font-medium">Realize sua consulta</p>
              <p className="text-muted-foreground">
                Atendimento rápido e de qualidade
              </p>
            </div>
          </div>
        </div>

        {/* Suporte */}
        <div className="text-sm text-muted-foreground">
          Precisa de ajuda? Entre em contato:{' '}
          <a 
            href="mailto:suporte@prontiasaude.com.br" 
            className="text-primary hover:underline"
          >
            suporte@prontiasaude.com.br
          </a>
        </div>
      </Card>
    </div>
  );
};

export default Confirmacao;
