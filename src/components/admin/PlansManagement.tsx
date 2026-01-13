import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Search, XCircle, CheckCircle, ChevronDown, ChevronUp, 
  RefreshCw, Edit2, Trash2, Users, Calendar, MapPin, 
  Mail, Phone, CreditCard, Loader2, AlertTriangle
} from "lucide-react";
import { formatPlanName } from "@/lib/patient-plan";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface PatientPlan {
  id: string;
  email: string;
  user_id: string | null;
  plan_code: string;
  status: string;
  plan_expires_at: string;
  created_at: string;
  updated_at: string;
  subscription_id?: string;
}

interface PlanWithDetails extends PatientPlan {
  first_name?: string;
  last_name?: string;
  cpf?: string;
  phone_e164?: string;
  address_line?: string;
  address_number?: string;
  city?: string;
  state?: string;
  cep?: string;
  subscription_status?: string;
  next_payment_date?: string;
  is_titular?: boolean;
}

interface Dependente {
  id: string;
  email: string;
  status: string;
  first_name?: string;
  last_name?: string;
  created_at?: string;
}

const PLAN_OPTIONS = [
  { value: 'IND_COM_ESP_1M', label: 'Individual com Especialistas - Mensal' },
  { value: 'IND_COM_ESP_3M', label: 'Individual com Especialistas - Trimestral' },
  { value: 'IND_COM_ESP_6M', label: 'Individual com Especialistas - Semestral' },
  { value: 'IND_COM_ESP_12M', label: 'Individual com Especialistas - Anual' },
  { value: 'IND_SEM_ESP_1M', label: 'Individual sem Especialistas - Mensal' },
  { value: 'IND_SEM_ESP_3M', label: 'Individual sem Especialistas - Trimestral' },
  { value: 'IND_SEM_ESP_6M', label: 'Individual sem Especialistas - Semestral' },
  { value: 'IND_SEM_ESP_12M', label: 'Individual sem Especialistas - Anual' },
  { value: 'FAM_COM_ESP_1M', label: 'Familiar com Especialistas - Mensal' },
  { value: 'FAM_COM_ESP_3M', label: 'Familiar com Especialistas - Trimestral' },
  { value: 'FAM_COM_ESP_6M', label: 'Familiar com Especialistas - Semestral' },
  { value: 'FAM_COM_ESP_12M', label: 'Familiar com Especialistas - Anual' },
  { value: 'FAM_SEM_ESP_1M', label: 'Familiar sem Especialistas - Mensal' },
  { value: 'FAM_SEM_ESP_3M', label: 'Familiar sem Especialistas - Trimestral' },
  { value: 'FAM_SEM_ESP_6M', label: 'Familiar sem Especialistas - Semestral' },
  { value: 'FAM_SEM_ESP_12M', label: 'Familiar sem Especialistas - Anual' },
  { value: 'BASIC', label: 'Plano Básico (Legado)' },
  { value: 'PREMIUM', label: 'Plano Premium (Legado)' },
  { value: 'FAMILY', label: 'Plano Família (Legado)' },
];

