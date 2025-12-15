-- Criar cupom BEMVINDO10 (10% desconto na primeira consulta)
-- Nota: owner_user_id precisa ser um UUID válido, usamos um UUID de admin fixo
INSERT INTO public.user_coupons (
  code,
  coupon_type,
  discount_percentage,
  is_active,
  is_admin_coupon,
  owner_user_id,
  pix_key
)
SELECT 
  'BEMVINDO10',
  'SERVICE',
  10,
  true,
  true,
  id,
  null
FROM auth.users 
WHERE email = 'admin@prontiasaude.com.br'
LIMIT 1
ON CONFLICT (code) DO NOTHING;