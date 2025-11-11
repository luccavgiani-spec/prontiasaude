-- Criar tabela sso_tokens para armazenar tokens de SSO ClickLife
CREATE TABLE IF NOT EXISTS public.sso_tokens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  jti TEXT NOT NULL UNIQUE,
  patient_id UUID NOT NULL,
  phone_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_sso_tokens_jti ON public.sso_tokens(jti);
CREATE INDEX idx_sso_tokens_patient_id ON public.sso_tokens(patient_id);
CREATE INDEX idx_sso_tokens_expires_at ON public.sso_tokens(expires_at);

-- RLS (permitir operações via service_role apenas)
ALTER TABLE public.sso_tokens ENABLE ROW LEVEL SECURITY;

-- Policy para service_role (usado nas edge functions)
CREATE POLICY "Service role has full access to sso_tokens"
  ON public.sso_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Índice para limpeza automática de tokens expirados
CREATE INDEX idx_sso_tokens_cleanup ON public.sso_tokens(expires_at) WHERE used_at IS NULL;

COMMENT ON TABLE public.sso_tokens IS 'Armazena tokens SSO de uso único para autenticação ClickLife';
COMMENT ON COLUMN public.sso_tokens.jti IS 'JWT ID único para cada token SSO';
COMMENT ON COLUMN public.sso_tokens.used_at IS 'Timestamp de quando o token foi usado (single-use)';