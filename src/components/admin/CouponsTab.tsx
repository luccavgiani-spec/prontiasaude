import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabaseProduction } from "@/lib/supabase-production";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { Copy, Loader2, Plus, Power, PowerOff, Trash2, CheckCircle2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
  original_amount: number;
  discount_amount: number;
  final_amount: number;
  discount_percent: number;
  created_at: string;
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
  patient_email: string;
  coupon_code: string;
  sku: string | null;
  amount: number;
  status: string;
  created_at: string;
}

interface BatchVerificationResult {
  success: boolean;
  summary: {
    total: number;
    approved: number;
    pending: number;
    refunded: number;
    rejected: number;
    errors: number;
  };
  details: Array<{
    payment_id: string;
    email: string;
    coupon_code: string;
    sku: string;
    mp_status: string;
    processed: boolean;
    message: string;
  }>;
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
  const [isVerifyingAll, setIsVerifyingAll] = useState(false);
  const [batchResult, setBatchResult] = useState<BatchVerificationResult | null>(null);
  const [showResultModal, setShowResultModal] = useState(false);

  useEffect(() => {
    loadCouponUses();
    loadActiveCoupons();
    loadPendingCoupons();
  }, []);

  const loadCouponUses = async () => {
    try {
      // Ler de Produção
      const { data, error } = await supabaseProduction
        .from('coupon_uses')
        .select('*')
        .order('reviewed', { ascending: true })
        .order('created_at', { ascending: false });

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
      // Ler de Produção
      const { data, error } = await supabaseProduction
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
          const { data: patient } = await supabaseProduction
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
      // Ler de Produção
      const { data, error } = await supabaseProduction
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
      
      const { data, error } = await invokeEdgeFunction(
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

  const handleVerifyAllPayments = async () => {
    if (pendingCoupons.length === 0) {
      toast.warning('Não há cupons pendentes para verificar');
      return;
    }
    
    setIsVerifyingAll(true);
    
    try {
      console.log(`Verificando ${pendingCoupons.length} cupons pendentes em lote...`);
      
      const { data, error } = await invokeEdgeFunction(
        'process-all-pending-coupons'
      );
      
      if (error) throw error;
      
      console.log('Resultado da verificação em lote:', data);
      
      setBatchResult(data);
      setShowResultModal(true);
      
      // Recarregar listas
      await loadPendingCoupons();
      await loadCouponUses();
      
      // Toast com resumo rápido
      if (data.summary.approved > 0) {
        toast.success(`✅ ${data.summary.approved} cupom(ns) processado(s) com sucesso!`);
      }
      if (data.summary.pending > 0) {
        toast.info(`⏳ ${data.summary.pending} ainda pendente(s)`);
      }
      if (data.summary.refunded > 0 || data.summary.rejected > 0) {
        toast.warning(`🔄 ${data.summary.refunded + data.summary.rejected} estornado(s)/rejeitado(s)`);
      }
      
    } catch (err) {
      console.error('Erro na verificação em lote:', err);
      toast.error('Erro ao verificar pagamentos em lote. Veja o console.');
    } finally {
      setIsVerifyingAll(false);
    }
  };

  // ✅ Usar edge function com service_role para bypass de RLS
  const handleToggleCoupon = async (id: string, currentStatus: boolean) => {
    try {
      const { data, error } = await invokeEdgeFunction('admin-coupon-operations', {
        body: {
          operation: 'toggle',
          id: id,
          is_active: !currentStatus,
        }
      });

      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || 'Erro desconhecido');
      }

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
      const { data, error } = await invokeEdgeFunction('admin-coupon-operations', {
        body: {
          operation: 'delete',
          id: couponToDelete,
        }
      });

      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || 'Erro desconhecido');
      }

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
      const { data, error } = await invokeEdgeFunction('admin-coupon-operations', {
        body: {
          operation: 'mark_reviewed',
          id: id,
          admin_reviewed: !currentStatus,
        }
      });

      if (error || !data?.success) {
        throw new Error(error?.message || data?.error || 'Erro desconhecido');
      }

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
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 text-yellow-600 animate-spin" />
                Cupons Pendentes
              </CardTitle>
              <CardDescription className="mt-1.5">
                Pagamentos PIX com cupons aplicados aguardando confirmação
              </CardDescription>
            </div>
            <Button
              onClick={handleVerifyAllPayments}
              disabled={isVerifyingAll || pendingCoupons.length === 0}
              variant="default"
              size="sm"
            >
              {isVerifyingAll ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  🔍 Verificar Todos ({pendingCoupons.length})
                </>
              )}
            </Button>
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
                        {pending.patient_email}
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
                        R$ {((pending.amount || 0) / 100).toFixed(2)}
                      </TableCell>
                      
                      <TableCell className="text-right font-semibold text-yellow-600">
                        R$ {(pending.amount / 100).toFixed(2)}
                      </TableCell>
                      
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(parseISO(pending.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleVerifyPayment(pending.payment_id, pending.patient_email)}
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

      {/* MODAL: RESULTADO DA VERIFICAÇÃO EM LOTE */}
      <AlertDialog open={showResultModal} onOpenChange={setShowResultModal}>
        <AlertDialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Verificação em Lote Concluída
            </AlertDialogTitle>
          </AlertDialogHeader>
          
          {batchResult && (
            <div className="space-y-4">
              {/* Resumo */}
              <div className="bg-muted p-4 rounded-lg">
                <h3 className="font-semibold mb-2">📊 Resumo</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>Total verificados: {batchResult.summary.total}</div>
                  <div className="text-green-600">✅ Aprovados: {batchResult.summary.approved}</div>
                  <div className="text-blue-600">⏳ Pendentes: {batchResult.summary.pending}</div>
                  <div className="text-yellow-600">🔄 Estornados: {batchResult.summary.refunded}</div>
                  <div className="text-red-600">❌ Rejeitados: {batchResult.summary.rejected}</div>
                  {batchResult.summary.errors > 0 && (
                    <div className="text-orange-600">⚠️ Erros: {batchResult.summary.errors}</div>
                  )}
                </div>
              </div>
              
              {/* Detalhes */}
              <div>
                <h3 className="font-semibold mb-2">📋 Detalhes</h3>
                <div className="space-y-2 text-sm max-h-96 overflow-y-auto">
                  {batchResult.details.map((detail, idx) => (
                    <div 
                      key={idx}
                      className={cn(
                        "p-3 rounded border",
                        detail.processed && "bg-green-50 border-green-200",
                        detail.mp_status === 'pending' && "bg-blue-50 border-blue-200",
                        detail.mp_status === 'refunded' && "bg-yellow-50 border-yellow-200",
                        (detail.mp_status === 'rejected' || detail.mp_status === 'cancelled') && "bg-red-50 border-red-200",
                        detail.mp_status === 'error' && "bg-orange-50 border-orange-200"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-xs font-semibold truncate">{detail.coupon_code}</div>
                          <div className="text-xs text-muted-foreground truncate">{detail.email}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{detail.sku}</div>
                        </div>
                        <div className="text-xs whitespace-nowrap">{detail.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowResultModal(false)}>
              Fechar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                        R$ {(use.original_amount / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-green-600">
                        R$ {(use.final_amount / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(parseISO(use.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
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
