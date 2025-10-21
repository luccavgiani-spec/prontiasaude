import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Edit, Key, Power, PowerOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatCNPJ } from '@/lib/validations';
import CompanyFormModal from './CompanyFormModal';
import CredentialsModal from './CredentialsModal';

interface Company {
  id: string;
  razao_social: string;
  cnpj: string;
  cep: string;
  n_funcionarios: number;
  status: 'ATIVA' | 'INATIVA';
  created_at: string;
}

export default function CompanyManagement() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [credentials, setCredentials] = useState<{ cnpj: string; password: string } | null>(null);
  
  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('companies')
        .select('id, razao_social, cnpj, cep, n_funcionarios, status, created_at')
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`razao_social.ilike.%${search}%,cnpj.ilike.%${search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCompanies((data || []) as Company[]);
    } catch (error) {
      console.error('Error loading companies:', error);
      toast.error('Erro ao carregar empresas');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (companyId: string) => {
    if (!confirm('Deseja redefinir a senha desta empresa? Uma nova senha temporária será gerada.')) {
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await supabase.functions.invoke('company-operations/' + companyId + '/reset-password', {
        method: 'POST',
      });

      if (response.error) throw response.error;

      const { credentials: newCreds } = response.data;
      setCredentials(newCreds);
      toast.success('Senha redefinida com sucesso');
    } catch (error) {
      console.error('Error resetting password:', error);
      toast.error('Erro ao redefinir senha');
    }
  };

  const handleToggleStatus = async (company: Company) => {
    const newStatus = company.status === 'ATIVA' ? 'INATIVA' : 'ATIVA';
    
    if (!confirm(`Deseja ${newStatus === 'ATIVA' ? 'ativar' : 'desativar'} esta empresa?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('companies')
        .update({ status: newStatus })
        .eq('id', company.id);

      if (error) throw error;

      toast.success(`Empresa ${newStatus === 'ATIVA' ? 'ativada' : 'desativada'} com sucesso`);
      loadCompanies();
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('Erro ao alterar status');
    }
  };

  const handleCompanyCreated = (newCredentials: { cnpj: string; password: string }) => {
    setCredentials(newCredentials);
    setShowFormModal(false);
    loadCompanies();
  };

  const handleCompanyUpdated = () => {
    setShowFormModal(false);
    setEditingCompany(null);
    loadCompanies();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Gerenciar Empresas</CardTitle>
          <Button onClick={() => {
            setEditingCompany(null);
            setShowFormModal(true);
          }}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Empresa
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por razão social ou CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadCompanies()}
              className="pl-9"
            />
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : companies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma empresa encontrada
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 font-medium">Razão Social</th>
                    <th className="text-left p-3 font-medium">CNPJ</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Criado em</th>
                    <th className="text-right p-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {companies.map((company) => (
                    <tr key={company.id} className="hover:bg-muted/50">
                      <td className="p-3">{company.razao_social}</td>
                      <td className="p-3 font-mono text-sm">{formatCNPJ(company.cnpj)}</td>
                      <td className="p-3">
                        <Badge variant={company.status === 'ATIVA' ? 'default' : 'secondary'}>
                          {company.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {new Date(company.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingCompany(company);
                              setShowFormModal(true);
                            }}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResetPassword(company.id)}
                          >
                            <Key className="h-3 w-3 mr-1" />
                            Redefinir Senha
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleStatus(company)}
                          >
                            {company.status === 'ATIVA' ? (
                              <PowerOff className="h-3 w-3 mr-1" />
                            ) : (
                              <Power className="h-3 w-3 mr-1" />
                            )}
                            {company.status === 'ATIVA' ? 'Desativar' : 'Ativar'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modals */}
      {showFormModal && (
        <CompanyFormModal
          company={editingCompany}
          onClose={() => {
            setShowFormModal(false);
            setEditingCompany(null);
          }}
          onCompanyCreated={handleCompanyCreated}
          onCompanyUpdated={handleCompanyUpdated}
        />
      )}

      {credentials && (
        <CredentialsModal
          credentials={credentials}
          onClose={() => setCredentials(null)}
        />
      )}
    </div>
  );
}
