import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

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
  status: string;
  created_at: string;
  updated_at: string;
}

interface CompanyAuthState {
  company: Company | null;
  loading: boolean;
  mustChangePassword: boolean;
}

export const useCompanyAuth = (): CompanyAuthState => {
  const [state, setState] = useState<CompanyAuthState>({
    company: null,
    loading: true,
    mustChangePassword: false,
  });
  const navigate = useNavigate();

  useEffect(() => {
    const checkCompanyAuth = async () => {
      try {
        // Verificar sessão
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          navigate('/empresa/login');
          return;
        }

        // Verificar se tem role 'company'
        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .eq('role', 'company')
          .maybeSingle();

        if (!roleData) {
          await supabase.auth.signOut();
          navigate('/empresa/login');
          return;
        }

        // Carregar credentials
        const { data: credData } = await supabase
          .from('company_credentials')
          .select('company_id, must_change_password')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (!credData) {
          await supabase.auth.signOut();
          navigate('/empresa/login');
          return;
        }

        // Verificar se a senha acabou de ser alterada (evita race condition)
        const justChanged = sessionStorage.getItem('password_just_changed');
        if (justChanged === 'true') {
          sessionStorage.removeItem('password_just_changed');
          // Não redirecionar - senha acabou de ser trocada, aguardar DB sync
        } else if (credData.must_change_password && !window.location.pathname.includes('/trocar-senha')) {
          // Se precisa trocar senha e não está na página de trocar senha, redirecionar
          navigate('/empresa/trocar-senha');
          return;
        }

        // Carregar dados da empresa
        const { data: companyData } = await supabase
          .from('companies')
          .select('*')
          .eq('id', credData.company_id)
          .single();

        if (!companyData) {
          await supabase.auth.signOut();
          navigate('/empresa/login');
          return;
        }

        setState({
          company: companyData as Company,
          loading: false,
          mustChangePassword: credData.must_change_password,
        });

      } catch (error) {
        console.error('Error checking company auth:', error);
        navigate('/empresa/login');
      }
    };

    checkCompanyAuth();
  }, [navigate]);

  return state;
};
