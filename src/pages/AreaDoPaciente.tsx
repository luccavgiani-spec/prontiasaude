import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, Link } from "react-router-dom";
import { 
  User, 
  Heart, 
  Baby, 
  Pills, 
  Stethoscope, 
  CheckCircle, 
  AlertCircle, 
  Edit,
  LogOut,
  Phone,
  MapPin,
  Calendar,
  Shield
} from "lucide-react";
import { requireAuth, getPatient, Patient } from "@/lib/auth";
import { formatCPF } from "@/lib/validations";

const AreaDoPaciente = () => {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const loadPatientData = async () => {
      const auth = await requireAuth();
      if (!auth) return;

      setCurrentUser(auth.user);
      
      const patientData = await getPatient(auth.user.id);
      if (patientData) {
        setPatient(patientData);
        
        // Check if profile needs completion
        if (!patientData.profile_complete) {
          navigate('/completar-perfil');
          return;
        }
        
        // Check if intake needs completion
        if (!patientData.intake_complete) {
          navigate('/intake/antecedentes');
          return;
        }
      }
      
      setIsLoading(false);
    };

    loadPatientData();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logout realizado",
      description: "Você foi desconectado com sucesso.",
    });
    navigate('/entrar');
  };

  const getPregnancyStatusText = (status?: string) => {
    switch (status) {
      case 'never': return 'Nunca esteve grávida';
      case 'pregnant_now': return 'Gestante atualmente';
      case 'pregnant_past': return 'Gestação anterior';
      default: return 'Não informado';
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <User className="h-8 w-8 animate-pulse mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Carregando seus dados...</p>
        </div>
      </div>
    );
  }

  const canScheduleAppointments = patient?.profile_complete && patient?.intake_complete;

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 bg-background">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Área do Paciente
            </h1>
            <p className="text-muted-foreground">
              Bem-vindo(a), {patient?.first_name || currentUser?.email}
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>

        {/* Status Alert */}
        {!canScheduleAppointments && (
          <Alert className="mb-8 border-yellow-200 bg-yellow-50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              Complete seu perfil e antecedentes médicos para poder agendar consultas.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Dados Pessoais */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                Dados Pessoais
                <Badge variant={patient?.profile_complete ? "default" : "secondary"}>
                  {patient?.profile_complete ? (
                    <><CheckCircle className="h-3 w-3 mr-1" /> Completo</>
                  ) : (
                    <><AlertCircle className="h-3 w-3 mr-1" /> Pendente</>
                  )}
                </Badge>
              </CardTitle>
              <CardDescription>
                Suas informações básicas de cadastro
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Nome</Label>
                  <p className="text-foreground">{patient?.first_name} {patient?.last_name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                  <p className="text-foreground">{currentUser?.email}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">CPF</Label>
                  <p className="text-foreground">{patient?.cpf ? formatCPF(patient.cpf) : 'Não informado'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Data de Nascimento</Label>
                  <p className="text-foreground">
                    {patient?.birth_date ? new Date(patient.birth_date).toLocaleDateString('pt-BR') : 'Não informado'}
                  </p>
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> Telefone
                </Label>
                <p className="text-foreground">{patient?.phone_e164 || 'Não informado'}</p>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> Endereço
                </Label>
                <p className="text-foreground">{patient?.address_line || 'Não informado'}</p>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Shield className="h-3 w-3" /> Termos aceitos em
                </Label>
                <p className="text-foreground">
                  {patient?.terms_accepted_at 
                    ? new Date(patient.terms_accepted_at).toLocaleDateString('pt-BR')
                    : 'Não aceito'
                  }
                </p>
              </div>
              
              <Button asChild variant="outline" className="w-full">
                <Link to="/completar-perfil">
                  <Edit className="h-4 w-4 mr-2" />
                  Editar perfil
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* Antecedentes Médicos */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Heart className="h-5 w-5 text-destructive" />
                Antecedentes Médicos
                <Badge variant={patient?.intake_complete ? "default" : "secondary"}>
                  {patient?.intake_complete ? (
                    <><CheckCircle className="h-3 w-3 mr-1" /> Completo</>
                  ) : (
                    <><AlertCircle className="h-3 w-3 mr-1" /> Pendente</>
                  )}
                </Badge>
              </CardTitle>
              <CardDescription>
                Informações importantes para seu atendimento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Heart className="h-3 w-3" /> Alergias
                </Label>
                <p className="text-foreground">
                  {patient?.has_allergies 
                    ? patient.allergies || 'Sim, mas não especificado'
                    : 'Não possui alergias'
                  }
                </p>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Baby className="h-3 w-3" /> Status de gestação
                </Label>
                <p className="text-foreground">
                  {getPregnancyStatusText(patient?.pregnancy_status)}
                </p>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Stethoscope className="h-3 w-3" /> Comorbidades
                </Label>
                <p className="text-foreground">
                  {patient?.has_comorbidities 
                    ? patient.comorbidities || 'Sim, mas não especificado'
                    : 'Não possui comorbidades'
                  }
                </p>
              </div>
              
              <div>
                <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Pills className="h-3 w-3" /> Medicamentos contínuos
                </Label>
                <p className="text-foreground">
                  {patient?.has_chronic_meds 
                    ? patient.chronic_meds || 'Sim, mas não especificado'
                    : 'Não usa medicamentos contínuos'
                  }
                </p>
              </div>
              
              <Button asChild variant="outline" className="w-full">
                <Link to="/intake/antecedentes">
                  <Edit className="h-4 w-4 mr-2" />
                  Editar antecedentes
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="mt-8 text-center">
          {canScheduleAppointments ? (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Pronto para agendar?</h2>
              <p className="text-muted-foreground">
                Seu perfil está completo. Agora você pode agendar consultas.
              </p>
              <Button asChild size="lg" className="bg-primary hover:bg-primary/90">
                <Link to="/#servicos">Agendar consulta</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-foreground">Complete seu cadastro</h2>
              <p className="text-muted-foreground">
                Finalize o preenchimento dos seus dados para poder agendar consultas.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                {!patient?.profile_complete && (
                  <Button asChild variant="outline">
                    <Link to="/completar-perfil">Completar perfil</Link>
                  </Button>
                )}
                {!patient?.intake_complete && (
                  <Button asChild className="bg-primary hover:bg-primary/90">
                    <Link to="/intake/antecedentes">Preencher antecedentes</Link>
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper Label component
const Label = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={`block ${className}`}>{children}</span>
);

export default AreaDoPaciente;