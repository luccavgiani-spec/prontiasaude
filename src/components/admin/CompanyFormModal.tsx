import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { validateCNPJWithChecksum, formatCNPJ, validateCEP } from '@/lib/validations';
import { generateTemporaryPassword } from '@/lib/password-generator';

interface Company {
  id: string;
  razao_social: string;
  cnpj: string;
  cep: string;
  logradouro?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  numero?: string;
  complemento?: string;
  n_funcionarios: number;
  contato_nome?: string;
  contato_email?: string;
  contato_telefone?: string;
}

interface CompanyFormModalProps {
  company: Company | null;
  onClose: () => void;
  onCompanyCreated: (credentials: { cnpj: string; password: string }) => void;
  onCompanyUpdated: () => void;
}

export default function CompanyFormModal({ company, onClose, onCompanyCreated, onCompanyUpdated }: CompanyFormModalProps) {
  const [loading, setLoading] = useState(false);
  const [loadingCEP, setLoadingCEP] = useState(false);
  const [formData, setFormData] = useState({
    razao_social: '',
    cnpj: '',
    cep: '',
    logradouro: '',
    bairro: '',
    cidade: '',
    uf: '',
    numero: '',
    complemento: '',
    n_funcionarios: 1,
    contato_nome: '',
    contato_email: '',
    contato_telefone: '',
    temporaryPassword: '',
    empresa_id_externo: 9083,
    plano_id_externo: 864,
  });

  useEffect(() => {
    if (company) {
      setFormData({
        razao_social: company.razao_social,
        cnpj: company.cnpj,
        cep: company.cep,
        logradouro: company.logradouro || '',
        bairro: company.bairro || '',
        cidade: company.cidade || '',
        uf: company.uf || '',
        numero: company.numero || '',
        complemento: company.complemento || '',
        n_funcionarios: company.n_funcionarios,
        contato_nome: company.contato_nome || '',
        contato_email: company.contato_email || '',
        contato_telefone: company.contato_telefone || '',
        temporaryPassword: '',
        empresa_id_externo: (company as any).empresa_id_externo || 9083,
        plano_id_externo: (company as any).plano_id_externo || 864,
      });
    }
  }, [company]);

  const fetchAddressByCEP = async (cep: string) => {
    if (!validateCEP(cep)) return;

    setLoadingCEP(true);
    try {
      const cleanCEP = cep.replace(/\D/g, '');
      const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
      const data = await response.json();

      if (data.erro) {
        toast.error('CEP não encontrado');
        return;
      }

      setFormData(prev => ({
        ...prev,
        logradouro: data.logradouro || '',
        bairro: data.bairro || '',
        cidade: data.localidade || '',
        uf: data.uf || '',
      }));
    } catch (error) {
      console.error('Error fetching CEP:', error);
      toast.error('Erro ao buscar CEP');
    } finally {
      setLoadingCEP(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações
    if (!formData.razao_social.trim()) {
      toast.error('Razão social é obrigatória');
      return;
    }

    if (!validateCNPJWithChecksum(formData.cnpj)) {
      toast.error('CNPJ inválido');
      return;
    }

    if (!validateCEP(formData.cep)) {
      toast.error('CEP inválido');
      return;
    }

    if (formData.n_funcionarios < 1) {
      toast.error('Número de funcionários deve ser maior que zero');
      return;
    }

    setLoading(true);

    try {
      if (company) {
        // Atualizar empresa existente
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
            empresa_id_externo: formData.empresa_id_externo,
            plano_id_externo: formData.plano_id_externo,
          })
          .eq('id', company.id);

        if (error) throw error;

        toast.success('Empresa atualizada com sucesso');
        onCompanyUpdated();
      } else {
        // Criar nova empresa
        const password = formData.temporaryPassword || generateTemporaryPassword(12);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No session');

        const response = await supabase.functions.invoke('company-operations/create', {
          method: 'POST',
          body: {
            company: {
              razao_social: formData.razao_social,
              cnpj: formData.cnpj.replace(/\D/g, ''),
              cep: formData.cep.replace(/\D/g, ''),
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
              empresa_id_externo: formData.empresa_id_externo,
              plano_id_externo: formData.plano_id_externo,
            },
            temporaryPassword: password,
          },
        });

        if (response.error) throw response.error;

        const { credentials } = response.data;
        toast.success('Empresa cadastrada com sucesso');
        onCompanyCreated(credentials);
      }
    } catch (error: any) {
      console.error('Error saving company:', error);
      if (error.message?.includes('duplicate key')) {
        toast.error('CNPJ já cadastrado');
      } else {
        toast.error(company ? 'Erro ao atualizar empresa' : 'Erro ao cadastrar empresa');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{company ? 'Editar Empresa' : 'Nova Empresa'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Label htmlFor="cnpj">CNPJ *</Label>
            <Input
              id="cnpj"
              value={formatCNPJ(formData.cnpj)}
              onChange={(e) => setFormData(prev => ({ ...prev, cnpj: e.target.value }))}
              disabled={!!company}
              required
            />
          </div>

          <div>
            <Label htmlFor="cep">CEP *</Label>
            <Input
              id="cep"
              value={formData.cep}
              onChange={(e) => setFormData(prev => ({ ...prev, cep: e.target.value }))}
              onBlur={() => fetchAddressByCEP(formData.cep)}
              disabled={loadingCEP}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="logradouro">Logradouro</Label>
              <Input
                id="logradouro"
                value={formData.logradouro}
                onChange={(e) => setFormData(prev => ({ ...prev, logradouro: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="bairro">Bairro</Label>
              <Input
                id="bairro"
                value={formData.bairro}
                onChange={(e) => setFormData(prev => ({ ...prev, bairro: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Label htmlFor="cidade">Cidade</Label>
              <Input
                id="cidade"
                value={formData.cidade}
                onChange={(e) => setFormData(prev => ({ ...prev, cidade: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="uf">UF</Label>
              <Input
                id="uf"
                value={formData.uf}
                onChange={(e) => setFormData(prev => ({ ...prev, uf: e.target.value.toUpperCase() }))}
                maxLength={2}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="numero">Número</Label>
              <Input
                id="numero"
                value={formData.numero}
                onChange={(e) => setFormData(prev => ({ ...prev, numero: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="complemento">Complemento</Label>
              <Input
                id="complemento"
                value={formData.complemento}
                onChange={(e) => setFormData(prev => ({ ...prev, complemento: e.target.value }))}
              />
            </div>
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

          <div className="border-t pt-4 mt-4">
            <h3 className="font-medium mb-3">Contato (Opcional)</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="contato_nome">Nome</Label>
                <Input
                  id="contato_nome"
                  value={formData.contato_nome}
                  onChange={(e) => setFormData(prev => ({ ...prev, contato_nome: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="contato_email">E-mail</Label>
                <Input
                  id="contato_email"
                  type="email"
                  value={formData.contato_email}
                  onChange={(e) => setFormData(prev => ({ ...prev, contato_email: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="contato_telefone">Telefone</Label>
                <Input
                  id="contato_telefone"
                  value={formData.contato_telefone}
                  onChange={(e) => setFormData(prev => ({ ...prev, contato_telefone: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h3 className="font-medium mb-3">IDs Externos (ClickLife)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="empresa_id_externo">Empresa ID Externo</Label>
                <Input
                  id="empresa_id_externo"
                  type="number"
                  value={formData.empresa_id_externo}
                  onChange={(e) => setFormData(prev => ({ ...prev, empresa_id_externo: parseInt(e.target.value) || 9083 }))}
                  placeholder="9083"
                />
              </div>
              <div>
                <Label htmlFor="plano_id_externo">Plano ID Externo</Label>
                <Input
                  id="plano_id_externo"
                  type="number"
                  value={formData.plano_id_externo}
                  onChange={(e) => setFormData(prev => ({ ...prev, plano_id_externo: parseInt(e.target.value) || 864 }))}
                  placeholder="864"
                />
              </div>
            </div>
          </div>

          {!company && (
            <div>
              <Label htmlFor="temporaryPassword">Senha Temporária (deixe vazio para gerar automaticamente)</Label>
              <Input
                id="temporaryPassword"
                type="text"
                value={formData.temporaryPassword}
                onChange={(e) => setFormData(prev => ({ ...prev, temporaryPassword: e.target.value }))}
                placeholder="Senha será gerada automaticamente"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : company ? 'Atualizar' : 'Cadastrar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
