import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
  MoreHorizontal, 
  RefreshCw, 
  XCircle, 
  Users, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  Calendar
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ConvitesManagementProps {
  companyId: string;
  companyName: string;
}

interface InviteData {
  id: string;
  email: string;
  status: string;
  invited_at: string;
  expires_at: string;
  completed_at: string | null;
}

export default function ConvitesManagement({ companyId, companyName }: ConvitesManagementProps) {
  const [invites, setInvites] = useState<InviteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingActions, setLoadingActions] = useState<Record<string, boolean>>({});
  const [filters, setFilters] = useState({
    status: null as string | null,
    email_search: '',
  });

  const fetchInvites = async (isInitialLoad = false) => {
    if (isInitialLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    
    try {
      let query = supabase
        .from('pending_employee_invites')
        .select('*')
        .eq('company_id', companyId)
        .order('invited_at', { ascending: false });

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.email_search) {
        query = query.ilike('email', `%${filters.email_search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setInvites(data || []);
    } catch (error) {
      console.error('Error fetching invites:', error);
      toast.error('Erro ao carregar convites');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInvites(true); // Primeira carga
    
    // Auto-refresh a cada 30 segundos
    const interval = setInterval(() => {
      fetchInvites(false); // Refreshes subsequentes
    }, 30000);
    
    return () => clearInterval(interval);
  }, [companyId, filters]);

  const applyFilters = () => {
    fetchInvites(false);
  };

  const clearFilters = () => {
    setFilters({ status: null, email_search: '' });
    setTimeout(() => fetchInvites(false), 100);
  };

  const handleResendInvite = async (inviteId: string) => {
    setLoadingActions(prev => ({ ...prev, [inviteId]: true }));
    try {
      const { error } = await supabase.functions.invoke('company-operations', {
        body: {
          operation: 'resend-invite',
          invite_id: inviteId
        }
      });

      if (error) throw error;
      
      toast.success('✅ Convite reenviado! O funcionário receberá o email em alguns minutos.', {
        duration: 5000
      });
      
      await fetchInvites(false);
    } catch (error: any) {
      toast.error(`❌ ${error.message || 'Erro ao reenviar convite'}`, {
        duration: 5000
      });
    } finally {
      setLoadingActions(prev => ({ ...prev, [inviteId]: false }));
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    setLoadingActions(prev => ({ ...prev, [inviteId]: true }));
    try {
      const { error } = await supabase
        .from('pending_employee_invites')
        .update({ status: 'cancelled' })
        .eq('id', inviteId);

      if (error) throw error;
      
      toast.success('✅ Convite cancelado com sucesso', {
        duration: 3000
      });
      
      await fetchInvites(false);
    } catch (error) {
      toast.error('❌ Erro ao cancelar convite', {
        duration: 3000
      });
    } finally {
      setLoadingActions(prev => ({ ...prev, [inviteId]: false }));
    }
  };

  const stats = {
    total: invites.length,
    pending: invites.filter(i => i.status === 'pending').length,
    completed: invites.filter(i => i.status === 'completed').length,
    expired: invites.filter(i => i.status === 'expired').length,
    completionRate: invites.length > 0 
      ? ((invites.filter(i => i.status === 'completed').length / invites.length) * 100).toFixed(1) 
      : '0'
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      pending: { variant: "default", label: "Pendente" },
      completed: { variant: "secondary", label: "Completo" },
      expired: { variant: "destructive", label: "Expirado" },
      cancelled: { variant: "outline", label: "Cancelado" }
    };
    
    const config = variants[status] || { variant: "outline" as const, label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completos</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expirados</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.expired}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conclusão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completionRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <Input
              placeholder="Buscar por email..."
              value={filters.email_search}
              onChange={(e) => setFilters(prev => ({ ...prev, email_search: e.target.value }))}
              className="flex-1"
            />
            
            <Select value={filters.status || undefined} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="Todos os status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="completed">Completo</SelectItem>
                <SelectItem value="expired">Expirado</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Button onClick={applyFilters} variant="default">
                Aplicar
              </Button>
              <Button onClick={clearFilters} variant="outline">
                Limpar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Convites */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Convites ({invites.length})</CardTitle>
          <Button onClick={() => fetchInvites(false)} variant="outline" size="sm" disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </Button>
        </CardHeader>
        <CardContent className="relative">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : (
            <>
              {refreshing && (
                <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10 rounded-lg">
                  <div className="flex items-center gap-2 bg-background px-4 py-2 rounded-lg shadow-lg border">
                    <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm font-medium">Atualizando...</span>
                  </div>
                </div>
              )}
              
              {invites.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum convite encontrado
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Enviado em</TableHead>
                        <TableHead>Expira em</TableHead>
                        <TableHead>Completo em</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invites.map((invite) => (
                        <TableRow key={invite.id}>
                          <TableCell className="font-medium">{invite.email}</TableCell>
                          <TableCell>{getStatusBadge(invite.status)}</TableCell>
                          <TableCell>
                            {format(new Date(invite.invited_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            {format(new Date(invite.expires_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            {invite.completed_at
                              ? format(new Date(invite.completed_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })
                              : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {invite.status === 'pending' && (
                                  <>
                                    <DropdownMenuItem 
                                      onClick={() => handleResendInvite(invite.id)}
                                      disabled={loadingActions[invite.id]}
                                    >
                                      <RefreshCw className={`h-4 w-4 mr-2 ${loadingActions[invite.id] ? 'animate-spin' : ''}`} />
                                      {loadingActions[invite.id] ? 'Reenviando...' : 'Reenviar'}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem 
                                      onClick={() => handleCancelInvite(invite.id)}
                                      disabled={loadingActions[invite.id]}
                                      className="text-red-600"
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      {loadingActions[invite.id] ? 'Cancelando...' : 'Cancelar'}
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {invite.status === 'expired' && (
                                  <DropdownMenuItem 
                                    onClick={() => handleResendInvite(invite.id)}
                                    disabled={loadingActions[invite.id]}
                                  >
                                    <RefreshCw className={`h-4 w-4 mr-2 ${loadingActions[invite.id] ? 'animate-spin' : ''}`} />
                                    {loadingActions[invite.id] ? 'Reenviando...' : 'Reenviar'}
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
