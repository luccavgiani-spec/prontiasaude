-- =====================================================
-- SCRIPT: Limpeza de Appointments Duplicados
-- Data: 2026-01-05
-- Mantém: O primeiro registro (created_at mais antigo)
-- Remove: Todos os registros duplicados subsequentes
-- =====================================================

-- Deletar duplicatas mantendo o primeiro registro
DELETE FROM appointments 
WHERE id IN (
  SELECT id 
  FROM (
    SELECT 
      id,
      order_id,
      ROW_NUMBER() OVER (
        PARTITION BY order_id 
        ORDER BY created_at ASC
      ) as row_num
    FROM appointments
    WHERE order_id IS NOT NULL
  ) ranked
  WHERE row_num > 1
);

-- Criar índice único para prevenir duplicatas futuras
CREATE UNIQUE INDEX IF NOT EXISTS appointments_order_id_unique 
ON appointments (order_id) 
WHERE order_id IS NOT NULL;