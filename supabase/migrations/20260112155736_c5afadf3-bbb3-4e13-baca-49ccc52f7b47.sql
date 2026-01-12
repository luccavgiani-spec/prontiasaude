-- Fase 1: Adicionar colunas faltantes para corrigir erros de build

-- 1. Adicionar colunas em services
ALTER TABLE services ADD COLUMN IF NOT EXISTS price_cents integer;

-- 2. Adicionar colunas em company_credentials
ALTER TABLE company_credentials ADD COLUMN IF NOT EXISTS must_change_password boolean DEFAULT true;

-- 3. Adicionar colunas em appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS redirect_url text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS order_id text;

-- 4. Adicionar colunas em admin_content para blog/livros
ALTER TABLE admin_content ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE admin_content ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE admin_content ADD COLUMN IF NOT EXISTS content_type text;
ALTER TABLE admin_content ADD COLUMN IF NOT EXISTS url text;
ALTER TABLE admin_content ADD COLUMN IF NOT EXISTS external_link text;
ALTER TABLE admin_content ADD COLUMN IF NOT EXISTS file_url text;
ALTER TABLE admin_content ADD COLUMN IF NOT EXISTS destination text;
ALTER TABLE admin_content ADD COLUMN IF NOT EXISTS blog_category text;

-- 5. Índices para performance
CREATE INDEX IF NOT EXISTS idx_appointments_order_id ON appointments(order_id);
CREATE INDEX IF NOT EXISTS idx_appointments_redirect_url ON appointments(redirect_url) WHERE redirect_url IS NOT NULL;