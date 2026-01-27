-- ===========================================
-- FASE 2.1: Políticas RLS adicionais para Admin Dashboard
-- Permite que o cliente anon leia dados administrativos
-- ===========================================

-- user_coupons: permitir leitura pública para dashboard admin
CREATE POLICY "Anon can read coupons for admin"
ON public.user_coupons FOR SELECT
USING (true);

-- coupon_uses: permitir leitura pública para dashboard admin
CREATE POLICY "Anon can read coupon_uses for admin"
ON public.coupon_uses FOR SELECT
USING (true);

-- pending_family_invites: permitir leitura pública para dashboard admin
CREATE POLICY "Anon can read family_invites for admin"
ON public.pending_family_invites FOR SELECT
USING (true);

-- companies: permitir leitura pública para dashboard admin
CREATE POLICY "Anon can read companies for admin"
ON public.companies FOR SELECT
USING (true);