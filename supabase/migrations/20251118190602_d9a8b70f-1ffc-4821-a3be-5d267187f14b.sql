-- Adicionar coluna para identificar cupons administrativos
ALTER TABLE user_coupons 
ADD COLUMN is_admin_coupon BOOLEAN NOT NULL DEFAULT false;

-- Marcar cupons existentes que começam com 'ADMIN_' como administrativos
UPDATE user_coupons 
SET is_admin_coupon = true 
WHERE code LIKE 'ADMIN_%';

-- Criar índice para performance
CREATE INDEX idx_user_coupons_admin ON user_coupons(is_admin_coupon) 
WHERE is_admin_coupon = true;

-- Remover constraint antiga que impedia múltiplos cupons do mesmo tipo
ALTER TABLE user_coupons 
DROP CONSTRAINT IF EXISTS unique_user_coupon_type;

-- Criar nova constraint que NÃO aplica a cupons administrativos
-- Permite múltiplos cupons admin, mas limita pacientes a 1 de cada tipo
CREATE UNIQUE INDEX unique_user_coupon_type_non_admin 
ON user_coupons (owner_user_id, coupon_type) 
WHERE is_admin_coupon = false;

-- Comentário explicativo
COMMENT ON COLUMN user_coupons.is_admin_coupon IS 'Identifica cupons criados por administradores. Cupons admin não têm limite de quantidade e podem ter até 100% de desconto.';