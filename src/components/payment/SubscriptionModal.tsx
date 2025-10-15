import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle2, XCircle, Shield } from 'lucide-react';
import { createSubscription, pollSubscriptionStatus } from '@/lib/mercadopago-api';
import { validateCPF } from '@/lib/cpf-validator';
import { supabase } from '@/integrations/supabase/client';
import { CardPaymentForm } from './CardPaymentForm';
import type { SubscriptionPayload } from '@/lib/types/plan';

const MERCADOPAGO_PUBLIC_KEY = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || '';

interface SubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sku: string;
  planName: string;
  amount: number; // centavos
  frequency: number;
  frequencyType: 'months' | 'days';
  onSuccess: (subscriptionId: string) => void;
}

type PaymentStatus = 'idle' | 'processing' | 'authorized' | 'confirming' | 'confirmed' | 'rejected' | 'error';

export function SubscriptionModal({
  open,
  onOpenChange,
  sku,
  planName,
  amount,
  frequency,
  frequencyType,
  onSuccess,
}: SubscriptionModalProps) {
  const [status, setStatus] = useState<PaymentStatus>('idle');
  const [error, setError] = useState<string>('');
  const [subscriptionId, setSubscriptionId] = useState<string>('');
  
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    cpf: '',
    telefone: '',
  });

  // Carregar dados do usuário
  useEffect(() => {
    if (open) {
      loadUserData();
    }
  }, [open]);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        setFormData(prev => ({
          ...prev,
          email: user.email || '',
          nome: user.user_metadata?.first_name || '',
        }));
      }
    } catch (err) {
      console.error('Error loading user data:', err);
    }
  };

  const handleCardSubmit = async (cardData: {
    token: string;
    payment_method_id: string;
    installments: number;
  }) => {
    try {
      setStatus('processing');
      setError('');

      // Validar CPF
      if (!validateCPF(formData.cpf)) {
        setError('CPF inválido');
        setStatus('idle');
        return;
      }

      // Criar payload de assinatura
      const payload: SubscriptionPayload = {
        payer_email: formData.email,
        card_token: cardData.token,
        reason: planName,
        auto_recurring: {
          frequency,
          frequency_type: frequencyType,
          transaction_amount: amount / 100,
          currency_id: 'BRL',
        },
        schedulePayload: {
          cpf: formData.cpf.replace(/\D/g, ''),
          email: formData.email,
          nome: formData.nome,
          telefone: formData.telefone.replace(/\D/g, ''),
          sku,
          plano_ativo: true,
        },
      };

      console.log('[Subscription] Creating subscription:', payload);
      const result = await createSubscription(payload);

      if (!result.success || result.status === 'rejected') {
        setError(result.error || 'Assinatura rejeitada. Verifique os dados do cartão.');
        setStatus('rejected');
        return;
      }

      if (result.status === 'authorized' && result.subscription_id) {
        setSubscriptionId(result.subscription_id);
        setStatus('authorized');
        
        // Iniciar polling para confirmar 1º pagamento
        setStatus('confirming');
        pollSubscriptionStatus(
          result.subscription_id,
          (newStatus) => {
            if (newStatus === 'confirmed') {
              setStatus('confirmed');
              setTimeout(() => {
                onSuccess(result.subscription_id!);
              }, 2000);
            } else if (newStatus === 'rejected') {
              setError('Primeiro pagamento rejeitado');
              setStatus('rejected');
            }
          }
        );
      }
    } catch (err) {
      console.error('[Subscription] Error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao processar assinatura');
      setStatus('error');
    }
  };

  const handleCardError = (errorMsg: string) => {
    setError(errorMsg);
    setStatus('error');
  };

  const handleClose = () => {
    if (status !== 'processing' && status !== 'confirming') {
      onOpenChange(false);
      setTimeout(() => {
        setStatus('idle');
        setError('');
        setSubscriptionId('');
      }, 300);
    }
  };

  const handleRetry = () => {
    setStatus('idle');
    setError('');
  };

  const isFormValid = Boolean(formData.nome && formData.email && formData.cpf && formData.telefone);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Assinar {planName}</DialogTitle>
        </DialogHeader>

        {/* Status Messages */}
        {status === 'processing' && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>Processando assinatura...</AlertDescription>
          </Alert>
        )}

        {status === 'confirming' && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>Confirmando primeiro pagamento...</AlertDescription>
          </Alert>
        )}

        {status === 'authorized' && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Assinatura autorizada! Aguardando confirmação do pagamento...
            </AlertDescription>
          </Alert>
        )}

        {status === 'confirmed' && (
          <Alert className="bg-green-50 border-green-200">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              ✅ Assinatura confirmada! Redirecionando...
            </AlertDescription>
          </Alert>
        )}

        {(status === 'rejected' || status === 'error') && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error || 'Erro ao processar assinatura'}</AlertDescription>
          </Alert>
        )}

        {/* Form */}
        {status === 'idle' && (
          <div className="space-y-4">
            {/* Dados pessoais */}
            <div className="space-y-4">
              <div>
                <Label htmlFor="nome">Nome Completo</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Seu nome completo"
                  required
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="seu@email.com"
                  required
                />
              </div>

              <div>
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  value={formData.cpf}
                  onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  required
                />
              </div>

              <div>
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                  maxLength={15}
                  required
                />
              </div>
            </div>

            {/* Informações da assinatura */}
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1 text-xs">
                  <p className="font-semibold">Cobrança recorrente automática:</p>
                  <p>
                    Valor: R$ {(amount / 100).toFixed(2)} a cada{' '}
                    {frequency} {frequencyType === 'months' ? 'mês(es)' : 'dia(s)'}
                  </p>
                  <p className="text-muted-foreground mt-2">
                    Você pode cancelar a assinatura a qualquer momento na área do paciente.
                  </p>
                </div>
              </AlertDescription>
            </Alert>

            {/* Card Form - só mostra se formulário válido */}
            {isFormValid && (
              <div className="pt-4 border-t">
                <h3 className="text-lg font-semibold mb-4">Dados do Cartão</h3>
                <CardPaymentForm
                  publicKey={MERCADOPAGO_PUBLIC_KEY}
                  amount={amount}
                  onSubmit={handleCardSubmit}
                  onError={handleCardError}
                  isProcessing={status === 'processing'}
                />
              </div>
            )}

            {!isFormValid && (
              <Alert>
                <AlertDescription className="text-sm">
                  Preencha todos os dados acima para continuar com o pagamento.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Retry Button */}
        {(status === 'rejected' || status === 'error') && (
          <div className="flex justify-center pt-4">
            <Button onClick={handleRetry} variant="outline">
              Tentar Novamente
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
