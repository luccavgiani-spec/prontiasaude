-- =====================================================
-- CORREÇÃO: Backfill patient_id em registros existentes
-- =====================================================

-- 1. Corrigir patient_plans onde patient_id é NULL mas user_id existe
UPDATE public.patient_plans pp
SET patient_id = p.id
FROM public.patients p
WHERE pp.user_id = p.user_id
  AND pp.patient_id IS NULL;

-- 2. Corrigir company_employees onde patient_id é NULL mas user_id existe  
UPDATE public.company_employees ce
SET patient_id = p.id
FROM public.patients p
WHERE ce.user_id = p.user_id
  AND ce.patient_id IS NULL;

-- =====================================================
-- CORREÇÃO: Adicionar RLS alternativa por user_id
-- =====================================================

-- 3. Política alternativa para patient_plans (acesso direto por user_id)
CREATE POLICY "Users can view own plans by user_id"
ON public.patient_plans FOR SELECT
USING (user_id = auth.uid());

-- 4. Política alternativa para company_employees (acesso direto por user_id)
CREATE POLICY "Employees can view themselves by user_id"
ON public.company_employees FOR SELECT
USING (user_id = auth.uid());