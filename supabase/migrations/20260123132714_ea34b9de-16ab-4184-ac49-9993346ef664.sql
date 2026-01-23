-- Adicionar coluna para SKUs permitidos (array de texto)
ALTER TABLE public.user_coupons
ADD COLUMN allowed_skus text[] DEFAULT NULL;

-- Comentário explicativo
COMMENT ON COLUMN public.user_coupons.allowed_skus IS 
  'Lista de SKUs para os quais este cupom é válido. NULL = qualquer serviço/plano do tipo especificado.';