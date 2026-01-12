import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Users, Search, Download, Eye, Trash2, Shield, Stethoscope, Loader2, Upload, UserCheck, UserX, AlertCircle } from 'lucide-react';
import { getPatientPlan } from '@/lib/patient-plan';
import { ManualPlanActivationModal } from './ManualPlanActivationModal';
import { ImportUsersModal } from './ImportUsersModal';

interface Patient {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  cpf?: string;
  phone_e164?: string;
  profile_complete: boolean;
  user_id?: string;
  created_at: string;
}

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
  hasAuthAccount?: boolean;
  authProvider?: 'email' | 'google' | 'none';
}

export default function UserRegistrationsTab() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [activationModalOpen, setActivationModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [clicklifeLoading, setClicklifeLoading] = useState<string | null>(null);
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    withAccount: 0,
    withoutAccount: 0,
    profileComplete: 0,
    withPlan: 0
  });
  const limit = 50;

  useEffect(() => {
    loadPatients();
  }, [page, statusFilter]);

  const loadPatients = async () => {
    setLoading(true);
    try {
      // Fetch all patients directly from the patients table
      let query = supabase
        .from('patients')
        .select('*')
        .order('created_at', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      // Apply search filter
      if (search) {
        query = query.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,cpf.ilike.%${search}%`);
      }

      const { data: patients, error } = await query;

      if (error) throw error;

      // Get total count for stats
      const { count: totalCount } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true });

      const { count: withAccountCount } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .not('user_id', 'is', null);

      const { count: profileCompleteCount } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('profile_complete', true);

      // Transform patients to User format
      const usersWithPlans = await Promise.all(
        (patients || []).map(async (patient: Patient) => {
          try {
            const plan = await getPatientPlan(patient.email, true);
            const now = new Date();
            const expiresAt = plan?.plan_expires_at ? new Date(plan.plan_expires_at) : null;
            const isActive = expiresAt && expiresAt > now && plan?.status === 'active';

            return {
              id: patient.user_id || patient.id,
              email: patient.email || '',
              created_at: patient.created_at,
              roles: [],
              patient: {
                first_name: patient.first_name,
                last_name: patient.last_name,
                cpf: patient.cpf,
                phone_e164: patient.phone_e164,
                profile_complete: patient.profile_complete || false,
              },
              activePlan: isActive,
              planCode: plan?.plan_code,
              hasAuthAccount: !!patient.user_id,
              authProvider: patient.user_id ? 'email' : 'none',
            } as User;
          } catch (error) {
            console.error(`Error loading plan for ${patient.email}:`, error);
            return {
              id: patient.user_id || patient.id,
              email: patient.email || '',
              created_at: patient.created_at,
              roles: [],
              patient: {
                first_name: patient.first_name,
                last_name: patient.last_name,
                cpf: patient.cpf,
                phone_e164: patient.phone_e164,
                profile_complete: patient.profile_complete || false,
              },
              activePlan: false,
              hasAuthAccount: !!patient.user_id,
              authProvider: patient.user_id ? 'email' : 'none',
            } as User;
          }
        })
      );

      // Apply status filter
      let filteredUsers = usersWithPlans;
      if (statusFilter === 'with_account') {
        filteredUsers = usersWithPlans.filter(u => u.hasAuthAccount);
      } else if (statusFilter === 'without_account') {
        filteredUsers = usersWithPlans.filter(u => !u.hasAuthAccount);
      } else if (statusFilter === 'with_plan') {
        filteredUsers = usersWithPlans.filter(u => u.activePlan);
      }

      setUsers(filteredUsers);

      // Count users with active plans
      const withPlanCount = usersWithPlans.filter(u => u.activePlan).length;

      setStats({
        total: totalCount || 0,
        withAccount: withAccountCount || 0,
        withoutAccount: (totalCount || 0) - (withAccountCount || 0),
        profileComplete: profileCompleteCount || 0,
        withPlan: withPlanCount
      });

    } catch (error) {
      console.error('Error loading patients:', error);
      toast.error('Erro ao carregar pacientes');
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
      loadPatients();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Erro ao deletar usuário');
    }
  };

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
    const headers = ['Email', 'Nome', 'CPF', 'Telefone', 'Data Cadastro', 'Conta Auth', 'Perfil Completo', 'Plano Ativo'];
    const rows = users.map(u => [
      u.email,
      `${u.patient?.first_name || ''} ${u.patient?.last_name || ''}`.trim(),
      u.patient?.cpf || '',
      u.patient?.phone_e164 || '',
      new Date(u.created_at).toLocaleDateString('pt-BR'),
      u.hasAuthAccount ? 'Sim' : 'Não',
      u.patient?.profile_complete ? 'Sim' : 'Não',
      u.activePlan ? 'Sim' : 'Não',
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `pacientes-${new Date().toISOString()}.csv`;
    link.click();
  };

  const formatCPF = (cpf?: string) => {
    if (!cpf) return 'N/A';
    const cleaned = cpf.replace(/\D/g, '');
    if (cleaned.length !== 11) return cpf;
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  if (loading) {
    return <div className="p-8 text-center">Carregando pacientes...</div>;
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Pacientes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Com Conta Auth</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.withAccount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sem Conta Auth</CardTitle>
            <UserX className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.withoutAccount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Perfis Completos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.profileComplete}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Com Plano Ativo</CardTitle>
            <Shield className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.withPlan}</div>
          </CardContent>
        </Card>
      </div>

      {/* Alert for users without auth */}
      {stats.withoutAccount > 0 && (
        <div className="flex items-center gap-3 p-4 bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg">
          <AlertCircle className="h-5 w-5 text-orange-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
              {stats.withoutAccount} pacientes sem conta de autenticação
            </p>
            <p className="text-xs text-orange-600 dark:text-orange-400">
              Importe os usuários do backup SQL para criar as contas com senhas preservadas.
            </p>
          </div>
          <Button onClick={() => setImportModalOpen(true)} variant="outline" className="border-orange-300">
            <Upload className="h-4 w-4 mr-2" />
            Importar Usuários
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex justify-between items-center gap-4">
        <div className="flex gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por email, nome ou CPF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadPatients()}
              className="pl-10"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Pacientes</SelectItem>
              <SelectItem value="with_account">Com Conta Auth</SelectItem>
              <SelectItem value="without_account">Sem Conta Auth</SelectItem>
              <SelectItem value="with_plan">Com Plano Ativo</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={loadPatients}>
            <Search className="h-4 w-4 mr-2" />
            Buscar
          </Button>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImportModalOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importar Backup
          </Button>
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Pacientes Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Nenhum paciente encontrado
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
                    <TableHead>Status Login</TableHead>
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
                      <TableCell>{user.patient?.phone_e164 || '-'}</TableCell>
                      <TableCell>{new Date(user.created_at).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>
                        {user.hasAuthAccount ? (
                          <Badge variant="default" className="bg-green-600">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Conta Ativa
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                            <UserX className="h-3 w-3 mr-1" />
                            Sem Conta
                          </Badge>
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
                          <Badge variant="default" className="bg-green-600">✓ {user.planCode}</Badge>
                        ) : (
                          <Badge variant="secondary">✗ Sem plano</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            title="Ver Detalhes"
                            onClick={() => setViewingUser(user)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          
                          {user.patient?.cpf && user.hasAuthAccount && (
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
                          
                          {user.patient && user.hasAuthAccount && (
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
                          
                          {user.hasAuthAccount && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(user.id)}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
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

      {/* Import Modal */}
      <ImportUsersModal
        open={importModalOpen}
        onOpenChange={setImportModalOpen}
        onSuccess={() => {
          setImportModalOpen(false);
          loadPatients();
        }}
      />

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
            loadPatients();
            toast.success('Plano ativado com sucesso!');
          }}
        />
      )}

      {/* Modal de Detalhes do Usuário */}
      <Dialog open={!!viewingUser} onOpenChange={(open) => !open && setViewingUser(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Paciente</DialogTitle>
          </DialogHeader>
          
          {viewingUser && (
            <div className="space-y-6">
              {/* Informações Básicas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="font-mono text-sm">{viewingUser.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Nome Completo</label>
                  <p>{viewingUser.patient?.first_name} {viewingUser.patient?.last_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">CPF</label>
                  <p className="font-mono">{formatCPF(viewingUser.patient?.cpf)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Telefone</label>
                  <p>{viewingUser.patient?.phone_e164 || '-'}</p>
                </div>
              </div>

              {/* Datas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Cadastrado em</label>
                  <p>{new Date(viewingUser.created_at).toLocaleString('pt-BR')}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status da Conta</label>
                  <div className="mt-1">
                    {viewingUser.hasAuthAccount ? (
                      <Badge variant="default" className="bg-green-600">Conta Ativa</Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-orange-100 text-orange-700">Sem Conta Auth</Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Perfil</label>
                  <div className="mt-1">
                    <Badge variant={viewingUser.patient?.profile_complete ? 'default' : 'secondary'}>
                      {viewingUser.patient?.profile_complete ? 'Completo' : 'Incompleto'}
                    </Badge>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Plano</label>
                  <div className="mt-1">
                    <Badge variant={viewingUser.activePlan ? 'default' : 'secondary'} className={viewingUser.activePlan ? 'bg-green-600' : ''}>
                      {viewingUser.activePlan ? viewingUser.planCode : 'Sem plano'}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* ID Técnico */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">Patient/User ID</label>
                <p className="font-mono text-xs text-muted-foreground">{viewingUser.id}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
