import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useCompanyAuth } from '@/hooks/useCompanyAuth';
import { Building2, User, Lock, HelpCircle, LogOut, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatCNPJ } from '@/lib/validations';
import ConvitesManagement from '@/components/empresa/ConvitesManagement';
export default function EmpresaDashboard() {
  const {
    company,
    loading
  } = useCompanyAuth();
  const navigate = useNavigate();
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/empresa/login');
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>;
  }
  if (!company) {
    return null;
  }
  return <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary" />
            <div>
              <h1 className="font-semibold">{company.razao_social}</h1>
              <p className="text-sm text-muted-foreground font-mono">{formatCNPJ(company.cnpj)}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-2">Bem-vindo(a)</h2>
            <p className="text-muted-foreground">
              Gerencie as informações da sua empresa e configurações de segurança.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Meu Perfil */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/empresa/perfil')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Meu Perfil
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Edite as informações cadastrais da empresa, endereço e dados de contato.
                </p>
              </CardContent>
            </Card>

            {/* Segurança */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/empresa/seguranca')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  Segurança
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Altere sua senha de acesso e gerencie configurações de segurança.
                </p>
              </CardContent>
            </Card>

            {/* Funcionários */}
            <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/empresa/funcionarios')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Gerenciar Funcionários
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Cadastre funcionários com acesso ao plano de saúde.
                </p>
              </CardContent>
            </Card>

            {/* Suporte */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-primary" />
                  Suporte
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Precisa de ajuda? Entre em contato com nosso suporte:
                </p>
                <ul className="text-sm space-y-2">
                  <li>📧 Email: suporte@prontiasaude.com.br</li>
                  <li>📞 Telefone: (11) 93335-9187</li>
                  <li>💬 Horário de atendimento: Segunda a Sexta, 9h às 18h</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Seção de Convites Inline */}
          <div className="mt-12 space-y-6">
            <div className="border-b pb-4">
              <h2 className="text-2xl font-bold text-foreground">
                📧 Convites de Funcionários
              </h2>
              <p className="text-muted-foreground mt-1">
                Acompanhe o status dos convites enviados e gerencie pendências
              </p>
            </div>
            
            <ConvitesManagement companyId={company.id} companyName={company.razao_social} />
          </div>
        </div>
      </div>
    </div>;
}