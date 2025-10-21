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

      // Login
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: formData.password,
      });

      if (error) throw error;

      if (!data.user) {
        throw new Error('Login failed');
      }

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

      // Verificar se precisa trocar senha
      const { data: credData } = await supabase
        .from('company_credentials')
        .select('must_change_password')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (credData?.must_change_password) {
        navigate('/empresa/trocar-senha');
      } else {
        navigate('/empresa');
      }

    } catch (error: any) {
      console.error('Login error:', error);
      if (error.message?.includes('Invalid login credentials')) {
        toast.error('CNPJ ou senha incorretos');
      } else {
        toast.error('Erro ao fazer login');
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
