import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Loader2, Plus, Power, PowerOff, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { CreateCouponModal } from "./CreateCouponModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CouponUse {
  id: string;
  coupon_code: string;
  used_by_name: string;
  used_by_email: string;
  service_or_plan_name: string;
  owner_email: string;
  owner_pix_key: string | null;
  amount_original: number;
  amount_discounted: number;
  discount_percentage: number;
  used_at: string;
  reviewed: boolean;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

interface ActiveCoupon {
  id: string;
  code: string;
  coupon_type: string;
  discount_percentage: number;
  pix_key: string | null;
  is_active: boolean;
  created_at: string;
  owner_user_id: string;
  owner_email?: string;
  owner_name?: string;
}

interface PendingCoupon {
  id: string;
  payment_id: string;
  order_id: string | null;
  email: string;
  coupon_code: string;
  sku: string | null;
  amount_cents: number;
  amount_original: number | null;
  discount_percentage: number | null;
  status: string;
  created_at: string;
}

export function CouponsTab() {
  const [couponUses, setCouponUses] = useState<CouponUse[]>([]);
  const [activeCoupons, setActiveCoupons] = useState<ActiveCoupon[]>([]);
  const [pendingCoupons, setPendingCoupons] = useState<PendingCoupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingActive, setIsLoadingActive] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [couponToDelete, setCouponToDelete] = useState<string | null>(null);
  const [verifyingPayment, setVerifyingPayment] = useState<string | null>(null);

  useEffect(() => {
    loadCouponUses();
    loadActiveCoupons();
    loadPendingCoupons();
  }, []);

  const loadCouponUses = async () => {
    try {
      const { data, error } = await supabase
        .from('coupon_uses')
        .select('*')
        .order('reviewed', { ascending: true })
        .order('used_at', { ascending: false });

      if (error) throw error;

      setCouponUses(data || []);
    } catch (error) {
      console.error('Erro ao carregar cupons utilizados:', error);
      toast.error("Erro ao carregar cupons");
    } finally {
      setIsLoading(false);
    }
  };

  const loadActiveCoupons = async () => {
    setIsLoadingActive(true);
    try {
      const { data, error } = await supabase
        .from('user_coupons')
        .select(`
          id,
          code,
          coupon_type,
          discount_percentage,
          pix_key,
          is_active,
          created_at,
          owner_user_id
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enriquecer com dados do owner
      const enrichedCoupons = await Promise.all(
        (data || []).map(async (coupon) => {
          const { data: patient } = await supabase
            .from('patients')
            .select('email, first_name, last_name')
            .eq('id', coupon.owner_user_id)
            .single();

          return {
            ...coupon,
            owner_email: patient?.email || 'Admin',
            owner_name: patient?.first_name 
              ? `${patient.first_name} ${patient.last_name || ''}`.trim()
              : 'Admin',
          };
        })
      );

      setActiveCoupons(enrichedCoupons);
    } catch (error) {
      console.error('Erro ao carregar cupons ativos:', error);
      toast.error("Erro ao carregar cupons ativos");
    } finally {
      setIsLoadingActive(false);
    }
  };

  const loadPendingCoupons = async () => {
    try {
      const { data, error } = await supabase
        .from('pending_payments')
        .select('*')
        .not('coupon_code', 'is', null)
        .eq('status', 'pending')
        .eq('processed', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao carregar cupons pendentes:', error);
        return;
      }

      setPendingCoupons(data || []);
      console.log(`Cupons pendentes carregados: ${data?.length || 0}`);
    } catch (error) {
      console.error('Erro ao carregar cupons pendentes:', error);
    }
  };

  const handleVerifyPayment = async (paymentId: string, email: string) => {
    setVerifyingPayment(paymentId);
    
    try {
      console.log(`Verificando pagamento ${paymentId}...`);
      
      const { data, error } = await supabase.functions.invoke(
        'process-pending-coupon',
        { body: { payment_id: paymentId } }
      );
      
      if (error) {
        console.error('Erro na função:', error);
        throw error;
      }

      console.log('Resposta da função:', data);
      
      if (data.success && data.status === 'approved') {
        toast.success(`✅ Pagamento confirmado! Cupom de ${email} processado.`);
        await loadPendingCoupons();
        await loadCouponUses();
      } else if (data.status === 'pending') {
        toast.warning('⏳ Pagamento ainda está pendente no Mercado Pago');
      } else if (data.status === 'rejected') {
        toast.error('❌ Pagamento foi rejeitado');
      } else {
        toast.error(`Status: ${data.status} - ${data.message}`);
      }
    } catch (err) {
      console.error('Erro ao verificar pagamento:', err);
      toast.error('Erro ao verificar pagamento. Veja o console.');
    } finally {
      setVerifyingPayment(null);
    }
  };

  const handleToggleCoupon = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('user_coupons')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast.success(`Cupom ${!currentStatus ? 'ativado' : 'desativado'} com sucesso!`);
      loadActiveCoupons();
    } catch (error) {
      console.error('Erro ao alternar status do cupom:', error);
      toast.error("Erro ao alterar status do cupom");
    }
  };

  const handleDeleteCoupon = async () => {
    if (!couponToDelete) return;

    try {
      const { error } = await supabase
        .from('user_coupons')
        .delete()
        .eq('id', couponToDelete);

      if (error) throw error;

      toast.success("Cupom deletado com sucesso!");
      loadActiveCoupons();
    } catch (error) {
      console.error('Erro ao deletar cupom:', error);
      toast.error("Erro ao deletar cupom");
    } finally {
      setDeleteDialogOpen(false);
      setCouponToDelete(null);
    }
  };

  const handleToggleReviewed = async (id: string, currentStatus: boolean) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('coupon_uses')
        .update({
          reviewed: !currentStatus,
          reviewed_at: !currentStatus ? new Date().toISOString() : null,
          reviewed_by: !currentStatus ? user?.id : null,
        })
        .eq('id', id);

      if (error) throw error;

      toast.success(`Cupom marcado como ${!currentStatus ? 'conferido' : 'não conferido'}!`);
      loadCouponUses();
    } catch (error) {
      console.error('Erro ao marcar cupom:', error);
      toast.error("Erro ao atualizar status de revisão");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para a área de transferência!");
  };

  if (isLoading && isLoadingActive) {
    return (
      <Card>
        <CardContent className="pt-6 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cupons Pendentes */}
      {pendingCoupons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 text-yellow-600 animate-spin" />
              Cupons Pendentes
            </CardTitle>
            <CardDescription>
              Pagamentos PIX com cupons aplicados aguardando confirmação - Clique em "Verificar" para processar manualmente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Código do Cupom</TableHead>
                    <TableHead>Serviço/Plano</TableHead>
                    <TableHead className="text-right">Valor Original</TableHead>
                    <TableHead className="text-right">Valor com Desconto</TableHead>
                    <TableHead>Data da Solicitação</TableHead>
                    <TableHead className="text-center">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingCoupons.map((pending) => (
                    <TableRow key={pending.id}>
                      <TableCell className="font-medium text-xs">
                        {pending.email}
                      </TableCell>
                      
                      <TableCell>
                        <code className="text-xs font-mono bg-yellow-100 px-2 py-1 rounded">
                          {pending.coupon_code}
                        </code>
                      </TableCell>
                      
                      <TableCell className="text-sm">
                        {pending.sku || 'N/A'}
                      </TableCell>
                      
                      <TableCell className="text-right text-muted-foreground">
                        R$ {((pending.amount_original || 0) / 100).toFixed(2)}
                      </TableCell>
                      
                      <TableCell className="text-right font-semibold text-yellow-600">
                        R$ {(pending.amount_cents / 100).toFixed(2)}
                      </TableCell>
                      
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(parseISO(pending.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleVerifyPayment(pending.payment_id, pending.email)}
                          disabled={verifyingPayment === pending.payment_id}
                          className="h-8"
                        >
                          {verifyingPayment === pending.payment_id ? (
                            <>
                              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                              Verificando...
                            </>
                          ) : (
                            <>
                              🔍 Verificar
                            </>
                          )}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cupons Utilizados */}
      <Card>
        <CardHeader>
          <CardTitle>✅ Cupons Utilizados</CardTitle>
          <CardDescription>
            Cupons efetivamente utilizados em compras pagas - Confira e marque como analisados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {couponUses.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum cupom foi utilizado ainda
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Conferido</TableHead>
                    <TableHead>Nome de quem usou</TableHead>
                    <TableHead>Código do cupom</TableHead>
                    <TableHead>Produto Vendido</TableHead>
                    <TableHead>E-mail do dono</TableHead>
                    <TableHead>Chave PIX do dono</TableHead>
                    <TableHead className="text-right">Valor Original</TableHead>
                    <TableHead className="text-right">Valor com Desconto</TableHead>
                    <TableHead>Data de uso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {couponUses.map((use) => (
                    <TableRow 
                      key={use.id}
                      className={use.reviewed ? 'bg-muted/50 text-muted-foreground' : ''}
                    >
                      <TableCell>
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={use.reviewed}
                            onCheckedChange={() => handleToggleReviewed(use.id, use.reviewed)}
                            disabled={use.reviewed}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{use.used_by_name}</TableCell>
                      <TableCell>
                        <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                          {use.coupon_code}
                        </code>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={use.service_or_plan_name}>
                        <span className="font-medium">{use.service_or_plan_name}</span>
                      </TableCell>
                      <TableCell className="text-xs">{use.owner_email}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <code className="text-xs font-mono">
                            {use.owner_pix_key || '-'}
                          </code>
                          {use.owner_pix_key && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard(use.owner_pix_key!)}
                              className="h-6 w-6 p-0"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        R$ {(use.amount_original / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        R$ {(use.amount_discounted / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(parseISO(use.used_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cupons Gerados */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle>📝 Cupons Gerados</CardTitle>
            <CardDescription>
              Cupons criados manualmente via dashboard para campanhas e parcerias
            </CardDescription>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Gerar Cupom
          </Button>
        </CardHeader>
        <CardContent>
          {isLoadingActive ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : activeCoupons.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum cupom ativo ainda. Clique em "Gerar Cupom" para criar o primeiro.
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Desconto</TableHead>
                    <TableHead>Dono</TableHead>
                    <TableHead>Chave PIX</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeCoupons.map((coupon) => (
                    <TableRow key={coupon.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono bg-muted px-2 py-1 rounded font-semibold">
                            {coupon.code}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(coupon.code)}
                            className="h-6 w-6 p-0"
                            title="Copiar código"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={coupon.coupon_type === 'SERVICE' ? 'default' : 'secondary'}>
                          {coupon.coupon_type === 'SERVICE' ? 'Serviço' : 'Plano'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {coupon.discount_percentage}%
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p className="font-medium">{coupon.owner_name}</p>
                          <p className="text-xs text-muted-foreground">{coupon.owner_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs font-mono">
                          {coupon.pix_key || '-'}
                        </code>
                      </TableCell>
                      <TableCell>
                        <Badge variant={coupon.is_active ? 'default' : 'secondary'}>
                          {coupon.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(parseISO(coupon.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleCoupon(coupon.id, coupon.is_active)}
                            className="h-7 px-2"
                            title={coupon.is_active ? 'Desativar' : 'Ativar'}
                          >
                            {coupon.is_active ? (
                              <PowerOff className="h-3 w-3" />
                            ) : (
                              <Power className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setCouponToDelete(coupon.id);
                              setDeleteDialogOpen(true);
                            }}
                            className="h-7 px-2 text-destructive hover:text-destructive"
                            title="Deletar"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Criação */}
      <CreateCouponModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSuccess={() => {
          loadActiveCoupons();
        }}
      />

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este cupom? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCoupon} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
