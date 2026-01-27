-- Tabela para armazenar assinaturas recorrentes do Mercado Pago
CREATE TABLE public.patient_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NULL,
  email TEXT NULL,
  mp_subscription_id TEXT NOT NULL UNIQUE,
  mp_status TEXT DEFAULT 'pending',
  plan_code TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  frequency INTEGER DEFAULT 1,
  frequency_type TEXT DEFAULT 'months',
  next_payment_date TIMESTAMP WITH TIME ZONE NULL,
  last_payment_date TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Adicionar coluna subscription_id na tabela patient_plans para vincular à subscription
ALTER TABLE public.patient_plans 
ADD COLUMN IF NOT EXISTS subscription_id UUID NULL REFERENCES public.patient_subscriptions(id),
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;

-- Criar índices para performance
CREATE INDEX idx_patient_subscriptions_email ON public.patient_subscriptions(email);
CREATE INDEX idx_patient_subscriptions_mp_id ON public.patient_subscriptions(mp_subscription_id);
CREATE INDEX idx_patient_plans_subscription ON public.patient_plans(subscription_id);

-- Habilitar RLS
ALTER TABLE public.patient_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policies para patient_subscriptions
CREATE POLICY "Users can view own subscriptions"
ON public.patient_subscriptions FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Admins can manage all subscriptions"
ON public.patient_subscriptions FOR ALL
USING (is_admin());

CREATE POLICY "Anon can read subscriptions for admin"
ON public.patient_subscriptions FOR SELECT
USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_patient_subscriptions_updated_at
BEFORE UPDATE ON public.patient_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();