-- Adicionar colunas para rastrear cadastros ClickLife e Communicare
ALTER TABLE patients 
ADD COLUMN IF NOT EXISTS clicklife_registered_at timestamptz,
ADD COLUMN IF NOT EXISTS communicare_registered_at timestamptz,
ADD COLUMN IF NOT EXISTS communicare_patient_id text;