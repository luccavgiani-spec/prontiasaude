import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useCompanyAuth } from '@/hooks/useCompanyAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Mail, Send, X } from 'lucide-react';

interface InviteStats {
  total: number;
  pending: number;
  completed: number;
  expired: number;
  cancelled: number;
  completion_rate: number;
}

interface InviteWithDetails {
  id: string;
  email: string;
  status: 'pending' | 'completed' | 'expired' | 'cancelled';
  invited_at: string;
  expires_at: string;
  completed_at: string | null;
}

export default function EmpresaConvites() {
  const { company, loading: authLoading } = useCompanyAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [invites, setInvites] = useState<InviteWithDetails[]>([]);
  const [stats, setStats] = useState<InviteStats>({
    total: 0,
    pending: 0,
    completed: 0,
    expired: 0,
    cancelled: 0,
    completion_rate: 0
  });
  const [filters, setFilters] = useState({
    status: '',
    email_search: ''
  });

  useEffect(() => {
    if (company) {
      loadInvites();
    }
  }, [company]);

  const loadInvites = async () => {
    if (!company) return;

    setLoading(true);
    try {
      let query = supabase
        .from('pending_employee_invites')
        .select('*')
        .eq('company_id', company.id)
        .order('invited_at', { ascending: false });

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.email_search) {
        query = query.ilike('email', `%${filters.email_search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;

      setInvites((data || []) as InviteWithDetails[]);

      // Calcular estatísticas
      const allInvites = data || [];
      const newStats: InviteStats = {
        total: allInvites.length,
        pending: allInvites.filter(i => i.status === 'pending').length,
        completed: allInvites.filter(i => i.status === 'completed').length,
        expired: allInvites.filter(i => i.status === 'expired').length,
        cancelled: allInvites.filter(i => i.status === 'cancelled').length,
        completion_rate: allInvites.length > 0 
          ? (allInvites.filter(i => i.status === 'completed').length / allInvites.length) * 100
          : 0
      };
      setStats(newStats);

    } catch (error) {
      toast.error('Erro ao carregar convites');
    } finally {
      setLoading(false);
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase.functions.invoke('company-operations', {
        body: {
          operation: 'resend-invite',
          invite_id: inviteId
        }
      });

      if (error) throw error;

      toast.success('Convite reenviado com sucesso!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao reenviar convite');
    }
  };

  const handleCancelInvite = async (inviteId: string) => {
    if (!confirm('Deseja realmente cancelar este convite?')) return;

    try {
      const { error } = await supabase
        .from('pending_employee_invites')
        .update({ status: 'cancelled' })
        .eq('id', inviteId);

      if (error) throw error;

      toast.success('Convite cancelado');
      loadInvites();
    } catch (error) {
      toast.error('Erro ao cancelar convite');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pendente</Badge>;
      case 'completed':
        return <Badge className="bg-green-600">Completo</Badge>;
      case 'expired':
        return <Badge variant="destructive">Expirado</Badge>;
      case 'cancelled':
        return <Badge variant="outline">Cancelado</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!company) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Header */}
          <div>
            <Button variant="ghost" onClick={() => navigate('/empresa')} className="mb-2">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <h1 className="text-3xl font-bold">Gerenciar Convites de Funcionários</h1>
            <p className="text-muted-foreground">
              Acompanhe o status dos convites enviados
            </p>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stats.total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Pendentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-yellow-600">{stats.pending}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Completos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Expirados</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-600">{stats.expired}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Taxa de Conclusão</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {stats.completion_rate.toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <Input
                  placeholder="Buscar por email..."
                  value={filters.email_search}
                  onChange={(e) => setFilters(prev => ({ ...prev, email_search: e.target.value }))}
                />
                <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="completed">Completo</SelectItem>
                    <SelectItem value="expired">Expirado</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <Button onClick={loadInvites} className="flex-1">
                    Aplicar Filtros
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setFilters({ status: '', email_search: '' });
                      loadInvites();
                    }}
                  >
                    Limpar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabela de Convites */}
          <Card>
            <CardHeader>
              <CardTitle>
                <Mail className="h-5 w-5 inline mr-2" />
                Convites ({invites.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">
                  <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
                  <p className="text-sm text-muted-foreground mt-2">Carregando...</p>
                </div>
              ) : invites.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum convite encontrado
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Enviado</TableHead>
                      <TableHead>Expira</TableHead>
                      <TableHead>Completo</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invites.map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell className="font-medium">{invite.email}</TableCell>
                        <TableCell>{getStatusBadge(invite.status)}</TableCell>
                        <TableCell>
                          {new Date(invite.invited_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          {invite.status === 'pending' 
                            ? new Date(invite.expires_at).toLocaleDateString('pt-BR')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {invite.completed_at 
                            ? new Date(invite.completed_at).toLocaleDateString('pt-BR')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {invite.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleResendInvite(invite.id)}
                                >
                                  <Send className="h-3 w-3 mr-1" />
                                  Reenviar
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleCancelInvite(invite.id)}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
