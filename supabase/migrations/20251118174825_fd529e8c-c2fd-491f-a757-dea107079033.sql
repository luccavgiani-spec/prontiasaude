-- Atualizar todos os cupons de serviços existentes para 5% de desconto
UPDATE user_coupons
SET 
  discount_percentage = 5,
  updated_at = now()
WHERE 
  coupon_type = 'SERVICE' 
  AND discount_percentage = 10
  AND is_active = true;

-- Atualizar todos os cupons de planos existentes para 5% de desconto
UPDATE user_coupons
SET 
  discount_percentage = 5,
  updated_at = now()
WHERE 
  coupon_type = 'PLAN' 
  AND discount_percentage IN (10, 15)
  AND is_active = true;