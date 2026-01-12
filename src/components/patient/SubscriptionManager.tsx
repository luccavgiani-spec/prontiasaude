import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  RefreshCw, 
  Pause, 
  XCircle, 
  CreditCard, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock
} from "lucide-react";
import { formatPlanName } from "@/lib/patient-plan";

interface Subscription {
  id: string;
  mp_subscription_id: string;
  mp_status: string;
  plan_code: string;
  amount_cents: number;
  frequency: number;
  frequency_type: string;
  next_payment_date?: string;
  last_payment_date?: string;
  created_at: string;
}

interface SubscriptionManagerProps {
  subscription: Subscription;
  onUpdate?: () => void;
}

export function SubscriptionManager({ subscription, onUpdate }: SubscriptionManagerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showPauseDialog, setShowPauseDialog] = useState(false);

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  const formatAmount = (cents: number) => {
    return (cents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "authorized":
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" /> Ativa</Badge>;
      case "paused":
        return <Badge className="bg-yellow-500"><Pause className="w-3 h-3 mr-1" /> Pausada</Badge>;
      case "cancelled":
        return <Badge className="bg-red-500"><XCircle className="w-3 h-3 mr-1" /> Cancelada</Badge>;
      case "pending":
        return <Badge className="bg-blue-500"><Clock className="w-3 h-3 mr-1" /> Pendente</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const handlePause = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("mp-pause-subscription", {
        body: { subscription_id: subscription.id }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success("Assinatura pausada com sucesso!");
      setShowPauseDialog(false);
      onUpdate?.();
    } catch (error: any) {
      console.error("[SubscriptionManager] Erro ao pausar:", error);
      toast.error(error.message || "Erro ao pausar assinatura");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("mp-cancel-subscription", {
        body: { subscription_id: subscription.id }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast.success("Assinatura cancelada. Seu plano continua ativo até a data de expiração.");
      setShowCancelDialog(false);
      onUpdate?.();
    } catch (error: any) {
      console.error("[SubscriptionManager] Erro ao cancelar:", error);
      toast.error(error.message || "Erro ao cancelar assinatura");
    } finally {
      setIsLoading(false);
    }
  };

  const getFrequencyText = () => {
    if (subscription.frequency === 1) {
      return subscription.frequency_type === "months" ? "mensal" : "diária";
    }
    return subscription.frequency_type === "months" 
      ? `a cada ${subscription.frequency} meses`
      : `a cada ${subscription.frequency} dias`;
  };

  const isActive = subscription.mp_status === "authorized";
  const isPaused = subscription.mp_status === "paused";
  const isCancelled = subscription.mp_status === "cancelled";

  return (
    <>
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <RefreshCw className="h-5 w-5 text-primary" />
              Assinatura Recorrente
            </CardTitle>
            {getStatusBadge(subscription.mp_status)}
          </div>
          <CardDescription>
            Renovação automática {getFrequencyText()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Informações da assinatura */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Plano:</span>
              <p className="font-medium">{formatPlanName(subscription.plan_code)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Valor:</span>
              <p className="font-medium">{formatAmount(subscription.amount_cents)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Último pagamento:</span>
              <p className="font-medium">{formatDate(subscription.last_payment_date)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Próxima cobrança:</span>
              <p className="font-medium flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(subscription.next_payment_date)}
              </p>
            </div>
          </div>

          {/* Alerta para assinatura pausada */}
          {isPaused && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <Pause className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800 text-sm">
                Sua assinatura está pausada. Entre em contato para reativar.
              </AlertDescription>
            </Alert>
          )}

          {/* Alerta para assinatura cancelada */}
          {isCancelled && (
            <Alert className="border-red-200 bg-red-50">
              <XCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800 text-sm">
                Assinatura cancelada. Seu plano permanece ativo até a data de expiração.
              </AlertDescription>
            </Alert>
          )}

          {/* Ações disponíveis */}
          {isActive && (
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPauseDialog(true)}
                disabled={isLoading}
                className="flex-1"
              >
                <Pause className="h-4 w-4 mr-2" />
                Pausar
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCancelDialog(true)}
                disabled={isLoading}
                className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            </div>
          )}

          {/* Info adicional */}
          <p className="text-xs text-muted-foreground text-center pt-2">
            Dúvidas? Fale conosco pelo WhatsApp: 0800 000 8780
          </p>
        </CardContent>
      </Card>

      {/* Dialog de Pausar */}
      <Dialog open={showPauseDialog} onOpenChange={setShowPauseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pausar Assinatura</DialogTitle>
            <DialogDescription>
              Ao pausar sua assinatura, as cobranças automáticas serão suspensas. 
              Seu plano continua ativo até a data de expiração atual.
            </DialogDescription>
          </DialogHeader>
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800 text-sm">
              Para reativar, entre em contato com nosso suporte.
            </AlertDescription>
          </Alert>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPauseDialog(false)}>
              Voltar
            </Button>
            <Button onClick={handlePause} disabled={isLoading}>
              {isLoading ? "Pausando..." : "Confirmar Pausa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Cancelar */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Assinatura</DialogTitle>
            <DialogDescription>
              Ao cancelar, você não será mais cobrado automaticamente. 
              Seu plano permanece ativo até a data de expiração.
            </DialogDescription>
          </DialogHeader>
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 text-sm">
              Esta ação não pode ser desfeita. Para assinar novamente, 
              será necessário fazer um novo pagamento.
            </AlertDescription>
          </Alert>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
              Voltar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleCancel} 
              disabled={isLoading}
            >
              {isLoading ? "Cancelando..." : "Confirmar Cancelamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
