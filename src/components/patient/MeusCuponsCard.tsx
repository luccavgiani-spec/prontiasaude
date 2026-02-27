import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getHybridSession } from "@/lib/auth-hybrid";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { Copy, Info, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Coupon {
  id: string;
  code: string;
  coupon_type: string;
  discount_percentage: number;
  pix_key: string | null;
}

export function MeusCuponsCard() {
  const [serviceCoupon, setServiceCoupon] = useState<Coupon | null>(null);
  const [planCoupon, setPlanCoupon] = useState<Coupon | null>(null);
  const [pixKey, setPixKey] = useState("");
  const [isLoadingCoupons, setIsLoadingCoupons] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPixModal, setShowPixModal] = useState(false);
  const [pendingCouponType, setPendingCouponType] = useState<'SERVICE' | 'PLAN' | null>(null);

  useEffect(() => {
    loadCoupons();
  }, []);

  // ✅ CORREÇÃO: Buscar cupons sempre da Produção via Edge Function
  const loadCoupons = async () => {
    try {
      const { session } = await getHybridSession();
      const user = session?.user;
      
      if (!user) {
        setIsLoadingCoupons(false);
        return;
      }
      
      console.log('[MeusCuponsCard] Carregando cupons via Edge Function (Produção)');
      
      const { data, error } = await invokeEdgeFunction('admin-coupon-operations', {
        body: {
          operation: 'list_by_owner',
          owner_user_id: user.id,
        }
      });
        
      if (error) throw error;
      
      const coupons = data?.coupons || [];
      if (coupons.length > 0) {
        const service = coupons.find((c: any) => c.coupon_type === 'SERVICE');
        const plan = coupons.find((c: any) => c.coupon_type === 'PLAN');
        setServiceCoupon(service || null);
        setPlanCoupon(plan || null);

        if (service?.pix_key || plan?.pix_key) {
          setPixKey(service?.pix_key || plan?.pix_key || "");
        }
      }
    } catch (error) {
      console.error('Erro ao carregar cupons:', error);
    } finally {
      setIsLoadingCoupons(false);
    }
  };

  const generateCouponCode = (userName: string, userId: string, type: 'SERVICE' | 'PLAN'): string => {
    const cleanName = userName.toUpperCase().replace(/\s+/g, '').slice(0, 6);
    const userSuffix = userId.slice(0, 4).toUpperCase();
    const typeSuffix = type === 'SERVICE' ? 'S5' : 'P5';
    return `${cleanName}${userSuffix}${typeSuffix}`;
  };

  const handleGenerateCoupon = async (type: 'SERVICE' | 'PLAN') => {
    if (!pixKey) {
      setPendingCouponType(type);
      setShowPixModal(true);
      return;
    }
    await createCoupon(type);
  };

  const handleSavePixAndGenerateCoupon = async () => {
    if (!pixKey.trim()) {
      toast.error("Por favor, informe sua chave PIX");
      return;
    }
    setShowPixModal(false);
    if (pendingCouponType) {
      await createCoupon(pendingCouponType);
      setPendingCouponType(null);
    }
  };

  // ✅ CORREÇÃO: Criar cupons sempre na Produção via Edge Function
  const createCoupon = async (type: 'SERVICE' | 'PLAN') => {
    try {
      setIsGenerating(true);
      
      const { session } = await getHybridSession();
      const user = session?.user;
      
      if (!user) {
        toast.error("Você precisa estar logado");
        return;
      }

      // Buscar nome do paciente via Edge Function de produção
      const { data: patientData } = await invokeEdgeFunction('admin-coupon-operations', {
        body: {
          operation: 'get_patient_name',
          user_id: user.id,
        }
      });
        
      const userName = patientData?.first_name || 'USER';
      const code = generateCouponCode(userName, user.id, type);
      const discountPercentage = 5;

      // ✅ Criar cupom na Produção via Edge Function (service_role bypassa RLS)
      const { data, error } = await invokeEdgeFunction('admin-coupon-operations', {
        body: {
          operation: 'create',
          code,
          coupon_type: type,
          discount_percentage: discountPercentage,
          pix_key: pixKey,
          owner_user_id: user.id,
        }
      });
        
      if (error) {
        console.error('Erro ao gerar cupom:', error);
        toast.error(error.message || "Erro ao gerar cupom. Tente novamente.");
        return;
      }

      if (data?.success && data?.coupon) {
        const coupon = data.coupon;
        if (type === 'SERVICE') {
          setServiceCoupon(coupon);
        } else {
          setPlanCoupon(coupon);
        }
        toast.success(`Cupom para ${type === 'SERVICE' ? 'serviços' : 'planos'} gerado com sucesso!`);
      } else if (data?.error?.includes('duplicate') || data?.error?.includes('unique')) {
        // Cupom já existe, recarregar
        await loadCoupons();
        toast.success("Cupom já existe!");
      } else {
        toast.error(data?.error || "Erro ao gerar cupom. Tente novamente.");
      }
    } catch (error) {
      console.error('Erro ao gerar cupom:', error);
      toast.error("Erro ao gerar cupom. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Código copiado para a área de transferência!");
  };

  if (isLoadingCoupons) {
    return <Card className="medical-card">
        <CardContent className="pt-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>;
  }

  return <>
      <Card className="medical-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            🎟️ Meus Cupons de Desconto
          </CardTitle>
          <CardDescription>Indique um amigo, ele usa seu cupom e você ganha R$10 no PIX. Simples assim!</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!pixKey && <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Para gerar cupons, você precisa cadastrar sua chave PIX
              </AlertDescription>
            </Alert>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button onClick={() => handleGenerateCoupon('SERVICE')} disabled={isGenerating || !!serviceCoupon} variant={serviceCoupon ? "secondary" : "default"}>
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "🛍️ "}
              {serviceCoupon ? "Cupom já gerado" : "Gerar cupom para serviços (5% OFF)"}
            </Button>

            <Button onClick={() => handleGenerateCoupon('PLAN')} disabled={isGenerating || !!planCoupon} variant={planCoupon ? "secondary" : "default"}>
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "💎 "}
              {planCoupon ? "Cupom já gerado" : "Gerar cupom para planos (5% OFF)"}
            </Button>
          </div>

          {serviceCoupon && <div className="p-4 bg-muted rounded-lg space-y-2">
              <Label className="text-sm font-semibold">Cupom para serviços avulsos (5% OFF):</Label>
              <div className="flex items-center gap-2">
                <Input value={serviceCoupon.code} readOnly className="font-mono font-bold text-base" />
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(serviceCoupon.code)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>}

          {planCoupon && <div className="p-4 bg-muted rounded-lg space-y-2">
              <Label className="text-sm font-semibold">Cupom para planos (5% OFF):</Label>
              <div className="flex items-center gap-2">
                <Input value={planCoupon.code} readOnly className="font-mono font-bold text-base" />
                <Button size="sm" variant="outline" onClick={() => copyToClipboard(planCoupon.code)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>}

          {pixKey && <div className="pt-4 border-t">
              <Label className="text-sm text-muted-foreground">
                Chave PIX cadastrada: <span className="font-mono">{pixKey}</span>
              </Label>
            </div>}
        </CardContent>
      </Card>

      {/* Modal de cadastro PIX */}
      <Dialog open={showPixModal} onOpenChange={setShowPixModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastre sua Chave PIX</DialogTitle>
            <DialogDescription>
              Para gerar cupons e receber repasses, informe sua chave PIX
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="pix">Chave PIX *</Label>
              <Input id="pix" placeholder="Digite sua chave PIX" value={pixKey} onChange={e => setPixKey(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                Pode ser CPF, e-mail, telefone ou chave aleatória
              </p>
            </div>
            <Button onClick={handleSavePixAndGenerateCoupon} disabled={!pixKey.trim()} className="w-full">
              Salvar e gerar cupom
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>;
}
