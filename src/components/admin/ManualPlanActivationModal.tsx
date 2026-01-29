import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CalendarClock } from "lucide-react";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { toast } from "sonner";
import { CATALOGO_SERVICOS, PLANOS } from "@/lib/constants";

// Helper para extrair SKUs únicos dos catálogos
const getAllSkus = () => {
  const servicoSkus = CATALOGO_SERVICOS.flatMap(s => {
    if (s.variantes) {
      return s.variantes.map(v => ({ sku: v.sku, nome: v.nome, preco: v.valor * 100 }));
    }
    return [{ sku: s.sku, nome: s.nome, preco: s.precoBase * 100 }];
  });
  
  // Planos básicos (mock - ajustar conforme necessário)
  const planSkus = [
    { sku: "BASIC", nome: "Plano Básico (30 dias)", preco: 2399 },
    { sku: "PREMIUM", nome: "Plano Premium", preco: 4999 },
    { sku: "FAMILY", nome: "Plano Família", preco: 7999 },
  ];
  
  return { servicoSkus, planSkus };
};

const { servicoSkus, planSkus } = getAllSkus();

interface ManualPlanActivationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    email: string;
    name: string;
    cpf?: string;
    currentPlan?: {
      code: string;
      expiresAt: string;
    };
  };
  onSuccess: () => void;
}

const DURATION_OPTIONS = [
  { value: "7", label: "7 dias (teste)" },
  { value: "30", label: "30 dias (padrão)" },
  { value: "60", label: "60 dias" },
  { value: "90", label: "90 dias" },
  { value: "365", label: "365 dias (anual)" },
];

export function ManualPlanActivationModal({ open, onOpenChange, user, onSuccess }: ManualPlanActivationModalProps) {
  const [planCode, setPlanCode] = useState<string>("");
  const [durationDays, setDurationDays] = useState<string>("30");
  const [sendEmail, setSendEmail] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleActivate = async () => {
    if (!planCode) {
      toast.error("Selecione um plano");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await invokeEdgeFunction('patient-operations', {
        body: {
          operation: 'activate_plan_manual',
          patient_email: user.email,
          patient_id: user.id,
          plan_code: planCode,
          duration_days: parseInt(durationDays),
          send_email: sendEmail
        }
      });

      if (error) {
        console.error('[ManualPlanActivationModal] Error:', error);
        const errorMsg = error?.message || 'Erro ao ativar plano. Verifique os logs.';
        toast.error(errorMsg);
        return;
      }

      // Verificar se a resposta indica sucesso
      if (!data?.success) {
        console.error('[ManualPlanActivationModal] Failed:', data);
        const step = data?.step ? `[${data.step}] ` : '';
        const details = data?.details ? ` (${data.details})` : '';
        toast.error(`${step}${data?.error || 'Erro ao ativar plano'}${details}`);
        return;
      }

      toast.success(`Plano ${planCode} ativado com sucesso!`);
      onSuccess();
    } catch (error) {
      console.error('[ManualPlanActivationModal] Exception:', error);
      toast.error('Erro inesperado ao ativar plano');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-green-600" />
            Ativação Manual de Plano
          </DialogTitle>
          <DialogDescription>
            Configure o plano que será ativado para este usuário
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* User Info */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Usuário:</span>
              <span className="text-sm">{user.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Email:</span>
              <span className="text-sm text-muted-foreground">{user.email}</span>
            </div>
            {user.cpf && (
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">CPF:</span>
                <span className="text-sm text-muted-foreground">{user.cpf}</span>
              </div>
            )}
          </div>

          {/* Current Plan Warning */}
          {user.currentPlan && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium">Plano atual será substituído</p>
                <p className="text-xs mt-1">
                  Plano: <Badge variant="outline" className="ml-1">{user.currentPlan.code}</Badge>
                </p>
              </div>
            </div>
          )}

          {/* Plan Selection */}
          <div className="space-y-2">
            <Label htmlFor="plan">Plano *</Label>
            <Select value={planCode} onValueChange={setPlanCode}>
              <SelectTrigger id="plan">
                <SelectValue placeholder="Selecione um plano..." />
              </SelectTrigger>
              <SelectContent>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  PLANOS RECORRENTES
                </div>
                {planSkus.map((plano) => (
                  <SelectItem key={plano.sku} value={plano.sku}>
                    {plano.nome} - R$ {(plano.preco / 100).toFixed(2)}
                  </SelectItem>
                ))}
                
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground mt-2">
                  SERVIÇOS AVULSOS
                </div>
                {servicoSkus.map((servico) => (
                  <SelectItem key={servico.sku} value={servico.sku}>
                    {servico.nome} - R$ {(servico.preco / 100).toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duration Selection */}
          <div className="space-y-2">
            <Label htmlFor="duration">Duração *</Label>
            <Select value={durationDays} onValueChange={setDurationDays}>
              <SelectTrigger id="duration">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Send Email Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="send-email"
              checked={sendEmail}
              onCheckedChange={(checked) => setSendEmail(checked as boolean)}
            />
            <Label
              htmlFor="send-email"
              className="text-sm font-normal cursor-pointer"
            >
              Enviar email de confirmação ao usuário
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleActivate}
            disabled={loading || !planCode}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? "Ativando..." : "Ativar Plano"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
