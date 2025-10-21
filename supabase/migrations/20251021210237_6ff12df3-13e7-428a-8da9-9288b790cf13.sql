-- Criar tabela de planos de pacientes
CREATE TABLE IF NOT EXISTS public.patient_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  plan_code TEXT NOT NULL,
  plan_expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_patient_plans_email ON public.patient_plans(email);
CREATE INDEX IF NOT EXISTS idx_patient_plans_user_id ON public.patient_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_patient_plans_status ON public.patient_plans(status);

-- RLS Policies
ALTER TABLE public.patient_plans ENABLE ROW LEVEL SECURITY;

-- Usuários veem apenas seu próprio plano
CREATE POLICY "Users can view their own plan"
  ON public.patient_plans FOR SELECT
  USING (
    auth.uid() = user_id 
    OR 
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Apenas admins podem gerenciar planos
CREATE POLICY "Admins can manage all plans"
  ON public.patient_plans FOR ALL
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Trigger para updated_at
CREATE TRIGGER update_patient_plans_updated_at
  BEFORE UPDATE ON public.patient_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.patient_plans IS 'Armazena planos ativos de pacientes (substituindo App Script)';
