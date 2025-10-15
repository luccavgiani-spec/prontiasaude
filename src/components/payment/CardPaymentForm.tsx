import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface CardPaymentFormProps {
  publicKey: string;
  amount: number;
  onSubmit: (cardData: {
    token: string;
    payment_method_id: string;
    installments: number;
  }) => void;
  onError: (error: string) => void;
  isProcessing: boolean;
}

export function CardPaymentForm({
  publicKey,
  amount,
  onSubmit,
  onError,
  isProcessing,
}: CardPaymentFormProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const cardFormRef = useRef<any>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    // Carrega SDK do Mercado Pago
    const loadMercadoPagoSDK = () => {
      if (document.getElementById('mercadopago-sdk')) {
        initializeCardForm();
        return;
      }

      const script = document.createElement('script');
      script.id = 'mercadopago-sdk';
      script.src = 'https://sdk.mercadopago.com/js/v2';
      script.async = true;
      script.onload = () => {
        console.log('[CardForm] SDK loaded');
        initializeCardForm();
      };
      script.onerror = () => {
        onError('Erro ao carregar SDK do Mercado Pago');
      };
      document.body.appendChild(script);
    };

    const initializeCardForm = () => {
      if (mountedRef.current) return;
      mountedRef.current = true;

      try {
        // @ts-ignore - MercadoPago global
        const mp = new window.MercadoPago(publicKey, {
          locale: 'pt-BR',
        });

        const cardForm = mp.cardForm({
          amount: String((amount / 100).toFixed(2)),
          iframe: true,
          form: {
            id: 'form-checkout',
            cardNumber: {
              id: 'form-checkout__cardNumber',
              placeholder: 'Número do cartão',
            },
            expirationDate: {
              id: 'form-checkout__expirationDate',
              placeholder: 'MM/AA',
            },
            securityCode: {
              id: 'form-checkout__securityCode',
              placeholder: 'CVV',
            },
            cardholderName: {
              id: 'form-checkout__cardholderName',
              placeholder: 'Titular do cartão',
            },
            issuer: {
              id: 'form-checkout__issuer',
              placeholder: 'Banco emissor',
            },
            installments: {
              id: 'form-checkout__installments',
              placeholder: 'Parcelas',
            },
            identificationType: {
              id: 'form-checkout__identificationType',
            },
            identificationNumber: {
              id: 'form-checkout__identificationNumber',
              placeholder: 'CPF',
            },
            cardholderEmail: {
              id: 'form-checkout__cardholderEmail',
              placeholder: 'E-mail',
            },
          },
          callbacks: {
            onFormMounted: (error: any) => {
              if (error) {
                console.error('[CardForm] Mount error:', error);
                onError('Erro ao carregar formulário de pagamento');
                return;
              }
              console.log('[CardForm] Mounted successfully');
              setIsLoaded(true);
            },
            onSubmit: (event: any) => {
              event.preventDefault();
              
              const {
                token,
                payment_method_id,
                installments,
              } = cardForm.getCardFormData();

              if (!token) {
                onError('Token do cartão não foi gerado. Verifique os dados.');
                return;
              }

              console.log('[CardForm] Token generated:', token.substring(0, 10) + '...');
              
              onSubmit({
                token,
                payment_method_id,
                installments: parseInt(installments),
              });
            },
            onFetching: (resource: string) => {
              console.log('[CardForm] Fetching:', resource);
            },
          },
        });

        cardFormRef.current = cardForm;
      } catch (error) {
        console.error('[CardForm] Initialization error:', error);
        onError('Erro ao inicializar formulário de cartão');
      }
    };

    loadMercadoPagoSDK();

    return () => {
      // Cleanup
      mountedRef.current = false;
    };
  }, [publicKey, amount, onSubmit, onError]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cardFormRef.current) {
      const form = document.getElementById('form-checkout') as HTMLFormElement;
      if (form) {
        form.requestSubmit();
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Formulário do Mercado Pago */}
      <form id="form-checkout" className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Número do Cartão</label>
          <div id="form-checkout__cardNumber" className="mp-input" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Validade</label>
            <div id="form-checkout__expirationDate" className="mp-input" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">CVV</label>
            <div id="form-checkout__securityCode" className="mp-input" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Nome no Cartão</label>
          <div id="form-checkout__cardholderName" className="mp-input" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">CPF</label>
          <div id="form-checkout__identificationNumber" className="mp-input" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">E-mail</label>
          <div id="form-checkout__cardholderEmail" className="mp-input" />
        </div>

        <div className="hidden">
          <select id="form-checkout__identificationType">
            <option value="CPF">CPF</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Banco Emissor</label>
          <select id="form-checkout__issuer" className="w-full p-3 border rounded-lg" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Parcelas</label>
          <select id="form-checkout__installments" className="w-full p-3 border rounded-lg" />
        </div>
      </form>

      {/* Loading state */}
      {!isLoaded && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Carregando formulário...</span>
        </div>
      )}

      {/* Submit button */}
      <Button
        type="button"
        onClick={handleSubmit}
        disabled={!isLoaded || isProcessing}
        className="w-full bg-green-600 hover:bg-green-700 text-white"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processando...
          </>
        ) : (
          'Pagar com Cartão'
        )}
      </Button>

      {/* Selo Mercado Pago */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
        </svg>
        <span>Ambiente seguro Mercado Pago</span>
      </div>
    </div>
  );
}
