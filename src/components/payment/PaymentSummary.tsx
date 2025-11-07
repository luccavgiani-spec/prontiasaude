import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, QrCode, User, Mail, Phone, FileText } from "lucide-react";
import { formataPreco } from "@/lib/utils";

interface PaymentSummaryProps {
  serviceName: string;
  amount: number;
  formData: {
    name: string;
    email: string;
    cpf: string;
    phone: string;
  };
  recurring?: boolean;
  frequency?: number;
  frequencyType?: 'months' | 'days';
  onSelectPaymentMethod: (method: 'card' | 'pix') => void;
}

export function PaymentSummary({
  serviceName,
  amount,
  formData,
  recurring,
  frequency,
  frequencyType,
  onSelectPaymentMethod
}: PaymentSummaryProps) {
  const formatRecurringText = () => {
    if (!recurring || !frequency) return null;
    
    const frequencyText = frequencyType === 'months' 
      ? `${frequency} ${frequency === 1 ? 'mês' : 'meses'}`
      : `${frequency} ${frequency === 1 ? 'dia' : 'dias'}`;
    
    return `Cobrança a cada ${frequencyText}`;
  };

  return (
    <div className="space-y-6">
      {/* Resumo do Serviço */}
      <div className="text-center pb-4 border-b">
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Resumo da Compra
        </h3>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{serviceName}</p>
          <div className="flex items-baseline justify-center gap-2">
            <p className="text-3xl font-bold text-primary">
              {formataPreco(amount / 100)}
            </p>
            {recurring && (
              <Badge variant="secondary" className="text-xs">
                Recorrente
              </Badge>
            )}
          </div>
          {recurring && (
            <p className="text-xs text-muted-foreground">
              {formatRecurringText()}
            </p>
          )}
        </div>
      </div>

      {/* Dados do Cliente */}
      <Card className="bg-muted/30">
        <CardContent className="p-4 space-y-3">
          <h4 className="text-sm font-semibold text-foreground mb-3">
            Dados do pagador:
          </h4>
          
          <div className="flex items-start gap-3">
            <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Nome</p>
              <p className="text-sm font-medium text-foreground truncate">
                {formData.name || 'Não informado'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Mail className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">E-mail</p>
              <p className="text-sm font-medium text-foreground truncate">
                {formData.email || 'Não informado'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">CPF</p>
              <p className="text-sm font-medium text-foreground">
                {formData.cpf || 'Não informado'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Phone className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Telefone</p>
              <p className="text-sm font-medium text-foreground">
                {formData.phone || 'Não informado'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Métodos de Pagamento */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-foreground text-center">
          Escolha a forma de pagamento:
        </h4>
        
        <div className="grid grid-cols-1 gap-3">
          <Button
            onClick={() => onSelectPaymentMethod('card')}
            size="lg"
            variant="outline"
            className="w-full h-auto py-4 flex flex-col gap-2 hover:border-primary hover:bg-primary/5 transition-all group"
          >
            <CreditCard className="h-6 w-6 text-primary group-hover:scale-110 transition-transform" />
            <span className="font-semibold">Cartão de Crédito</span>
            <span className="text-xs text-muted-foreground">
              Aprovação imediata
            </span>
          </Button>

          {/* PIX disponível apenas para pagamentos únicos (não recorrentes) */}
          {!recurring && (
            <Button
              onClick={() => onSelectPaymentMethod('pix')}
              size="lg"
              variant="outline"
              className="w-full h-auto py-4 flex flex-col gap-2 hover:border-primary hover:bg-primary/5 transition-all group"
            >
              <QrCode className="h-6 w-6 text-primary group-hover:scale-110 transition-transform" />
              <span className="font-semibold">PIX</span>
              <span className="text-xs text-muted-foreground">
                Pagamento instantâneo
              </span>
            </Button>
          )}
        </div>
        
        {/* Aviso quando PIX não está disponível */}
        {recurring && (
          <p className="text-xs text-center text-muted-foreground mt-2">
            ℹ️ Para planos recorrentes, apenas cartão de crédito está disponível
          </p>
        )}
      </div>

      {/* Informações adicionais */}
      <div className="text-center pt-4 border-t">
        <p className="text-xs text-muted-foreground">
          🔒 Pagamento 100% seguro e criptografado
        </p>
      </div>
    </div>
  );
}
