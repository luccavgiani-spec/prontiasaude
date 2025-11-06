import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Search, XCircle, CheckCircle } from "lucide-react";

interface PatientPlan {
  id: string;
  email: string;
  user_id: string | null;
  plan_code: string;
  status: string;
  plan_expires_at: string;
  created_at: string;
  updated_at: string;
}

const PlansManagement = () => {
  const [searchEmail, setSearchEmail] = useState("");
  const [plans, setPlans] = useState<PatientPlan[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const { toast } = useToast();

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
        .eq('email', searchEmail.trim())
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPlans(data || []);

      if (!data || data.length === 0) {
        toast({
          title: "Nenhum plano encontrado",
          description: `Nenhum plano encontrado para ${searchEmail}`,
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

  const disablePlan = async (email: string) => {
    setIsDisabling(true);
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
          email: email
        }
      });

      if (response.error) {
        throw response.error;
      }

      toast({
        title: "Plano desabilitado",
        description: `Plano de ${email} foi desabilitado com sucesso`,
      });

      // Atualizar lista de planos
      await searchPlans();
    } catch (error: any) {
      console.error('Erro ao desabilitar plano:', error);
      toast({
        title: "Erro ao desabilitar plano",
        description: error.message || "Ocorreu um erro ao desabilitar o plano",
        variant: "destructive"
      });
    } finally {
      setIsDisabling(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Planos de Pacientes</CardTitle>
          <CardDescription>
            Busque e gerencie planos de pacientes por email
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <Label htmlFor="search-email">Email do Paciente</Label>
              <Input
                id="search-email"
                type="email"
                placeholder="cristielli@outlook.com"
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
                <Search className="w-4 h-4 mr-2" />
                {isSearching ? "Buscando..." : "Buscar"}
              </Button>
            </div>
          </div>

          {plans.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Planos Encontrados</h3>
              {plans.map((plan) => (
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
                                Inativo
                              </>
                            )}
                          </Badge>
                        </div>
                        <div>
                          <span className="font-medium">Código do Plano:</span>{" "}
                          <code className="bg-muted px-2 py-1 rounded text-sm">
                            {plan.plan_code}
                          </code>
                        </div>
                        <div>
                          <span className="font-medium">Email:</span> {plan.email}
                        </div>
                        <div>
                          <span className="font-medium">Expira em:</span>{" "}
                          {formatDate(plan.plan_expires_at)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Criado em: {formatDate(plan.created_at)}
                        </div>
                      </div>
                      {plan.status === 'active' && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => disablePlan(plan.email)}
                          disabled={isDisabling}
                        >
                          <XCircle className="w-4 h-4 mr-2" />
                          {isDisabling ? "Desabilitando..." : "Desabilitar"}
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PlansManagement;
