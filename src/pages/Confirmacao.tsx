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
        value: parseFloat(productValue) / 100,
        // Converter centavos para reais
        order_id: orderNsu,
        content_name: productName || 'Serviço Médico',
        content_category: 'servico_medico',
        contents: [{
          id: orderNsu,
          quantity: 1,
          item_price: parseFloat(productValue) / 100
        }]
      });
    }

    // Timer regressivo
    const timer = setInterval(() => {
      setCountdown(prev => {
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
  return <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
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
        {orderNsu && <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              Número do Pedido
            </p>
            <p className="text-sm font-mono font-semibold">
              {orderNsu}
            </p>
          </div>}

        {/* Timer */}
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-4">
            <div className="relative">
              <svg className="transform -rotate-90 w-24 h-24">
                <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-muted" />
                <circle cx="48" cy="48" r="44" stroke="currentColor" strokeWidth="8" fill="transparent" strokeDasharray={`${2 * Math.PI * 44}`} strokeDashoffset={`${2 * Math.PI * 44 * (1 - countdown / 30)}`} className="text-primary transition-all duration-1000 ease-linear" strokeLinecap="round" />
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
          <Button size="lg" onClick={handleRedirect} className="min-w-[200px]">
            Ir Agora
          </Button>

          {receiptUrl && <Button size="lg" variant="outline" onClick={() => window.open(receiptUrl, '_blank')} className="min-w-[200px]">
              Ver Comprovante
            </Button>}
        </div>

        {/* Informações adicionais */}
        <div className="pt-6 border-t space-y-4">
          <h3 className="font-semibold text-lg">Próximos Passos</h3>
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex justify-center">
                <svg className="w-8 h-8 text-green-500" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                </svg>
              </div>
              <p className="font-medium">Confirmação</p>
              <p className="text-muted-foreground">
                Você receberá o link da consulta
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
          Precisa de ajuda? Entre em contato com o{' '}
          <a href="https://wa.me/5511933359187" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            Suporte
          </a>
        </div>
      </Card>
    </div>;
};
export default Confirmacao;