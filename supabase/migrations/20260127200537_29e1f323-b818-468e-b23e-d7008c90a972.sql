-- ============================================================
-- CORREÇÃO: Race Condition de Appointments Duplicados
-- ============================================================
-- Adicionar índice único para order_id na tabela appointments
-- Isso impede que duas requisições paralelas (webhook + polling)
-- criem appointments duplicados para o mesmo pagamento.
-- ============================================================

-- Criar índice único para order_id (apenas se não nulo)
CREATE UNIQUE INDEX IF NOT EXISTS appointments_order_id_unique_idx 
ON appointments (order_id) 
WHERE order_id IS NOT NULL;