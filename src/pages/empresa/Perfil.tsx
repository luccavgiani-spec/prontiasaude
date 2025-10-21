import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { useCompanyAuth } from '@/hooks/useCompanyAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { validateCEP, formatCNPJ } from '@/lib/validations';
import { ArrowLeft } from 'lucide-react';

export default function EmpresaPerfil() {
  const { company, loading: authLoading } = useCompanyAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    razao_social: company?.razao_social || '',
    cep: company?.cep || '',
    logradouro: company?.logradouro || '',
    bairro: company?.bairro || '',
    cidade: company?.cidade || '',
    uf: company?.uf || '',
    numero: company?.numero || '',
    complemento: company?.complemento || '',
    n_funcionarios: company?.n_funcionarios || 1,
    contato_nome: company?.contato_nome || '',
    contato_email: company?.contato_email || '',
    contato_telefone: company?.contato_telefone || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateCEP(formData.cep)) {
      toast.error('CEP inválido');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('companies')
        .update({
          razao_social: formData.razao_social,
          cep: formData.cep,
          logradouro: formData.logradouro,
          bairro: formData.bairro,
          cidade: formData.cidade,
          uf: formData.uf,
          numero: formData.numero,
          complemento: formData.complemento,
          n_funcionarios: formData.n_funcionarios,
          contato_nome: formData.contato_nome,
          contato_email: formData.contato_email,
          contato_telefone: formData.contato_telefone,
        })
        .eq('id', company?.id);

      if (error) throw error;

      toast.success('Perfil atualizado com sucesso');
      navigate('/empresa');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Erro ao atualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !company) {
    return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4">
      <div className="container mx-auto max-w-2xl">
        <Button variant="ghost" onClick={() => navigate('/empresa')} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Meu Perfil</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>CNPJ</Label>
                <Input value={formatCNPJ(company.cnpj)} disabled className="bg-muted" />
              </div>

              <div>
                <Label htmlFor="razao_social">Razão Social *</Label>
                <Input
                  id="razao_social"
                  value={formData.razao_social}
                  onChange={(e) => setFormData(prev => ({ ...prev, razao_social: e.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="n_funcionarios">Número de Funcionários *</Label>
                <Input
                  id="n_funcionarios"
                  type="number"
                  min="1"
                  value={formData.n_funcionarios}
                  onChange={(e) => setFormData(prev => ({ ...prev, n_funcionarios: parseInt(e.target.value) || 1 }))}
                  required
                />
              </div>

              <div className="border-t pt-4 mt-4 space-y-4">
                <h3 className="font-medium">Endereço</h3>
                <Input
                  placeholder="CEP *"
                  value={formData.cep}
                  onChange={(e) => setFormData(prev => ({ ...prev, cep: e.target.value }))}
                  required
                />
                <Input
                  placeholder="Logradouro"
                  value={formData.logradouro}
                  onChange={(e) => setFormData(prev => ({ ...prev, logradouro: e.target.value }))}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    placeholder="Número"
                    value={formData.numero}
                    onChange={(e) => setFormData(prev => ({ ...prev, numero: e.target.value }))}
                  />
                  <Input
                    placeholder="Complemento"
                    value={formData.complemento}
                    onChange={(e) => setFormData(prev => ({ ...prev, complemento: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => navigate('/empresa')}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
