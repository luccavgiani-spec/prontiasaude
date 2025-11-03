import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";
import { formataPreco } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

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
      <DialogContent className="sm:max-w-3xl max-h-[90vh] bg-background">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Escolha sua especialidade</DialogTitle>
          <DialogDescription>
            Selecione o serviço que melhor atende suas necessidades
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <div className="grid gap-3 py-2">
            {packages.map((pkg) => {
              const consultas = pkg.consultas || 1;
              const precoPorConsulta = consultas > 1 ? pkg.valor / consultas : pkg.valor;
              const isMultiple = consultas > 1;
              
              return (
                <Card 
                  key={pkg.sku}
                  className="p-4 hover:border-primary hover:shadow-md transition-all cursor-pointer bg-card border-2"
                  onClick={() => {
                    onPackageSelect(pkg);
                    onOpenChange(false);
                  }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="font-bold text-xl mb-2 text-foreground">
                        {pkg.nome}
                      </h3>
                      
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold text-primary">
                          {formataPreco(precoPorConsulta)}
                        </span>
                        {isMultiple && (
                          <span className="text-sm text-muted-foreground">
                            por sessão
                          </span>
                        )}
                      </div>
                      
                      {isMultiple && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Total: {formataPreco(pkg.valor)} ({consultas} sessões)
                        </p>
                      )}
                    </div>

                    <Button 
                      variant="outline" 
                      className="bg-green-600 text-white border-green-600 hover:bg-green-700 shrink-0"
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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
