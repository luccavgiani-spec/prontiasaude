-- Adicionar política RLS de DELETE para pending_employee_invites
-- Permite que empresas deletem apenas seus próprios convites

CREATE POLICY "Empresas podem deletar seus próprios convites"
ON pending_employee_invites
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM company_credentials
    WHERE company_credentials.user_id = auth.uid()
    AND company_credentials.company_id = pending_employee_invites.company_id
  )
);