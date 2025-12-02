-- Criar tabela de auditoria para cadastros ClickLife
CREATE TABLE public.clicklife_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_email TEXT NOT NULL,
  patient_cpf TEXT,
  patient_name TEXT,
  appointment_id TEXT,
  order_id TEXT,
  payment_id TEXT,
  sku TEXT,
  service_name TEXT,
  clicklife_empresa_id INTEGER,
  clicklife_plano_id INTEGER,
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  response_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para consultas frequentes
CREATE INDEX idx_clicklife_registrations_email ON public.clicklife_registrations(patient_email);
CREATE INDEX idx_clicklife_registrations_created_at ON public.clicklife_registrations(created_at DESC);
CREATE INDEX idx_clicklife_registrations_success ON public.clicklife_registrations(success);
CREATE INDEX idx_clicklife_registrations_order_id ON public.clicklife_registrations(order_id);

-- Habilitar RLS
ALTER TABLE public.clicklife_registrations ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem ver os registros de auditoria
CREATE POLICY "Only admins can view clicklife_registrations"
ON public.clicklife_registrations
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role tem acesso total (para edge functions)
CREATE POLICY "Service role has full access to clicklife_registrations"
ON public.clicklife_registrations
FOR ALL
USING (true)
WITH CHECK (true);