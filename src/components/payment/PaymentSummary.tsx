import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreditCard, QrCode, User, Mail, Phone, FileText, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
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
  sku?: string; // Para detectar se é um plano
  onSelectPaymentMethod: (method: 'card' | 'pix') => void;
  
  // Props de cupom
  couponCode: string;
  setCouponCode: (code: string) => void;
  appliedCoupon: {
    is_valid: boolean;
    coupon_id: string;
    coupon_code: string;
    discount_percentage: number;
    amount_original: number;
    amount_discounted: number;
    owner_user_id: string;
    owner_email: string;
    owner_pix_key: string;
  } | null;
  isValidatingCoupon: boolean;
  couponError: string;
  onApplyCoupon: () => void;
  onRemoveCoupon: () => void;
}

// Helper para detectar se é um plano (individual ou familiar)
const isPlanSku = (sku?: string): boolean => {
  if (!sku) return false;
  return sku.startsWith('IND_') || sku.startsWith('FAM_');
};

export function PaymentSummary({
  serviceName,
  amount,
  formData,
  recurring,
  frequency,
  frequencyType,
  sku,
  onSelectPaymentMethod,
  couponCode,
  setCouponCode,
  appliedCoupon,
  isValidatingCoupon,
  couponError,
  onApplyCoupon,
  onRemoveCoupon
}: PaymentSummaryProps) {
  // PIX é bloqueado para planos (IND_* ou FAM_*) e para recorrências
  const isPixBlocked = recurring || isPlanSku(sku);
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

      {/* Campo de Cupom */}
      <div className="border-t pt-4">
        <Label htmlFor="coupon">Cupom de desconto (opcional)</Label>
        <div className="flex gap-2 mt-2">
          <Input
            id="coupon"
            placeholder="Digite o código do cupom"
            value={couponCode}
            onChange={(e) => {
              setCouponCode(e.target.value.toUpperCase());
            }}
            disabled={!!appliedCoupon || isValidatingCoupon}
            className="uppercase"
          />
          {!appliedCoupon && (
            <Button
              onClick={onApplyCoupon}
              disabled={!couponCode || isValidatingCoupon}
              variant="outline"
            >
              {isValidatingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
            </Button>
          )}
          {appliedCoupon && (
            <Button
              onClick={onRemoveCoupon}
              variant="ghost"
              size="icon"
              title="Remover cupom"
            >
              <AlertCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        {couponError && (
          <p className="text-sm text-destructive mt-2">{couponError}</p>
        )}
        
        {appliedCoupon && (
          <div className="mt-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md">
            <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">
                Cupom aplicado! Desconto de {appliedCoupon.discount_percentage}%
              </span>
            </div>
            <div className="text-sm text-green-700 dark:text-green-300 mt-1">
              De <span className="line-through">R$ {(appliedCoupon.amount_original / 100).toFixed(2)}</span> por{" "}
              <span className="font-semibold">R$ {(appliedCoupon.amount_discounted / 100).toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

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

          {/* PIX disponível apenas para serviços avulsos (não planos e não recorrentes) */}
          {!isPixBlocked && (
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
        {isPixBlocked && (
          <p className="text-xs text-center text-muted-foreground mt-2">
            ℹ️ Para planos, apenas cartão de crédito está disponível
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
