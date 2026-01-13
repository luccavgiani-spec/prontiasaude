import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, User, Mail, Phone, MapPin, Calendar, Shield, AlertCircle, Check } from "lucide-react";
import { validateEmail, validateCPF, validatePhoneE164, validateBirthDate, formatPhoneE164, formatPhoneMask, validateCEP, formatCEP } from "@/lib/validations";
import { PasswordChecklist, isPasswordValid } from "@/components/auth/PasswordChecklist";

const Cadastrar = () => {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    cep: "",
    logradouro: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    uf: "",
    address_line: "",
    cpf: "",
    phone_display: "",
    phone_e164: "",
    birth_date: "",
    gender: "",
    terms_accepted: false,
    marketing_opt_in: false
  });
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const navigate = useNavigate();

  // Calcular progresso do formulário
  const progressSteps = useMemo(() => {
    return [
      {
        name: 'Dados Pessoais',
        complete: Boolean(formData.first_name.trim() && formData.last_name.trim() && validateEmail(formData.email))
      },
      {
        name: 'Endereço',
        complete: Boolean(
          validateCEP(formData.cep) && 
          formData.logradouro.trim() && 
          formData.numero.trim() && 
          formData.cidade.trim() && 
          formData.uf.trim()
        )
      },
      {
        name: 'Documentos',
        complete: Boolean(
          validateCPF(formData.cpf) && 
          validatePhoneE164(formData.phone_e164) && 
          validateBirthDate(formData.birth_date) && 
          formData.gender
        )
      },
      {
        name: 'Segurança',
        complete: Boolean(isPasswordValid(formData.password) && formData.terms_accepted)
      }
    ];
  }, [formData]);

  const progressPercent = useMemo(() => {
    const completed = progressSteps.filter(s => s.complete).length;
    return (completed / progressSteps.length) * 100;
  }, [progressSteps]);

  const fetchAddressByCEP = async (cep: string) => {
    if (!validateCEP(cep)) return;
    
    setCepLoading(true);
    setCepError("");
    
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep.replace(/\D/g, '')}/json/`);
      const data = await response.json();
      
      if (data.erro) {
        setCepError("CEP não encontrado");
        return;
      }
      
      setFormData(prev => ({
        ...prev,
        logradouro: data.logradouro || "",
        bairro: data.bairro || "",
        cidade: data.localidade || "",
        uf: data.uf || "",
        address_line: `${data.logradouro || ""}, ${data.bairro || ""}, ${data.localidade || ""} - ${data.uf || ""}`
      }));
    } catch (error) {
      setCepError("CEP não encontrado");
    } finally {
      setCepLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    // Limpar erro do campo quando usuário digitar
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: '' }));
    }

    if (field === 'phone_display' && typeof value === 'string') {
      const masked = formatPhoneMask(value);
      const e164 = formatPhoneE164(value);
      setFormData(prev => ({ 
        ...prev, 
        phone_display: masked,
        phone_e164: e164
      }));
      return;
    }
    if (field === 'cep' && typeof value === 'string') {
      const formatted = formatCEP(value);
      setFormData(prev => ({ ...prev, cep: formatted }));
      
      // Debounce CEP lookup
      const cleanCEP = value.replace(/\D/g, '');
      if (cleanCEP.length === 8) {
        setTimeout(() => fetchAddressByCEP(cleanCEP), 400);
      } else {
        setCepError("");
      }
      return;
    }
    if (field === 'cpf' && typeof value === 'string') {
      value = value.replace(/\D/g, '');
    }
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Validação em tempo real quando usuário sai do campo
  const validateField = async (field: string) => {
    const newErrors = { ...fieldErrors };

    switch (field) {
      case 'email':
        if (formData.email && !validateEmail(formData.email)) {
          newErrors.email = 'Email inválido. Use o formato: email@exemplo.com';
        }
        break;

      case 'cpf':
        if (formData.cpf && !validateCPF(formData.cpf)) {
          newErrors.cpf = 'CPF inválido. Verifique os dígitos digitados.';
        } else if (formData.cpf && formData.cpf.length === 11) {
          // Verificar se CPF já existe
          const { data: existingPatient } = await supabase
            .from('patients')
            .select('id')
            .eq('cpf', formData.cpf)
            .maybeSingle();
          
          if (existingPatient) {
            newErrors.cpf = 'Este CPF já está cadastrado. Faça login ou recupere sua senha.';
          }
        }
        break;

      case 'phone_display':
        if (formData.phone_e164 && !validatePhoneE164(formData.phone_e164)) {
          newErrors.phone_display = 'Telefone inválido. Use o formato: (11) 99999-9999';
        }
        break;

      case 'birth_date':
        if (formData.birth_date && !validateBirthDate(formData.birth_date)) {
          newErrors.birth_date = 'Data de nascimento inválida.';
        }
        break;
    }

    setFieldErrors(newErrors);
  };

  const validateForm = () => {
    if (!formData.first_name.trim()) {
      toast({ title: "Erro", description: "Nome é obrigatório.", variant: "warning" });
      return false;
    }
    if (!formData.last_name.trim()) {
      toast({ title: "Erro", description: "Sobrenome é obrigatório.", variant: "warning" });
      return false;
    }
    if (!validateEmail(formData.email)) {
      toast({ title: "Erro", description: "Email inválido.", variant: "warning" });
      return false;
    }
    if (!formData.cep.trim()) {
      toast({ title: "Erro", description: "CEP é obrigatório.", variant: "warning" });
      return false;
    }
    if (!validateCEP(formData.cep)) {
      toast({ title: "Erro", description: "CEP deve ter 8 dígitos.", variant: "warning" });
      return false;
    }
    if (!formData.logradouro.trim()) {
      toast({ title: "Erro", description: "Logradouro é obrigatório.", variant: "warning" });
      return false;
    }
    if (!formData.numero.trim()) {
      toast({ title: "Erro", description: "Número é obrigatório.", variant: "warning" });
      return false;
    }
    if (!validateCPF(formData.cpf)) {
      toast({ title: "Erro", description: "CPF deve ter 11 dígitos.", variant: "warning" });
      return false;
    }
    if (!validatePhoneE164(formData.phone_e164)) {
      toast({ title: "Erro", description: "Telefone inválido. Use o formato: +5511999999999", variant: "warning" });
      return false;
    }
    if (!validateBirthDate(formData.birth_date)) {
      toast({ title: "Erro", description: "Data de nascimento inválida.", variant: "warning" });
      return false;
    }
    if (!formData.gender) {
      toast({ title: "Erro", description: "Gênero é obrigatório.", variant: "warning" });
      return false;
    }
    if (!formData.terms_accepted) {
      toast({ title: "Erro", description: "Você deve aceitar os termos de uso.", variant: "warning" });
      return false;
    }
    return true;
  };

  const toDbGender = (gender: string): string => {
    if (gender === 'masculino') return 'M';
    if (gender === 'feminino') return 'F';
    if (gender === 'outro') return 'I';
    return gender;
  };

  const translateAuthError = (error: any): string => {
    const message = error.message?.toLowerCase() || '';
    
    // Email já cadastrado
    if (message.includes('user already registered') || 
        message.includes('email already registered') ||
        error.code === '23505') {
      return 'Este email já está cadastrado. Faça login ou recupere sua senha.';
    }
    
    // Validação de email
    if (message.includes('invalid email') || 
        message.includes('invalid format')) {
      return 'Email inválido. Verifique o formato digitado.';
    }
    
    // Senha fraca
    if (message.includes('password') && 
        (message.includes('weak') || message.includes('short') || message.includes('at least'))) {
      return 'A senha deve ter no mínimo 6 caracteres e atender aos requisitos de segurança.';
    }
    
    // Erro de rede
    if (message.includes('network') || message.includes('fetch')) {
      return 'Erro de conexão. Verifique sua internet e tente novamente.';
    }
    
    // Rate limit
    if (message.includes('rate limit') || message.includes('too many')) {
      return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
    }
    
    // Erro genérico
    return 'Erro ao criar conta. Tente novamente ou entre em contato com o suporte.';
  };

  const handleSignUpWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !formData.password.trim()) {
      if (!formData.password.trim()) {
        toast({ title: "Erro", description: "Senha é obrigatória.", variant: "warning" });
      }
      return;
    }

    if (!isPasswordValid(formData.password)) {
      toast({ title: "Erro", description: "Senha deve atender todos os requisitos.", variant: "warning" });
      return;
    }

    setIsLoading(true);
    
    // Verificar se CPF já existe
    const { data: existingPatient } = await supabase
      .from('patients')
      .select('id')
      .eq('cpf', formData.cpf)
      .maybeSingle();
    
    if (existingPatient) {
      toast({
        title: "CPF já cadastrado",
        description: "Este CPF já está cadastrado. Faça login ou recupere sua senha.",
        variant: "warning",
      });
      setIsLoading(false);
      return;
    }
    
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          first_name: formData.first_name,
          last_name: formData.last_name,
          address_line: formData.address_line,
          cep: formData.cep,
          city: formData.cidade,
          state: formData.uf,
          address_number: formData.numero,
          complement: formData.complemento,
          cpf: formData.cpf,
          phone_e164: formData.phone_e164,
          birth_date: formData.birth_date,
          gender: toDbGender(formData.gender),
          terms_accepted_at: new Date().toISOString(),
          marketing_opt_in: formData.marketing_opt_in
        }
      }
    });

    if (error) {
      toast({
        title: "Erro no cadastro",
        description: translateAuthError(error),
        variant: "warning",
      });
      setIsLoading(false);
      return;
    }

    // Sincronizar dados com tabela patients (fallback caso trigger não funcione)
    if (signUpData?.user?.id) {
      try {
        const { error: insertError } = await supabase
          .from('patients')
          .upsert({
            user_id: signUpData.user.id,
            first_name: formData.first_name,
            last_name: formData.last_name,
            email: formData.email,
            cpf: formData.cpf,
            phone_e164: formData.phone_e164,
            birth_date: formData.birth_date,
            gender: toDbGender(formData.gender),
            cep: formData.cep,
            address_line: formData.address_line,
            address_number: formData.numero,
            complement: formData.complemento,
            city: formData.cidade,
            state: formData.uf,
            terms_accepted_at: new Date().toISOString(),
            marketing_opt_in: formData.marketing_opt_in,
            profile_complete: true
          }, { onConflict: 'user_id' });

        if (insertError && insertError.code !== '23505') {
          // 23505 = duplicate key (ignore se já existe)
          console.error('[Cadastro] Erro ao criar paciente:', insertError);
          toast({
            title: "Erro ao salvar perfil",
            description: "Sua conta foi criada, mas houve um erro ao salvar seus dados. Por favor, complete seu perfil após fazer login.",
            variant: "warning",
            duration: 8000,
          });
        }
      } catch (syncError) {
        console.error('[Cadastro] Exceção ao sincronizar paciente:', syncError);
      }
    }

    toast({
      title: "✅ Cadastro realizado com sucesso!",
      description: "Bem-vindo(a)! Você será redirecionado para sua área.",
      duration: 4000,
    });
    // Usuário JÁ está logado após signUp com auto-confirm
    // Redirecionar para callback que leva para /area-do-paciente
    navigate('/auth/callback');
    
    setIsLoading(false);
  };

  const handleMagicLink = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    
    // Verificar se CPF já existe
    const { data: existingPatient } = await supabase
      .from('patients')
      .select('id')
      .eq('cpf', formData.cpf)
      .maybeSingle();
    
    if (existingPatient) {
      toast({
        title: "CPF já cadastrado",
        description: "Este CPF já está cadastrado. Faça login ou recupere sua senha.",
        variant: "warning",
      });
      setIsLoading(false);
      return;
    }
    
    // First create user with password then send magic link
    const { error: signUpError } = await supabase.auth.signUp({
      email: formData.email,
      password: 'temp_password_' + Math.random().toString(36),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          first_name: formData.first_name,
          last_name: formData.last_name,
          address_line: formData.address_line,
          cep: formData.cep,
          city: formData.cidade,
          state: formData.uf,
          address_number: formData.numero,
          complement: formData.complemento,
          cpf: formData.cpf,
          phone_e164: formData.phone_e164,
          birth_date: formData.birth_date,
          gender: toDbGender(formData.gender),
          terms_accepted_at: new Date().toISOString(),
          marketing_opt_in: formData.marketing_opt_in
        }
      }
    });

    if (signUpError) {
      toast({
        title: "Erro no cadastro",
        description: translateAuthError(signUpError),
        variant: "warning",
      });
    } else {
      // Send magic link for login
      const { error: magicError } = await supabase.auth.signInWithOtp({
        email: formData.email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });
      
      if (magicError) {
        toast({
          title: "Erro ao enviar magic link",
          description: translateAuthError(magicError),
          variant: "warning",
        });
      } else {
        toast({
          title: "✅ Link de acesso enviado!",
          description: `Enviamos um link de acesso para ${formData.email}. Clique no link para fazer login.`,
          duration: 6000,
        });
        navigate('/entrar');
      }
    }
    
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-foreground">Criar Conta</CardTitle>
          <CardDescription>
            Preencha seus dados para se cadastrar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Indicador de Progresso */}
          <div className="mb-2">
            <div className="flex justify-between items-start mb-3">
              {progressSteps.map((step, index) => (
                <div key={index} className="flex flex-col items-center flex-1">
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                      step.complete 
                        ? 'bg-primary text-primary-foreground shadow-md' 
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {step.complete ? <Check className="h-4 w-4" /> : index + 1}
                  </div>
                  <span 
                    className={`text-xs mt-1.5 text-center hidden sm:block transition-colors ${
                      step.complete ? 'text-primary font-medium' : 'text-muted-foreground'
                    }`}
                  >
                    {step.name}
                  </span>
                </div>
              ))}
            </div>
            <Progress value={progressPercent} className="h-2" />
            <p className="text-xs text-muted-foreground text-center mt-2">
              {progressSteps.filter(s => s.complete).length} de {progressSteps.length} etapas concluídas
            </p>
          </div>

          <form onSubmit={handleSignUpWithPassword} className="space-y-4">
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
            
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  onBlur={() => validateField('email')}
                  className={`pl-10 ${fieldErrors.email ? 'border-destructive' : ''}`}
                  required
                />
              </div>
              {fieldErrors.email && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {fieldErrors.email}
                </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Senha (para login com senha)</Label>
              <div className="relative">
                <Shield className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Digite sua senha"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="pl-10"
                />
              </div>
              {formData.password && <PasswordChecklist password={formData.password} />}
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cep">CEP *</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="cep"
                    placeholder="00000-000"
                    value={formData.cep}
                    onChange={(e) => handleInputChange('cep', e.target.value)}
                    className="pl-10"
                    maxLength={9}
                    required
                  />
                  {cepLoading && (
                    <div className="absolute right-3 top-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
                {cepError && (
                  <p className="text-sm text-destructive">{cepError}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="logradouro">Logradouro *</Label>
                  <Input
                    id="logradouro"
                    placeholder="Rua, Avenida, etc."
                    value={formData.logradouro}
                    onChange={(e) => handleInputChange('logradouro', e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numero">Número *</Label>
                  <Input
                    id="numero"
                    placeholder="123"
                    value={formData.numero}
                    onChange={(e) => handleInputChange('numero', e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="complemento">Complemento</Label>
                  <Input
                    id="complemento"
                    placeholder="Apto, Bloco, etc."
                    value={formData.complemento}
                    onChange={(e) => handleInputChange('complemento', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input
                    id="bairro"
                    placeholder="Seu bairro"
                    value={formData.bairro}
                    onChange={(e) => handleInputChange('bairro', e.target.value)}
                    readOnly
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input
                    id="cidade"
                    placeholder="Sua cidade"
                    value={formData.cidade}
                    onChange={(e) => handleInputChange('cidade', e.target.value)}
                    readOnly
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="uf">Estado (UF)</Label>
                <Input
                  id="uf"
                  placeholder="SP"
                  value={formData.uf}
                  onChange={(e) => handleInputChange('uf', e.target.value)}
                  maxLength={2}
                  readOnly
                />
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
                  onBlur={() => validateField('cpf')}
                  className={fieldErrors.cpf ? 'border-destructive' : ''}
                  maxLength={11}
                  required
                />
                {fieldErrors.cpf && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {fieldErrors.cpf}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone_display">Telefone *</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone_display"
                    placeholder="(11) 91234-5678"
                    value={formData.phone_display}
                    onChange={(e) => handleInputChange('phone_display', e.target.value)}
                    onBlur={() => validateField('phone_display')}
                    className={`pl-10 ${fieldErrors.phone_display ? 'border-destructive' : ''}`}
                    required
                  />
                </div>
                {fieldErrors.phone_display && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {fieldErrors.phone_display}
                  </p>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="birth_date">Data de Nascimento *</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="birth_date"
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => handleInputChange('birth_date', e.target.value)}
                  onBlur={() => validateField('birth_date')}
                  className={`pl-10 ${fieldErrors.birth_date ? 'border-destructive' : ''}`}
                  required
                />
              </div>
              {fieldErrors.birth_date && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {fieldErrors.birth_date}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Gênero *</Label>
              <select
                id="gender"
                value={formData.gender}
                onChange={(e) => handleInputChange('gender', e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                required
              >
                <option value="">Selecione</option>
                <option value="masculino">Masculino</option>
                <option value="feminino">Feminino</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="terms"
                  checked={formData.terms_accepted}
                  onCheckedChange={(checked) => handleInputChange('terms_accepted', !!checked)}
                  required
                />
                <Label htmlFor="terms" className="text-sm">
                  Aceito os termos de uso e política de privacidade *
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="marketing"
                  checked={formData.marketing_opt_in}
                  onCheckedChange={(checked) => handleInputChange('marketing_opt_in', !!checked)}
                />
                <Label htmlFor="marketing" className="text-sm">
                  Desejo receber comunicações por email
                </Label>
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <Button 
                type="submit" 
                className="w-full bg-primary hover:bg-primary/90" 
                disabled={isLoading || (formData.password && !isPasswordValid(formData.password))}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar conta com senha
              </Button>
              
              <Button 
                type="button"
                onClick={handleMagicLink} 
                variant="outline" 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Receber magic link
              </Button>
            </div>
          </form>
          
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Já tem uma conta?{" "}
              <Link to="/entrar" className="text-primary hover:underline">
                Fazer login
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Cadastrar;