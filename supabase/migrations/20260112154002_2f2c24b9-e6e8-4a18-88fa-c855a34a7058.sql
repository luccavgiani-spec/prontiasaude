
-- =====================================================
-- FASE 1: Corrigir Tabela patients
-- =====================================================

-- Renomear colunas para alinhar com código
ALTER TABLE public.patients RENAME COLUMN phone TO phone_e164;
ALTER TABLE public.patients RENAME COLUMN street TO address_line;
ALTER TABLE public.patients RENAME COLUMN number TO address_number;

-- Adicionar colunas faltantes
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS profile_complete boolean DEFAULT false;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS marketing_opt_in boolean DEFAULT false;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS clubeben_status text;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS clubeben_last_sync timestamptz;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS clubeben_retry_count integer DEFAULT 0;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS status_email integer DEFAULT 0;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS status_sms integer DEFAULT 0;

-- =====================================================
-- FASE 2: Corrigir Tabela patient_plans
-- =====================================================

-- Adicionar colunas esperadas pelo código
ALTER TABLE public.patient_plans ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.patient_plans ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.patient_plans RENAME COLUMN end_date TO plan_expires_at;

-- =====================================================
-- FASE 3: Corrigir Tabela appointments
-- =====================================================

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS service_code text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS start_at_local timestamptz;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS duration_min integer;

-- =====================================================
-- FASE 4: Corrigir Tabela coupon_uses
-- =====================================================

ALTER TABLE public.coupon_uses ADD COLUMN IF NOT EXISTS coupon_code text;
ALTER TABLE public.coupon_uses ADD COLUMN IF NOT EXISTS service_or_plan_name text;
ALTER TABLE public.coupon_uses ADD COLUMN IF NOT EXISTS owner_email text;
ALTER TABLE public.coupon_uses ADD COLUMN IF NOT EXISTS owner_pix_key text;
ALTER TABLE public.coupon_uses ADD COLUMN IF NOT EXISTS owner_name text;
ALTER TABLE public.coupon_uses ADD COLUMN IF NOT EXISTS discount_percent numeric;
ALTER TABLE public.coupon_uses ADD COLUMN IF NOT EXISTS owner_id uuid;
ALTER TABLE public.coupon_uses ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending';

-- =====================================================
-- FASE 5: Corrigir Tabela user_coupons
-- =====================================================

ALTER TABLE public.user_coupons RENAME COLUMN discount_percent TO discount_percentage;

-- =====================================================
-- FASE 6: Corrigir Tabela pending_employee_invites
-- =====================================================

ALTER TABLE public.pending_employee_invites ADD COLUMN IF NOT EXISTS invited_at timestamptz DEFAULT now();
ALTER TABLE public.pending_employee_invites ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- =====================================================
-- FASE 7: Índices para performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_patients_email ON public.patients(email);
CREATE INDEX IF NOT EXISTS idx_patients_cpf ON public.patients(cpf);
CREATE INDEX IF NOT EXISTS idx_patients_user_id ON public.patients(user_id);
CREATE INDEX IF NOT EXISTS idx_patient_plans_email ON public.patient_plans(email);
CREATE INDEX IF NOT EXISTS idx_patient_plans_user_id ON public.patient_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_email ON public.appointments(email);
