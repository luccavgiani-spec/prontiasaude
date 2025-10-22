-- Criar função SECURITY DEFINER para obter email do usuário atual
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid()
$$;

-- Dropar policy antiga que causa erro de permissão
DROP POLICY IF EXISTS "Users can view their own plan" ON public.patient_plans;

-- Criar nova policy usando a função SECURITY DEFINER
CREATE POLICY "Users can view own plan by id or email"
ON public.patient_plans
FOR SELECT
USING (
  (auth.uid() = user_id) OR (email = public.current_user_email())
);