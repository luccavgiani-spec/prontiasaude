-- Função segura para marcar senha como alterada (SECURITY DEFINER)
-- Permite que o próprio usuário limpe a flag must_change_password sem abrir UPDATE geral
CREATE OR REPLACE FUNCTION public.mark_password_changed()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.company_credentials
  SET 
    must_change_password = false,
    is_temporary_password = false,
    updated_at = NOW()
  WHERE user_id = auth.uid();
  
  RETURN FOUND;
END;
$$;

-- Permitir que usuários autenticados chamem a função
GRANT EXECUTE ON FUNCTION public.mark_password_changed() TO authenticated;