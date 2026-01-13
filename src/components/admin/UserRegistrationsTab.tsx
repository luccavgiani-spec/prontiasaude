import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Users, Search, Download, Eye, Trash2, Shield, Stethoscope, Loader2, Upload, UserCheck, AlertCircle, AlertTriangle, Edit, HeartPulse } from 'lucide-react';
import { getPatientPlan } from '@/lib/patient-plan';
import { ManualPlanActivationModal } from './ManualPlanActivationModal';
import { ImportUsersModal } from './ImportUsersModal';
import { EditPatientModal } from './EditPatientModal';
import { validateCPF } from '@/lib/cpf-validator';

interface Patient {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  cpf?: string;
  phone_e164?: string;
  birth_date?: string;
  gender?: string;
  cep?: string;
  address_line?: string;
  address_number?: string;
  city?: string;
  state?: string;
  profile_complete: boolean;
  user_id?: string;
  created_at: string;
}

interface User {
  id: string;
  patientId: string; // Keep patient.id for editing
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
    birth_date?: string;
    gender?: string;
    cep?: string;
    address_line?: string;
    address_number?: string;
    city?: string;
    state?: string;
    profile_complete: boolean;
  };
  activePlan?: boolean;
  planCode?: string;
  hasAuthAccount?: boolean;
  authProvider?: 'email' | 'google' | 'none';
  // Data quality flags
  hasInvalidCpf?: boolean;
  hasPlaceholderPhone?: boolean;
  hasMissingCriticalData?: boolean;
}

