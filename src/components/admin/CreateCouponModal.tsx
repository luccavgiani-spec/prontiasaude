import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";

interface CreateCouponModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateCouponModal({ open, onOpenChange, onSuccess }: CreateCouponModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    couponType: "SERVICE" as "SERVICE" | "PLAN",
    discountPercentage: "",
    ownerEmail: "",
    pixKey: "",
  });

  const generateRandomCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "ADMIN_";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, code }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.code.trim()) {
      toast.error("Código do cupom é obrigatório!");
      return;
    }

    const discount = parseInt(formData.discountPercentage);
    if (isNaN(discount) || discount < 1 || discount > 100) {
      toast.error("Porcentagem deve estar entre 1 e 100!");
      return;
    }

    setIsLoading(true);

    try {
      // 1. Verificar se código já existe
      const { data: existing } = await supabase
        .from('user_coupons')
        .select('code')
        .eq('code', formData.code.toUpperCase())
        .single();

      if (existing) {
        toast.error("Este código de cupom já existe!");
        setIsLoading(false);
        return;
      }

      // 2. Resolver owner_user_id
      let ownerId: string;

      if (formData.ownerEmail.trim()) {
        // Buscar paciente pelo email
        const { data: patient } = await supabase
          .from('patients')
          .select('id')
          .eq('email', formData.ownerEmail.trim())
          .single();

        if (!patient) {
          toast.error("E-mail do dono não encontrado no sistema!");
          setIsLoading(false);
          return;
        }

        ownerId = patient.id;
      } else {
        // Usar admin como owner
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          toast.error("Erro ao identificar usuário admin!");
          setIsLoading(false);
          return;
        }
        ownerId = user.id;
      }

      // 3. Inserir cupom
      const { error } = await supabase
        .from('user_coupons')
        .insert({
          owner_user_id: ownerId,
          code: formData.code.toUpperCase(),
          coupon_type: formData.couponType,
          discount_percentage: discount,
          pix_key: formData.pixKey.trim() || null,
          is_active: true,
        });

      if (error) {
        console.error("Erro ao criar cupom:", error);
        toast.error("Erro ao criar cupom!");
        setIsLoading(false);
        return;
      }

      toast.success(`Cupom ${formData.code.toUpperCase()} criado com sucesso! 🎉`);
      
      // Reset form
      setFormData({
        code: "",
        couponType: "SERVICE",
        discountPercentage: "",
        ownerEmail: "",
        pixKey: "",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao criar cupom:", error);
      toast.error("Erro inesperado ao criar cupom!");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Gerar Cupom Customizado</DialogTitle>
          <DialogDescription>
            Crie um cupom com porcentagem de desconto personalizada
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Código do Cupom */}
          <div className="space-y-2">
            <Label htmlFor="code">Código do Cupom *</Label>
            <div className="flex gap-2">
              <Input
                id="code"
                placeholder="Ex: PROMO50, DESCONTO25"
                value={formData.code}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  code: e.target.value.toUpperCase().replace(/\s/g, '') 
                }))}
                className="flex-1"
                required
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={generateRandomCode}
                title="Gerar código aleatório"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Clique no botão para gerar um código aleatório
            </p>
          </div>

          {/* Tipo de Cupom */}
          <div className="space-y-2">
            <Label htmlFor="type">Tipo de Cupom *</Label>
            <Select
              value={formData.couponType}
              onValueChange={(value: "SERVICE" | "PLAN") => 
                setFormData(prev => ({ ...prev, couponType: value }))
              }
            >
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SERVICE">Serviço (consulta avulsa)</SelectItem>
                <SelectItem value="PLAN">Plano (assinatura)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {formData.couponType === "SERVICE" 
                ? "Aplica desconto em consultas avulsas" 
                : "Aplica desconto em planos mensais/anuais"}
            </p>
          </div>

          {/* Porcentagem de Desconto */}
          <div className="space-y-2">
            <Label htmlFor="discount">Porcentagem de Desconto (%) *</Label>
            <Input
              id="discount"
              type="number"
              min="1"
              max="100"
              placeholder="Ex: 10, 25, 50"
              value={formData.discountPercentage}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                discountPercentage: e.target.value 
              }))}
              required
            />
            <p className="text-xs text-muted-foreground">
              Valor entre 1% e 100%
            </p>
          </div>

          {/* E-mail do Dono (Opcional) */}
          <div className="space-y-2">
            <Label htmlFor="ownerEmail">E-mail do Dono (opcional)</Label>
            <Input
              id="ownerEmail"
              type="email"
              placeholder="paciente@exemplo.com"
              value={formData.ownerEmail}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                ownerEmail: e.target.value 
              }))}
            />
            <p className="text-xs text-muted-foreground">
              Deixe vazio para usar seu usuário admin como dono
            </p>
          </div>

          {/* Chave PIX (Opcional) */}
          <div className="space-y-2">
            <Label htmlFor="pixKey">Chave PIX (opcional)</Label>
            <Input
              id="pixKey"
              placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
              value={formData.pixKey}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                pixKey: e.target.value 
              }))}
            />
            <p className="text-xs text-muted-foreground">
              Para rastreamento de comissões (se aplicável)
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                "Gerar Cupom"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
