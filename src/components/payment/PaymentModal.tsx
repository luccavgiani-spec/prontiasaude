import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CardPaymentForm } from './CardPaymentForm';
import { PixPaymentForm } from './PixPaymentForm';
import { validateCPF, formatCPF, cleanCPF } from '@/lib/cpf-validator';
import { createPayment, pollPixStatus, PaymentPayload } from '@/lib/mercadopago-api';
import { trackInitiateCheckout, trackPurchase } from '@/lib/meta-tracking';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Loader2, Clock } from 'lucide-react';

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sku: string;
  serviceName: string;
  amount: number; // em centavos
  especialidade?: string;
  onSuccess: (paymentId: string) => void;
}

type PaymentMethod = 'card' | 'pix';
type PaymentStatus = 'idle' | 'processing' | 'approved' | 'rejected' | 'pending_pix' | 'in_process';

interface FormData {
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  especialidade?: string;
}

interface PixData {
  qr_code: string;
  qr_code_base64: string;
  payment_id: string;
}

const ESPECIALIDADES = [
  'Personal Trainer',
  'Nutricionista',
  'Reumatologista',
  'Neurologista',
  'Infectologista',
  'Nutrólogo',
  'Geriatria',
  'Cardiologista',
  'Dermatologista',
  'Endocrinologista',
  'Gastroenterologista',
  'Ginecologista',
  'Oftalmologista',
  'Ortopedista',
  'Pediatra',
  'Otorrinolaringologista',
  'Médico da Família',
  'Psiquiatra',
];

