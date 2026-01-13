-- Remover política existente
DROP POLICY IF EXISTS "Admins can manage settings" ON admin_settings;

-- Criar nova política com USING e WITH CHECK
CREATE POLICY "Admins can manage settings" ON admin_settings
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());