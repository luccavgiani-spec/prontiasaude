-- FASE 1: Adicionar campos faltantes na tabela patients
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('M', 'F', 'I', '')),
  ADD COLUMN IF NOT EXISTS cep text,
  ADD COLUMN IF NOT EXISTS address_number text,
  ADD COLUMN IF NOT EXISTS address_complement text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'site';

-- Comentários para documentação
COMMENT ON COLUMN public.patients.gender IS 'Gênero: M (Masculino), F (Feminino), I (Indefinido)';
COMMENT ON COLUMN public.patients.cep IS 'CEP - 8 dígitos sem máscara';
COMMENT ON COLUMN public.patients.address_number IS 'Número do endereço';
COMMENT ON COLUMN public.patients.address_complement IS 'Complemento do endereço (opcional)';
COMMENT ON COLUMN public.patients.city IS 'Cidade';
COMMENT ON COLUMN public.patients.state IS 'UF - Estado brasileiro';
COMMENT ON COLUMN public.patients.source IS 'Origem do cadastro (site, app, etc)';