export function PaymentModal({
  open,
  onOpenChange,
  sku,
  serviceName,
  amount,
  especialidade,
  onSuccess,
}: PaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('idle');
  const [formData, setFormData] = useState<FormData>({
    nome: '',
    email: '',
    cpf: '',
    telefone: '',
    especialidade: especialidade || '',
  });
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [error, setError] = useState<string>('');
  const [paymentId, setPaymentId] = useState<string>('');

  const publicKey = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || '';

  // Track InitiateCheckout quando abre modal
  useEffect(() => {
    if (open) {
      trackInitiateCheckout({
        value: amount / 100,
        content_name: serviceName,
        content_ids: [sku],
      });

      // Pré-preencher dados se usuário logado
      loadUserData();
    } else {
      // Reset ao fechar
      setPaymentStatus('idle');
      setError('');
      setPixData(null);
      setPaymentId('');
    }
  }, [open, amount, serviceName, sku]);

  const loadUserData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: patient } = await supabase
        .from('patients')
        .select('first_name, last_name, cpf, phone_e164')
        .eq('id', user.id)
        .single();

      if (patient) {
        const fullName = [patient.first_name, patient.last_name].filter(Boolean).join(' ');
        setFormData({
          nome: fullName,
          email: user.email || '',
          cpf: patient.cpf || '',
          telefone: patient.phone_e164 || '',
          especialidade: especialidade || '',
        });
      } else {
        // Sem dados do paciente, usar apenas email do user
        setFormData({
          ...formData,
          email: user.email || '',
        });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const validateForm = (): boolean => {
    if (!formData.nome.trim()) {
      setError('Nome é obrigatório');
      return false;
    }
    if (!formData.email.trim()) {
      setError('Email é obrigatório');
      return false;
    }
    if (!validateCPF(formData.cpf)) {
      setError('CPF inválido');
      return false;
    }
    if (!formData.telefone.trim()) {
      setError('Telefone é obrigatório');
      return false;
    }
    
    // Validar especialidade para SKUs de médicos especialistas
    if (sku.includes('especialista') && !formData.especialidade) {
      setError('Selecione uma especialidade');
      return false;
    }

    setError('');
    return true;
  };

  const buildSchedulePayload = () => {
    return {
      cpf: cleanCPF(formData.cpf),
      email: formData.email,
      nome: formData.nome,
      telefone: formData.telefone.replace(/\D/g, ''),
      especialidade: formData.especialidade,
      sku: sku,
      horario_iso: new Date().toISOString(),
      plano_ativo: sku.includes('PLANO_'),
    };
  };

  const handleCardSubmit = async (cardData: {
    token: string;
    payment_method_id: string;
    installments: number;
  }) => {
    if (!validateForm()) return;

    setPaymentStatus('processing');
    setError('');

    const payload: PaymentPayload = {
      method: 'card',
      token: cardData.token,
      transaction_amount: amount / 100,
      payment_method_id: cardData.payment_method_id,
      installments: cardData.installments,
      description: serviceName,
      payer: {
        email: formData.email,
        identification: {
          type: 'CPF',
          number: cleanCPF(formData.cpf),
        },
      },
      schedulePayload: buildSchedulePayload(),
    };

    const response = await createPayment(payload);

    if (!response.success) {
      setPaymentStatus('rejected');
      setError(response.error || 'Erro ao processar pagamento');
      toast.error('Pagamento rejeitado');
      return;
    }

    // Handle status
    if (response.status === 'approved') {
      setPaymentStatus('approved');
      setPaymentId(response.payment_id || '');
      
      // Track purchase
      trackPurchase({
        value: amount / 100,
        order_id: response.payment_id || '',
        content_name: serviceName,
        contents: [{ id: sku, quantity: 1 }],
      });

      toast.success('Pagamento aprovado!');
      
      // Redirect após 3s
      setTimeout(() => {
        onSuccess(response.payment_id || '');
      }, 3000);
    } else if (response.status === 'rejected') {
      setPaymentStatus('rejected');
      setError('Pagamento rejeitado. Tente outro cartão.');
      toast.error('Pagamento rejeitado');
    } else if (response.status === 'in_process') {
      setPaymentStatus('in_process');
      setPaymentId(response.payment_id || '');
      toast.info('Pagamento em análise...');
      
      // Start light polling
      startPollingForCardPayment(response.payment_id || '');
    }
  };

  const handlePixSubmit = async () => {
    if (!validateForm()) return;

    setPaymentStatus('processing');
    setError('');

    const payload: PaymentPayload = {
      method: 'pix',
      transaction_amount: amount / 100,
      description: serviceName,
      payer: {
        email: formData.email,
      },
      schedulePayload: buildSchedulePayload(),
    };

    const response = await createPayment(payload);

    if (!response.success || !response.qr_code) {
      setPaymentStatus('rejected');
      setError(response.error || 'Erro ao gerar QR Code PIX');
      toast.error('Erro ao gerar PIX');
      return;
    }

    // Exibir QR Code
    setPixData({
      qr_code: response.qr_code,
      qr_code_base64: response.qr_code_base64 || '',
      payment_id: response.payment_id || '',
    });
    setPaymentStatus('pending_pix');
    setPaymentId(response.payment_id || '');

    // Start polling
    pollPixStatus(response.payment_id || '', (status) => {
      if (status === 'approved') {
        setPaymentStatus('approved');
        
        // Track purchase
        trackPurchase({
          value: amount / 100,
          order_id: response.payment_id || '',
          content_name: serviceName,
          contents: [{ id: sku, quantity: 1 }],
        });

        toast.success('Pagamento PIX confirmado!');
        
        setTimeout(() => {
          onSuccess(response.payment_id || '');
        }, 3000);
      } else if (status === 'rejected') {
        setPaymentStatus('rejected');
        setError('Pagamento PIX rejeitado');
        toast.error('Pagamento rejeitado');
      }
    });
  };

  const startPollingForCardPayment = (id: string) => {
    // Polling leve para cartão in_process (5s por 2min)
    pollPixStatus(id, (status) => {
      if (status === 'approved') {
        setPaymentStatus('approved');
        trackPurchase({
          value: amount / 100,
          order_id: id,
          content_name: serviceName,
          contents: [{ id: sku, quantity: 1 }],
        });
        toast.success('Pagamento aprovado!');
        setTimeout(() => onSuccess(id), 3000);
      } else if (status === 'rejected') {
        setPaymentStatus('rejected');
        setError('Pagamento rejeitado após análise');
        toast.error('Pagamento rejeitado');
      }
    });
  };

  const handleTryAgain = () => {
    setPaymentStatus('idle');
    setError('');
    setPixData(null);
  };

  const renderStatus = () => {
    switch (paymentStatus) {
      case 'processing':
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-medium">Processando pagamento...</p>
          </div>
        );

      case 'approved':
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <CheckCircle className="h-16 w-16 text-green-600" />
            <p className="text-xl font-bold text-green-600">Pagamento Aprovado!</p>
            <p className="text-muted-foreground">Redirecionando...</p>
          </div>
        );

      case 'rejected':
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <XCircle className="h-16 w-16 text-red-600" />
            <p className="text-xl font-bold text-red-600">Pagamento Rejeitado</p>
            <p className="text-muted-foreground">{error || 'Tente outro método de pagamento'}</p>
            <button
              onClick={handleTryAgain}
              className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              Tentar Novamente
            </button>
          </div>
        );

      case 'in_process':
        return (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Clock className="h-16 w-16 text-yellow-600 animate-pulse" />
            <p className="text-xl font-bold text-yellow-600">Analisando Pagamento...</p>
            <p className="text-muted-foreground text-center">
              Seu pagamento está sendo analisado.<br />
              Você receberá confirmação em breve.
            </p>
          </div>
        );

      case 'pending_pix':
        return pixData ? (
          <PixPaymentForm
            qrCode={pixData.qr_code}
            qrCodeBase64={pixData.qr_code_base64}
            onCancel={() => onOpenChange(false)}
          />
        ) : null;

      default:
        return null;
    }
  };

  const showForm = paymentStatus === 'idle';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">
            {serviceName}
          </DialogTitle>
          <p className="text-muted-foreground">
            Valor: <span className="font-bold text-primary">R$ {(amount / 100).toFixed(2)}</span>
          </p>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {!showForm && renderStatus()}

        {showForm && (
          <div className="space-y-6">
            {/* Form fields */}
            <div className="grid gap-4">
              <div>
                <Label htmlFor="nome">Nome Completo</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="Seu nome completo"
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
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    value={formData.cpf}
                    onChange={(e) => {
                      const cleaned = cleanCPF(e.target.value);
                      setFormData({ ...formData, cpf: formatCPF(cleaned) });
                    }}
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                </div>

                <div>
                  <Label htmlFor="telefone">Telefone</Label>
                  <Input
                    id="telefone"
                    value={formData.telefone}
                    onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                    placeholder="(11) 99999-9999"
                  />
                </div>
              </div>

              {/* Especialidade (condicional) */}
              {(sku.includes('especialista') || especialidade) && (
                <div>
                  <Label htmlFor="especialidade">Especialidade</Label>
                  <Select
                    value={formData.especialidade}
                    onValueChange={(value) => setFormData({ ...formData, especialidade: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a especialidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {ESPECIALIDADES.map((esp) => (
                        <SelectItem key={esp} value={esp}>
                          {esp}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Payment Tabs */}
            <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="card">💳 Cartão de Crédito</TabsTrigger>
                <TabsTrigger value="pix">📱 PIX</TabsTrigger>
              </TabsList>

              <TabsContent value="card" className="mt-6">
                <CardPaymentForm
                  publicKey={publicKey}
                  amount={amount}
                  onSubmit={handleCardSubmit}
                  onError={setError}
                  isProcessing={paymentStatus !== 'idle' && paymentStatus !== 'rejected'}
                />
              </TabsContent>

              <TabsContent value="pix" className="mt-6">
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Ao clicar em "Gerar QR Code PIX", você receberá um código para pagamento instantâneo.
                  </p>
                  <button
                    onClick={handlePixSubmit}
                    disabled={paymentStatus !== 'idle'}
                    className="w-full py-3 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                  >
                    {paymentStatus !== 'idle' ? 'Gerando...' : 'Gerar QR Code PIX'}
                  </button>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
