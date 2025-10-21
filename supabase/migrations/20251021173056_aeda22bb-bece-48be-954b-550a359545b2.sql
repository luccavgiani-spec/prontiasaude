-- Criar tabela companies (sem políticas que referenciam company_credentials ainda)
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social text NOT NULL,
  cnpj text UNIQUE NOT NULL,
  cep text NOT NULL,
  logradouro text,
  bairro text,
  cidade text,
  uf text,
  numero text,
  complemento text,
  n_funcionarios integer NOT NULL DEFAULT 1 CHECK (n_funcionarios >= 1),
  contato_nome text,
  contato_email text,
  contato_telefone text,
  status text NOT NULL DEFAULT 'ATIVA' CHECK (status IN ('ATIVA', 'INATIVA')),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para companies
CREATE INDEX idx_companies_cnpj ON public.companies(cnpj);
CREATE INDEX idx_companies_status ON public.companies(status);

-- RLS para companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Política temporária para admins (enquanto não temos company_credentials)
CREATE POLICY "Admins can manage all companies"
  ON public.companies
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger para updated_at
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Criar tabela company_credentials
CREATE TABLE public.company_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  must_change_password boolean NOT NULL DEFAULT true,
  failed_login_attempts integer NOT NULL DEFAULT 0,
  last_failed_login_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id),
  UNIQUE(user_id)
);

-- Índices para company_credentials
CREATE INDEX idx_company_credentials_company_id ON public.company_credentials(company_id);
CREATE INDEX idx_company_credentials_user_id ON public.company_credentials(user_id);

-- RLS para company_credentials
ALTER TABLE public.company_credentials ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para company_credentials
CREATE POLICY "Admins can manage all credentials"
  ON public.company_credentials
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Companies can view their own credentials"
  ON public.company_credentials
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Companies can update their own credentials"
  ON public.company_credentials
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Trigger para updated_at
CREATE TRIGGER update_company_credentials_updated_at
  BEFORE UPDATE ON public.company_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Agora adicionar as políticas de companies que referenciam company_credentials
CREATE POLICY "Companies can view their own record"
  ON public.companies
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'company'
    )
    AND id IN (
      SELECT company_id FROM public.company_credentials
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );

CREATE POLICY "Companies can update their own record"
  ON public.companies
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = 'company'
    )
    AND id IN (
      SELECT company_id FROM public.company_credentials
      WHERE user_id = auth.uid()
      LIMIT 1
    )
  );