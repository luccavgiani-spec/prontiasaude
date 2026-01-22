-- Correção de dados históricos: Atualizar pending_payments que têm appointments correspondentes
-- mas que ainda estão marcadas como pending ou não processadas

-- 1. Atualizar pending_payments que têm appointment com order_id correspondente
UPDATE pending_payments 
SET 
  status = 'approved', 
  processed = true, 
  processed_at = COALESCE(processed_at, now())
WHERE order_id IN (
  SELECT DISTINCT a.order_id 
  FROM appointments a
  WHERE a.order_id IS NOT NULL
)
AND (status = 'pending' OR processed = false);

-- 2. Atualizar pending_payments que têm patient_plans com plano ativo correspondente ao email
UPDATE pending_payments pp
SET 
  status = 'approved', 
  processed = true, 
  processed_at = COALESCE(pp.processed_at, now())
FROM patient_plans pl
WHERE pp.patient_email = pl.email
AND pp.sku = pl.plan_code
AND pl.status = 'active'
AND (pp.status = 'pending' OR pp.processed = false);