-- ================================================
-- Tabela de Auditoria de Webhooks do Mercado Pago
-- ================================================
-- Esta tabela registra TODOS os webhooks recebidos,
-- mesmo os que falham no parsing ou processamento.
-- Isso permite rastrear 100% dos webhooks.

CREATE TABLE public.webhook_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at TIMESTAMPTZ DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'mercadopago',
  raw_body TEXT,
  parsed_payment_id TEXT,
  parsed_action TEXT,
  processing_status TEXT DEFAULT 'received',
  error_message TEXT,
  response_status INTEGER,
  processing_time_ms INTEGER
);

-- Índices para busca rápida
CREATE INDEX idx_webhook_audit_payment_id ON public.webhook_audit(parsed_payment_id);
CREATE INDEX idx_webhook_audit_received_at ON public.webhook_audit(received_at DESC);
CREATE INDEX idx_webhook_audit_status ON public.webhook_audit(processing_status);

-- Habilitar RLS (apenas service_role pode inserir/ler)
ALTER TABLE public.webhook_audit ENABLE ROW LEVEL SECURITY;

-- Policy: Admins podem ver auditorias (para debugging)
CREATE POLICY "Admins can view webhook audit" ON public.webhook_audit
  FOR SELECT USING (is_admin());

-- Comentário na tabela
COMMENT ON TABLE public.webhook_audit IS 'Registra todos os webhooks recebidos do Mercado Pago para auditoria e debugging';