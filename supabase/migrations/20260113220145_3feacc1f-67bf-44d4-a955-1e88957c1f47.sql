-- Adicionar colunas de deduplicação para evento CAPI purchase_confirmed
ALTER TABLE pending_payments 
  ADD COLUMN IF NOT EXISTS purchase_confirmed_sent BOOLEAN DEFAULT FALSE;

ALTER TABLE pending_payments 
  ADD COLUMN IF NOT EXISTS purchase_confirmed_event_id TEXT;

-- Criar índice para consultas de deduplicação
CREATE INDEX IF NOT EXISTS idx_pending_payments_purchase_confirmed 
  ON pending_payments(purchase_confirmed_sent) 
  WHERE purchase_confirmed_sent = TRUE;