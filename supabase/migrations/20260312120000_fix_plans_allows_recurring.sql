-- Corrigir allows_recurring para todos os planos IND_*/FAM_*
-- Planos semestrais (6M) e anuais (12M) estavam com allows_recurring=false,
-- mas todos os planos devem ter recorrência habilitada.

UPDATE services
SET allows_recurring = true
WHERE sku LIKE 'IND_%' OR sku LIKE 'FAM_%';
