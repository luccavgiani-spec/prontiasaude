import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useCompanyAuth } from '@/hooks/useCompanyAuth';
import { ArrowLeft } from 'lucide-react';
import ConvitesManagement from '@/components/empresa/ConvitesManagement';

export default function EmpresaConvites() {
  const { company, loading } = useCompanyAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  if (!company) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      <div className="container mx-auto px-4 py-8">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/empresa')} 
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        
        <h1 className="text-3xl font-bold mb-2">Convites de Funcionários</h1>
        <p className="text-muted-foreground mb-8">
          Acompanhe o status dos convites enviados
        </p>
        
        <ConvitesManagement 
          companyId={company.id} 
          companyName={company.razao_social}
        />
      </div>
    </div>
  );
}
