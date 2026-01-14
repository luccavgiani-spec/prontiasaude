
-- Tabela para armazenar tokens de recuperação de senha
CREATE TABLE public.password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index para busca rápida por token
CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens(token);

-- Index para limpeza de tokens expirados
CREATE INDEX idx_password_reset_tokens_expires ON public.password_reset_tokens(expires_at);

-- RLS: Ninguém pode acessar diretamente (apenas via Edge Functions)
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Não criar policies = ninguém acessa diretamente
COMMENT ON TABLE public.password_reset_tokens IS 'Tokens de recuperação de senha - acesso apenas via Edge Functions';
