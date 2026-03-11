import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabaseProduction } from "@/lib/supabase-production";
import { getHybridSession } from "@/lib/auth-hybrid";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { useToast } from "@/hooks/use-toast";
import { Users, UserPlus, Mail, Loader2, RefreshCw, X, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface FamiliarInvite {
  id: string;
  email: string;
  status: 'pending' | 'completed' | 'expired' | 'cancelled';
  created_at: string;
  expires_at: string;
  accepted_at?: string | null;
}

interface FamiliarMember {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
}

interface FamiliaresSectionProps {
  currentUserId: string;
  planId: string;
  planCode: string;
}

const MAX_FAMILIARES = 3; // Titular + 3 familiares = 4 no total

export function FamiliaresSection({ currentUserId, planId, planCode }: FamiliaresSectionProps) {
  const [invites, setInvites] = useState<FamiliarInvite[]>([]);
  const [members, setMembers] = useState<FamiliarMember[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const { toast } = useToast();

  const totalFamiliares = members.length + invites.filter(i => i.status === 'pending').length;
  const canAddMore = totalFamiliares < MAX_FAMILIARES;

  useEffect(() => {
    loadData();
  }, [planId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Carregar convites pendentes (Production - tem public SELECT policy)
      const { data: invitesData, error: invitesError } = await supabaseProduction
        .from('pending_family_invites')
        .select('*')
        .eq('titular_plan_id', planId)
        .in('status', ['pending', 'completed'])
        .order('created_at', { ascending: false });

      if (invitesError) throw invitesError;
      setInvites((invitesData || []) as unknown as FamiliarInvite[]);

      // Buscar membros ativos (convites completos)
      const completedEmails = (invitesData || [])
        .filter((i: any) => i.status === 'completed')
        .map((i: any) => i.email);

      if (completedEmails.length > 0) {
        const { data: membersData } = await supabaseProduction
          .from('patients')
          .select('id, email, first_name, last_name, created_at')
          .in('email', completedEmails);

        setMembers((membersData || []) as FamiliarMember[]);
      } else {
        setMembers([]);
      }
    } catch (error) {
      console.error('Error loading family data:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados dos familiares.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendInvite = async () => {
    if (!newEmail.trim()) {
      toast({
        title: "Erro",
        description: "Digite o email do familiar.",
        variant: "destructive",
      });
      return;
    }

    if (!canAddMore) {
      toast({
        title: "Limite atingido",
        description: `Você já atingiu o limite de ${MAX_FAMILIARES} familiares no plano.`,
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const { session } = await getHybridSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        toast({
          title: "Sessão expirada",
          description: "Faça login novamente para enviar convites.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await invokeEdgeFunction('patient-operations', {
        body: {
          operation: 'invite-familiar',
          plan_id: planId,
          email: newEmail.toLowerCase().trim()
        },
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "✅ Convite enviado!",
        description: `Email enviado para ${newEmail}`,
      });

      setNewEmail("");
      loadData();
    } catch (error: any) {
      console.error('Error sending invite:', error);
      toast({
        title: "Erro ao enviar convite",
        description: error.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    setLoadingAction(inviteId);
    try {
      const { session } = await getHybridSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        toast({
          title: "Sessão expirada",
          description: "Faça login novamente para reenviar convites.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await invokeEdgeFunction('patient-operations', {
        body: {
          operation: 'resend-family-invite',
          invite_id: inviteId
        },
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "✅ Convite reenviado!",
        description: "O familiar receberá um novo email.",
      });

      loadData();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível reenviar o convite.",
        variant: "destructive",
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    setLoadingAction(inviteId);
    try {
      const { error } = await (supabaseProduction
        .from('pending_family_invites') as any)
        .delete()
        .eq('id', inviteId)
        .eq('titular_patient_id', currentUserId);

      if (error) throw error;

      toast({
        title: "✅ Convite cancelado",
        description: "O convite foi removido.",
      });

      loadData();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: "Não foi possível cancelar o convite.",
        variant: "destructive",
      });
    } finally {
      setLoadingAction(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pendente</Badge>;
      case 'completed':
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle2 className="h-3 w-3" /> Ativo</Badge>;
      case 'expired':
        return <Badge variant="outline" className="gap-1 text-muted-foreground"><AlertCircle className="h-3 w-3" /> Expirado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Meus Familiares
          <Badge variant="outline" className="ml-2">
            {totalFamiliares} de {MAX_FAMILIARES}
          </Badge>
        </CardTitle>
        <CardDescription>
          Seu plano familiar permite adicionar até {MAX_FAMILIARES} dependentes.
          Convide seus familiares para aproveitarem os benefícios!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Formulário para adicionar novo familiar */}
        {canAddMore ? (
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="familiarEmail" className="sr-only">Email do familiar</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="familiarEmail"
                  type="email"
                  placeholder="Digite o email do familiar"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="pl-10"
                  disabled={isSending}
                />
              </div>
            </div>
            <Button onClick={handleSendInvite} disabled={isSending || !newEmail.trim()}>
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Convidar
                </>
              )}
            </Button>
          </div>
        ) : (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Você atingiu o limite de {MAX_FAMILIARES} familiares no plano.
            </AlertDescription>
          </Alert>
        )}

        {/* Lista de familiares/convites */}
        {invites.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite) => {
                const member = members.find(m => m.email === invite.email);
                const isPending = invite.status === 'pending';
                
                return (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium">{invite.email}</TableCell>
                    <TableCell>
                      {member ? `${member.first_name || ''} ${member.last_name || ''}`.trim() || '-' : '-'}
                    </TableCell>
                    <TableCell>{getStatusBadge(invite.status)}</TableCell>
                    <TableCell className="text-right">
                      {isPending && (
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResendInvite(invite.id)}
                            disabled={loadingAction === invite.id}
                          >
                            {loadingAction === invite.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelInvite(invite.id)}
                            disabled={loadingAction === invite.id}
                            className="text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum familiar cadastrado ainda.</p>
            <p className="text-sm">Convide seus familiares usando o formulário acima!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
