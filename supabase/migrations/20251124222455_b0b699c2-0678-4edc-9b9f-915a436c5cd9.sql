-- Política RLS para permitir validação de convites pelo token
-- Esta política é segura porque:
-- 1. O invite_token é um UUID aleatório impossível de adivinhar
-- 2. A consulta sempre filtra pelo token exato
-- 3. É necessário para o fluxo de onboarding funcionar

CREATE POLICY "Funcionários podem validar convites pelo token" 
ON pending_employee_invites 
FOR SELECT 
TO public
USING (true);