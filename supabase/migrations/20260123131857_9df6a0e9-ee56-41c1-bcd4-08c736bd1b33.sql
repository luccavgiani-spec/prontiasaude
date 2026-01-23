-- Permitir que usuários autenticados insiram registros de uso de cupom
CREATE POLICY "Authenticated users can insert coupon uses"
  ON public.coupon_uses FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);