import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getHybridSession, supabaseProductionAuth, hybridSignOut, hybridSignUp, hybridSignIn } from "@/lib/auth-hybrid";
import { invokeEdgeFunction } from "@/lib/edge-functions";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, User, MapPin, Phone, Home, LogOut, Eye, EyeOff, Lock } from "lucide-react";
import { DateOfBirthInput } from "@/components/ui/date-of-birth-input";
import { requireAuth, getPatient } from "@/lib/auth";
import { validateCPF, validatePhoneE164, validateBirthDate, formatPhoneE164 } from "@/lib/validations";
import { upsertPatientBasic } from "@/lib/patients";
import { PasswordChecklist, isPasswordValid } from "@/components/auth/PasswordChecklist";

const CompletarPerfil = () => {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    address_line: "",
    cpf: "",
    phone_e164: "",
    birth_date: "",
    gender: "",
    cep: "",
    address_number: "",
    address_complement: "",
    city: "",
    state: "",
    terms_accepted: false
  });
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [inviteData, setInviteData] = useState<any>(null);
  const [showFamilyAuthChoice, setShowFamilyAuthChoice] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('token');
  const familyToken = searchParams.get('token_familiar');

  useEffect(() => {
    if (familyToken) {
      validateFamilyInviteToken();
    } else if (inviteToken) {
      validateInviteToken();
    } else {
      loadPatientData();
    }
  }, [inviteToken, familyToken]);

  const validateFamilyInviteToken = async () => {
    setIsLoading(true);
    try {
      // Usar função RPC segura para validar token de convite familiar
      const { data: inviteResult, error } = await supabase
        .rpc('validate_family_invite_token', { _token: familyToken });
        
      const invite = inviteResult?.[0];
      
      if (error || !invite) {
        toast({
          title: "Convite inválido",
          description: "Este convite não existe, já foi utilizado ou expirou.",
          variant: "destructive",
        });
        navigate('/entrar');
        return;
      }
      
      // Construir objeto de dados do convite para manter compatibilidade
      const inviteData = {
        email: invite.email,
        titular_plan_id: invite.titular_plan_id,
        expires_at: (invite as any).expires_at || '',
        invite_token: familyToken, // ✅ CRÍTICO: incluir token para ativação posterior
        patient_plans: {
          plan_code: (invite as any).plan_code || '',
          plan_expires_at: (invite as any).plan_expires_at || ''
        },
        isFamilyInvite: true
      };
      
      // Marcar como convite familiar
      setInviteData(inviteData);
      
      // Verificar sessão atual
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session && session.user.email?.toLowerCase() !== invite.email.toLowerCase()) {
        try { await supabase.auth.signOut(); } catch (e) { console.warn('[CompletarPerfil] signOut error (family invite):', e); }
        toast({
          title: "Sessão anterior encerrada",
          description: `Complete o cadastro com o email ${invite.email}`,
        });
        setShowFamilyAuthChoice(true);
      } else if (session) {
        setCurrentUser(session.user);
        const patient = await getPatient(session.user.id);
        if (patient) {
          setFormData({
            first_name: patient.first_name || '',
            last_name: patient.last_name || '',
            address_line: patient.address_line || '',
            cpf: patient.cpf || '',
            phone_e164: patient.phone_e164 || '',
            birth_date: patient.birth_date || '',
            gender: patient.gender || 'F',
            cep: patient.cep || '',
            city: patient.city || '',
            state: patient.state || '',
            address_number: patient.address_number || '',
            address_complement: patient.complement || '',
            terms_accepted: true
          });
        }
      } else {
        setShowFamilyAuthChoice(true);
      }
    } catch (error) {
      console.error('Error validating family invite:', error);
      toast({
        title: "Erro",
        description: "Não foi possível validar o convite.",
        variant: "destructive",
      });
      navigate('/entrar');
    } finally {
      setIsLoading(false);
    }
  };

  const validateInviteToken = async () => {
    setIsLoading(true);
    try {
      // ✅ Buscar convite via Edge Function na Produção (onde os convites são criados)
      const { data, error } = await invokeEdgeFunction('validate-invite', {
        body: { token: inviteToken }
      });
        
      if (error || !data?.valid) {
        toast({
          title: "Convite inválido",
          description: data?.reason || "Este convite não existe ou já foi utilizado.",
          variant: "destructive",
        });
        navigate('/entrar');
        return;
      }

      const invite = data.invite;
      
      // Verificar expiração
      if (new Date(invite.expires_at) < new Date()) {
        toast({
          title: "Convite expirado",
          description: "Este convite expirou. Solicite um novo à sua empresa.",
          variant: "destructive",
        });
        navigate('/entrar');
        return;
      }
      
      setInviteData(invite);
      
      // Preencher email automaticamente
      // Preencher nome do convite (se disponível), NÃO o email
      if (invite.first_name || invite.last_name) {
        setFormData(prev => ({ 
          ...prev, 
          first_name: invite.first_name || '',
          last_name: invite.last_name || ''
        }));
      }
      
      // Verificar se usuário já está logado
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // VERIFICAÇÃO: Se o email logado é DIFERENTE do convite, fazer logout
        if (session.user.email?.toLowerCase() !== invite.email.toLowerCase()) {
          console.log('[CompletarPerfil] Email mismatch detected - signing out:', {
            logged_email: session.user.email,
            invite_email: invite.email
          });
          
          // Fazer logout silencioso
          try { await supabase.auth.signOut(); } catch (e) { console.warn('[CompletarPerfil] signOut error (employee invite):', e); }
          
          toast({
            title: "Sessão anterior encerrada",
            description: `Complete o cadastro com o email ${invite.email}`,
            variant: "default",
          });
          
          // NÃO definir currentUser - continuar como novo usuário
          // O fluxo vai para criação de nova conta em handleSave
        } else {
          // Email corresponde - usar sessão existente
          console.log('[CompletarPerfil] Email match - using existing session');
          
          const patient = await getPatient(session.user.id);
          if (patient) {
            setCurrentUser({ id: patient.id, email: invite.email });
            
            // Preencher formulário com dados existentes
            setFormData({
              first_name: patient.first_name || '',
              last_name: patient.last_name || '',
              address_line: patient.address_line || '',
              cpf: patient.cpf || '',
              phone_e164: patient.phone_e164 || '',
              birth_date: patient.birth_date || '',
              gender: patient.gender || 'F',
              cep: patient.cep || '',
              city: patient.city || '',
              state: patient.state || '',
              address_number: patient.address_number || '',
              address_complement: patient.complement || '',
              terms_accepted: true
            });
            
            toast({
              title: "✅ Bem-vindo(a) de volta!",
              description: "Confirme seus dados para ativar seu plano empresarial.",
              variant: "default",
            });
          } else {
            // Tem sessão mas não tem patient - usar email do convite
            setCurrentUser(session.user);
          }
        }
      }
    } catch (error: any) {
      console.error('Error validating invite:', error);
      toast({
        title: "Erro",
        description: "Não foi possível validar o convite.",
        variant: "destructive",
      });
      navigate('/entrar');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPatientData = async () => {
    const auth = await requireAuth();
    if (!auth) return;

    setCurrentUser(auth.user);
    
    // Load existing patient data
    const patient = await getPatient(auth.user.id);
    if (patient) {
      setFormData({
        first_name: patient.first_name || "",
        last_name: patient.last_name || "",
        address_line: patient.address_line || "",
        cpf: patient.cpf || "",
        phone_e164: patient.phone_e164 || "",
        birth_date: patient.birth_date || "",
        gender: patient.gender || "",
        cep: patient.cep || "",
        address_number: patient.address_number || "",
        address_complement: patient.complement || "",
        city: patient.city || "",
        state: patient.state || "",
        terms_accepted: !!patient.terms_accepted_at
      });
    }
  };

  const fetchAddressByCEP = async (cep: string) => {
    if (cep.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (data.erro) {
        toast({
          title: "CEP não encontrado",
          description: "Verifique o CEP digitado.",
          variant: "destructive",
        });
        return;
      }

      setFormData(prev => ({
        ...prev,
        address_line: data.logradouro || prev.address_line,
        city: data.localidade || prev.city,
        state: data.uf || prev.state,
        address_complement: data.complemento || prev.address_complement,
      }));

      toast({
        title: "Endereço encontrado",
        description: "Os campos foram preenchidos automaticamente.",
      });
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      toast({
        title: "Erro ao buscar CEP",
        description: "Não foi possível buscar o endereço. Preencha manualmente.",
        variant: "destructive",
      });
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    if (field === 'phone_e164' && typeof value === 'string') {
      value = formatPhoneE164(value);
    }
    if (field === 'cpf' && typeof value === 'string') {
      value = value.replace(/\D/g, '');
    }
    if (field === 'cep' && typeof value === 'string') {
      const cleanCep = value.replace(/\D/g, '');
      setFormData(prev => ({ ...prev, cep: cleanCep }));
      if (cleanCep.length === 8) {
        fetchAddressByCEP(cleanCep);
      }
      return;
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    if (!formData.first_name.trim()) {
      toast({ title: "Erro", description: "Nome é obrigatório.", variant: "destructive" });
      return false;
    }
    if (!formData.last_name.trim()) {
      toast({ title: "Erro", description: "Sobrenome é obrigatório.", variant: "destructive" });
      return false;
    }
    if (!formData.address_line.trim()) {
      toast({ title: "Erro", description: "Endereço é obrigatório.", variant: "destructive" });
      return false;
    }
    // Validação de CPF mais rigorosa
    const cleanedCpf = formData.cpf.replace(/\D/g, '');
    if (!cleanedCpf || cleanedCpf.length !== 11) {
      toast({ title: "Erro", description: "CPF é obrigatório e deve ter 11 dígitos.", variant: "destructive" });
      return false;
    }
    if (!validateCPF(formData.cpf)) {
      toast({ title: "Erro", description: "CPF inválido. Verifique os dígitos informados.", variant: "destructive" });
      return false;
    }
    
    // Validação de telefone mais rigorosa - bloquear placeholders
    if (!formData.phone_e164 || formData.phone_e164.trim() === '') {
      toast({ title: "Erro", description: "Telefone é obrigatório.", variant: "destructive" });
      return false;
    }
    if (!validatePhoneE164(formData.phone_e164)) {
      toast({ title: "Erro", description: "Telefone inválido. Use o formato: (11) 99999-9999", variant: "destructive" });
      return false;
    }
    // Bloquear telefones placeholder conhecidos
    const blockedPhones = ['+5511999999999', '+5500000000000', '+55999999999', '+5511111111111'];
    if (blockedPhones.includes(formData.phone_e164)) {
      toast({ title: "Erro", description: "Por favor, informe seu telefone real (não use números de exemplo).", variant: "destructive" });
      return false;
    }
    if (!validateBirthDate(formData.birth_date)) {
      toast({ title: "Erro", description: "Data de nascimento inválida.", variant: "destructive" });
      return false;
    }
    if (!formData.gender || !['M', 'F', 'I'].includes(formData.gender)) {
      toast({ title: "Erro", description: "Gênero é obrigatório.", variant: "destructive" });
      return false;
    }
    if (!/^\d{8}$/.test(formData.cep)) {
      toast({ title: "Erro", description: "CEP deve ter 8 dígitos.", variant: "destructive" });
      return false;
    }
    if (!formData.city.trim()) {
      toast({ title: "Erro", description: "Cidade é obrigatória.", variant: "destructive" });
      return false;
    }
    if (!formData.state.trim()) {
      toast({ title: "Erro", description: "Estado é obrigatório.", variant: "destructive" });
      return false;
    }
    if (!formData.terms_accepted) {
      toast({ title: "Erro", description: "Você deve aceitar os termos de uso.", variant: "destructive" });
      return false;
    }
    
    // Validação de senha apenas para convites de empresa
    if (inviteData && !currentUser) {
      if (!password.trim()) {
        toast({ title: "Erro", description: "Senha é obrigatória.", variant: "destructive" });
        return false;
      }
      if (!isPasswordValid(password)) {
        toast({ title: "Erro", description: "A senha não atende aos requisitos mínimos.", variant: "destructive" });
        return false;
      }
      if (password !== confirmPassword) {
        toast({ title: "Erro", description: "As senhas não coincidem.", variant: "destructive" });
        return false;
      }
    }
    
    return true;
  };

  const handleGoToLogin = () => {
    const tokenValue = inviteData?.invite_token || familyToken || '';
    sessionStorage.setItem('pending_family_invite_token', tokenValue);
    localStorage.setItem('pending_family_invite_token', tokenValue);
    window.location.href = `/entrar?email=${encodeURIComponent(inviteData?.email || '')}`;
  };

  const handleLogout = async () => {
    try {
      // ✅ CORRIGIDO: Usar hybridSignOut para limpar ambos os ambientes
      await hybridSignOut();
      navigate('/entrar');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      // Forçar limpeza mesmo com erro
      sessionStorage.removeItem('auth_environment');
      navigate('/entrar');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    
    // Variável local para evitar problemas de timing com estado assíncrono
    let activeUser = currentUser;
    
    // Se for convite e não tiver sessão, criar usuário com senha definida
    if (inviteData && !activeUser) {
      try {
        // ✅ HÍBRIDO: Criar usuário em AMBOS os ambientes (Cloud + Produção)
        const signUpResult = await hybridSignUp(inviteData.email, password);
        
        if (!signUpResult.success) {
          console.error('[CompletarPerfil] hybridSignUp error:', signUpResult.error);
          
          // Verificar se é erro de "já cadastrado"
          if (signUpResult.error?.includes('já está cadastrado') || signUpResult.error?.includes('already registered')) {
            // Tentar login híbrido
            const loginResult = await hybridSignIn(inviteData.email, password);
            
            if (loginResult.success && loginResult.session) {
              console.log('[CompletarPerfil] ✅ Login híbrido bem-sucedido para usuário existente');
              setCurrentUser(loginResult.session.user);
              activeUser = loginResult.session.user;
            } else {
              // Login falhou - redirecionar para /entrar com token salvo
              if (inviteData.isFamilyInvite) {
                const tokenValue = inviteData.invite_token || familyToken || '';
                sessionStorage.setItem('pending_family_invite_token', tokenValue);
                localStorage.setItem('pending_family_invite_token', tokenValue);
              } else {
                const tokenValue = inviteData.token || inviteToken || '';
                sessionStorage.setItem('pending_invite_token', tokenValue);
                localStorage.setItem('pending_invite_token', tokenValue);
              }
              
              toast({
                title: "Você já possui uma conta",
                description: inviteData.isFamilyInvite 
                  ? "Faça login e seu plano familiar será ativado automaticamente."
                  : "Faça login e seu plano empresarial será ativado automaticamente.",
                variant: "default",
                duration: 5000
              });
              
              setIsLoading(false);
              setTimeout(() => {
                window.location.href = `/entrar?email=${encodeURIComponent(inviteData.email)}`;
              }, 2000);
              return;
            }
          } else {
            toast({
              title: "Erro ao criar conta",
              description: signUpResult.error || "Não foi possível criar sua conta.",
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }
        } else {
          // ✅ Cadastro híbrido bem-sucedido - sessão de Produção ativa
          console.log('[CompletarPerfil] ✅ hybridSignUp OK. ProdID:', signUpResult.prodUserId);
          setCurrentUser(signUpResult.user);
          activeUser = signUpResult.user;
        }
      } catch (error: any) {
        console.error('[CompletarPerfil] Exception during auth:', error);
        toast({
          title: "Erro",
          description: "Não foi possível criar sua conta. Tente novamente.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
    }
    
    // ✅ Verificar sessão ativa após autenticação (garante auth.uid() preenchido)
    const { session: activeSession, environment: activeEnv } = await getHybridSession();
    if (!activeSession) {
      toast({
        title: "Erro",
        description: "Você precisa estar autenticado para continuar.",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
    // Garantir que activeUser reflete a sessão válida
    activeUser = activeSession.user;
    console.log('[CompletarPerfil] ✅ Sessão ativa confirmada:', activeEnv, activeUser.id);
    
    try {
      // Log antes de salvar perfil
      console.log('[CompletarPerfil] 📋 Salvando perfil:', {
        user_id: activeUser.id,
        email: activeUser.email,
        cpf: formData.cpf ? '***' + formData.cpf.replace(/\D/g, '').slice(-4) : 'VAZIO',
        phone: formData.phone_e164 ? '***' + formData.phone_e164.slice(-4) : 'VAZIO',
        cep: formData.cep || 'VAZIO',
      });
      
      const upsertResult = await upsertPatientBasic({
        first_name: formData.first_name,
        last_name: formData.last_name,
        address_line: formData.address_line,
        cpf: formData.cpf,
        phone_e164: formData.phone_e164,
        birth_date: formData.birth_date,
        gender: formData.gender,
        cep: formData.cep,
        address_number: formData.address_number,
        address_complement: formData.address_complement,
        city: formData.city,
        state: formData.state,
        termsAccepted: formData.terms_accepted,
        source: inviteData ? 'empresa_invite' : undefined,
        userId: activeUser?.id,
        userEmail: activeUser?.email || inviteData?.email,
      });

      console.log('[CompletarPerfil] ✅ Perfil salvo com sucesso via Edge Function:', upsertResult);
      
      // ✅ Usar user_id canônico retornado pelo backend
      const canonicalUserId = upsertResult?.user_id || activeUser?.id;
      console.log('[CompletarPerfil] User ID canônico:', canonicalUserId);
      
      // SE FOR CONVITE DE EMPRESA, ativar plano via Edge Function segura
      if (inviteData && !inviteData.isFamilyInvite) {
        try {
          console.log('[CompletarPerfil] Calling activate-employee-plan Edge Function...');
          
          // ✅ CORREÇÃO: Obter token do ambiente correto para Authorization
          const { session: currentSession, environment: currentEnv } = await getHybridSession();
          const authHeaders: Record<string, string> = {};
          if (currentSession?.access_token) {
            authHeaders['Authorization'] = `Bearer ${currentSession.access_token}`;
          }
          console.log('[CompletarPerfil] Usando token do ambiente:', currentEnv);
          
          const { data: planResult, error: planError } = await invokeEdgeFunction('company-operations', {
            body: {
              operation: 'activate-employee-plan',
              invite_token: inviteData.token || inviteToken,
              employee_data: {
                nome: `${formData.first_name} ${formData.last_name}`,
                cpf: formData.cpf.replace(/\D/g, ''),
                telefone: formData.phone_e164,
                birth_date: formData.birth_date,
                gender: formData.gender === 'M' ? 'M' : 'F',
                address_line: formData.address_line,
                address_number: formData.address_number,
                address_complement: formData.address_complement || '',
                cep: formData.cep,
                city: formData.city,
                state: formData.state
              }
            },
            headers: authHeaders
          });
          
          if (planError || !planResult.success) {
            console.error('❌ Error activating plan via Edge Function:', planError || planResult);
            throw new Error(planResult?.error || 'Falha ao ativar plano empresarial');
          }
          
          console.log('✅ Plan and employee record created via Edge Function:', planResult.plan_code);
          
          // ✅ Limpar tokens salvos após sucesso (evita loop de redirect)
          sessionStorage.removeItem('pending_invite_token');
          localStorage.removeItem('pending_invite_token');
          
          toast({
            title: "🎉 Bem-vindo!",
            description: "Seu plano empresarial foi ativado com sucesso!",
          });
        } catch (activationErr: any) {
          console.error('❌ Exception during plan activation:', activationErr);
          toast({
            title: "Erro ao ativar plano",
            description: activationErr.message || "Não foi possível ativar seu plano empresarial. Entre em contato com o suporte.",
            variant: "destructive",
          });
          // ✅ NÃO propagar erro - perfil já foi salvo com sucesso
          // Redirecionar mesmo sem plano ativo (admin pode corrigir depois)
          console.warn('[CompletarPerfil] Plan activation failed but profile saved, continuing redirect...');
        }
      } else if (inviteData && inviteData.isFamilyInvite) {
        // SE FOR CONVITE FAMILIAR, ativar plano do familiar
        try {
          console.log('[CompletarPerfil] Activating family member plan...');
          
          // ✅ CORREÇÃO: Obter token do ambiente correto para Authorization
          const { session: currentSession, environment: currentEnv } = await getHybridSession();
          const authHeaders: Record<string, string> = {};
          if (currentSession?.access_token) {
            authHeaders['Authorization'] = `Bearer ${currentSession.access_token}`;
          }
          console.log('[CompletarPerfil] Usando token do ambiente:', currentEnv);
          
          const { data: familyResult, error: familyError } = await invokeEdgeFunction('patient-operations', {
            body: {
              operation: 'activate-family-member',
              invite_token: inviteData.invite_token,
              user_id: activeUser.id // ✅ Passar user_id para usuários existentes
            },
            headers: authHeaders
          });
          
          if (familyError || !familyResult.success) {
            throw new Error(familyResult?.error || 'Falha ao ativar plano familiar');
          }
          
          // ✅ Limpar tokens salvos após sucesso
          sessionStorage.removeItem('pending_family_invite_token');
          localStorage.removeItem('pending_family_invite_token');
          
          toast({
            title: "🏠 Bem-vindo à família!",
            description: "Seu plano familiar foi ativado com sucesso!",
          });
        } catch (familyErr: any) {
          console.error('❌ Exception during family plan activation:', familyErr);
          toast({
            title: "Erro ao ativar plano",
            description: familyErr.message || "Não foi possível ativar seu plano familiar.",
            variant: "destructive",
          });
          console.warn('[CompletarPerfil] Family plan activation failed but profile saved, continuing redirect...');
        }
      } else {
        toast({
          title: "Perfil atualizado",
          description: "Suas informações foram salvas com sucesso.",
        });
      }


      const redirectUrl = searchParams.get('redirect');
      if (redirectUrl) {
        window.location.replace(decodeURIComponent(redirectUrl));
      } else {
        // Usar window.location.replace para forçar reload e garantir detecção correta do ambiente
        window.location.replace('/area-do-paciente');
      }
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar suas informações. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center relative">
          {/* Botão de logout sempre visível para usuários autenticados */}
          {currentUser && !inviteToken && !familyToken && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          )}
          <CardTitle className="text-2xl font-bold text-foreground">Completar Perfil</CardTitle>
          <CardDescription>
            Complete TODAS as informações abaixo para acessar o atendimento
          </CardDescription>
        </CardHeader>
        <CardContent>
          {inviteData && showFamilyAuthChoice && !currentUser ? (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-2">
                  🏠 Você foi convidado para um Plano Familiar!
                </h3>
                <p className="text-sm text-green-700">
                  O convite foi enviado para <strong>{inviteData.email}</strong>.
                  Como você deseja prosseguir?
                </p>
              </div>
              <div className="space-y-3">
                <Button
                  className="w-full bg-primary hover:bg-primary/90"
                  onClick={() => setShowFamilyAuthChoice(false)}
                >
                  Criar conta
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleGoToLogin}
                >
                  Já tenho conta
                </Button>
              </div>
            </div>
          ) : (
          <>
          {inviteData && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-green-800 mb-2">
                {inviteData.isFamilyInvite
                  ? "🏠 Você foi convidado para um Plano Familiar!"
                  : `✅ Você foi convidado pela ${inviteData.companies?.razao_social || 'sua empresa'}`
                }
              </h3>
              <p className="text-sm text-green-700">
                Complete seus dados abaixo e seu plano de saúde será ativado automaticamente!
              </p>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            {inviteData && !currentUser && (
              <div className="border-t border-b py-6 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Lock className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Crie sua Senha de Acesso</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Nova Senha *</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Digite sua senha"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar Senha *</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Digite novamente"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
                
                <PasswordChecklist password={password} />
                
                {password && confirmPassword && password !== confirmPassword && (
                  <p className="text-sm text-destructive flex items-center gap-2">
                    <span>⚠️</span>
                    <span>As senhas não coincidem</span>
                  </p>
                )}
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Nome *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="first_name"
                    placeholder="Seu nome"
                    value={formData.first_name}
                    onChange={(e) => handleInputChange('first_name', e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Sobrenome *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="last_name"
                    placeholder="Seu sobrenome"
                    value={formData.last_name}
                    onChange={(e) => handleInputChange('last_name', e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF *</Label>
                <Input
                  id="cpf"
                  placeholder="Apenas números"
                  value={formData.cpf}
                  onChange={(e) => handleInputChange('cpf', e.target.value)}
                  maxLength={11}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birth_date">Data de Nascimento *</Label>
                <DateOfBirthInput
                  value={formData.birth_date}
                  onChange={(date) => handleInputChange('birth_date', date)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="gender">Gênero *</Label>
              <Select value={formData.gender} onValueChange={(value) => handleInputChange('gender', value)}>
                <SelectTrigger id="gender">
                  <SelectValue placeholder="Selecione seu gênero" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Feminino</SelectItem>
                  <SelectItem value="I">Prefiro não informar</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone_e164">Telefone *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="phone_e164"
                  placeholder="+5511999999999"
                  value={formData.phone_e164}
                  onChange={(e) => handleInputChange('phone_e164', e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>
            
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Home className="h-5 w-5" />
                Endereço Completo
              </h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="address_line">Rua/Avenida *</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="address_line"
                        placeholder="Nome da rua"
                        value={formData.address_line}
                        onChange={(e) => handleInputChange('address_line', e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address_number">Número *</Label>
                    <Input
                      id="address_number"
                      placeholder="123"
                      value={formData.address_number}
                      onChange={(e) => handleInputChange('address_number', e.target.value)}
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cep">CEP *</Label>
                    <Input
                      id="cep"
                      placeholder="00000000"
                      value={formData.cep}
                      onChange={(e) => handleInputChange('cep', e.target.value)}
                      maxLength={8}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address_complement">Complemento</Label>
                    <Input
                      id="address_complement"
                      placeholder="Apto, Bloco, etc (opcional)"
                      value={formData.address_complement}
                      onChange={(e) => handleInputChange('address_complement', e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city">Cidade *</Label>
                    <Input
                      id="city"
                      placeholder="São Paulo"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">Estado (UF) *</Label>
                    <Select value={formData.state} onValueChange={(value) => handleInputChange('state', value)}>
                      <SelectTrigger id="state">
                        <SelectValue placeholder="Selecione o estado" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="AC">Acre</SelectItem>
                        <SelectItem value="AL">Alagoas</SelectItem>
                        <SelectItem value="AP">Amapá</SelectItem>
                        <SelectItem value="AM">Amazonas</SelectItem>
                        <SelectItem value="BA">Bahia</SelectItem>
                        <SelectItem value="CE">Ceará</SelectItem>
                        <SelectItem value="DF">Distrito Federal</SelectItem>
                        <SelectItem value="ES">Espírito Santo</SelectItem>
                        <SelectItem value="GO">Goiás</SelectItem>
                        <SelectItem value="MA">Maranhão</SelectItem>
                        <SelectItem value="MT">Mato Grosso</SelectItem>
                        <SelectItem value="MS">Mato Grosso do Sul</SelectItem>
                        <SelectItem value="MG">Minas Gerais</SelectItem>
                        <SelectItem value="PA">Pará</SelectItem>
                        <SelectItem value="PB">Paraíba</SelectItem>
                        <SelectItem value="PR">Paraná</SelectItem>
                        <SelectItem value="PE">Pernambuco</SelectItem>
                        <SelectItem value="PI">Piauí</SelectItem>
                        <SelectItem value="RJ">Rio de Janeiro</SelectItem>
                        <SelectItem value="RN">Rio Grande do Norte</SelectItem>
                        <SelectItem value="RS">Rio Grande do Sul</SelectItem>
                        <SelectItem value="RO">Rondônia</SelectItem>
                        <SelectItem value="RR">Roraima</SelectItem>
                        <SelectItem value="SC">Santa Catarina</SelectItem>
                        <SelectItem value="SP">São Paulo</SelectItem>
                        <SelectItem value="SE">Sergipe</SelectItem>
                        <SelectItem value="TO">Tocantins</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="terms"
                checked={formData.terms_accepted}
                onCheckedChange={(checked) => handleInputChange('terms_accepted', !!checked)}
                required
              />
              <label htmlFor="terms" className="text-sm font-medium leading-none cursor-pointer select-none">
                Aceito os termos de uso e política de privacidade *
              </label>
            </div>
            
            <div className="flex gap-3">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleLogout}
                className="flex-1"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
              <Button type="submit" className="flex-1 bg-primary hover:bg-primary/90" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar e continuar
              </Button>
            </div>
          </form>
          </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CompletarPerfil;