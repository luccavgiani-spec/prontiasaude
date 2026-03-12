-- =============================================
-- FIX: Corrigir RLS policy de pending_family_invites
--
-- BUG: A policy "Titulares podem gerenciar seus convites" comparava
--   titular_patient_id (que é patients.id) com auth.uid() (que é auth.users.id).
--   Para pacientes cujo patients.id ≠ auth.users.id, a policy NUNCA fazia match,
--   impedindo operações de gerenciamento de convites familiares.
--
-- FIX: Usar subquery para buscar o patient_id correto do usuário autenticado.
-- =============================================

-- Remover policy incorreta
DROP POLICY IF EXISTS "Titulares podem gerenciar seus convites" ON public.pending_family_invites;

-- Criar policy corrigida
CREATE POLICY "Titulares podem gerenciar seus convites"
ON public.pending_family_invites
FOR ALL TO authenticated
USING (
  titular_patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
)
WITH CHECK (
  titular_patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
);
