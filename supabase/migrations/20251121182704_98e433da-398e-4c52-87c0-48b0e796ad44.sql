-- Criar tabela de convites pendentes de funcionários
CREATE TABLE IF NOT EXISTS pending_employee_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invite_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'cancelled')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  completed_at TIMESTAMPTZ,
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, email)
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_pending_invites_token ON pending_employee_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_pending_invites_company ON pending_employee_invites(company_id);
CREATE INDEX IF NOT EXISTS idx_pending_invites_status ON pending_employee_invites(status);
CREATE INDEX IF NOT EXISTS idx_pending_invites_email ON pending_employee_invites(email);

-- Habilitar RLS
ALTER TABLE pending_employee_invites ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Admins podem gerenciar todos os convites"
ON pending_employee_invites
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Empresas podem visualizar seus próprios convites"
ON pending_employee_invites
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM company_credentials
    WHERE company_credentials.user_id = auth.uid()
      AND company_credentials.company_id = pending_employee_invites.company_id
  )
);

CREATE POLICY "Empresas podem criar seus próprios convites"
ON pending_employee_invites
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM company_credentials
    WHERE company_credentials.user_id = auth.uid()
      AND company_credentials.company_id = pending_employee_invites.company_id
  )
);

CREATE POLICY "Empresas podem atualizar seus próprios convites"
ON pending_employee_invites
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM company_credentials
    WHERE company_credentials.user_id = auth.uid()
      AND company_credentials.company_id = pending_employee_invites.company_id
  )
);