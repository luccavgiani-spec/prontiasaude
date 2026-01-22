-- Adicionar colunas faltantes na tabela company_employees
-- Estas colunas são necessárias para o cadastro completo de funcionários

ALTER TABLE public.company_employees
ADD COLUMN IF NOT EXISTS user_id UUID,
ADD COLUMN IF NOT EXISTS nome TEXT,
ADD COLUMN IF NOT EXISTS telefone TEXT,
ADD COLUMN IF NOT EXISTS datanascimento DATE,
ADD COLUMN IF NOT EXISTS sexo TEXT,
ADD COLUMN IF NOT EXISTS fotobase64 TEXT,
ADD COLUMN IF NOT EXISTS logradouro TEXT,
ADD COLUMN IF NOT EXISTS numero TEXT,
ADD COLUMN IF NOT EXISTS complemento TEXT,
ADD COLUMN IF NOT EXISTS bairro TEXT,
ADD COLUMN IF NOT EXISTS cep TEXT,
ADD COLUMN IF NOT EXISTS cidade TEXT,
ADD COLUMN IF NOT EXISTS estado TEXT,
ADD COLUMN IF NOT EXISTS empresa_id_externo INTEGER,
ADD COLUMN IF NOT EXISTS plano_id_externo INTEGER,
ADD COLUMN IF NOT EXISTS has_active_plan BOOLEAN DEFAULT FALSE;

-- Criar índice para busca por user_id
CREATE INDEX IF NOT EXISTS idx_company_employees_user_id ON public.company_employees(user_id);