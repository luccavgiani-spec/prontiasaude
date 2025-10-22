import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Users, Search, Download, Eye, Trash2, Shield } from 'lucide-react';
import { getPatientPlan } from '@/lib/patient-plan';

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
    intake_complete: boolean;
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
    if (!confirm('Tem certeza que deseja excluir este usuário?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { error } = await supabase.functions.invoke(`user-management?operation=delete&user_id=${userId}`, {
        method: 'DELETE',
      });

      if (error) throw error;

      toast.success('Usuário excluído');
      loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Erro ao excluir usuário');
    }
  };

  const handleActivatePlan = async (userId: string, email: string, userName: string) => {
    if (!confirm(`Ativar plano básico (Individual com Especialistas) para ${userName}?`)) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Calcular data de expiração: 30 dias a partir de hoje
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      // Inserir na tabela patient_plans
      const { error } = await supabase
        .from('patient_plans')
        .insert({
          user_id: userId,
          email: email,
          plan_code: 'IND_COM_ESP_1M',
          plan_expires_at: expiresAt.toISOString(),
          status: 'active'
        });

      if (error) throw error;

      toast.success(`Plano ativado com sucesso para ${userName}! Válido por 30 dias.`);
      loadUsers(); // Recarregar lista
    } catch (error: any) {
      console.error('Error activating plan:', error);
      toast.error(error.message || 'Erro ao ativar plano');
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

  const maskCPF = (cpf?: string) => {
    if (!cpf) return 'N/A';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.***.**$4');
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Intakes Completos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {users.filter(u => u.patient?.intake_complete).length}
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
                    <TableHead>Intake</TableHead>
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
                      <TableCell className="font-mono text-sm">{maskCPF(user.patient?.cpf)}</TableCell>
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
                        {user.patient?.intake_complete ? (
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
                          
                          {/* ✅ NOVO: Botão para ativar plano */}
                          {!user.activePlan && user.patient && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleActivatePlan(
                                user.id, 
                                user.email, 
                                `${user.patient.first_name} ${user.patient.last_name}`
                              )}
                              title="Ativar Plano Básico (30 dias)"
                              className="text-green-600 hover:text-green-700"
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
    </div>
  );
}