// Constants for placeholder detection
const PLACEHOLDER_PHONE = '+5511999999999';
const PLACEHOLDER_CPF = '00000000000';

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
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [quickConsultUser, setQuickConsultUser] = useState<User | null>(null);
  const [quickConsultProvider, setQuickConsultProvider] = useState<'clicklife' | 'communicare'>('clicklife');
  const [quickConsultLoading, setQuickConsultLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    withPlan: 0,
    criticalWithPlan: 0
  });
  const limit = 50;

  useEffect(() => {
    loadPatients();
  }, [page, statusFilter]);

  const isPlaceholderPhone = (phone?: string) => phone === PLACEHOLDER_PHONE;
  const isInvalidCpf = (cpf?: string) => {
    if (!cpf) return false;
    const cleaned = cpf.replace(/\D/g, '');
    return cleaned === PLACEHOLDER_CPF || (cleaned.length === 11 && !validateCPF(cleaned));
  };
  const hasCriticalDataMissing = (patient?: User['patient']) => {
    if (!patient) return true;
    return !patient.cpf || !patient.phone_e164 || isPlaceholderPhone(patient.phone_e164) || isInvalidCpf(patient.cpf);
  };

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

      // Count data quality issues
      const { count: invalidPhoneCount } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('phone_e164', PLACEHOLDER_PHONE);

      const { count: invalidCpfCount } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .eq('cpf', PLACEHOLDER_CPF);

      const { count: missingCpfCount } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .is('cpf', null);

      const { count: missingPhoneCount } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .is('phone_e164', null);

      // Transform patients to User format
      const usersWithPlans = await Promise.all(
        (patients || []).map(async (patient: Patient) => {
          try {
            const plan = await getPatientPlan(patient.email, true);
            // Para plan_expires_at (DATE), considerar ativo se expira hoje ou depois
            // Normalizar expiresAt para fim do dia para garantir que "hoje" é válido
            const expiresAt = plan?.plan_expires_at ? new Date(plan.plan_expires_at + 'T23:59:59') : null;
            const now = new Date();
            const isActive = expiresAt && expiresAt >= now && plan?.status === 'active';

            const patientData = {
              first_name: patient.first_name,
              last_name: patient.last_name,
              cpf: patient.cpf,
              phone_e164: patient.phone_e164,
              birth_date: patient.birth_date,
              gender: patient.gender,
              cep: patient.cep,
              address_line: patient.address_line,
              address_number: patient.address_number,
              city: patient.city,
              state: patient.state,
              profile_complete: patient.profile_complete || false,
            };

            return {
              id: patient.user_id || patient.id,
              patientId: patient.id,
              email: patient.email || '',
              created_at: patient.created_at,
              roles: [],
              patient: patientData,
              activePlan: isActive,
              planCode: plan?.plan_code,
              hasAuthAccount: !!patient.user_id,
              authProvider: patient.user_id ? 'email' : 'none',
              hasInvalidCpf: isInvalidCpf(patient.cpf),
              hasPlaceholderPhone: isPlaceholderPhone(patient.phone_e164),
              hasMissingCriticalData: hasCriticalDataMissing(patientData),
            } as User;
          } catch (error) {
            console.error(`Error loading plan for ${patient.email}:`, error);
            const patientData = {
              first_name: patient.first_name,
              last_name: patient.last_name,
              cpf: patient.cpf,
              phone_e164: patient.phone_e164,
              birth_date: patient.birth_date,
              gender: patient.gender,
              cep: patient.cep,
              address_line: patient.address_line,
              address_number: patient.address_number,
              city: patient.city,
              state: patient.state,
              profile_complete: patient.profile_complete || false,
            };
            return {
              id: patient.user_id || patient.id,
              patientId: patient.id,
              email: patient.email || '',
              created_at: patient.created_at,
              roles: [],
              patient: patientData,
              activePlan: false,
              hasAuthAccount: !!patient.user_id,
              authProvider: patient.user_id ? 'email' : 'none',
              hasInvalidCpf: isInvalidCpf(patient.cpf),
              hasPlaceholderPhone: isPlaceholderPhone(patient.phone_e164),
              hasMissingCriticalData: hasCriticalDataMissing(patientData),
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
      } else if (statusFilter === 'incomplete_data') {
        filteredUsers = usersWithPlans.filter(u => u.hasMissingCriticalData);
      } else if (statusFilter === 'invalid_phone') {
        filteredUsers = usersWithPlans.filter(u => u.hasPlaceholderPhone);
      } else if (statusFilter === 'invalid_cpf') {
        filteredUsers = usersWithPlans.filter(u => u.hasInvalidCpf || !u.patient?.cpf);
      } else if (statusFilter === 'critical_with_plan') {
        filteredUsers = usersWithPlans.filter(u => u.activePlan && u.hasMissingCriticalData);
      }

      setUsers(filteredUsers);

      // Count users with active plans
      const withPlanCount = usersWithPlans.filter(u => u.activePlan).length;
      const incompleteDataCount = usersWithPlans.filter(u => u.hasMissingCriticalData).length;
      const criticalWithPlanCount = usersWithPlans.filter(u => u.activePlan && u.hasMissingCriticalData).length;

      setStats({
        total: totalCount || 0,
        withPlan: withPlanCount,
        criticalWithPlan: criticalWithPlanCount
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

  const handleEditPatient = (user: User) => {
    setEditingPatient({
      id: user.patientId,
      email: user.email,
      first_name: user.patient?.first_name,
      last_name: user.patient?.last_name,
      cpf: user.patient?.cpf,
      phone_e164: user.patient?.phone_e164,
      birth_date: user.patient?.birth_date,
      gender: user.patient?.gender,
      cep: user.patient?.cep,
      address_line: user.patient?.address_line,
      address_number: user.patient?.address_number,
      city: user.patient?.city,
      state: user.patient?.state,
      profile_complete: user.patient?.profile_complete || false,
      user_id: user.hasAuthAccount ? user.id : undefined,
      created_at: user.created_at,
    });
  };

  const handleQuickConsult = async () => {
    if (!quickConsultUser) return;
    
    setQuickConsultLoading(true);
    
    try {
      const payload = {
        cpf: quickConsultUser.patient?.cpf || '',
        email: quickConsultUser.email,
        nome: `${quickConsultUser.patient?.first_name || ''} ${quickConsultUser.patient?.last_name || ''}`.trim(),
        telefone: quickConsultUser.patient?.phone_e164 || '',
        sku: 'ITC6534', // Clínico Geral (Pronto Atendimento)
        plano_ativo: !!quickConsultUser.activePlan,
        sexo: quickConsultUser.patient?.gender || 'F',
        birth_date: quickConsultUser.patient?.birth_date,
        force_provider: quickConsultProvider,
      };
      
      console.log('[QuickConsult] Criando consulta:', { provider: quickConsultProvider, email: payload.email });
      
      const { data, error } = await supabase.functions.invoke('schedule-redirect', {
        body: payload,
      });
      
      if (error) throw error;
      
      if (data?.ok && data?.url) {
        toast.success(`Consulta criada na ${quickConsultProvider === 'clicklife' ? 'ClickLife' : 'Communicare'}!`);
        
        // Copiar URL para clipboard
        await navigator.clipboard.writeText(data.url);
        toast.info('Link da consulta copiado para a área de transferência!');
        
        // Abrir em nova aba
        window.open(data.url, '_blank');
      } else {
        toast.error(data?.error || 'Erro ao criar consulta');
      }
    } catch (error) {
      console.error('Erro ao criar consulta:', error);
      toast.error('Erro ao criar consulta rápida');
    } finally {
      setQuickConsultLoading(false);
      setQuickConsultUser(null);
    }
  };

  const exportCSV = () => {
    const headers = ['Email', 'Nome', 'CPF', 'Telefone', 'Data Cadastro', 'Conta Auth', 'Perfil Completo', 'Plano Ativo', 'Dados Válidos'];
    const rows = users.map(u => [
      u.email,
      `${u.patient?.first_name || ''} ${u.patient?.last_name || ''}`.trim(),
      u.patient?.cpf || '',
      u.patient?.phone_e164 || '',
      new Date(u.created_at).toLocaleDateString('pt-BR'),
      u.hasAuthAccount ? 'Sim' : 'Não',
      u.patient?.profile_complete ? 'Sim' : 'Não',
      u.activePlan ? 'Sim' : 'Não',
      u.hasMissingCriticalData ? 'Não' : 'Sim',
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `pacientes-${new Date().toISOString()}.csv`;
    link.click();
  };

  const formatCPF = (cpf?: string) => {
    if (!cpf) return null;
    const cleaned = cpf.replace(/\D/g, '');
    if (cleaned.length !== 11) return cpf;
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const renderCpfCell = (user: User) => {
    const cpf = user.patient?.cpf;
    if (!cpf) {
      return <Badge variant="destructive" className="text-xs">Sem CPF</Badge>;
    }
    if (cpf === PLACEHOLDER_CPF) {
      return <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">CPF Placeholder</Badge>;
    }
    if (!validateCPF(cpf)) {
      return (
        <div className="flex items-center gap-1">
          <span className="font-mono text-sm">{formatCPF(cpf)}</span>
          <Badge variant="outline" className="text-xs border-red-500 text-red-600">Inválido</Badge>
        </div>
      );
    }
    return <span className="font-mono text-sm">{formatCPF(cpf)}</span>;
  };

  const renderPhoneCell = (user: User) => {
    const phone = user.patient?.phone_e164;
    if (!phone) {
      return <Badge variant="destructive" className="text-xs">Sem Telefone</Badge>;
    }
    if (phone === PLACEHOLDER_PHONE) {
      return <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">Placeholder</Badge>;
    }
    return <span>{phone}</span>;
  };

  if (loading) {
    return (
      <div className="p-8 text-center flex items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Carregando pacientes...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
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

        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Perfis Incompletos</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">64</div>
            <p className="text-xs text-muted-foreground mt-1">Provenientes da migração</p>
          </CardContent>
        </Card>
      </div>

      {/* Critical Alert - Patients with plan but missing data */}
      {stats.criticalWithPlan > 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              ⚠️ {stats.criticalWithPlan} paciente(s) com plano ativo têm dados incompletos
            </p>
            <p className="text-xs text-red-600 dark:text-red-400">
              Esses pacientes podem ter problemas ao usar o plano (sem CPF ou telefone válido).
            </p>
          </div>
          <Button 
            onClick={() => setStatusFilter('critical_with_plan')} 
            variant="outline" 
            className="border-red-300 text-red-700 hover:bg-red-100"
          >
            Ver Pacientes Críticos
          </Button>
        </div>
      )}


      {/* Filters */}
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <div className="flex gap-4 flex-1 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
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
            <SelectTrigger className="w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Pacientes</SelectItem>
              <SelectItem value="with_plan">Com Plano Ativo</SelectItem>
              <SelectItem value="incomplete_data">⚠️ Perfis Incompletos (Migração)</SelectItem>
              <SelectItem value="critical_with_plan">🚨 Críticos com Plano</SelectItem>
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
            Importar
          </Button>
          <Button variant="outline" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Pacientes Cadastrados</span>
            <Badge variant="secondary">{users.length} exibidos</Badge>
          </CardTitle>
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
                    <TableHead>Cadastrado</TableHead>
                    <TableHead>Login</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow 
                      key={user.patientId} 
                      className={user.activePlan && user.hasMissingCriticalData ? 'bg-red-50/50 dark:bg-red-950/20' : ''}
                    >
                      <TableCell className="font-mono text-sm max-w-[200px] truncate" title={user.email}>
                        {user.email}
                      </TableCell>
                      <TableCell>
                        {user.patient?.first_name && user.patient?.last_name
                          ? `${user.patient.first_name} ${user.patient.last_name}`
                          : user.patient?.first_name || <Badge variant="secondary" className="text-xs">Sem nome</Badge>}
                      </TableCell>
                      <TableCell>{renderCpfCell(user)}</TableCell>
                      <TableCell>{renderPhoneCell(user)}</TableCell>
                      <TableCell className="text-sm">{new Date(user.created_at).toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>
                        {user.hasAuthAccount ? (
                          <Badge variant="default" className="bg-green-600 text-xs">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Ativo
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 text-xs">
                            Sem
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.activePlan ? (
                          <Badge variant="default" className="bg-green-600 text-xs">✓ {user.planCode}</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">✗</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            title="Editar Dados"
                            onClick={() => handleEditPatient(user)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            title="Consulta Rápida"
                            onClick={() => {
                              if (!user.patient?.cpf) {
                                toast.error('Paciente não possui CPF cadastrado');
                                return;
                              }
                              setQuickConsultUser(user);
                              setQuickConsultProvider('clicklife');
                            }}
                            disabled={!user.patient?.cpf}
                            className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                          >
                            <HeartPulse className="h-4 w-4" />
                          </Button>
                          
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

      {/* Edit Patient Modal */}
      <EditPatientModal
        open={!!editingPatient}
        onOpenChange={(open) => !open && setEditingPatient(null)}
        patient={editingPatient}
        onSuccess={() => {
          setEditingPatient(null);
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

      {/* Modal de Consulta Rápida */}
      <Dialog open={!!quickConsultUser} onOpenChange={() => setQuickConsultUser(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HeartPulse className="h-5 w-5 text-purple-600" />
              Criar Consulta Rápida
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Info do Paciente */}
            <div className="bg-muted p-3 rounded-lg">
              <p className="font-medium">
                {quickConsultUser?.patient?.first_name} {quickConsultUser?.patient?.last_name}
              </p>
              <p className="text-sm text-muted-foreground">{quickConsultUser?.email}</p>
              <p className="text-sm font-mono">{formatCPF(quickConsultUser?.patient?.cpf)}</p>
            </div>
            
            {/* Seleção de Provedor */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Escolha o Provedor:</label>
              <RadioGroup 
                value={quickConsultProvider} 
                onValueChange={(v) => setQuickConsultProvider(v as 'clicklife' | 'communicare')}
              >
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted cursor-pointer">
                  <RadioGroupItem value="clicklife" id="clicklife" />
                  <label htmlFor="clicklife" className="cursor-pointer flex-1">
                    <span className="font-medium">ClickLife</span>
                    <p className="text-sm text-muted-foreground">Pronto atendimento imediato</p>
                  </label>
                </div>
                <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-muted cursor-pointer">
                  <RadioGroupItem value="communicare" id="communicare" />
                  <label htmlFor="communicare" className="cursor-pointer flex-1">
                    <span className="font-medium">Communicare</span>
                    <p className="text-sm text-muted-foreground">Fila de atendimento</p>
                  </label>
                </div>
              </RadioGroup>
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setQuickConsultUser(null)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleQuickConsult} 
              disabled={quickConsultLoading}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {quickConsultLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Criando...
                </>
              ) : (
                <>
                  <HeartPulse className="h-4 w-4 mr-2" />
                  Criar Consulta
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Detalhes do Usuário */}
      <Dialog open={!!viewingUser} onOpenChange={(open) => !open && setViewingUser(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes do Paciente</DialogTitle>
          </DialogHeader>
          
          {viewingUser && (
            <div className="space-y-6">
              {/* Data Quality Warnings */}
              {viewingUser.hasMissingCriticalData && (
                <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-medium">Dados críticos incompletos</span>
                  </div>
                  <ul className="text-xs text-red-600 dark:text-red-400 mt-1 ml-6 list-disc">
                    {!viewingUser.patient?.cpf && <li>CPF não cadastrado</li>}
                    {viewingUser.hasInvalidCpf && <li>CPF inválido ou placeholder</li>}
                    {!viewingUser.patient?.phone_e164 && <li>Telefone não cadastrado</li>}
                    {viewingUser.hasPlaceholderPhone && <li>Telefone é placeholder</li>}
                  </ul>
                </div>
              )}

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
                  <div className="flex items-center gap-2">
                    {renderCpfCell(viewingUser)}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Telefone</label>
                  <div className="flex items-center gap-2">
                    {renderPhoneCell(viewingUser)}
                  </div>
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
                <label className="text-sm font-medium text-muted-foreground">Patient ID</label>
                <p className="font-mono text-xs text-muted-foreground">{viewingUser.patientId}</p>
              </div>
              {viewingUser.hasAuthAccount && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">User ID (Auth)</label>
                  <p className="font-mono text-xs text-muted-foreground">{viewingUser.id}</p>
                </div>
              )}

              {/* Quick Edit Button */}
              <div className="pt-4 border-t">
                <Button onClick={() => {
                  setViewingUser(null);
                  handleEditPatient(viewingUser);
                }} className="w-full">
                  <Edit className="h-4 w-4 mr-2" />
                  Editar Dados do Paciente
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
