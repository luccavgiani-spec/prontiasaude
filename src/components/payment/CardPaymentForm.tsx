import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertCircle } from 'lucide-react';
import { extractBIN } from '@/lib/card-utils';
import { InstallmentOption } from '@/lib/types/payment';
import { toast } from 'sonner';
import { GAS_BASE } from '@/lib/constants';

interface CardPaymentFormProps {
  publicKey: string;
  amount: number;
  onSubmit: (cardData: {
    token: string;
    payment_method_id: string;
    installments: number;
  }) => void;
  onError: (error: string) => void;
  onCardDataChange?: (data: { number: string; holder: string; expiry: string }) => void;
  isProcessing: boolean;
}

const SDK_LOAD_TIMEOUT = 15000; // 15 segundos

export function CardPaymentForm({
  publicKey,
  amount,
  onSubmit,
  onError,
  onCardDataChange,
  isProcessing,
}: CardPaymentFormProps) {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [installmentsOptions, setInstallmentsOptions] = useState<InstallmentOption[]>([]);
  const [selectedInstallments, setSelectedInstallments] = useState(1);
  const [isLoadingInstallments, setIsLoadingInstallments] = useState(false);
  const [currentBIN, setCurrentBIN] = useState<string>('');
  
  const cardFormRef = useRef<any>(null);
  const mountedRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    loadMercadoPagoSDK();

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      mountedRef.current = false;
    };
  }, [publicKey, amount]);

  const loadMercadoPagoSDK = () => {
    // Verificar se SDK já está carregado
    if (document.getElementById('mercadopago-sdk')) {
      initializeCardForm();
      return;
    }

    // Iniciar timeout
    timeoutRef.current = setTimeout(() => {
      if (!isSDKLoaded) {
        setSdkError('Tempo limite excedido ao carregar formulário');
        onError('Erro ao carregar formulário de pagamento — tente atualizar a página.');
        console.error('[CardForm] SDK load timeout');
      }
    }, SDK_LOAD_TIMEOUT);

    // Carregar SDK
    const script = document.createElement('script');
    script.id = 'mercadopago-sdk';
    script.src = 'https://sdk.mercadopago.com/js/v2';
    script.async = true;
    script.onload = () => {
      console.log('[CardForm] SDK loaded successfully');
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      initializeCardForm();
    };
    script.onerror = () => {
      setSdkError('Erro ao carregar SDK');
      onError('Erro ao carregar formulário de pagamento — tente atualizar a página.');
      console.error('[CardForm] SDK load error');
    };
    document.body.appendChild(script);
  };

  const initializeCardForm = () => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    try {
      console.log('[CardForm] Initializing with PUBLIC_KEY:', publicKey.substring(0, 20) + '...');
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
            placeholder: 'Nome como está no cartão',
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
              setSdkError('Erro ao carregar formulário');
              onError('Erro ao carregar formulário de pagamento');
              return;
            }
            console.log('[CardForm] Mounted successfully');
            setIsSDKLoaded(true);
          },
          onSubmit: (event: any) => {
            event.preventDefault();
            handleFormSubmit();
          },
          onFetching: (resource: string) => {
            console.log('[CardForm] Fetching:', resource);
            
            // Detectar quando número do cartão muda para buscar parcelas
            if (resource.includes('payment_methods')) {
              const cardNumberInput = document.querySelector('[data-checkout="cardNumber"]') as HTMLInputElement;
              if (cardNumberInput) {
                const bin = extractBIN(cardNumberInput.value);
                if (bin.length === 6 && bin !== currentBIN) {
                  setCurrentBIN(bin);
                  fetchInstallments(bin);
                }
                
                // Atualizar preview
                if (onCardDataChange) {
                  const holderInput = document.querySelector('[data-checkout="cardholderName"]') as HTMLInputElement;
                  const expiryInput = document.querySelector('[data-checkout="cardExpirationDate"]') as HTMLInputElement;
                  
                  onCardDataChange({
                    number: cardNumberInput?.value || '',
                    holder: holderInput?.value || '',
                    expiry: expiryInput?.value || '',
                  });
                }
              }
            }
          },
        },
      });

      cardFormRef.current = cardForm;
    } catch (error) {
      console.error('[CardForm] Initialization error:', error);
      setSdkError('Erro ao inicializar formulário');
      onError('Erro ao inicializar formulário de cartão');
    }
  };

  const fetchInstallments = async (bin: string) => {
    setIsLoadingInstallments(true);
    console.log('[CardForm] Fetching installments for BIN:', bin);

    try {
      const url = `${GAS_BASE}?path=mp-get-installments&amount=${(amount / 100).toFixed(2)}&bin=${bin}`;
      console.log('[CardForm] Fetching installments from:', url);
      const response = await fetch(url);
      
      const data = await response.json();

      if (data.success && data.installments && data.installments.length > 0) {
        setInstallmentsOptions(data.installments);
        setSelectedInstallments(1);
        console.log('[CardForm] Installments loaded:', data.installments.length);
      } else {
        // Fallback: 1x sem juros
        setInstallmentsOptions([
          {
            installments: 1,
            installment_amount: amount / 100,
            total_amount: amount / 100,
          },
        ]);
        toast.info('Pagamento disponível apenas à vista.');
        console.warn('[CardForm] No installments returned, using fallback');
      }
    } catch (error) {
      console.error('[CardForm] Error fetching installments:', error);
      console.error('[CardForm] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      // Fallback: 1x sem juros
      setInstallmentsOptions([
        {
          installments: 1,
          installment_amount: amount / 100,
          total_amount: amount / 100,
        },
      ]);
      toast.error('Erro ao carregar opções de parcelamento. Pagamento à vista.');
    } finally {
      setIsLoadingInstallments(false);
    }
  };

  const handleFormSubmit = () => {
    if (!cardFormRef.current) {
      onError('Formulário não inicializado');
      return;
    }

    try {
      const formData = cardFormRef.current.getCardFormData();
      const { token, payment_method_id } = formData;

      if (!token) {
        onError('Token do cartão não foi gerado. Verifique os dados.');
        toast.error('Dados do cartão inválidos');
        return;
      }

      console.log('[CardForm] Token generated successfully');
      
      onSubmit({
        token,
        payment_method_id,
        installments: selectedInstallments,
      });
    } catch (error) {
      console.error('[CardForm] Tokenization error:', error);
      onError('Erro ao processar dados do cartão. Verifique as informações.');
      toast.error('Erro ao processar cartão');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cardFormRef.current) {
      const form = document.getElementById('form-checkout') as HTMLFormElement;
      if (form) {
        form.requestSubmit();
      }
    }
  };

  const handleRetry = () => {
    setSdkError(null);
    setIsSDKLoaded(false);
    mountedRef.current = false;
    loadMercadoPagoSDK();
  };

  // Mostrar erro com botão de retry
  if (sdkError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <AlertCircle className="h-12 w-12 text-red-600" />
        <p className="text-lg font-medium text-red-600">Erro ao Carregar Formulário</p>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          {sdkError}. Tente atualizar a página ou clique no botão abaixo.
        </p>
        <Button onClick={handleRetry} variant="outline">
          Tentar Novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Formulário do Mercado Pago */}
      <form id="form-checkout" className="space-y-4" onSubmit={handleManualSubmit}>
        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">Número do Cartão</label>
          <div id="form-checkout__cardNumber" className="mp-input" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">Validade</label>
            <div id="form-checkout__expirationDate" className="mp-input" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">CVV</label>
            <div id="form-checkout__securityCode" className="mp-input" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">Nome no Cartão</label>
          <div id="form-checkout__cardholderName" className="mp-input" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">CPF</label>
          <div id="form-checkout__identificationNumber" className="mp-input" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-foreground">E-mail</label>
          <div id="form-checkout__cardholderEmail" className="mp-input" />
        </div>

        <div className="hidden">
          <select id="form-checkout__identificationType">
            <option value="CPF">CPF</option>
          </select>
        </div>

        {/* Dropdown de Parcelas Customizado */}
        {installmentsOptions.length > 0 && (
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">Parcelas</label>
            <Select
              value={String(selectedInstallments)}
              onValueChange={(value) => setSelectedInstallments(Number(value))}
              disabled={isLoadingInstallments}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione o parcelamento" />
              </SelectTrigger>
              <SelectContent>
                {installmentsOptions.map((option) => (
                  <SelectItem key={option.installments} value={String(option.installments)}>
                    {option.installments}x de R$ {option.installment_amount.toFixed(2)}
                    {option.recommended_message && ` - ${option.recommended_message}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </form>

      {/* Loading state */}
      {!isSDKLoaded && !sdkError && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Carregando formulário seguro...</span>
        </div>
      )}

      {/* Submit button */}
      {isSDKLoaded && (
        <>
          <Button
            type="button"
            onClick={handleManualSubmit}
            disabled={isProcessing || isLoadingInstallments}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processando Pagamento...
              </>
            ) : (
              'Confirmar Pagamento'
            )}
          </Button>

          {/* Selo Mercado Pago */}
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <span>Ambiente seguro • Mercado Pago</span>
          </div>
        </>
      )}
    </div>
  );
}
