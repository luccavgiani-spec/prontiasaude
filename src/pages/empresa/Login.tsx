import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatCNPJ } from '@/lib/validations';
import { Building2 } from 'lucide-react';

export default function EmpresaLogin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    cnpj: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.cnpj || !formData.password) {
      toast.error('Preencha todos os campos');
      return;
    }

    setLoading(true);

    try {
      // Gerar email a partir do CNPJ
      const cleanCNPJ = formData.cnpj.replace(/\D/g, '');
      const email = `${cleanCNPJ}@empresa.prontia.com`;

      console.log('[Login] Tentando autenticar:', { cnpj: cleanCNPJ, email });

      // Login
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: formData.password,
      });

      if (error) throw error;

      if (!data.user) {
        throw new Error('Login failed');
      }

      console.log('[Login] Autenticação bem-sucedida, verificando role...');

      // Verificar se é empresa
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id)
        .eq('role', 'company')
        .maybeSingle();

      if (!roleData) {
        await supabase.auth.signOut();
        throw new Error('Acesso não autorizado');
      }

      console.log('[Login] Role verificada, buscando credentials...');

      // Verificar se precisa trocar senha e resetar failed attempts
      const { data: credData } = await supabase
        .from('company_credentials')
        .select('must_change_password')
        .eq('user_id', data.user.id)
        .maybeSingle();

      // Resetar tentativas falhadas em caso de sucesso
      await supabase
        .from('company_credentials')
        .update({
          failed_login_attempts: 0,
          last_failed_login_at: null,
          last_login_at: new Date().toISOString()
        })
        .eq('user_id', data.user.id);

      console.log('[Login] Login bem-sucedido, redirecionando...', {
        must_change_password: credData?.must_change_password
      });

      if (credData?.must_change_password) {
        toast.success('Use a senha temporária fornecida para definir sua senha permanente');
        navigate('/empresa/trocar-senha');
      } else {
        toast.success('Login realizado com sucesso');
        navigate('/empresa');
      }

    } catch (error: any) {
      console.error('[Login] Erro:', error);
      
      // Mensagens de erro específicas
      if (error.message?.includes('Invalid login credentials')) {
        const cleanCNPJ = formData.cnpj.replace(/\D/g, '');
        
        // Verificar se empresa existe para fornecer mensagem mais útil
        try {
          const { data: companyData } = await supabase
            .from('companies')
            .select('id, razao_social')
            .eq('cnpj', cleanCNPJ)
            .maybeSingle();

          if (!companyData) {
            toast.error('CNPJ não encontrado. Verifique se sua empresa foi cadastrada pelo administrador.');
          } else {
            // Empresa existe, então é problema de senha
            const { data: credData } = await supabase
              .from('company_credentials')
              .select('must_change_password, failed_login_attempts, company_id, user_id')
              .eq('company_id', companyData.id)
              .maybeSingle();

            if (credData) {
              // Incrementar tentativas falhadas via RPC ou edge function
              // Por ora, apenas mostrar mensagem apropriada
              if (credData.must_change_password) {
                toast.error('Senha incorreta. No primeiro acesso, use a SENHA TEMPORÁRIA fornecida pelo administrador.');
              } else {
                const attempts = (credData.failed_login_attempts || 0) + 1;
                if (attempts >= 5) {
                  toast.error('Múltiplas tentativas falhadas. Entre em contato com o administrador para resetar sua senha.');
                } else {
                  toast.error(`Senha incorreta. Tentativa ${attempts}/5. Após 5 tentativas, sua conta será bloqueada.`);
                }
              }
            } else {
              toast.error('Erro de configuração. Entre em contato com o administrador.');
            }
          }
        } catch (checkError) {
          console.error('[Login] Erro ao verificar empresa:', checkError);
          toast.error('CNPJ ou senha incorretos. Verifique suas credenciais.');
        }
      } else if (error.message?.includes('Acesso não autorizado')) {
        toast.error('Este usuário não tem permissão de acesso como empresa');
      } else if (error.message?.includes('Email not confirmed')) {
        toast.error('Email não confirmado. Entre em contato com o administrador.');
      } else {
        toast.error('Erro ao fazer login. Verifique sua conexão e tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-primary p-3">
              <Building2 className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Área da Empresa</CardTitle>
          <p className="text-sm text-muted-foreground">
            Entre com seu CNPJ e senha
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-xs text-yellow-800">
                <strong>Primeiro acesso?</strong> Use a senha temporária fornecida pelo administrador. Você será redirecionado para criar uma senha permanente.
              </p>
            </div>

            <div>
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={formatCNPJ(formData.cnpj)}
                onChange={(e) => setFormData(prev => ({ ...prev, cnpj: e.target.value }))}
                placeholder="00.000.000/0000-00"
                disabled={loading}
                required
              />
            </div>

            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                placeholder="Digite a senha temporária ou permanente"
                disabled={loading}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Entrando...' : 'Entrar'}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Problemas para acessar? Entre em contato com o administrador.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