const PlansManagement = () => {
  // Search state
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResults, setSearchResults] = useState<PatientPlan[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // All plans state
  const [allPlans, setAllPlans] = useState<PlanWithDetails[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set());
  const [dependentesMap, setDependentesMap] = useState<Record<string, Dependente[]>>({});
  const [loadingDependentes, setLoadingDependentes] = useState<Set<string>>(new Set());
  
  // Modals state
  const [selectedPlan, setSelectedPlan] = useState<PlanWithDetails | null>(null);
  const [showChangePlanModal, setShowChangePlanModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [newPlanCode, setNewPlanCode] = useState("");
  const [newExpiryDate, setNewExpiryDate] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const { toast } = useToast();

  // Load all active plans on mount
  useEffect(() => {
    loadAllPlans();
  }, []);

  const loadAllPlans = async () => {
    setIsLoadingPlans(true);
    try {
      // Query patient_plans with joined patient data
      const { data: plans, error } = await supabase
        .from('patient_plans')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch all titular_plan_ids from pending_family_invites to identify titulars
      const { data: titularInvites } = await supabase
        .from('pending_family_invites')
        .select('titular_plan_id');
      
      const titularPlanIds = new Set(
        (titularInvites || []).map(inv => inv.titular_plan_id)
      );

      // Fetch patient details for each plan
      const plansWithDetails: PlanWithDetails[] = [];
      
      for (const plan of plans || []) {
        let patientData = null;
        
        // Try to get patient by patient_id first (correct field from patient_plans)
        if (plan.patient_id) {
          const { data } = await supabase
            .from('patients')
            .select('first_name, last_name, cpf, phone_e164, address_line, address_number, city, state, cep')
            .eq('id', plan.patient_id)
            .maybeSingle();
          patientData = data;
        }
        
        // Fallback: try by user_id (patients.user_id = plan.user_id)
        if (!patientData && plan.user_id) {
          const { data } = await supabase
            .from('patients')
            .select('first_name, last_name, cpf, phone_e164, address_line, address_number, city, state, cep')
            .eq('user_id', plan.user_id)
            .maybeSingle();
          patientData = data;
        }
        
        // Last fallback: try by email
        if (!patientData && plan.email) {
          const { data } = await supabase
            .from('patients')
            .select('first_name, last_name, cpf, phone_e164, address_line, address_number, city, state, cep')
            .eq('email', plan.email)
            .maybeSingle();
          patientData = data;
        }

        // Check if this plan is a titular (has invites referencing it)
        const isTitular = isFamilyPlan(plan.plan_code) && titularPlanIds.has(plan.id);

        plansWithDetails.push({
          ...plan,
          first_name: patientData?.first_name || undefined,
          last_name: patientData?.last_name || undefined,
          cpf: patientData?.cpf || undefined,
          phone_e164: patientData?.phone_e164 || undefined,
          address_line: patientData?.address_line || undefined,
          address_number: patientData?.address_number || undefined,
          city: patientData?.city || undefined,
          state: patientData?.state || undefined,
          cep: patientData?.cep || undefined,
          is_titular: isTitular,
        });
      }

      setAllPlans(plansWithDetails);
    } catch (error) {
      console.error('Erro ao carregar planos:', error);
      toast({
        title: "Erro ao carregar planos",
        description: "Ocorreu um erro ao buscar os planos ativos",
        variant: "destructive"
      });
    } finally {
      setIsLoadingPlans(false);
    }
  };

  const searchPlans = async () => {
    if (!searchEmail.trim()) {
      toast({
        title: "Email necessário",
        description: "Digite um email para buscar",
        variant: "destructive"
      });
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('patient_plans')
        .select('*')
        .ilike('email', `%${searchEmail.trim()}%`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setSearchResults(data || []);

      if (!data || data.length === 0) {
        toast({
          title: "Nenhum plano encontrado",
          description: `Nenhum plano encontrado para "${searchEmail}"`,
        });
      }
    } catch (error) {
      console.error('Erro ao buscar planos:', error);
      toast({
        title: "Erro ao buscar planos",
        description: "Ocorreu um erro ao buscar os planos",
        variant: "destructive"
      });
    } finally {
      setIsSearching(false);
    }
  };

  const loadDependentes = async (planId: string) => {
    if (dependentesMap[planId]) return;
    
    setLoadingDependentes(prev => new Set(prev).add(planId));
    
    try {
      const { data, error } = await supabase
        .from('pending_family_invites')
        .select('id, email, status, created_at')
        .eq('titular_plan_id', planId);

      if (error) throw error;

      // Fetch patient names for completed invites
      const dependentesWithNames: Dependente[] = [];
      
      for (const invite of data || []) {
        let firstName, lastName;
        
        if (invite.status === 'completed') {
          const { data: patient } = await supabase
            .from('patients')
            .select('first_name, last_name')
            .eq('email', invite.email)
            .maybeSingle();
          
          firstName = patient?.first_name;
          lastName = patient?.last_name;
        }
        
        dependentesWithNames.push({
          id: invite.id,
          email: invite.email,
          status: invite.status,
          first_name: firstName,
          last_name: lastName,
          created_at: invite.created_at,
        });
      }

      setDependentesMap(prev => ({ ...prev, [planId]: dependentesWithNames }));
    } catch (error) {
      console.error('Erro ao carregar dependentes:', error);
    } finally {
      setLoadingDependentes(prev => {
        const next = new Set(prev);
        next.delete(planId);
        return next;
      });
    }
  };

  const toggleExpanded = (planId: string) => {
    setExpandedPlans(prev => {
      const next = new Set(prev);
      if (next.has(planId)) {
        next.delete(planId);
      } else {
        next.add(planId);
        loadDependentes(planId);
      }
      return next;
    });
  };

  const handleChangePlan = (plan: PlanWithDetails) => {
    setSelectedPlan(plan);
    setNewPlanCode(plan.plan_code);
    setNewExpiryDate(plan.plan_expires_at.split('T')[0]);
    setShowChangePlanModal(true);
  };

  const handleDeletePlan = (plan: PlanWithDetails) => {
    setSelectedPlan(plan);
    setShowDeleteDialog(true);
  };

  const confirmChangePlan = async () => {
    if (!selectedPlan || !newPlanCode) return;
    
    setIsUpdating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Não autenticado",
          description: "Você precisa estar autenticado",
          variant: "destructive"
        });
        return;
      }

      const response = await supabase.functions.invoke('patient-operations', {
        body: {
          operation: 'change_plan',
          plan_id: selectedPlan.id,
          new_plan_code: newPlanCode,
          new_expires_at: newExpiryDate ? new Date(newExpiryDate).toISOString() : undefined
        }
      });

      if (response.error) {
        throw response.error;
      }

      toast({
        title: "Plano alterado",
        description: `Plano alterado com sucesso para ${selectedPlan.email}`,
      });

      setShowChangePlanModal(false);
      setSelectedPlan(null);
      await loadAllPlans();
    } catch (error: any) {
      console.error('Erro ao alterar plano:', error);
      toast({
        title: "Erro ao alterar plano",
        description: error.message || "Ocorreu um erro ao alterar o plano",
        variant: "destructive"
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const confirmDeletePlan = async () => {
    if (!selectedPlan) return;
    
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: "Não autenticado",
          description: "Você precisa estar autenticado",
          variant: "destructive"
        });
        return;
      }

      const response = await supabase.functions.invoke('patient-operations', {
        body: {
          operation: 'disable_plan',
          email: selectedPlan.email
        }
      });

      if (response.error) {
        throw response.error;
      }

      toast({
        title: "Plano excluído",
        description: `Plano de ${selectedPlan.email} foi desabilitado com sucesso`,
      });

      setShowDeleteDialog(false);
      setSelectedPlan(null);
      await loadAllPlans();
    } catch (error: any) {
      console.error('Erro ao excluir plano:', error);
      toast({
        title: "Erro ao excluir plano",
        description: error.message || "Ocorreu um erro ao excluir o plano",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getExpiryStatus = (expiresAt: string) => {
    const expiry = new Date(expiresAt);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) return { color: 'bg-red-500', text: 'Expirado' };
    if (daysUntilExpiry <= 7) return { color: 'bg-amber-500', text: `${daysUntilExpiry}d` };
    if (daysUntilExpiry <= 30) return { color: 'bg-yellow-500', text: `${daysUntilExpiry}d` };
    return { color: 'bg-green-500', text: `${daysUntilExpiry}d` };
  };

  const isFamilyPlan = (planCode: string) => {
    return planCode.startsWith('FAM_') || planCode === 'FAMILY' || planCode === 'FAM_BASIC';
  };

  const formatAddress = (plan: PlanWithDetails) => {
    const parts = [];
    if (plan.address_line) parts.push(plan.address_line);
    if (plan.address_number) parts.push(plan.address_number);
    if (plan.city) parts.push(plan.city);
    if (plan.state) parts.push(plan.state);
    if (plan.cep) parts.push(`CEP: ${plan.cep}`);
    return parts.length > 0 ? parts.join(', ') : '—';
  };

  const getFullName = (plan: PlanWithDetails) => {
    const name = [plan.first_name, plan.last_name].filter(Boolean).join(' ');
    return name || plan.email.split('@')[0];
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Buscar Plano
          </CardTitle>
          <CardDescription>
            Busque planos por email do paciente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <Label htmlFor="search-email">Email do Paciente</Label>
              <Input
                id="search-email"
                type="email"
                placeholder="exemplo@email.com"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && searchPlans()}
              />
            </div>
            <div className="flex items-end">
              <Button 
                onClick={searchPlans} 
                disabled={isSearching}
              >
                {isSearching ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 mr-2" />
                )}
                {isSearching ? "Buscando..." : "Buscar"}
              </Button>
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Resultados da Busca</h3>
              {searchResults.map((plan) => (
                <Card key={plan.id} className="bg-muted/30">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Status:</span>
                          <Badge 
                            variant={plan.status === 'active' ? 'default' : 'secondary'}
                          >
                            {plan.status === 'active' ? (
                              <>
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Ativo
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3 mr-1" />
                                {plan.status}
                              </>
                            )}
                          </Badge>
                        </div>
                        <div>
                          <span className="font-medium">Plano:</span>{" "}
                          {formatPlanName(plan.plan_code)}
                        </div>
                        <div>
                          <span className="font-medium">Email:</span> {plan.email}
                        </div>
                        <div>
                          <span className="font-medium">Expira em:</span>{" "}
                          {formatDateTime(plan.plan_expires_at)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Criado em: {formatDateTime(plan.created_at)}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {plan.status === 'active' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleChangePlan(plan as PlanWithDetails)}
                            >
                              <Edit2 className="w-4 h-4 mr-1" />
                              Trocar
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDeletePlan(plan as PlanWithDetails)}
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Excluir
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All Active Plans Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Todos os Planos Ativos
              </CardTitle>
              <CardDescription>
                Lista completa de pacientes com planos ativos ({allPlans.length} planos)
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadAllPlans}
              disabled={isLoadingPlans}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingPlans ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingPlans ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Carregando planos...</span>
            </div>
          ) : allPlans.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum plano ativo encontrado
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"></TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Compra</TableHead>
                    <TableHead>Expiração</TableHead>
                    <TableHead>Endereço</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allPlans.map((plan) => (
                    <Collapsible key={plan.id} asChild>
                      <>
                        <TableRow className="hover:bg-muted/50">
                          <TableCell>
                            {plan.is_titular && (
                              <CollapsibleTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="p-0 h-8 w-8"
                                  onClick={() => toggleExpanded(plan.id)}
                                >
                                  {expandedPlans.has(plan.id) ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {getFullName(plan)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-muted-foreground" />
                              <span className="text-sm">{plan.email}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {formatPlanName(plan.plan_code)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {formatDate(plan.created_at)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{formatDate(plan.plan_expires_at)}</span>
                              <Badge className={`${getExpiryStatus(plan.plan_expires_at).color} text-white text-xs`}>
                                {getExpiryStatus(plan.plan_expires_at).text}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm max-w-[200px] truncate" title={formatAddress(plan)}>
                              <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                              <span className="truncate">{formatAddress(plan)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {plan.subscription_id ? (
                              <Badge className="bg-blue-500 text-white">
                                <RefreshCw className="w-3 h-3 mr-1" />
                                Recorrente
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                <CreditCard className="w-3 h-3 mr-1" />
                                Único
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleChangePlan(plan)}
                                title="Trocar plano"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeletePlan(plan)}
                                className="text-destructive hover:text-destructive"
                                title="Excluir plano"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        
                        {/* Dependentes Row */}
                        {plan.is_titular && expandedPlans.has(plan.id) && (
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={9} className="p-4">
                              <CollapsibleContent>
                                <div className="pl-8">
                                  <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    Dependentes do Plano Familiar
                                  </h4>
                                  
                                  {loadingDependentes.has(plan.id) ? (
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      Carregando dependentes...
                                    </div>
                                  ) : !dependentesMap[plan.id] || dependentesMap[plan.id].length === 0 ? (
                                    <div className="text-sm text-muted-foreground">
                                      Nenhum dependente cadastrado
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      {dependentesMap[plan.id].map((dep) => (
                                        <div 
                                          key={dep.id} 
                                          className="flex items-center gap-4 p-2 bg-background rounded-md border"
                                        >
                                          <div className="flex-1">
                                            <div className="font-medium text-sm">
                                              {dep.first_name && dep.last_name 
                                                ? `${dep.first_name} ${dep.last_name}` 
                                                : dep.email.split('@')[0]}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              {dep.email}
                                            </div>
                                          </div>
                                          <Badge 
                                            variant={dep.status === 'completed' ? 'default' : 'secondary'}
                                            className="text-xs"
                                          >
                                            {dep.status === 'completed' ? (
                                              <>
                                                <CheckCircle className="w-3 h-3 mr-1" />
                                                Ativo
                                              </>
                                            ) : (
                                              <>
                                                <AlertTriangle className="w-3 h-3 mr-1" />
                                                Pendente
                                              </>
                                            )}
                                          </Badge>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Change Plan Modal */}
      <Dialog open={showChangePlanModal} onOpenChange={setShowChangePlanModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trocar Plano</DialogTitle>
            <DialogDescription>
              Altere o plano ou a data de expiração para {selectedPlan?.email}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Plano Atual</Label>
              <Input disabled value={formatPlanName(selectedPlan?.plan_code)} />
            </div>
            
            <div className="space-y-2">
              <Label>Novo Plano</Label>
              <Select value={newPlanCode} onValueChange={setNewPlanCode}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um plano" />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Nova Data de Expiração</Label>
              <Input 
                type="date" 
                value={newExpiryDate}
                onChange={(e) => setNewExpiryDate(e.target.value)}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowChangePlanModal(false)}>
              Cancelar
            </Button>
            <Button onClick={confirmChangePlan} disabled={isUpdating}>
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Plano</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o plano de <strong>{selectedPlan?.email}</strong>?
              <br /><br />
              Esta ação irá cancelar o plano. Os dependentes (se houver) continuarão com seus registros intactos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePlan}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                'Confirmar Exclusão'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PlansManagement;
