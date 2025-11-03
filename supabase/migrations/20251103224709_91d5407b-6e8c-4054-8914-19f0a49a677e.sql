-- Criar tabela para tracking de pagamentos PIX pending
CREATE TABLE IF NOT EXISTS public.pending_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id TEXT NOT NULL,
  order_id TEXT,
  email TEXT NOT NULL,
  status TEXT NOT NULL,
  sku TEXT,
  amount_cents INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ
);

-- Index para busca rápida por order_id e payment_id
CREATE INDEX IF NOT EXISTS idx_pending_payments_order_id ON public.pending_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_pending_payments_payment_id ON public.pending_payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_pending_payments_processed ON public.pending_payments(processed) WHERE processed = false;

-- RLS policies
ALTER TABLE public.pending_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage pending payments"
  ON public.pending_payments
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own pending payments"
  ON public.pending_payments
  FOR SELECT
  USING (email = current_user_email());
