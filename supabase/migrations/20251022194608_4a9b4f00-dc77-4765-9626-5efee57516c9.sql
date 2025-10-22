-- =====================================================
-- PROBLEMA 1: Migrar senhas para Supabase Auth
-- =====================================================

-- Remover coluna senha (plaintext - CRÍTICO)
ALTER TABLE public.company_employees DROP COLUMN IF EXISTS senha;

-- Adicionar coluna user_id para vincular com auth.users
ALTER TABLE public.company_employees 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_company_employees_user_id 
ON public.company_employees(user_id);

-- Atualizar RLS: Funcionários podem ver próprio registro
DROP POLICY IF EXISTS "Employees can view their own record" ON public.company_employees;

CREATE POLICY "Employees can view their own record"
  ON public.company_employees
  FOR SELECT
  USING (auth.uid() = user_id);

-- =====================================================
-- PROBLEMA 2: Server-Side Price Validation
-- =====================================================

-- Criar tabela de serviços (source of truth para preços)
CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL UNIQUE,
  name text NOT NULL,
  price_cents integer NOT NULL, -- Preço em centavos
  allows_recurring boolean DEFAULT false,
  recurring_frequency integer,
  recurring_frequency_type text CHECK (recurring_frequency_type IN ('days', 'months')),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_services_sku ON public.services(sku);
CREATE INDEX IF NOT EXISTS idx_services_active ON public.services(active);

-- RLS: Público pode ler serviços ativos, apenas admin pode modificar
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active services"
  ON public.services FOR SELECT
  USING (active = true);

CREATE POLICY "Only admins can manage services"
  ON public.services FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Trigger para atualizar updated_at
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Popular tabela com serviços existentes
INSERT INTO public.services (sku, name, price_cents, allows_recurring) VALUES
  ('ITC6534', 'Clínico Geral', 4390, false),
  ('ZXW2165', 'Psicólogo - 1 sessão', 4490, false),
  ('HXR8516', 'Psicólogo - 4 sessões', 17196, false),
  ('YME9025', 'Psicólogo - 8 sessões', 30792, false),
  ('BIR7668', 'Personal Trainer', 5499, false),
  ('VPN5132', 'Nutricionista', 5990, false),
  ('TQP5720', 'Cardiologista', 8990, false),
  ('HGG3503', 'Dermatologista', 8990, false),
  ('VHH8883', 'Endocrinologista', 8990, false),
  ('TSB0751', 'Gastroenterologista', 8990, false),
  ('CCP1566', 'Ginecologista', 8990, false),
  ('FKS5964', 'Oftalmologista', 8990, false),
  ('TVQ5046', 'Ortopedista', 8990, false),
  ('HMG9544', 'Pediatra', 8990, false),
  ('HME8366', 'Otorrinolaringologista', 8990, false),
  ('DYY8522', 'Médico da Família', 8990, false),
  ('QOP1101', 'Psiquiatra', 8990, false),
  ('LZF3879', 'Nutrólogo', 11990, false),
  ('YZD9932', 'Geriatria', 11990, false),
  ('UDH3250', 'Reumatologista', 12990, false),
  ('PKS9388', 'Neurologista', 12990, false),
  ('MYX5186', 'Infectologista', 12990, false),
  ('OVM9892', 'Laudos Psicológicos', 11990, false),
  ('RZP5755', 'Renovação de Receitas', 3490, false),
  ('ULT3571', 'Solicitação de Exames', 3490, false)
ON CONFLICT (sku) DO NOTHING;