-- Tabela user_coupons (cupons gerados pelos pacientes)
CREATE TABLE public.user_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  coupon_type TEXT NOT NULL CHECK (coupon_type IN ('SERVICE', 'PLAN')),
  discount_percentage NUMERIC NOT NULL DEFAULT 10,
  pix_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT unique_user_coupon_type UNIQUE (owner_user_id, coupon_type)
);

-- Índices para performance
CREATE INDEX idx_user_coupons_code ON public.user_coupons(code) WHERE is_active = true;
CREATE INDEX idx_user_coupons_owner ON public.user_coupons(owner_user_id);

-- RLS Policies
ALTER TABLE public.user_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own coupons"
  ON public.user_coupons FOR SELECT
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can insert their own coupons"
  ON public.user_coupons FOR INSERT
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can update their own coupons"
  ON public.user_coupons FOR UPDATE
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Admins can manage all coupons"
  ON public.user_coupons FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Trigger para updated_at
CREATE TRIGGER update_user_coupons_updated_at
  BEFORE UPDATE ON public.user_coupons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela coupon_uses (registros de uso de cupons)
CREATE TABLE public.coupon_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.user_coupons(id) ON DELETE CASCADE,
  coupon_code TEXT NOT NULL,
  used_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_by_name TEXT NOT NULL,
  used_by_email TEXT NOT NULL,
  service_or_plan_id TEXT,
  service_or_plan_name TEXT NOT NULL,
  owner_user_id UUID NOT NULL,
  owner_email TEXT NOT NULL,
  owner_pix_key TEXT,
  payment_id TEXT NOT NULL,
  order_id TEXT,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  amount_original NUMERIC NOT NULL,
  amount_discounted NUMERIC NOT NULL,
  discount_percentage NUMERIC NOT NULL
);

-- Índices para performance
CREATE INDEX idx_coupon_uses_payment_id ON public.coupon_uses(payment_id);
CREATE INDEX idx_coupon_uses_owner ON public.coupon_uses(owner_user_id);
CREATE INDEX idx_coupon_uses_used_by ON public.coupon_uses(used_by_user_id);
CREATE INDEX idx_coupon_uses_used_at ON public.coupon_uses(used_at DESC);

-- RLS Policies
ALTER TABLE public.coupon_uses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all coupon uses"
  ON public.coupon_uses FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Coupon owners can view their coupon uses"
  ON public.coupon_uses FOR SELECT
  USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can view their own coupon uses"
  ON public.coupon_uses FOR SELECT
  USING (auth.uid() = used_by_user_id);

-- Adicionar campos de cupom na tabela pending_payments
ALTER TABLE public.pending_payments
ADD COLUMN coupon_id UUID REFERENCES public.user_coupons(id) ON DELETE SET NULL,
ADD COLUMN coupon_code TEXT,
ADD COLUMN amount_original NUMERIC,
ADD COLUMN discount_percentage NUMERIC;