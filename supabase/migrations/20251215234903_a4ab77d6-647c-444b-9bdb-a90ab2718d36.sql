-- Função segura para validar convite familiar por token
-- Retorna apenas os campos necessários, sem expor dados sensíveis
CREATE OR REPLACE FUNCTION public.validate_family_invite_token(p_token TEXT)
RETURNS TABLE(
  valid BOOLEAN,
  email TEXT,
  titular_plan_id UUID,
  plan_code TEXT,
  plan_expires_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    (pfi.status = 'pending' AND pfi.expires_at > NOW()) as valid,
    pfi.email,
    pfi.titular_plan_id,
    pp.plan_code,
    pp.plan_expires_at,
    pfi.expires_at
  FROM pending_family_invites pfi
  LEFT JOIN patient_plans pp ON pp.id = pfi.titular_plan_id
  WHERE pfi.invite_token = p_token
  LIMIT 1;
$$;

-- Remover a política pública vulnerável
DROP POLICY IF EXISTS "Validar convites por token" ON pending_family_invites;