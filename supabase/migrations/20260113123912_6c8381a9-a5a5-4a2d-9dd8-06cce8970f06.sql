-- Primeiro, remover duplicatas mantendo o registro mais recente com profile_complete = true
DELETE FROM patients p1
USING patients p2
WHERE p1.user_id = p2.user_id 
  AND p1.user_id IS NOT NULL
  AND p1.id != p2.id
  AND (
    (p2.profile_complete = true AND (p1.profile_complete = false OR p1.profile_complete IS NULL))
    OR (p2.profile_complete = p1.profile_complete AND p2.updated_at > p1.updated_at)
  );

-- Adicionar UNIQUE constraint na coluna user_id
ALTER TABLE patients 
ADD CONSTRAINT patients_user_id_unique UNIQUE (user_id);