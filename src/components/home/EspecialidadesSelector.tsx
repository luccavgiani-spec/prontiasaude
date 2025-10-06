import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Stethoscope, Loader2 } from "lucide-react";
import { fetchEspecialidades, openInfinitePayCheckout, type Especialidade } from "@/lib/infinitepay-link-resolver";
import { useToast } from "@/hooks/use-toast";
import { trackLead } from "@/lib/meta-tracking";

export function EspecialidadesSelector() {
  const [especialidades, setEspecialidades] = useState<Especialidade[]>([]);
  const [selectedSku, setSelectedSku] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckoutLoading, setIsCheckoutLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadEspecialidades();
  }, []);

  const loadEspecialidades = async () => {
    setIsLoading(true);
    try {
      const items = await fetchEspecialidades();
      setEspecialidades(items);
      if (items.length > 0) {
        setSelectedSku(items[0].sku);
      }
    } catch (error) {
      console.error('Erro ao carregar especialidades:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as especialidades.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAgendar = async () => {
    if (!selectedSku) {
      toast({
        title: "Atenção",
        description: "Selecione uma especialidade primeiro.",
        variant: "destructive"
      });
      return;
    }

    setIsCheckoutLoading(true);
    try {
      const selectedEsp = especialidades.find(e => e.sku === selectedSku);
      
      trackLead({
        value: 89.90, // Valor padrão, ajuste conforme necessário
        content_name: selectedEsp?.label || "Consulta Especialista"
      });

      const success = await openInfinitePayCheckout(selectedSku);
      
      if (!success) {
        toast({
          title: "Erro",
          description: "Não foi possível abrir o checkout. Tente novamente.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Erro no checkout:', error);
      toast({
        title: "Erro",
        description: "Erro ao processar agendamento.",
        variant: "destructive"
      });
    } finally {
      setIsCheckoutLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Carregando especialidades...</span>
        </div>
      </Card>
    );
  }

  if (especialidades.length === 0) {
    return (
      <Card className="p-6">
        <div className="text-center text-muted-foreground">
          <p>Nenhuma especialidade disponível no momento.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Stethoscope className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-foreground">Médicos Especialistas</h3>
          <p className="text-sm text-muted-foreground">Selecione a especialidade desejada</p>
        </div>
      </div>

      <div className="space-y-4">
        <Select value={selectedSku} onValueChange={setSelectedSku}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Selecione uma especialidade" />
          </SelectTrigger>
          <SelectContent className="bg-background">
            {especialidades.map((esp) => (
              <SelectItem key={esp.sku} value={esp.sku}>
                {esp.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={handleAgendar}
          className="w-full"
          size="lg"
          disabled={isCheckoutLoading || !selectedSku}
        >
          {isCheckoutLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processando...
            </>
          ) : (
            "Agendar agora"
          )}
        </Button>
      </div>
    </Card>
  );
}
