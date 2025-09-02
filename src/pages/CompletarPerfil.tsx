import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Loader2, User, MapPin, Phone, Calendar } from "lucide-react";
import { requireAuth, getPatient, upsertPatient } from "@/lib/auth";
import { validateCPF, validatePhoneE164, validateBirthDate, formatPhoneE164, isProfileComplete } from "@/lib/validations";

const CompletarPerfil = () => {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    address_line: "",
    cpf: "",
    phone_e164: "",
    birth_date: "",
    terms_accepted: false
  });
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
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
          terms_accepted: !!patient.terms_accepted_at
        });
      }
    };

    loadPatientData();
  }, []);

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !currentUser) return;

    setIsLoading(true);
    
    try {
      const patientData = {
        ...formData,
        terms_accepted_at: formData.terms_accepted ? new Date().toISOString() : null,
        profile_complete: true
      };

      await upsertPatient(currentUser.id, patientData);
      
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso.",
      });
      
      navigate('/intake/antecedentes');
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar suas informações. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-foreground">Completar Perfil</CardTitle>
          <CardDescription>
            Complete suas informações básicas para continuar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
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
            
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar e continuar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompletarPerfil;