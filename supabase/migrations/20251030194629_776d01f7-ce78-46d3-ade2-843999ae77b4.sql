-- Adicionar campos para controle ClubeBen na tabela patients
ALTER TABLE public.patients
ADD COLUMN IF NOT EXISTS clubeben_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS clubeben_last_sync TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS clubeben_retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS status_email INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS status_sms INTEGER DEFAULT 1;

-- Comentários para documentação
COMMENT ON COLUMN public.patients.clubeben_status IS 'Status da integração: pending, active, error';
COMMENT ON COLUMN public.patients.clubeben_last_sync IS 'Última tentativa de sincronização com ClubeBen';
COMMENT ON COLUMN public.patients.clubeben_retry_count IS 'Contador de retentativas (max 3)';
COMMENT ON COLUMN public.patients.status_email IS '1=aceita emails, 0=não aceita';
COMMENT ON COLUMN public.patients.status_sms IS '1=aceita SMS, 0=não aceita';