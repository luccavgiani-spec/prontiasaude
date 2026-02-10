import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edge-functions';
import { useCompanyAuth } from '@/hooks/useCompanyAuth';
import { toast } from 'sonner';
import { validateCPF } from '@/lib/cpf-validator';
import { validateCEP, validateEmail } from '@/lib/validations';
import { ArrowLeft, Plus, Trash2, Upload, Send, FileSpreadsheet } from 'lucide-react';
import BulkInviteModal from '@/components/empresa/BulkInviteModal';

interface Employee {
  id: string;
  first_name: string | null;
  last_name: string | null;
  cpf: string;
  email: string;
  created_at: string;
}

interface PendingInvite {
  id: string;
  email: string;
  status: string;
  invited_at: string;
  expires_at: string;
}

const brazilianStates = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export default function EmpresaFuncionarios() {
  const { company, loading: authLoading } = useCompanyAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingCEP, setLoadingCEP] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [cadastroMode, setCadastroMode] = useState<'convite' | 'completo'>('convite');
  const [inviteEmail, setInviteEmail] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [bulkInviteOpen, setBulkInviteOpen] = useState(false);

  const [formData, setFormData] = useState({
    nome: '',
    cpf: '',
    email: '',
    datanascimento: '',
    sexo: 'M',
    telefone: '',
    fotobase64: '',
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cep: '',
    cidade: '',
    estado: '',
  });

  useEffect(() => {
    if (company) {
      loadEmployees();
      loadPendingInvites();
    }
  }, [company]);

  const loadEmployees = async () => {
    if (!company) return;

    setLoading(true);
    try {
      const { data, error } = await invokeEdgeFunction('company-operations', {
        body: {
          operation: 'list-employees',
          company_cnpj: company.cnpj
        }
      });
      if (error) throw error;
      setEmployees((data?.employees || []) as Employee[]);
    } catch (error) {
      toast.error('Erro ao carregar funcionários');
    } finally {
      setLoading(false);
    }
  };

  const loadPendingInvites = async () => {
    if (!company) return;

    try {
      const { data, error } = await invokeEdgeFunction('company-operations', {
        body: {
          operation: 'list-pending-invites',
          company_cnpj: company.cnpj
        }
      });
      if (error) throw error;
      setPendingInvites(data?.invites || []);
    } catch (error) {
      toast.error('Erro ao carregar convites pendentes');
    }
  };

  // Função auxiliar para extrair erro estruturado de múltiplas fontes possíveis
  const extractErrorInfo = (data: any, error: any) => {
    // Caso 1: Erro estruturado em data (Edge Function retornou 200 com erro)
    if (data?.error && data?.code) {
      return data;
    }
    
    // Caso 2: Erro já é um objeto com error e code (Supabase parseou automaticamente)
    if (error?.error && error?.code) {
      return error;
    }
    
    // Caso 3: Erro em error.message como string JSON
    if (error?.message && typeof error.message === 'string') {
      try {
        const parsed = JSON.parse(error.message);
        if (parsed?.error && parsed?.code) {
          return parsed;
        }
      } catch {
        // Não é JSON válido, continuar
      }
    }
    
    // Caso 4: Erro em error.context (algumas versões do SDK)
    if (error?.context?.error && error?.context?.code) {
      return error.context;
    }
    
    return null;
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(inviteEmail)) {
      toast.error('E-mail inválido');
      return;
    }
    
    setLoading(true);
    
    try {
      const { data, error } = await invokeEdgeFunction('company-operations', {
        body: {
          operation: 'invite-employee',
          company_id: company?.id,
          email: inviteEmail
        }
      });
      
      console.log('[Invite] Response:', { data, error });
      
      // Extrair erro estruturado de qualquer fonte possível
      const errorInfo = extractErrorInfo(data, error);
      
      // Verificar resposta controlada da edge function (com código de erro)
      if (errorInfo?.error && errorInfo?.code) {
        let errorMessage = errorInfo.error;
        
        if (errorInfo.code === 'INVITE_PENDING') {
          errorMessage = 'Já existe um convite pendente para este email. Use a opção "Reenviar" na tabela abaixo.';
        } else if (errorInfo.code === 'EMAIL_ALREADY_REGISTERED') {
          errorMessage = 'Este email já está cadastrado no sistema como paciente.';
        } else if (errorInfo.code === 'EMPLOYEE_REGISTERED') {
          errorMessage = 'Este funcionário já completou o cadastro. Verifique a aba "Funcionários".';
        }
        
        console.log('[Invite] Displaying error:', errorMessage);
        toast.error(errorMessage);
        setLoading(false);
        return;
      }
      
      // Erro do Supabase client (network, etc.) sem estrutura JSON
      if (error) {
        console.error('[Invite] Unstructured error:', error);
        toast.error(error.message || 'Erro ao enviar convite');
        setLoading(false);
        return;
      }
      
      // Sucesso
      toast.success(`Convite enviado para ${inviteEmail}!`);
      setInviteEmail('');
      setShowForm(false);
      loadPendingInvites();
      
    } catch (error: any) {
      console.error('[Invite] Exception:', error);
      toast.error(error.message || 'Erro ao enviar convite');
    } finally {
      setLoading(false);
    }
  };

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
        estado: data.uf || '',
      }));
    } catch (error) {
      // Don't log CEP lookup errors
      toast.error('Erro ao buscar CEP');
    } finally {
      setLoadingCEP(false);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Imagem deve ter no máximo 2MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setPhotoPreview(base64);
      setFormData(prev => ({ ...prev, fotobase64: base64 }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validações
    if (!formData.nome.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    if (!validateCPF(formData.cpf)) {
      toast.error('CPF inválido');
      return;
    }

    if (!validateEmail(formData.email)) {
      toast.error('E-mail inválido');
      return;
    }

    if (!validateCEP(formData.cep)) {
      toast.error('CEP inválido');
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No session');

      const response = await invokeEdgeFunction('company-operations', {
        body: {
          operation: 'create-employee',
          ...formData,
          company_id: company?.id,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao cadastrar funcionário');
      }

      // Verificar se há erro na resposta data
      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      toast.success(`Funcionário cadastrado! Email com instruções enviado para ${formData.email}`);
      setShowForm(false);
      setFormData({
        nome: '',
        cpf: '',
        email: '',
        datanascimento: '',
        sexo: 'M',
        telefone: '',
        fotobase64: '',
        logradouro: '',
        numero: '',
        complemento: '',
        bairro: '',
        cep: '',
        cidade: '',
        estado: '',
      });
      setPhotoPreview(null);
      loadEmployees();
    } catch (error: any) {
      // Exibir mensagem de erro real do Edge Function
      const errorMessage = error?.message || 'Erro ao cadastrar funcionário';
      console.error('[Funcionarios] Error:', errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (employeeId: string) => {
    if (!confirm('Tem certeza que deseja excluir este funcionário?')) return;

    try {
      const { data, error } = await invokeEdgeFunction('company-operations', {
        body: {
          operation: 'delete-employee',
          employee_id: employeeId,
          company_cnpj: company?.cnpj
        }
      });
      if (error) throw error;

      toast.success('Funcionário excluído');
      loadEmployees();
    } catch (error) {
      toast.error('Erro ao excluir funcionário');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!company) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Button variant="ghost" onClick={() => navigate('/empresa')} className="mb-2">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <h1 className="text-3xl font-bold">Gerenciar Funcionários</h1>
              <p className="text-muted-foreground">
                Cadastre funcionários com acesso ao plano de saúde
              </p>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setBulkInviteOpen(true)}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Importar Lista
              </Button>
              <Button onClick={() => setShowForm(!showForm)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Funcionário
              </Button>
            </div>
          </div>

          {showForm && cadastroMode === 'convite' && (
            <Card>
              <CardHeader>
                <CardTitle>Convidar Funcionário</CardTitle>
                <CardDescription>
                  O funcionário receberá um email e completará seu próprio cadastro
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleInvite} className="space-y-4">
                  <div>
                    <Label htmlFor="invite-email">E-mail do Funcionário *</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="funcionario@exemplo.com"
                      required
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      O funcionário receberá um link para completar seu cadastro e o plano será ativado automaticamente.
                    </p>
                  </div>
                  
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? 'Enviando convite...' : 'Enviar Convite'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {pendingInvites.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Convites Pendentes ({pendingInvites.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Enviado em</TableHead>
                      <TableHead>Expira em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingInvites.map((invite) => (
                      <TableRow key={invite.id}>
                        <TableCell>{invite.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">Aguardando</Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(invite.invited_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          {new Date(invite.expires_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {showForm && cadastroMode === 'completo' && (
            <Card>
              <CardHeader>
                <CardTitle>Cadastrar Funcionário</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="nome">Nome Completo *</Label>
                      <Input
                        id="nome"
                        value={formData.nome}
                        onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="cpf">CPF *</Label>
                      <Input
                        id="cpf"
                        value={formData.cpf}
                        onChange={(e) => setFormData(prev => ({ ...prev, cpf: e.target.value }))}
                        placeholder="000.000.000-00"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email">E-mail *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>

                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                    <p className="text-sm text-blue-700">
                      <strong>ℹ️ Senha de Acesso:</strong> O funcionário receberá um email com link para criar sua própria senha. Ele poderá acessar sua área através de <strong>/area-do-paciente</strong> usando o mesmo login de pacientes.
                    </p>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="datanascimento">Data de Nascimento *</Label>
                      <Input
                        id="datanascimento"
                        type="date"
                        value={formData.datanascimento}
                        onChange={(e) => setFormData(prev => ({ ...prev, datanascimento: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="sexo">Sexo *</Label>
                      <Select value={formData.sexo} onValueChange={(value) => setFormData(prev => ({ ...prev, sexo: value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">Masculino</SelectItem>
                          <SelectItem value="F">Feminino</SelectItem>
                          <SelectItem value="O">Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="telefone">Telefone *</Label>
                      <Input
                        id="telefone"
                        value={formData.telefone}
                        onChange={(e) => setFormData(prev => ({ ...prev, telefone: e.target.value }))}
                        placeholder="(11) 99999-9999"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="foto">Foto (opcional)</Label>
                    <div className="flex items-center gap-4">
                      <Input
                        id="foto"
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="flex-1"
                      />
                      {photoPreview && (
                        <img src={photoPreview} alt="Preview" className="h-16 w-16 object-cover rounded" />
                      )}
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="font-medium mb-3">Endereço</h3>
                    <div className="grid md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="cep">CEP *</Label>
                        <Input
                          id="cep"
                          value={formData.cep}
                          onChange={(e) => setFormData(prev => ({ ...prev, cep: e.target.value }))}
                          onBlur={() => fetchAddressByCEP(formData.cep)}
                          disabled={loadingCEP}
                          placeholder="00000-000"
                          required
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label htmlFor="logradouro">Logradouro *</Label>
                        <Input
                          id="logradouro"
                          value={formData.logradouro}
                          onChange={(e) => setFormData(prev => ({ ...prev, logradouro: e.target.value }))}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <Label htmlFor="numero">Número *</Label>
                        <Input
                          id="numero"
                          value={formData.numero}
                          onChange={(e) => setFormData(prev => ({ ...prev, numero: e.target.value }))}
                          required
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
                      <div>
                        <Label htmlFor="bairro">Bairro *</Label>
                        <Input
                          id="bairro"
                          value={formData.bairro}
                          onChange={(e) => setFormData(prev => ({ ...prev, bairro: e.target.value }))}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="cidade">Cidade *</Label>
                        <Input
                          id="cidade"
                          value={formData.cidade}
                          onChange={(e) => setFormData(prev => ({ ...prev, cidade: e.target.value }))}
                          required
                        />
                      </div>
                    </div>

                    <div className="mt-4">
                      <Label htmlFor="estado">Estado *</Label>
                      <Select value={formData.estado} onValueChange={(value) => setFormData(prev => ({ ...prev, estado: value }))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {brazilianStates.map(uf => (
                            <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={loading}>
                      {loading ? 'Cadastrando...' : 'Cadastrar Funcionário'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Funcionários Cadastrados ({employees.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {employees.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum funcionário cadastrado
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Cadastrado em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((employee) => (
                      <TableRow key={employee.id}>
                        <TableCell>{employee.first_name} {employee.last_name}</TableCell>
                        <TableCell className="font-mono">{employee.cpf}</TableCell>
                        <TableCell>{employee.email}</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell>{new Date(employee.created_at).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(employee.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <BulkInviteModal
        open={bulkInviteOpen}
        onClose={() => setBulkInviteOpen(false)}
        companyId={company?.id || ''}
        onComplete={() => {
          loadPendingInvites();
          loadEmployees();
        }}
      />
    </div>
  );
}
