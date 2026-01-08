-- Corrigir RLS policy permissiva na tabela clicklife_registrations
-- A policy atual permite acesso total com "true", o que é inseguro

-- Remover policy atual
DROP POLICY IF EXISTS "Service role has full access to clicklife_registrations" ON public.clicklife_registrations;

-- Criar novas policies mais restritivas
-- Admins podem ver todos os registros
CREATE POLICY "Admins can view all clicklife_registrations"
ON public.clicklife_registrations
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admins podem gerenciar registros (INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can manage clicklife_registrations"
ON public.clicklife_registrations
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));