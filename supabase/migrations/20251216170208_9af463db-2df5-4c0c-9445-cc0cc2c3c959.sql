-- Remover registros duplicados da tabela appointments
-- Mantém apenas o primeiro registro de cada grupo (email + service_name criados em menos de 120 segundos)
DELETE FROM appointments
WHERE id IN (
  SELECT id FROM (
    SELECT 
      a1.id,
      ROW_NUMBER() OVER (
        PARTITION BY a1.email, a1.service_name 
        ORDER BY a1.created_at ASC
      ) as rn
    FROM appointments a1
    WHERE EXISTS (
      SELECT 1 FROM appointments a2 
      WHERE a2.email = a1.email 
        AND a2.service_name = a1.service_name
        AND a2.id != a1.id
        AND ABS(EXTRACT(EPOCH FROM (a2.created_at - a1.created_at))) < 120
    )
  ) duplicates
  WHERE rn > 1
);