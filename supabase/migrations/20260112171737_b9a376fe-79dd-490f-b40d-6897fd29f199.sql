-- Adicionar colunas faltantes em pending_payments
ALTER TABLE pending_payments 
ADD COLUMN IF NOT EXISTS amount_original numeric,
ADD COLUMN IF NOT EXISTS discount_percent numeric;

-- Adicionar colunas faltantes em coupon_uses
ALTER TABLE coupon_uses
ADD COLUMN IF NOT EXISTS order_id text;