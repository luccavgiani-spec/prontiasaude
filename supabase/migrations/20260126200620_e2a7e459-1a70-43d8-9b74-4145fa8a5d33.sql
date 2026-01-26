-- Adicionar policy para permitir INSERT via service_role (edge functions)
-- O service_role bypass RLS automaticamente, mas para clareza adicionamos policy

CREATE POLICY "Service role can insert audit" ON public.webhook_audit
  FOR INSERT WITH CHECK (true);

-- Policy para admins poderem gerenciar (update/delete se necessário)
CREATE POLICY "Admins can manage webhook audit" ON public.webhook_audit
  FOR ALL USING (is_admin());