-- ===========================================
-- FASE 2: Políticas RLS de Leitura Pública para Admin Dashboard
-- Permite que o cliente anon leia dados administrativos
-- ===========================================

-- 1. admin_settings: permitir leitura pública
CREATE POLICY "Anon can read settings"
ON public.admin_settings FOR SELECT
USING (true);

-- 2. pending_payments: permitir leitura pública para dashboard admin
CREATE POLICY "Anon can read payments for admin"
ON public.pending_payments FOR SELECT
USING (true);

-- 3. appointments: permitir leitura pública para dashboard admin
CREATE POLICY "Anon can read appointments for admin"
ON public.appointments FOR SELECT
USING (true);

-- 4. patients: permitir leitura pública para dashboard admin
CREATE POLICY "Anon can read patients for admin"
ON public.patients FOR SELECT
USING (true);

-- 5. patient_plans: permitir leitura pública para dashboard admin
CREATE POLICY "Anon can read plans for admin"
ON public.patient_plans FOR SELECT
USING (true);