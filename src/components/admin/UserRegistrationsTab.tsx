import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Users, Search, Download, Eye, Trash2, Shield, Stethoscope, Loader2 } from 'lucide-react';
import { getPatientPlan } from '@/lib/patient-plan';
import { ManualPlanActivationModal } from './ManualPlanActivationModal';

interface User {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string;
  phone?: string;
  roles: string[];
  patient?: {
    first_name?: string;
    last_name?: string;
    cpf?: string;
    phone_e164?: string;
    profile_complete: boolean;
  };
  activePlan?: boolean;
  planCode?: string;
}

export default function UserRegistrationsTab() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [activationModalOpen, setActivationModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [clicklifeLoading, setClicklifeLoading] = useState<string | null>(null);
  const limit = 50;

  useEffect(() => {
    loadUsers();
  }, [page, roleFilter]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('user-management', {
        body: {
          operation: 'list',
          page,
          limit,
          search: search || undefined,
          role: roleFilter !== 'all' ? roleFilter : undefined,
        },
      });

      if (error) throw error;

      const usersWithPlans = await Promise.all(
        (data.users || []).map(async (user: User) => {
          try {
            const plan = await getPatientPlan(user.email);
            const now = new Date();
            const expiresAt = plan?.plan_expires_at ? new Date(plan.plan_expires_at) : null;
            const isActive = expiresAt && expiresAt > now && plan?.status === 'active';
            
            return {
              ...user,
              activePlan: isActive,
              planCode: plan?.plan_code,
            };
          } catch (error) {
            console.error(`Error loading plan for ${user.email}:`, error);
            return { ...user, activePlan: false };
          }
        })
      );

      setUsers(usersWithPlans);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm('Tem certeza que deseja deletar este usuário? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const { error } = await supabase.functions.invoke('user-management', {
        body: {
          operation: 'delete_user',
          user_id: userId
        }
      });

      if (error) {
        console.error('Error deleting user:', error);
        toast.error('Erro ao deletar usuário');
        return;
      }

      toast.success('Usuário deletado com sucesso');
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Erro ao deletar usuário');
    }
  };

  // ✅ NOVO: Ativar manualmente na ClickLife
  const handleClickLifeActivation = async (user: User) => {
    if (!user.patient?.cpf) {
      toast.error('Usuário não possui CPF cadastrado');
      return;
    }

    setClicklifeLoading(user.id);
    
    try {
      const { data, error } = await supabase.functions.invoke('activate-clicklife-manual', {
        body: {
          email: user.email
        }
      });

      if (error) {
        console.error('Error activating ClickLife:', error);
        toast.error('Erro ao ativar na ClickLife: ' + (error.message || 'Erro desconhecido'));
        return;
      }

      if (data?.success) {
        toast.success('Paciente ativado na ClickLife com sucesso!');
      } else {
        toast.error('Falha na ativação: ' + (data?.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error('Error activating ClickLife:', error);
      toast.error('Erro ao ativar na ClickLife');
    } finally {
      setClicklifeLoading(null);
    }
  };

  const exportCSV = () => {
    const headers = ['Email', 'Nome', 'CPF', 'Telefone', 'Data Cadastro', 'Último Login', 'Status', 'Roles'];
    const rows = users.map(u => [
      u.email,
      `${u.patient?.first_name || ''} ${u.patient?.last_name || ''}`.trim(),
      u.patient?.cpf || '',
      u.patient?.phone_e164 || u.phone || '',
      new Date(u.created_at).toLocaleDateString('pt-BR'),
      u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('pt-BR') : 'Nunca',
      u.email_confirmed_at ? 'Ativo' : 'Pendente',
      u.roles.join(', '),
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `usuarios-${new Date().toISOString()}.csv`;
    link.click();
  };

  const formatCPF = (cpf?: string) => {
    if (!cpf) return 'N/A';
    const cleaned = cpf.replace(/\D/g, '');
    if (cleaned.length !== 11) return cpf;
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  if (loading) {
    return <div className="p-8 text-center">Carregando cadastros...</div>;
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.email_confirmed_at).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Cadastros Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => new Date(u.created_at).toDateString() === new Date().toDateString()).length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Perfis Completos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.patient?.profile_complete).length}
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Filters */}
      <div className="flex justify-between items-center gap-4">
        <div className="flex gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por email, nome ou CPF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
              className="pl-10"
            />
          </div>

          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Roles</SelectItem>
              <SelectItem value="user">Usuário</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="company">Empresa</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={loadUsers}>
            <Search className="h-4 w-4 mr-2" />
            Buscar
          </Button>
        </div>

        <Button variant="outline" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" />
          Exportar CSV
        </Button>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Usuários Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum usuário encontrado
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Cadastrado em</TableHead>
                    <TableHead>Último Login</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Plano Ativo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-mono text-sm">{user.email}</TableCell>
                      <TableCell>
                        {user.patient?.first_name && user.patient?.last_name
                          ? `${user.patient.first_name} ${user.patient.last_name}`
                          : '-'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">{formatCPF(user.patient?.cpf)}</TableCell>
                      <TableCell>{user.patient?.phone_e164 || user.phone || '-'}</TableCell>
                      <TableCell>{new Date(user.created_at).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>
                        {user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString('pt-BR') : 'Nunca'}
                      </TableCell>
                      <TableCell>
                        {user.email_confirmed_at ? (
                          <Badge variant="default">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary">Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.roles.length > 0 ? (
                          <div className="flex gap-1">
                            {user.roles.map(role => (
                              <Badge key={role} variant="outline">
                                {role}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {user.patient?.profile_complete ? (
                          <Badge variant="default">✓</Badge>
                        ) : (
                          <Badge variant="secondary">✗</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.activePlan ? (
                          <Badge variant="default" className="bg-green-600">✓ Ativo</Badge>
                        ) : (
                          <Badge variant="secondary">✗ Sem plano</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" title="Ver Detalhes">
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {/* ✅ NOVO: Botão para ativar na ClickLife */}
                          {user.patient?.cpf && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleClickLifeActivation(user)}
                              disabled={clicklifeLoading === user.id}
                              title="Ativar na ClickLife"
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              {clicklifeLoading === user.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Stethoscope className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          
                          {/* Botão para ativar/renovar plano */}
                          {user.patient && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedUser(user);
                                setActivationModalOpen(true);
                              }}
                              title={user.activePlan ? "Renovar/Alterar Plano" : "Ativar Plano"}
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            >
                              <Shield className="h-4 w-4" />
                            </Button>
                          )}
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(user.id)}
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Pagination */}
      <div className="flex justify-center gap-2">
        <Button
          variant="outline"
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          Anterior
        </Button>
        <span className="flex items-center px-4">Página {page}</span>
        <Button
          variant="outline"
          onClick={() => setPage(p => p + 1)}
          disabled={users.length < limit}
        >
          Próxima
        </Button>
      </div>

      {/* Modal de Ativação Manual */}
      {selectedUser && (
        <ManualPlanActivationModal
          open={activationModalOpen}
          onOpenChange={setActivationModalOpen}
          user={{
            id: selectedUser.id,
            email: selectedUser.email,
            name: `${selectedUser.patient?.first_name || ''} ${selectedUser.patient?.last_name || ''}`.trim(),
            cpf: selectedUser.patient?.cpf,
            currentPlan: selectedUser.activePlan ? {
              code: selectedUser.planCode || '',
              expiresAt: ''
            } : undefined
          }}
          onSuccess={() => {
            setActivationModalOpen(false);
            setSelectedUser(null);
            loadUsers();
            toast.success('Plano ativado com sucesso!');
          }}
        />
      )}
    </div>
  );
}
