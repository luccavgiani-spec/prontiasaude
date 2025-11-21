import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Copy, AlertTriangle } from 'lucide-react';
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

  const copyInstructions = () => {
    const instructions = `🏢 ACESSO À PLATAFORMA PRONTIA - ÁREA DA EMPRESA

📋 CREDENCIAIS DE ACESSO:
CNPJ: ${formatCNPJ(credentials.cnpj)}
Senha Temporária: ${credentials.password}

⚠️ IMPORTANTE: Esta é uma SENHA TEMPORÁRIA que deve ser usada apenas no primeiro acesso.

📝 PASSO A PASSO PARA PRIMEIRO ACESSO:

1️⃣ Acesse: https://prontiasaude.com.br/empresa/login

2️⃣ Digite o CNPJ e a senha temporária acima

3️⃣ Você será AUTOMATICAMENTE redirecionado para criar uma senha permanente

4️⃣ Defina sua nova senha (mínimo 8 caracteres, com letras e números)

5️⃣ Após confirmar, você terá acesso completo ao painel da empresa

❓ PROBLEMAS?
- Certifique-se de copiar a senha exatamente como está (sem espaços extras)
- Senhas são case-sensitive (diferenciam maiúsculas e minúsculas)
- Em caso de dúvidas, entre em contato com o administrador

⏰ Esta senha temporária é válida e deve ser trocada no primeiro acesso.`;

    navigator.clipboard.writeText(instructions);
    toast.success('Instruções completas copiadas!');
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            Empresa cadastrada com sucesso!
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Aviso importante */}
          <div className="p-4 bg-yellow-50 border-2 border-yellow-400 rounded-lg flex gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-yellow-900">⚠️ SENHA TEMPORÁRIA</p>
              <p className="text-sm text-yellow-800">
                Esta senha <strong>DEVE ser trocada</strong> no primeiro acesso. A empresa será automaticamente 
                redirecionada para criar uma senha permanente.
              </p>
            </div>
          </div>

          {/* Credenciais */}
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

          {/* Instruções passo a passo */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
            <p className="font-semibold text-blue-900">📝 Instruções para o responsável da empresa:</p>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Acesse <strong>prontiasaude.com.br/empresa/login</strong></li>
              <li>Digite o <strong>CNPJ</strong> e a <strong>senha temporária</strong> acima</li>
              <li>Você será redirecionado automaticamente para trocar a senha</li>
              <li>Defina sua senha permanente (mínimo 8 caracteres)</li>
              <li>Pronto! Acesso liberado ao painel da empresa</li>
            </ol>
          </div>

          {/* Botões de ação */}
          <div className="flex flex-col gap-2">
            <Button onClick={copyInstructions} className="w-full" size="lg">
              <Copy className="h-4 w-4 mr-2" />
              Copiar Instruções Completas (Enviar para Empresa)
            </Button>
            <Button onClick={copyToClipboard} variant="outline" className="w-full">
              <Copy className="h-4 w-4 mr-2" />
              Copiar Apenas Credenciais
            </Button>
            <Button variant="secondary" onClick={onClose} className="w-full">
              Fechar
            </Button>
          </div>

          {/* Nota de segurança */}
          <p className="text-xs text-center text-muted-foreground">
            🔒 As credenciais são enviadas automaticamente por email, mas recomendamos enviá-las também por outro canal seguro.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}