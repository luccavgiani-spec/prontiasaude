import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Loader2, Heart, Baby, Pills, Stethoscope } from "lucide-react";
import { requireAuth, getPatient, upsertPatient } from "@/lib/auth";
import { isIntakeComplete } from "@/lib/validations";

const Antecedentes = () => {
  const [formData, setFormData] = useState({
    has_allergies: false,
    allergies: "",
    pregnancy_status: "" as 'never' | 'pregnant_now' | 'pregnant_past' | '',
    has_comorbidities: false,
    comorbidities: "",
    has_chronic_meds: false,
    chronic_meds: ""
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
          has_allergies: patient.has_allergies || false,
          allergies: patient.allergies || "",
          pregnancy_status: patient.pregnancy_status || "",
          has_comorbidities: patient.has_comorbidities || false,
          comorbidities: patient.comorbidities || "",
          has_chronic_meds: patient.has_chronic_meds || false,
          chronic_meds: patient.chronic_meds || ""
        });
      }
    };

    loadPatientData();
  }, []);

  const validateForm = () => {
    if (formData.has_allergies && !formData.allergies.trim()) {
      toast({ title: "Erro", description: "Por favor, descreva suas alergias.", variant: "destructive" });
      return false;
    }
    if (formData.has_comorbidities && !formData.comorbidities.trim()) {
      toast({ title: "Erro", description: "Por favor, descreva suas comorbidades.", variant: "destructive" });
      return false;
    }
    if (formData.has_chronic_meds && !formData.chronic_meds.trim()) {
      toast({ title: "Erro", description: "Por favor, descreva seus medicamentos de uso contínuo.", variant: "destructive" });
      return false;
    }
    if (!formData.pregnancy_status) {
      toast({ title: "Erro", description: "Por favor, responda sobre gestação.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!currentUser) return;

    setIsLoading(true);
    
    try {
      const patientData = {
        ...formData,
        intake_complete: false
      };

      await upsertPatient(currentUser.id, patientData);
      
      toast({
        title: "Rascunho salvo",
        description: "Suas informações foram salvas como rascunho.",
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar o rascunho. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !currentUser) return;

    setIsLoading(true);
    
    try {
      const patientData = {
        ...formData,
        intake_complete: true
      };

      await upsertPatient(currentUser.id, patientData);
      
      toast({
        title: "Antecedentes concluídos",
        description: "Suas informações médicas foram registradas com sucesso.",
      });
      
      navigate('/area-do-paciente');
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
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-foreground">Antecedentes Médicos</CardTitle>
            <CardDescription>
              Para oferecermos o melhor atendimento, precisamos conhecer seu histórico médico
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleComplete} className="space-y-8">
              {/* Alergias */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Heart className="h-5 w-5 text-destructive" />
                    Alergias
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RadioGroup
                    value={formData.has_allergies ? "sim" : "nao"}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, has_allergies: value === "sim" }))}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="nao" id="allergies-no" />
                      <Label htmlFor="allergies-no">Não tenho alergias</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sim" id="allergies-yes" />
                      <Label htmlFor="allergies-yes">Sim, tenho alergias</Label>
                    </div>
                  </RadioGroup>
                  
                  {formData.has_allergies && (
                    <div className="space-y-2">
                      <Label htmlFor="allergies">Descreva suas alergias *</Label>
                      <Textarea
                        id="allergies"
                        placeholder="Ex: alergia a penicilina, alergia alimentar a frutos do mar..."
                        value={formData.allergies}
                        onChange={(e) => setFormData(prev => ({ ...prev, allergies: e.target.value }))}
                        className="min-h-20"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Gestação */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Baby className="h-5 w-5 text-primary" />
                    Gestação
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={formData.pregnancy_status}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, pregnancy_status: value as any }))}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="never" id="pregnancy-never" />
                      <Label htmlFor="pregnancy-never">Nunca estive grávida</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="pregnant_now" id="pregnancy-now" />
                      <Label htmlFor="pregnancy-now">Gestante atualmente</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="pregnant_past" id="pregnancy-past" />
                      <Label htmlFor="pregnancy-past">Já estive grávida anteriormente</Label>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>

              {/* Comorbidades */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Stethoscope className="h-5 w-5 text-accent-foreground" />
                    Comorbidades
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RadioGroup
                    value={formData.has_comorbidities ? "sim" : "nao"}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, has_comorbidities: value === "sim" }))}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="nao" id="comorbidities-no" />
                      <Label htmlFor="comorbidities-no">Não possuo comorbidades</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sim" id="comorbidities-yes" />
                      <Label htmlFor="comorbidities-yes">Sim, possuo comorbidades</Label>
                    </div>
                  </RadioGroup>
                  
                  {formData.has_comorbidities && (
                    <div className="space-y-2">
                      <Label htmlFor="comorbidities">Descreva suas comorbidades *</Label>
                      <Textarea
                        id="comorbidities"
                        placeholder="Ex: diabetes, hipertensão, problemas cardíacos..."
                        value={formData.comorbidities}
                        onChange={(e) => setFormData(prev => ({ ...prev, comorbidities: e.target.value }))}
                        className="min-h-20"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Medicamentos */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Pills className="h-5 w-5 text-yellow-600" />
                    Medicamentos de uso contínuo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RadioGroup
                    value={formData.has_chronic_meds ? "sim" : "nao"}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, has_chronic_meds: value === "sim" }))}
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="nao" id="meds-no" />
                      <Label htmlFor="meds-no">Não uso medicamentos contínuos</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sim" id="meds-yes" />
                      <Label htmlFor="meds-yes">Sim, uso medicamentos contínuos</Label>
                    </div>
                  </RadioGroup>
                  
                  {formData.has_chronic_meds && (
                    <div className="space-y-2">
                      <Label htmlFor="chronic_meds">Descreva seus medicamentos *</Label>
                      <Textarea
                        id="chronic_meds"
                        placeholder="Ex: Losartana 50mg 1x ao dia, Metformina 850mg 2x ao dia..."
                        value={formData.chronic_meds}
                        onChange={(e) => setFormData(prev => ({ ...prev, chronic_meds: e.target.value }))}
                        className="min-h-20"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row gap-4">
                <Button 
                  type="button"
                  variant="outline" 
                  onClick={handleSaveDraft}
                  className="flex-1"
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Salvar rascunho
                </Button>
                
                <Button 
                  type="submit"
                  className="flex-1 bg-primary hover:bg-primary/90"
                  disabled={isLoading}
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Concluir antecedentes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Antecedentes;