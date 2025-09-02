import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, User, Mail, Phone, MapPin, Calendar, Shield } from "lucide-react";
import { validateEmail, validateCPF, validatePhoneE164, validateBirthDate, formatPhoneE164 } from "@/lib/validations";

const Cadastrar = () => {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    address_line: "",
    cpf: "",
    phone_e164: "",
    birth_date: "",
    terms_accepted: false,
    marketing_opt_in: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleInputChange = (field: string, value: string | boolean) => {
    if (field === 'phone_e164' && typeof value === 'string') {
      value = formatPhoneE164(value);
    }
    if (field === 'cpf' && typeof value === 'string') {
      value = value.replace(/\D/g, '');
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
    if (!validateEmail(formData.email)) {
      toast({ title: "Erro", description: "Email inválido.", variant: "destructive" });
      return false;
    }
    if (!formData.address_line.trim()) {
      toast({ title: "Erro", description: "Endereço é obrigatório.", variant: "destructive" });
      return false;
    }
    if (!validateCPF(formData.cpf)) {
      toast({ title: "Erro", description: "CPF deve ter 11 dígitos.", variant: "destructive" });
      return false;
    }
    if (!validatePhoneE164(formData.phone_e164)) {
      toast({ title: "Erro", description: "Telefone inválido. Use o formato: +5511999999999", variant: "destructive" });
      return false;
    }
    if (!validateBirthDate(formData.birth_date)) {
      toast({ title: "Erro", description: "Data de nascimento inválida.", variant: "destructive" });
      return false;
    }
    if (!formData.terms_accepted) {
      toast({ title: "Erro", description: "Você deve aceitar os termos de uso.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleSignUpWithPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !formData.password.trim()) {
      if (!formData.password.trim()) {
        toast({ title: "Erro", description: "Senha é obrigatória.", variant: "destructive" });
      }
      return;
    }

    if (formData.password.length < 6) {
      toast({ title: "Erro", description: "Senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    
    const { error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          first_name: formData.first_name,
          last_name: formData.last_name,
          address_line: formData.address_line,
          cpf: formData.cpf,
          phone_e164: formData.phone_e164,
          birth_date: formData.birth_date,
          terms_accepted_at: new Date().toISOString(),
          marketing_opt_in: formData.marketing_opt_in
        }
      }
    });

    if (error) {
      toast({
        title: "Erro no cadastro",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Cadastro realizado",
        description: "Verifique seu email para confirmar a conta.",
      });
      navigate('/entrar');
    }
    
    setIsLoading(false);
  };

  const handleMagicLink = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    
    const { error } = await supabase.auth.signUp({
      email: formData.email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          first_name: formData.first_name,
          last_name: formData.last_name,
          address_line: formData.address_line,
          cpf: formData.cpf,
          phone_e164: formData.phone_e164,
          birth_date: formData.birth_date,
          terms_accepted_at: new Date().toISOString(),
          marketing_opt_in: formData.marketing_opt_in
        }
      }
    });

    if (error) {
      toast({
        title: "Erro no cadastro",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Magic link enviado",
        description: "Verifique seu email para acessar sua conta.",
      });
      navigate('/entrar');
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
                  className="pl-10"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">Senha (para login com senha)</Label>
              <div className="relative">
                <Shield className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="address_line">Endereço *</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="address_line"
                  placeholder="Rua, número, bairro, cidade"
                  value={formData.address_line}
                  onChange={(e) => handleInputChange('address_line', e.target.value)}
                  className="pl-10"
                  required
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
                  maxLength={11}
                  required
                />
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
                  className="pl-10"
                  required
                />
              </div>
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
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
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