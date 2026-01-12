-- Adicionar coluna manychat_contact_id para compatibilidade com dados antigos
ALTER TABLE patients ADD COLUMN IF NOT EXISTS manychat_contact_id text;

-- Criar índice para buscas eficientes
CREATE INDEX IF NOT EXISTS idx_patients_manychat ON patients(manychat_contact_id);