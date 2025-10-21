-- ============================================
-- MIGRATION 1: Tabela company_employees
-- ============================================

CREATE TABLE IF NOT EXISTS public.company_employees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cpf text NOT NULL,
  email text NOT NULL,
  telefone text NOT NULL,
  senha text NOT NULL,
  datanascimento text NOT NULL,
  sexo text NOT NULL CHECK (sexo IN ('M', 'F', 'O')),
  fotobase64 text,
  logradouro text NOT NULL,
  numero text NOT NULL,
  complemento text,
  bairro text NOT NULL,
  cep text NOT NULL,
  cidade text NOT NULL,
  estado text NOT NULL,
  empresa_id_externo integer NOT NULL DEFAULT 9083,
  plano_id_externo integer NOT NULL DEFAULT 864,
  has_active_plan boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(cpf)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_company_employees_company_id ON public.company_employees(company_id);
CREATE INDEX IF NOT EXISTS idx_company_employees_cpf ON public.company_employees(cpf);
CREATE INDEX IF NOT EXISTS idx_company_employees_has_active_plan ON public.company_employees(has_active_plan);

-- Enable RLS
ALTER TABLE public.company_employees ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all employees"
ON public.company_employees
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Companies can view their own employees"
ON public.company_employees
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM company_credentials
    WHERE company_credentials.user_id = auth.uid()
      AND company_credentials.company_id = company_employees.company_id
  )
);

CREATE POLICY "Companies can insert their own employees"
ON public.company_employees
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM company_credentials
    WHERE company_credentials.user_id = auth.uid()
      AND company_credentials.company_id = company_employees.company_id
  )
);

CREATE POLICY "Companies can update their own employees"
ON public.company_employees
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM company_credentials
    WHERE company_credentials.user_id = auth.uid()
      AND company_credentials.company_id = company_employees.company_id
  )
);

CREATE POLICY "Companies can delete their own employees"
ON public.company_employees
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM company_credentials
    WHERE company_credentials.user_id = auth.uid()
      AND company_credentials.company_id = company_employees.company_id
  )
);

-- Trigger para updated_at
CREATE TRIGGER update_company_employees_updated_at
BEFORE UPDATE ON public.company_employees
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- MIGRATION 2: Adicionar campos em companies
-- ============================================

ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS empresa_id_externo integer NOT NULL DEFAULT 9083,
ADD COLUMN IF NOT EXISTS plano_id_externo integer NOT NULL DEFAULT 864;

-- ============================================
-- MIGRATION 3: Tabela metrics
-- ============================================

CREATE TABLE IF NOT EXISTS public.metrics (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_type text NOT NULL CHECK (metric_type IN ('sale', 'appointment', 'registration')),
  amount_cents integer,
  plan_code text,
  specialty text,
  platform text CHECK (platform IN ('clicklife', 'communicare')),
  status text,
  patient_email text,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  metadata jsonb,
  created_at timestamp with time zone DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_metrics_type ON public.metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_metrics_created_at ON public.metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_metrics_platform ON public.metrics(platform);
CREATE INDEX IF NOT EXISTS idx_metrics_company_id ON public.metrics(company_id);

-- Enable RLS
ALTER TABLE public.metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Only admins can manage metrics"
ON public.metrics
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));