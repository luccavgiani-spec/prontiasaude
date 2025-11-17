-- Adicionar colunas para controle de revisão em coupon_uses
ALTER TABLE public.coupon_uses
ADD COLUMN reviewed BOOLEAN DEFAULT FALSE,
ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN reviewed_by UUID REFERENCES auth.users(id);

-- Criar índice para otimizar queries de cupons conferidos/não conferidos
CREATE INDEX idx_coupon_uses_reviewed ON public.coupon_uses(reviewed);

-- Comentários para documentação
COMMENT ON COLUMN public.coupon_uses.reviewed IS 'Indica se o cupom utilizado foi conferido/analisado pelo admin';
COMMENT ON COLUMN public.coupon_uses.reviewed_at IS 'Data e hora em que o cupom foi marcado como conferido';
COMMENT ON COLUMN public.coupon_uses.reviewed_by IS 'ID do admin que marcou o cupom como conferido';