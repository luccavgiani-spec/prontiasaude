-- =====================================================
-- BACKFILL: Corrigir dados desconectados para ClubeBen
-- =====================================================

-- 1. Backfill do campo email em patients (buscar de auth.users)
UPDATE public.patients p
SET email = au.email
FROM auth.users au
WHERE p.id = au.id
  AND p.email IS NULL;

-- 2. Backfill do campo user_id em patient_plans (vincular pelo email)
UPDATE public.patient_plans pp
SET user_id = p.id
FROM public.patients p
WHERE pp.email = p.email
  AND pp.user_id IS NULL
  AND p.id IS NOT NULL;

-- 3. Garantir que pacientes com plano ativo tenham clubeben_status = 'pending' para re-sincronização
UPDATE public.patients p
SET 
  clubeben_status = 'pending',
  clubeben_retry_count = 0
FROM public.patient_plans pp
WHERE (pp.user_id = p.id OR pp.email = p.email)
  AND pp.status = 'active'
  AND pp.plan_expires_at > NOW()
  AND (p.clubeben_status IS NULL OR p.clubeben_status NOT IN ('active', 'pending'));