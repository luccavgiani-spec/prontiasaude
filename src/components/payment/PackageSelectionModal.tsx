import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";
import { formataPreco } from "@/lib/utils";

interface Package {
  valor: number;
  nome: string;
  sku: string;
  consultas?: number;
}

interface PackageSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  packages: Package[];
  onPackageSelect: (pkg: Package) => void;
}

export function PackageSelectionModal({ 
  open, 
  onOpenChange, 
  packages,
  onPackageSelect 
}: PackageSelectionModalProps) {
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Escolha seu plano de Psicologia</DialogTitle>
          <DialogDescription>
            Selecione a quantidade de sessões que melhor atende suas necessidades
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {packages.map((pkg) => {
            const consultas = pkg.consultas || 1;
            const precoPorConsulta = consultas > 1 ? pkg.valor / consultas : pkg.valor;
            const isMultiple = consultas > 1;
            const economiaPercent = isMultiple ? Math.round((1 - (precoPorConsulta / packages[0].valor)) * 100) : 0;
            
            return (
              <Card 
                key={pkg.sku}
                className="p-4 hover:border-primary hover:shadow-md transition-all cursor-pointer relative"
                onClick={() => {
                  onPackageSelect(pkg);
                  onOpenChange(false);
                }}
              >
                {economiaPercent > 0 && (
                  <div className="absolute -top-3 right-4 bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                    Economize {economiaPercent}%
                  </div>
                )}
                
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-1">
                      {consultas} {consultas === 1 ? 'Sessão' : 'Sessões'}
                    </h3>
                    
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="text-2xl font-bold text-primary">
                        {formataPreco(precoPorConsulta)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        por sessão
                      </span>
                    </div>
                    
                    {isMultiple && (
                      <p className="text-sm text-muted-foreground">
                        Total: {formataPreco(pkg.valor)} ({consultas} sessões)
                      </p>
                    )}

                    <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-primary" />
                      <span>Sessões de 30 minutos</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-primary" />
                      <span>Atendimento online</span>
                    </div>
                    {isMultiple && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="h-4 w-4 text-primary" />
                        <span>Melhor custo-benefício</span>
                      </div>
                    )}
                  </div>

                  <Button 
                    variant="outline" 
                    className="bg-green-600 text-white border-green-600 hover:bg-green-700"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPackageSelect(pkg);
                      onOpenChange(false);
                    }}
                  >
                    Escolher
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
