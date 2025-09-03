import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { upsertPatient } from "@/lib/api";
import { normalizaPhoneE164, setEmailAtual, setPhone, isEmailValid, isTelefoneValid } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface CadastroModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (email: string) => void;
}

export function CadastroModal({ open, onOpenChange, onSuccess }: CadastroModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, informe seu nome completo.",
        variant: "destructive",
      });
      return;
    }

    if (!isEmailValid(formData.email)) {
      toast({
        title: "Email inválido",
        description: "Por favor, informe um email válido.",
        variant: "destructive",
      });
      return;
    }

    if (!isTelefoneValid(formData.phone)) {
      toast({
        title: "Telefone inválido",
        description: "Por favor, informe um telefone válido.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await upsertPatient({
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        phone_e164: normalizaPhoneE164(formData.phone)
      });

      if (result.success) {
        setEmailAtual(formData.email.trim().toLowerCase());
        setPhone(formData.phone);
        toast({
          title: "Cadastro realizado!",
          description: "Seus dados foram salvos com sucesso.",
        });
        onSuccess(formData.email.trim().toLowerCase());
        onOpenChange(false);
        setFormData({ name: "", email: "", phone: "" });
      } else {
        toast({
          title: "Erro no cadastro",
          description: result.error || "Tente novamente em alguns instantes.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erro inesperado",
        description: "Não foi possível processar seu cadastro. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-primary">
            Cadastro Rápido
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome completo</Label>
            <Input
              id="name"
              type="text"
              placeholder="Seu nome completo"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="rounded-xl"
              disabled={isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="rounded-xl"
              disabled={isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="phone">Telefone</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="(11) 99999-9999"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="rounded-xl"
              disabled={isLoading}
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full bg-gradient-to-r from-primary to-primary-glow text-white hover:from-primary-glow hover:to-primary shadow-elegant transition-all duration-300 hover:shadow-primary-glow" 
            size="lg"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cadastrando...
              </>
            ) : (
              "Continuar"
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}