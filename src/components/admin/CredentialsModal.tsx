import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { formatCNPJ } from '@/lib/validations';

interface CredentialsModalProps {
  credentials: {
    cnpj: string;
    password: string;
  };
  onClose: () => void;
}

export default function CredentialsModal({ credentials, onClose }: CredentialsModalProps) {
  const copyToClipboard = () => {
    const text = `CNPJ: ${formatCNPJ(credentials.cnpj)}\nSenha Temporária: ${credentials.password}`;
    navigator.clipboard.writeText(text);
    toast.success('Credenciais copiadas para a área de transferência');
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Empresa cadastrada com sucesso!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-4 bg-muted rounded-lg space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">CNPJ</p>
              <p className="font-mono font-semibold text-lg">{formatCNPJ(credentials.cnpj)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Senha Temporária</p>
              <p className="font-mono font-semibold text-lg">{credentials.password}</p>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Copie estas credenciais e envie para a empresa. A empresa será obrigada a trocar a senha no primeiro acesso.
          </p>

          <div className="flex gap-2">
            <Button onClick={copyToClipboard} className="flex-1">
              <Copy className="h-4 w-4 mr-2" />
              Copiar Credenciais
            </Button>
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
