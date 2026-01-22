import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isPasswordValid } from '@/lib/password-generator';
import { PasswordChecklist } from '@/components/auth/PasswordChecklist';

export default function EmpresaTrocarSenha() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    newPassword: '',
    confirmPassword: '',
  });

  // Verificar autenticação ao montar componente
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Sessão expirada. Faça login novamente com a senha temporária.');
        navigate('/empresa/login');
      }
    };
    checkAuth();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isPasswordValid(formData.newPassword)) {
      toast.error('A senha não atende aos requisitos mínimos');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setLoading(true);

    try {
      console.log('[TrocarSenha] Iniciando troca de senha...');

      // Verificar sessão antes de tentar atualizar
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Sessão expirada');
      }

      const { error } = await supabase.auth.updateUser({
        password: formData.newPassword,
      });

      if (error) {
        console.error('[TrocarSenha] Erro ao atualizar senha:', error);
        
        if (error.message.includes('session')) {
          throw new Error('Sessão expirada. Faça login novamente.');
        }
        
        throw error;
      }

      console.log('[TrocarSenha] Senha atualizada no Auth, atualizando credentials...');

      // Atualizar flag must_change_password
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: updateError } = await supabase
          .from('company_credentials')
          .update({ must_change_password: false })
          .eq('user_id', user.id);

        if (updateError) {
          console.error('[TrocarSenha] Erro ao atualizar credentials:', updateError);
          throw new Error('Senha atualizada mas erro ao finalizar. Entre em contato com o administrador.');
        }
      }

      console.log('[TrocarSenha] ✅ Senha alterada com sucesso');
      toast.success('Senha alterada com sucesso! Redirecionando...');
      
      setTimeout(() => {
        navigate('/empresa');
      }, 1500);

    } catch (error: any) {
      console.error('[TrocarSenha] Erro:', error);
      
      if (error.message?.includes('Sessão expirada')) {
        toast.error('Sessão expirada. Faça login novamente com a senha temporária.');
        setTimeout(() => {
          navigate('/empresa/login');
        }, 2000);
      } else {
        toast.error(error.message || 'Erro ao alterar senha. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Trocar Senha</CardTitle>
          <p className="text-sm text-muted-foreground">
            Por segurança, você precisa alterar sua senha temporária.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={formData.newPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                required
              />
            </div>

            <PasswordChecklist password={formData.newPassword} />

            <div>
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Alterando...' : 'Alterar Senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
