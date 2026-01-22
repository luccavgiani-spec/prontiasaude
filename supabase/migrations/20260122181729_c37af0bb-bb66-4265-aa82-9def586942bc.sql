-- Adicionar colunas faltantes para rastreamento de login na tabela company_credentials
ALTER TABLE public.company_credentials
ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

COMMENT ON COLUMN public.company_credentials.failed_login_attempts IS 'Contador de tentativas de login falhadas';
COMMENT ON COLUMN public.company_credentials.last_failed_login_at IS 'Data/hora da última tentativa de login falhada';
COMMENT ON COLUMN public.company_credentials.last_login_at IS 'Data/hora do último login bem-sucedido';