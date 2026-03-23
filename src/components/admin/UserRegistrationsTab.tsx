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
import { supabaseProduction } from '@/lib/supabase-production';
import { invokeEdgeFunction, invokeCloudEdgeFunction } from '@/lib/edge-functions';
import { toast } from 'sonner';
import { Users, Search, Download, Eye, Trash2, Shield, Stethoscope, Loader2, Upload, UserCheck, AlertCircle, AlertTriangle, Edit, HeartPulse, UserPlus, Copy, XCircle, Key } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { getPatientPlanByEmail, getPatientPlansBatch } from '@/lib/patient-plan';
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
  source?: 'cloud' | 'production' | 'both';
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
  // Source environment
  source?: 'cloud' | 'production' | 'both';
  // True when auth user exists but no row in patients table
  _noPatientRecord?: boolean;
}

// Constants for placeholder detection
const PLACEHOLDER_PHONE = '+5511999999999';
const PLACEHOLDER_CPF = '00000000000';

export default function UserRegistrationsTab() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [allUsersCache, setAllUsersCache] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [activationModalOpen, setActivationModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  const [viewingUser, setViewingUser] = useState<User | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [quickConsultUser, setQuickConsultUser] = useState<User | null>(null);
  const [quickConsultProvider, setQuickConsultProvider] = useState<'clicklife' | 'communicare'>('clicklife');
  const [quickConsultLoading, setQuickConsultLoading] = useState(false);
  const [generatedConsultUrl, setGeneratedConsultUrl] = useState<string | null>(null);
  
  // Platform activation modal state
  const [platformActivationUser, setPlatformActivationUser] = useState<User | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<'clicklife' | 'communicare'>('clicklife');
  const [selectedClickLifePlanId, setSelectedClickLifePlanId] = useState<number>(864);
  const [platformActivationLoading, setPlatformActivationLoading] = useState(false);
  
  // Reset password modal state
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  
  const [stats, setStats] = useState({
    total: 0,
    withPlan: 0,
    criticalWithPlan: 0,
  });
  const limit = 50;

  // Fetch data once on mount
  useEffect(() => {
    fetchAllUsers();
  }, []);

  // Apply filters locally whenever search, filter, page, or cache changes
  useEffect(() => {
    if (allUsersCache.length > 0) {
      applyFilters();
    }
  }, [search, statusFilter, page, allUsersCache]);

  // Reset page when search or filter changes
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  // Fix z-index: marca overlay do Dialog de Consulta Rápida para ficar acima dos float buttons
  useEffect(() => {
    if (quickConsultUser) {
      const timer = setTimeout(() => {
        const overlay = document.querySelector('[data-radix-dialog-overlay]');
        if (overlay) overlay.setAttribute('data-quick-consult-overlay', '');
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [quickConsultUser]);

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

  // Helper to transform raw patient data to User format
  const transformPatientToUser = async (patient: any, source: 'cloud' | 'production'): Promise<User> => {
    try {
      // Buscar plano de PRODUÇÃO por EMAIL (planos sempre ficam em produção)
      const plan = source === 'production' ? await getPatientPlanByEmail(patient.email || '') : null;
      
      let expiresAt: Date | null = null;
      if (plan?.plan_expires_at) {
        expiresAt = new Date(plan.plan_expires_at);
        if (expiresAt.getUTCHours() === 0 && expiresAt.getUTCMinutes() === 0) {
          expiresAt.setUTCHours(23, 59, 59, 999);
        }
      }
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
        activePlan: isActive || false,
        planCode: plan?.plan_code,
        hasAuthAccount: !!patient.user_id,
        authProvider: patient.user_id ? 'email' : 'none',
        hasInvalidCpf: isInvalidCpf(patient.cpf),
        hasPlaceholderPhone: isPlaceholderPhone(patient.phone_e164),
        hasMissingCriticalData: hasCriticalDataMissing(patientData),
        source,
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
        source,
      } as User;
    }
  };

  // Merge patients from Cloud and Production, removing duplicates by email
  const mergePatients = (cloudUsers: User[], prodUsers: User[]): User[] => {
    const emailMap = new Map<string, User>();
    
    // Add production users first (they take priority)
    for (const user of prodUsers) {
      const email = user.email.toLowerCase();
      emailMap.set(email, { ...user, source: 'production' });
    }
    
    // Add cloud users, marking as 'both' if already exists
    for (const user of cloudUsers) {
      const email = user.email.toLowerCase();
      if (emailMap.has(email)) {
        // User exists in both - mark as 'both' but keep production data
        const existing = emailMap.get(email)!;
        emailMap.set(email, { ...existing, source: 'both' });
      } else {
        emailMap.set(email, { ...user, source: 'cloud' });
      }
    }
    
    return Array.from(emailMap.values());
  };

  const fetchAllUsers = async () => {
    setLoading(true);
    try {
      console.log('[UserRegistrationsTab] ========================================');
      console.log('[UserRegistrationsTab] Buscando via list-all-users...');
      
      const { data: response, error: fetchError } = await invokeCloudEdgeFunction('list-all-users', {
        body: {}
      });
      
      console.log('[UserRegistrationsTab] Resposta recebida:', {
        success: response?.success,
        usersCount: response?.users?.length,
        stats: response?.stats,
        error: fetchError
      });
      
      if (fetchError) {
        console.error('[UserRegistrationsTab] ❌ Erro ao buscar usuários:', fetchError);
        // Show warning but keep existing users in state (don't clear the list)
        toast.warning('Não foi possível atualizar a lista. Exibindo dados anteriores.');
        setLoading(false);
        return;
      }

      if (!response?.success) {
        console.error('[UserRegistrationsTab] ❌ Resposta inválida:', response);
        // Show warning but keep existing users in state
        toast.warning(response?.error || 'Erro ao processar dados. Exibindo dados anteriores.');
        setLoading(false);
        return;
      }
      
      console.log(`[UserRegistrationsTab] ✅ Recebidos: ${response.users?.length || 0} usuários`);
      
      // Batch: buscar todos os planos de uma vez (em vez de 1 query por usuário)
      const allEmails = (response.users || [])
        .map((u: any) => (u.email || u.patient?.email || '').toLowerCase())
        .filter(Boolean) as string[];
      
      const planMap = await getPatientPlansBatch(allEmails);
      console.log(`[UserRegistrationsTab] Batch plans: ${planMap.size} planos ativos para ${allEmails.length} emails`);
      
      // Transformar dados sincronamente usando o mapa de planos
      const allUsers: User[] = (response.users || []).map((u: any) => {
        const plan = planMap.get((u.email || '').toLowerCase());
        const activePlan = !!plan;
        const planCode = plan?.plan_code;
        
        // _from_metadata means auth user_metadata was used as fallback (no real patients row)
        const hasRealPatientRecord = u.patient && !u.patient._from_metadata;
        const patientData = u.patient ? {
          first_name: u.patient.first_name,
          last_name: u.patient.last_name,
          cpf: u.patient.cpf,
          phone_e164: u.patient.phone_e164,
          birth_date: u.patient.birth_date,
          gender: u.patient.gender,
          cep: u.patient.cep,
          address_line: u.patient.address_line,
          address_number: u.patient.address_number,
          city: u.patient.city,
          state: u.patient.state,
          profile_complete: u.patient.profile_complete || false,
        } : undefined;

        return {
          id: u.id,
          patientId: u.patient?.id || u.id,
          email: u.email || u.patient?.email || '',
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          email_confirmed_at: u.email_confirmed_at,
          roles: [],
          // Use patientData for display; _noPatientRecord flags users missing a real DB row
          patient: patientData,
          _noPatientRecord: !hasRealPatientRecord,
          patientEmail: u.patient?.email || '',
          activePlan,
          planCode,
          hasAuthAccount: true,
          authProvider: 'email',
          hasInvalidCpf: isInvalidCpf(patientData?.cpf),
          hasPlaceholderPhone: isPlaceholderPhone(patientData?.phone_e164),
          hasMissingCriticalData: hasCriticalDataMissing(patientData),
          source: u.source as 'cloud' | 'production' | 'both',
        } as User;
      });

      // Calculate stats
      const withPlanCount = allUsers.filter(u => u.activePlan).length;
      const criticalWithPlanCount = allUsers.filter(u => u.activePlan && u.hasMissingCriticalData).length;

      setStats({
        total: response.stats?.totalUnique || allUsers.length,
        withPlan: withPlanCount,
        criticalWithPlan: criticalWithPlanCount,
      });

      // Store in cache - filtering will happen via applyFilters useEffect
      setAllUsersCache(allUsers);

    } catch (error) {
      console.error('Error loading patients:', error);
      toast.error('Erro ao carregar pacientes');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filteredUsers = [...allUsersCache];

    // Apply search filter
    if (search.trim()) {
      const searchLower = search.toLowerCase().trim();
      const searchDigits = search.replace(/\D/g, '');
      filteredUsers = filteredUsers.filter(u => {
        if (u.email?.toLowerCase().includes(searchLower)) return true;
        // Fallback: buscar também no email do patient (caso u.email esteja vazio)
        const patientEmail = (u as any).patientEmail || '';
        if (patientEmail && patientEmail.toLowerCase().includes(searchLower)) return true;
        if (u.patient?.first_name?.toLowerCase().includes(searchLower)) return true;
        if (u.patient?.last_name?.toLowerCase().includes(searchLower)) return true;
        const fullName = `${u.patient?.first_name || ''} ${u.patient?.last_name || ''}`.toLowerCase();
        if (fullName.includes(searchLower)) return true;
        if (searchDigits && u.patient?.cpf?.replace(/\D/g, '').includes(searchDigits)) return true;
        if (searchDigits && u.patient?.phone_e164?.replace(/\D/g, '').includes(searchDigits)) return true;
        return false;
      });
    }
    
    // Apply status filter
    if (statusFilter === 'with_account') {
      filteredUsers = filteredUsers.filter(u => u.hasAuthAccount);
    } else if (statusFilter === 'without_account') {
      filteredUsers = filteredUsers.filter(u => !u.hasAuthAccount);
    } else if (statusFilter === 'with_plan') {
      filteredUsers = filteredUsers.filter(u => u.activePlan);
    } else if (statusFilter === 'incomplete_data') {
      filteredUsers = filteredUsers.filter(u => u.hasMissingCriticalData);
    } else if (statusFilter === 'invalid_phone') {
      filteredUsers = filteredUsers.filter(u => u.hasPlaceholderPhone);
    } else if (statusFilter === 'invalid_cpf') {
      filteredUsers = filteredUsers.filter(u => u.hasInvalidCpf || !u.patient?.cpf);
    } else if (statusFilter === 'critical_with_plan') {
      filteredUsers = filteredUsers.filter(u => u.activePlan && u.hasMissingCriticalData);
    } else if (statusFilter === 'no_patient_record') {
      filteredUsers = filteredUsers.filter(u => u._noPatientRecord);
    }

    // Paginate locally
    const startIdx = (page - 1) * limit;
    const paginatedUsers = filteredUsers.slice(startIdx, startIdx + limit);

    setUsers(paginatedUsers);
  };

  const handleDelete = async (userId: string, userEmail: string) => {
    if (!confirm(`Tem certeza que deseja deletar o usuário ${userEmail}?\n\nEsta ação não pode ser desfeita e remove o usuário de AMBOS os ambientes (Cloud e Produção).`)) {
      return;
    }

    try {
      // Usar invokeCloudEdgeFunction porque a edge function está no Cloud
      const { data, error } = await invokeCloudEdgeFunction('user-management', {
        body: {
          operation: 'delete_user',
          user_id: userId,
          email: userEmail // Passar email para deletar da Produção também
        }
      });

      if (error) {
        console.error('Error deleting user:', error);
        toast.error('Erro ao deletar usuário');
        return;
      }

      console.log('[handleDelete] Resultado:', data);
      toast.success(`Usuário ${userEmail} deletado com sucesso`);
      fetchAllUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Erro ao deletar usuário');
    }
  };

  const handleRemovePlan = async (user: User) => {
    if (!confirm(`Deseja realmente remover o plano de ${user.email}?\n\nEsta ação irá cancelar o plano ativo.`)) {
      return;
    }

    try {
      // ✅ CORREÇÃO: Enviar JWT real do admin
      const { data: sessionData } = await supabase.auth.getSession();
      const adminToken = sessionData?.session?.access_token;

      const { data, error } = await invokeEdgeFunction('patient-operations', {
        body: {
          operation: 'deactivate_plan_manual',
          patient_email: user.email
        },
        headers: adminToken ? {
          Authorization: `Bearer ${adminToken}`
        } : undefined
      });

      if (error) {
        console.error('[handleRemovePlan] Error:', error);
        toast.error('Erro ao remover plano');
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || 'Erro ao remover plano');
        return;
      }

      toast.success('Plano removido com sucesso!');
      fetchAllUsers();
    } catch (error) {
      console.error('[handleRemovePlan] Exception:', error);
      toast.error('Erro inesperado ao remover plano');
    }
  };

  const handlePlatformActivation = async () => {
    if (!platformActivationUser) return;
    
    // Validar dados obrigatórios
    if (!platformActivationUser.patient?.cpf) {
      toast.error('Paciente não possui CPF cadastrado');
      return;
    }
    if (!platformActivationUser.patient?.phone_e164) {
      toast.error('Paciente não possui telefone cadastrado');
      return;
    }

    setPlatformActivationLoading(true);
    
    try {
      const functionName = selectedPlatform === 'clicklife' 
        ? 'activate-clicklife-manual' 
        : 'activate-communicare-manual';
      
      // ✅ CORREÇÃO: Enviar todos os dados no payload para não depender do banco de Produção
      const payload = {
        email: platformActivationUser.email,
        cpf: platformActivationUser.patient?.cpf,
        nome: `${platformActivationUser.patient?.first_name || ''} ${platformActivationUser.patient?.last_name || ''}`.trim(),
        telefone: platformActivationUser.patient?.phone_e164,
        sexo: platformActivationUser.patient?.gender || 'F',
        birth_date: platformActivationUser.patient?.birth_date,
        skip_db_lookup: true,
        ...(selectedPlatform === 'clicklife' ? { plan_id: selectedClickLifePlanId } : {})
      };
      
      console.log(`[PlatformActivation] Ativando na ${selectedPlatform}:`, {
        email: payload.email,
        cpf: payload.cpf?.substring(0, 3) + '***',
        nome: payload.nome,
        skip_db_lookup: payload.skip_db_lookup
      });
      
      // Chamar Edge Function em Produção
      const { data, error } = await invokeEdgeFunction(functionName, {
        body: payload
      });

      if (error) {
        console.error(`Error activating ${selectedPlatform}:`, error);
        toast.error(`Erro ao ativar na ${selectedPlatform === 'clicklife' ? 'ClickLife' : 'Communicare'}: ${error.message || 'Erro desconhecido'}`);
        return;
      }

      if (data?.success) {
        console.log('[PlatformActivation] ✅ Ativação bem-sucedida:', data);
        
        const platformName = selectedPlatform === 'clicklife' ? 'ClickLife' : 'Communicare';
        const patientName = platformActivationUser.patient?.first_name || platformActivationUser.email;
        
        const planInfo = selectedPlatform === 'clicklife' ? ` (plano_id: ${selectedClickLifePlanId})` : '';
        toast.success(`${patientName} ativado na ${platformName}!${planInfo}`, {
          description: selectedPlatform === 'clicklife' ? `Plano ClickLife: ${selectedClickLifePlanId}` : 'Paciente cadastrado e ativado com sucesso.',
          duration: 6000,
        });
        
        setPlatformActivationUser(null);
      } else {
        toast.error('Falha na ativação: ' + (data?.error || 'Erro desconhecido'));
      }
    } catch (error) {
      console.error(`Error activating ${selectedPlatform}:`, error);
      toast.error(`Erro ao ativar na ${selectedPlatform === 'clicklife' ? 'ClickLife' : 'Communicare'}`);
    } finally {
      setPlatformActivationLoading(false);
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

  const handleCreatePatientRecord = async (user: User) => {
    if (user.patient) {
      toast.error('Este usuário já possui registro de paciente');
      return;
    }

    try {
      toast.info('Criando registro de paciente...');

      // First, try to get metadata from auth user (Cloud)
      let metadata: Record<string, any> = {};
      try {
        const { data: cloudUserData } = await invokeCloudEdgeFunction('check-user-exists', {
          body: { email: user.email.toLowerCase().trim() }
        });
        // If user exists in Cloud, we use their auth metadata
        if (cloudUserData?.existsInCloud || cloudUserData?.existsInProduction) {
          // The metadata will be extracted from auth user_metadata by the edge function
        }
      } catch (e) {
        console.warn('[handleCreatePatientRecord] Could not fetch user metadata:', e);
      }

      const { data, error } = await invokeEdgeFunction('patient-operations', {
        body: {
          operation: 'admin_create_patient',
          email: user.email,
          user_id: user.id,
          metadata,
        }
      });

      if (error) {
        toast.error('Erro ao criar registro: ' + (error.message || 'Erro desconhecido'));
        return;
      }

      if (data?.success) {
        toast.success('Registro de paciente criado com sucesso!');
        // Refresh users list
        fetchAllUsers();
      } else {
        toast.error(data?.error || 'Erro ao criar registro de paciente');
      }
    } catch (err: any) {
      console.error('[handleCreatePatientRecord] Error:', err);
      toast.error('Erro inesperado ao criar registro');
    }
  };

  const handleResetPassword = async (user: User) => {
    setResetLoading(true);
    
    // Gerar senha aleatória forte (12 caracteres)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    try {
      // Chamar Edge Function para atualizar senha em ambos os ambientes
      const { data, error } = await invokeCloudEdgeFunction('reset-user-password', {
        body: { email: user.email, new_password: password }
      });

      if (error) {
        console.error('[handleResetPassword] Erro:', error);
        toast.error('Erro ao resetar senha: ' + (error.message || 'Erro desconhecido'));
        setResetLoading(false);
        return;
      }

      if (!data?.success) {
        toast.error(data?.message || 'Erro ao resetar senha');
        setResetLoading(false);
        return;
      }

      setGeneratedPassword(password);
      setResetPasswordUser(user);
      toast.success('Senha resetada com sucesso!');
    } catch (err: any) {
      console.error('[handleResetPassword] Exception:', err);
      toast.error('Erro inesperado ao resetar senha');
    } finally {
      setResetLoading(false);
    }
  };

  const handleQuickConsult = async () => {
    if (!quickConsultUser) return;
    
    // ✅ Validação prévia de campos obrigatórios (evita enviar payload inválido)
    const missingFields: string[] = [];
    if (!quickConsultUser.patient?.cpf) missingFields.push('CPF');
    if (!quickConsultUser.email) missingFields.push('Email');
    if (!quickConsultUser.patient?.first_name && !quickConsultUser.patient?.last_name) missingFields.push('Nome');
    if (!quickConsultUser.patient?.phone_e164) missingFields.push('Telefone');
    
    if (missingFields.length > 0) {
      toast.error(`Dados obrigatórios faltando: ${missingFields.join(', ')}. Edite o paciente primeiro.`);
      return;
    }
    
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
        skip_registration: true, // ✅ Pular cadastro/ativação, ir direto para criação de atendimento
      };
      
      console.log('[QuickConsult] Criando consulta:', { provider: quickConsultProvider, email: payload.email });
      
      // ✅ CORREÇÃO: Usar invokeEdgeFunction para chamar produção
      const { data, error } = await invokeEdgeFunction('schedule-redirect', {
        body: payload,
      });
      
      if (error) throw error;
      
      if (data?.ok && data?.url) {
        // ✅ Salvar URL no estado para mostrar no modal
        setGeneratedConsultUrl(data.url);
        setQuickConsultLoading(false);
        
        // Copiar automaticamente (try/catch isolado para não fechar modal no mobile)
        try {
          await navigator.clipboard.writeText(data.url);
          toast.success(`Consulta criada na ${quickConsultProvider === 'clicklife' ? 'ClickLife' : 'Communicare'}! Link copiado.`);
        } catch (clipErr) {
          console.warn('[QuickConsult] Clipboard não disponível:', clipErr);
          toast.success(`Consulta criada na ${quickConsultProvider === 'clicklife' ? 'ClickLife' : 'Communicare'}! Copie o link abaixo.`);
        }
        
        // NÃO fechar o modal - deixar aberto para mostrar o link
      } else {
        // ✅ Melhor mensagem de erro com debug_hint e request_id
        const errorMsg = data?.error || 'Erro desconhecido';
        const debugHint = data?.debug_hint || '';
        const errorCode = data?.error_code || '';
        const requestId = data?.request_id || '';
        const responsePreview = data?.response_preview || '';
        const details = data?.details || {};
        
        console.error('[QuickConsult] Erro estruturado:', { 
          error: errorMsg, 
          debug_hint: debugHint, 
          error_code: errorCode, 
          request_id: requestId,
          response_preview: responsePreview,
          details: details
        });
        
        let userMessage = errorMsg;
        if (errorCode === 'EMPTY_BODY') {
          userMessage = 'Erro de comunicação: payload não chegou ao servidor. Tente novamente.';
        } else if (errorCode === 'MISSING_FIELDS') {
          userMessage = `Campos obrigatórios faltando: ${errorMsg}`;
        } else if (debugHint) {
          userMessage = `${errorMsg} (${debugHint})`;
        }
        
        // ✅ Mostrar request_id para facilitar debug nos logs
        if (requestId) {
          userMessage += ` [ID: ${requestId.substring(0, 8)}]`;
        }
        
        toast.error(userMessage);
        setQuickConsultLoading(false);
        setQuickConsultUser(null);
        setGeneratedConsultUrl(null);
      }
    } catch (error: any) {
      console.error('Erro ao criar consulta:', error);
      toast.error(`Erro ao criar consulta rápida: ${error?.message || 'Erro de conexão'}`);
      setQuickConsultLoading(false);
      setQuickConsultUser(null);
      setGeneratedConsultUrl(null);
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
              onKeyDown={(e) => e.key === 'Enter' && fetchAllUsers()}
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
              <SelectItem value="no_patient_record">⚠️ Sem Registro de Paciente</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={fetchAllUsers}>
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
                    <TableHead>Origem</TableHead>
                    <TableHead>Login</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow
                      key={user.patientId}
                      className={
                        user._noPatientRecord
                          ? 'bg-amber-50/50 dark:bg-amber-950/20'
                          : user.activePlan && user.hasMissingCriticalData
                            ? 'bg-red-50/50 dark:bg-red-950/20'
                            : ''
                      }
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
                        {user.source === 'both' ? (
                          <Badge variant="outline" className="text-xs border-purple-500 text-purple-600">Ambos</Badge>
                        ) : user.source === 'cloud' ? (
                          <Badge variant="outline" className="text-xs border-blue-500 text-blue-600">☁️ Cloud</Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs border-green-500 text-green-600">🏭 Prod</Badge>
                        )}
                      </TableCell>
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
                        <div className="flex items-center gap-1">
                          {user.activePlan ? (
                            <>
                              <Badge variant="default" className="bg-green-600 text-xs">✓ {user.planCode}</Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemovePlan(user)}
                                title="Remover Plano"
                                className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          ) : (
                            <Badge variant="secondary" className="text-xs">✗</Badge>
                          )}
                        </div>
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

                          {user._noPatientRecord && user.hasAuthAccount && (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Criar Registro de Paciente (auth existe, mas sem registro na tabela patients)"
                              onClick={() => handleCreatePatientRecord(user)}
                              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            >
                              <AlertCircle className="h-4 w-4" />
                            </Button>
                          )}

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
                            title="Resetar Senha"
                            onClick={() => handleResetPassword(user)}
                            disabled={resetLoading}
                            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          
                          {user.patient?.cpf && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setPlatformActivationUser(user);
                                setSelectedPlatform('clicklife');
                              }}
                              title="Ativar em Plataforma (ClickLife ou Communicare)"
                              className="text-teal-600 hover:text-teal-700 hover:bg-teal-50"
                            >
                              <UserPlus className="h-4 w-4" />
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
                              onClick={() => handleDelete(user.id, user.email)}
                              title="Excluir"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
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
          fetchAllUsers();
        }}
      />

      {/* Edit Patient Modal */}
      <EditPatientModal
        open={!!editingPatient}
        onOpenChange={(open) => !open && setEditingPatient(null)}
        patient={editingPatient}
        onSuccess={() => {
          setEditingPatient(null);
          fetchAllUsers();
        }}
      />

      {/* Modal de Ativação Manual */}
      {selectedUser && (
        <ManualPlanActivationModal
          open={activationModalOpen}
          onOpenChange={setActivationModalOpen}
          user={{
            id: selectedUser.patientId || selectedUser.id,
            email: selectedUser.email,
            name: `${selectedUser.patient?.first_name || ''} ${selectedUser.patient?.last_name || ''}`.trim(),
            cpf: selectedUser.patient?.cpf,
            phone: selectedUser.patient?.phone_e164,
            gender: selectedUser.patient?.gender,
            birth_date: selectedUser.patient?.birth_date,
            currentPlan: selectedUser.activePlan ? {
              code: selectedUser.planCode || '',
              expiresAt: ''
            } : undefined
          }}
          onSuccess={() => {
            setActivationModalOpen(false);
            setSelectedUser(null);
            fetchAllUsers();
            toast.success('Plano ativado com sucesso!');
          }}
        />
      )}

      {/* Modal de Consulta Rápida */}
      <Dialog open={!!quickConsultUser} onOpenChange={(open) => {
        if (!open) {
          setQuickConsultUser(null);
          setGeneratedConsultUrl(null);
        }
      }}>
        <DialogContent className="sm:max-w-md !z-[10001]">
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
            
            {/* Mostrar link gerado */}
            {generatedConsultUrl && (
              <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">✅ Consulta criada com sucesso!</p>
                <div className="flex items-center gap-2">
                  <Input 
                    value={generatedConsultUrl} 
                    readOnly 
                    className="flex-1 text-xs font-mono"
                  />
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedConsultUrl);
                      toast.success('Link copiado!');
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                  Envie este link para o paciente iniciar a consulta.
                </p>
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => {
              setQuickConsultUser(null);
              setGeneratedConsultUrl(null);
            }}>
              {generatedConsultUrl ? 'Fechar' : 'Cancelar'}
            </Button>
            {!generatedConsultUrl && (
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
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Ativação em Plataforma */}
      <Dialog open={!!platformActivationUser} onOpenChange={(open) => !open && setPlatformActivationUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-teal-600" />
              Ativar Paciente em Plataforma
            </DialogTitle>
          </DialogHeader>
          
          {platformActivationUser && (
            <div className="space-y-6">
              {/* Dados do Paciente */}
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Paciente:</span>
                  <span className="text-sm font-medium">
                    {platformActivationUser.patient?.first_name} {platformActivationUser.patient?.last_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Email:</span>
                  <span className="text-sm font-mono">{platformActivationUser.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">CPF:</span>
                  <span className="text-sm font-mono">
                    {platformActivationUser.patient?.cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                  </span>
                </div>
              </div>

              {/* Seleção de Plataforma */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Escolha a plataforma:</Label>
                <RadioGroup 
                  value={selectedPlatform} 
                  onValueChange={(value: 'clicklife' | 'communicare') => setSelectedPlatform(value)}
                  className="space-y-3"
                >
                  <div className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedPlatform === 'clicklife' ? 'border-teal-500 bg-teal-50 dark:bg-teal-950' : 'hover:bg-muted/50'}`}>
                    <RadioGroupItem value="clicklife" id="clicklife" />
                    <div className="flex-1">
                      <Label htmlFor="clicklife" className="cursor-pointer font-medium">ClickLife</Label>
                      <p className="text-xs text-muted-foreground">Pronto atendimento imediato</p>
                    </div>
                    <Stethoscope className="h-5 w-5 text-blue-500" />
                  </div>
                  
                  <div className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedPlatform === 'communicare' ? 'border-teal-500 bg-teal-50 dark:bg-teal-950' : 'hover:bg-muted/50'}`}>
                    <RadioGroupItem value="communicare" id="communicare" />
                    <div className="flex-1">
                      <Label htmlFor="communicare" className="cursor-pointer font-medium">Communicare</Label>
                      <p className="text-xs text-muted-foreground">Sistema de agendamento</p>
                    </div>
                    <HeartPulse className="h-5 w-5 text-purple-500" />
                  </div>
              </RadioGroup>
              </div>

              {/* Seletor de Plano ClickLife (visível apenas quando ClickLife selecionado) */}
              {selectedPlatform === 'clicklife' && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Código do Plano ClickLife:</Label>
                  <Select 
                    value={String(selectedClickLifePlanId)} 
                    onValueChange={(v) => setSelectedClickLifePlanId(Number(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="863">863 — Sem Especialista (Pronto Atendimento)</SelectItem>
                      <SelectItem value="864">864 — Com Especialista (padrão)</SelectItem>
                      <SelectItem value="1237">1237 — Familiar Sem Especialista</SelectItem>
                      <SelectItem value="1238">1238 — Familiar Com Especialista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Botões de Ação */}
              <div className="flex gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setPlatformActivationUser(null)}
                  className="flex-1"
                  disabled={platformActivationLoading}
                >
                  Cancelar
                </Button>
                <Button 
                  onClick={handlePlatformActivation}
                  disabled={platformActivationLoading}
                  className="flex-1 bg-teal-600 hover:bg-teal-700"
                >
                  {platformActivationLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Ativando...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Ativar
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
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

      {/* Modal de Senha Resetada */}
      <Dialog open={!!resetPasswordUser && !!generatedPassword} onOpenChange={(open) => {
        if (!open) {
          setResetPasswordUser(null);
          setGeneratedPassword(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <Key className="h-5 w-5" />
              Senha Resetada com Sucesso
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <p>Nova senha gerada para <strong>{resetPasswordUser?.email}</strong>:</p>
            
            <div className="flex items-center gap-2 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <code className="flex-1 text-lg font-mono select-all">{generatedPassword}</code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(generatedPassword || '');
                  toast.success('Senha copiada!');
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground">
              Envie esta senha para o usuário. Ele poderá usá-la imediatamente para fazer login.
            </p>
          </div>
          
          <div className="flex justify-end">
            <Button onClick={() => {
              setResetPasswordUser(null);
              setGeneratedPassword(null);
            }}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
