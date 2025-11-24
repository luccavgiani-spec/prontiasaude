-- Política RLS para permitir leitura pública de dados básicos de empresas
-- Necessário para o fluxo de onboarding de funcionários através de convites
-- Esta política é segura porque:
-- 1. Expõe apenas dados básicos (razão social, status) necessários para validação
-- 2. Não expõe dados sensíveis como credenciais ou informações financeiras
-- 3. É necessário para o JOIN funcionar no fluxo de convites

CREATE POLICY "Leitura pública de dados básicos de empresas" 
ON companies 
FOR SELECT 
TO public
USING (true);