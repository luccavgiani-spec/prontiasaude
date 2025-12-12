-- Tabela para convites de familiares
CREATE TABLE public.pending_family_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titular_id UUID NOT NULL,
  titular_plan_id UUID NOT NULL REFERENCES patient_plans(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invite_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(titular_plan_id, email)
);

-- Enable RLS
ALTER TABLE public.pending_family_invites ENABLE ROW LEVEL SECURITY;

-- Titulares podem gerenciar seus próprios convites
CREATE POLICY "Titulares podem gerenciar seus convites" 
ON public.pending_family_invites
FOR ALL TO authenticated
USING (titular_id = auth.uid())
WITH CHECK (titular_id = auth.uid());

-- Qualquer pessoa pode validar convites por token (para cadastro)
CREATE POLICY "Validar convites por token" 
ON public.pending_family_invites
FOR SELECT TO public
USING (true);

-- Admins podem gerenciar todos os convites
CREATE POLICY "Admins podem gerenciar todos convites familiares"
ON public.pending_family_invites
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));