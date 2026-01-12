
-- =============================================
-- FASE 1: CRIAR ENUM TYPE
-- =============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'company');

-- =============================================
-- FASE 2: CRIAR TABELAS (ordem respeitando FKs)
-- =============================================

-- 1. patients (tabela base)
CREATE TABLE public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    cpf TEXT,
    phone TEXT,
    birth_date DATE,
    gender TEXT,
    cep TEXT,
    street TEXT,
    number TEXT,
    complement TEXT,
    neighborhood TEXT,
    city TEXT,
    state TEXT,
    clicklife_patient_id TEXT,
    clubeben_id TEXT,
    clubeben_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. user_roles
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role public.app_role NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, role)
);

-- 3. admin_settings
CREATE TABLE public.admin_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. admin_content
CREATE TABLE public.admin_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section TEXT NOT NULL,
    content JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. services
CREATE TABLE public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2),
    sku TEXT UNIQUE,
    category TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 6. manychat_contacts
CREATE TABLE public.manychat_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id TEXT UNIQUE,
    phone TEXT,
    name TEXT,
    email TEXT,
    cpf TEXT,
    first_interaction TIMESTAMPTZ,
    last_interaction TIMESTAMPTZ,
    tags JSONB,
    custom_fields JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 7. clicklife_registrations
CREATE TABLE public.clicklife_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    cpf TEXT NOT NULL,
    clicklife_patient_id TEXT,
    status TEXT DEFAULT 'pending',
    registration_data JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 8. companies
CREATE TABLE public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    razao_social TEXT NOT NULL,
    cnpj TEXT UNIQUE,
    status TEXT DEFAULT 'active',
    cep TEXT,
    logradouro TEXT,
    bairro TEXT,
    cidade TEXT,
    uf TEXT,
    numero TEXT,
    complemento TEXT,
    n_funcionarios INTEGER,
    contato_nome TEXT,
    contato_email TEXT,
    contato_telefone TEXT,
    empresa_id_externo INTEGER,
    plano_id_externo INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 9. company_credentials
CREATE TABLE public.company_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    cnpj TEXT NOT NULL,
    password_hash TEXT,
    is_temporary_password BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 10. company_employees
CREATE TABLE public.company_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    cpf TEXT,
    first_name TEXT,
    last_name TEXT,
    status TEXT DEFAULT 'active',
    invited_at TIMESTAMPTZ,
    activated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 11. appointments
CREATE TABLE public.appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    appointment_id TEXT UNIQUE,
    service_name TEXT,
    specialty TEXT,
    provider TEXT,
    status TEXT DEFAULT 'scheduled',
    scheduled_date TIMESTAMPTZ,
    duration_minutes INTEGER,
    meeting_url TEXT,
    notes TEXT,
    external_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 12. patient_plans
CREATE TABLE public.patient_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    plan_code TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    start_date DATE,
    end_date DATE,
    mp_subscription_id TEXT,
    mp_payer_id TEXT,
    payment_method TEXT,
    next_payment_date DATE,
    subscription_status TEXT,
    activated_by TEXT,
    activated_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancelled_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 13. pending_payments
CREATE TABLE public.pending_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id TEXT UNIQUE,
    payment_id TEXT,
    patient_email TEXT,
    patient_cpf TEXT,
    patient_name TEXT,
    sku TEXT,
    amount DECIMAL(10,2),
    status TEXT DEFAULT 'pending',
    payment_method TEXT,
    coupon_code TEXT,
    coupon_owner_id UUID,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    external_reference TEXT,
    payment_data JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 14. user_coupons
CREATE TABLE public.user_coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    owner_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    discount_percent INTEGER DEFAULT 10,
    coupon_type TEXT DEFAULT 'service',
    pix_key TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 15. pending_employee_invites
CREATE TABLE public.pending_employee_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    cpf TEXT,
    first_name TEXT,
    last_name TEXT,
    token TEXT UNIQUE,
    status TEXT DEFAULT 'pending',
    expires_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 16. sso_tokens
CREATE TABLE public.sso_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    jti TEXT UNIQUE NOT NULL,
    clicklife_token TEXT,
    redirect_to TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 17. coupon_uses
CREATE TABLE public.coupon_uses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID REFERENCES public.user_coupons(id) ON DELETE CASCADE NOT NULL,
    used_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    used_by_email TEXT,
    used_by_name TEXT,
    service_sku TEXT,
    original_amount DECIMAL(10,2),
    discount_amount DECIMAL(10,2),
    final_amount DECIMAL(10,2),
    payment_id TEXT,
    reviewed BOOLEAN DEFAULT false,
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 18. pending_family_invites
CREATE TABLE public.pending_family_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titular_patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE NOT NULL,
    titular_plan_id UUID REFERENCES public.patient_plans(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    cpf TEXT,
    first_name TEXT,
    last_name TEXT,
    relationship TEXT,
    token TEXT UNIQUE,
    status TEXT DEFAULT 'pending',
    expires_at TIMESTAMPTZ,
    accepted_at TIMESTAMPTZ,
    dependent_patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
    dependent_plan_id UUID REFERENCES public.patient_plans(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 19. metrics
CREATE TABLE public.metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type TEXT NOT NULL,
    metric_value DECIMAL(10,2),
    sku TEXT,
    platform TEXT,
    company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- FASE 3: CRIAR FUNCTIONS
-- =============================================

-- Function: current_user_email
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::json->>'email',
    (SELECT email FROM auth.users WHERE id = auth.uid())
  )
$$;

-- Function: has_role (evita recursão em RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function: is_admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Function: update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Function: handle_new_user (cria patient no signup)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.patients (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name'
  );
  RETURN NEW;
END;
$$;

-- Function: trigger_clubeben_sync_on_active_plan
CREATE OR REPLACE FUNCTION public.trigger_clubeben_sync_on_active_plan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Apenas sincroniza quando plano fica ativo
  IF NEW.status = 'active' AND (OLD IS NULL OR OLD.status != 'active') THEN
    -- Log para debug (a sincronização real é feita via edge function)
    RAISE LOG 'ClubeBen sync triggered for patient_plan: %', NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Function: validate_family_invite_token
CREATE OR REPLACE FUNCTION public.validate_family_invite_token(_token TEXT)
RETURNS TABLE (
  invite_id UUID,
  titular_patient_id UUID,
  titular_plan_id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  relationship TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    titular_patient_id,
    titular_plan_id,
    email,
    first_name,
    last_name,
    relationship
  FROM public.pending_family_invites
  WHERE token = _token
    AND status = 'pending'
    AND expires_at > now()
$$;

-- =============================================
-- FASE 4: CRIAR TRIGGERS
-- =============================================

-- Triggers de updated_at
CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_admin_settings_updated_at
  BEFORE UPDATE ON public.admin_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_admin_content_updated_at
  BEFORE UPDATE ON public.admin_content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_timestamp
  BEFORE UPDATE ON public.manychat_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clicklife_registrations_updated_at
  BEFORE UPDATE ON public.clicklife_registrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_credentials_updated_at
  BEFORE UPDATE ON public.company_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_employees_updated_at
  BEFORE UPDATE ON public.company_employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patient_plans_updated_at
  BEFORE UPDATE ON public.patient_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_coupons_updated_at
  BEFORE UPDATE ON public.user_coupons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pending_employee_invites_updated_at
  BEFORE UPDATE ON public.pending_employee_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pending_family_invites_updated_at
  BEFORE UPDATE ON public.pending_family_invites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger de lógica de negócio: ClubeBen sync
CREATE TRIGGER on_patient_plan_active
  AFTER INSERT OR UPDATE ON public.patient_plans
  FOR EACH ROW EXECUTE FUNCTION public.trigger_clubeben_sync_on_active_plan();

-- Trigger de Auth: criar patient no signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- FASE 5: HABILITAR RLS E CRIAR POLICIES
-- =============================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manychat_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clicklife_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patient_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_employee_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sso_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_family_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metrics ENABLE ROW LEVEL SECURITY;

-- =============================================
-- POLICIES: patients (7)
-- =============================================
CREATE POLICY "Users can view own patient data"
  ON public.patients FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own patient data"
  ON public.patients FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own patient data"
  ON public.patients FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all patients"
  ON public.patients FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can update all patients"
  ON public.patients FOR UPDATE
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can insert patients"
  ON public.patients FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete patients"
  ON public.patients FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- =============================================
-- POLICIES: user_roles (3)
-- =============================================
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.is_admin());

-- =============================================
-- POLICIES: admin_settings (1)
-- =============================================
CREATE POLICY "Admins can manage settings"
  ON public.admin_settings FOR ALL
  TO authenticated
  USING (public.is_admin());

-- =============================================
-- POLICIES: admin_content (2)
-- =============================================
CREATE POLICY "Anyone can view content"
  ON public.admin_content FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage content"
  ON public.admin_content FOR ALL
  TO authenticated
  USING (public.is_admin());

-- =============================================
-- POLICIES: services (2)
-- =============================================
CREATE POLICY "Anyone can view services"
  ON public.services FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage services"
  ON public.services FOR ALL
  TO authenticated
  USING (public.is_admin());

-- =============================================
-- POLICIES: manychat_contacts (1)
-- =============================================
CREATE POLICY "Service role only"
  ON public.manychat_contacts FOR ALL
  TO service_role
  USING (true);

-- =============================================
-- POLICIES: clicklife_registrations (3)
-- =============================================
CREATE POLICY "Users can view own registrations"
  ON public.clicklife_registrations FOR SELECT
  TO authenticated
  USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all registrations"
  ON public.clicklife_registrations FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can manage registrations"
  ON public.clicklife_registrations FOR ALL
  TO authenticated
  USING (public.is_admin());

-- =============================================
-- POLICIES: companies (4)
-- =============================================
CREATE POLICY "Company admins can view own company"
  ON public.companies FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM public.company_credentials 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company admins can update own company"
  ON public.companies FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM public.company_credentials 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all companies"
  ON public.companies FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can manage all companies"
  ON public.companies FOR ALL
  TO authenticated
  USING (public.is_admin());

-- =============================================
-- POLICIES: company_credentials (3)
-- =============================================
CREATE POLICY "Users can view own credentials"
  ON public.company_credentials FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all credentials"
  ON public.company_credentials FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can manage credentials"
  ON public.company_credentials FOR ALL
  TO authenticated
  USING (public.is_admin());

-- =============================================
-- POLICIES: company_employees (6)
-- =============================================
CREATE POLICY "Employees can view themselves"
  ON public.company_employees FOR SELECT
  TO authenticated
  USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Company admins can view employees"
  ON public.company_employees FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_credentials 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company admins can insert employees"
  ON public.company_employees FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_credentials 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company admins can update employees"
  ON public.company_employees FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_credentials 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all employees"
  ON public.company_employees FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can manage all employees"
  ON public.company_employees FOR ALL
  TO authenticated
  USING (public.is_admin());

-- =============================================
-- POLICIES: appointments (2)
-- =============================================
CREATE POLICY "Users can view own appointments"
  ON public.appointments FOR SELECT
  TO authenticated
  USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage appointments"
  ON public.appointments FOR ALL
  TO authenticated
  USING (public.is_admin());

-- =============================================
-- POLICIES: patient_plans (2)
-- =============================================
CREATE POLICY "Users can view own plans"
  ON public.patient_plans FOR SELECT
  TO authenticated
  USING (patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all plans"
  ON public.patient_plans FOR ALL
  TO authenticated
  USING (public.is_admin());

-- =============================================
-- POLICIES: pending_payments (2)
-- =============================================
CREATE POLICY "Users can view own payments"
  ON public.pending_payments FOR SELECT
  TO authenticated
  USING (patient_email = public.current_user_email());

CREATE POLICY "Admins can manage payments"
  ON public.pending_payments FOR ALL
  TO authenticated
  USING (public.is_admin());

-- =============================================
-- POLICIES: user_coupons (4)
-- =============================================
CREATE POLICY "Users can view own coupons"
  ON public.user_coupons FOR SELECT
  TO authenticated
  USING (owner_user_id = auth.uid());

CREATE POLICY "Anyone can validate coupons"
  ON public.user_coupons FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can view all coupons"
  ON public.user_coupons FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can manage coupons"
  ON public.user_coupons FOR ALL
  TO authenticated
  USING (public.is_admin());

-- =============================================
-- POLICIES: pending_employee_invites (6)
-- =============================================
CREATE POLICY "Anyone can view invite by token"
  ON public.pending_employee_invites FOR SELECT
  USING (true);

CREATE POLICY "Company admins can view invites"
  ON public.pending_employee_invites FOR SELECT
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_credentials 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company admins can create invites"
  ON public.pending_employee_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.company_credentials 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Company admins can update invites"
  ON public.pending_employee_invites FOR UPDATE
  TO authenticated
  USING (
    company_id IN (
      SELECT company_id FROM public.company_credentials 
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all invites"
  ON public.pending_employee_invites FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can manage all invites"
  ON public.pending_employee_invites FOR ALL
  TO authenticated
  USING (public.is_admin());

-- =============================================
-- POLICIES: sso_tokens (1)
-- =============================================
CREATE POLICY "Service role only for SSO"
  ON public.sso_tokens FOR ALL
  TO service_role
  USING (true);

-- =============================================
-- POLICIES: coupon_uses (3)
-- =============================================
CREATE POLICY "Users can view uses of own coupons"
  ON public.coupon_uses FOR SELECT
  TO authenticated
  USING (
    coupon_id IN (
      SELECT id FROM public.user_coupons WHERE owner_user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all coupon uses"
  ON public.coupon_uses FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can manage coupon uses"
  ON public.coupon_uses FOR ALL
  TO authenticated
  USING (public.is_admin());

-- =============================================
-- POLICIES: pending_family_invites (2)
-- =============================================
CREATE POLICY "Titulars can manage family invites"
  ON public.pending_family_invites FOR ALL
  TO authenticated
  USING (
    titular_patient_id IN (SELECT id FROM public.patients WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage all family invites"
  ON public.pending_family_invites FOR ALL
  TO authenticated
  USING (public.is_admin());

-- =============================================
-- POLICIES: metrics (1)
-- =============================================
CREATE POLICY "Admins can manage metrics"
  ON public.metrics FOR ALL
  TO authenticated
  USING (public.is_admin());

-- =============================================
-- FASE 6: CRIAR INDEXES IMPORTANTES
-- =============================================

-- patients indexes
CREATE INDEX idx_patients_user_id ON public.patients(user_id);
CREATE INDEX idx_patients_email ON public.patients(email);
CREATE INDEX idx_patients_cpf ON public.patients(cpf);
CREATE INDEX idx_patients_clicklife_id ON public.patients(clicklife_patient_id);
CREATE INDEX idx_patients_clubeben_id ON public.patients(clubeben_id);

-- user_roles indexes
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_role ON public.user_roles(role);

-- admin_settings indexes
CREATE INDEX idx_admin_settings_key ON public.admin_settings(key);

-- companies indexes
CREATE INDEX idx_companies_cnpj ON public.companies(cnpj);
CREATE INDEX idx_companies_status ON public.companies(status);

-- company_credentials indexes
CREATE INDEX idx_company_credentials_company_id ON public.company_credentials(company_id);
CREATE INDEX idx_company_credentials_user_id ON public.company_credentials(user_id);
CREATE INDEX idx_company_credentials_cnpj ON public.company_credentials(cnpj);

-- company_employees indexes
CREATE INDEX idx_company_employees_company_id ON public.company_employees(company_id);
CREATE INDEX idx_company_employees_patient_id ON public.company_employees(patient_id);
CREATE INDEX idx_company_employees_email ON public.company_employees(email);
CREATE INDEX idx_company_employees_cpf ON public.company_employees(cpf);

-- appointments indexes
CREATE INDEX idx_appointments_patient_id ON public.appointments(patient_id);
CREATE INDEX idx_appointments_status ON public.appointments(status);
CREATE INDEX idx_appointments_scheduled_date ON public.appointments(scheduled_date);
CREATE INDEX idx_appointments_provider ON public.appointments(provider);

-- patient_plans indexes
CREATE INDEX idx_patient_plans_patient_id ON public.patient_plans(patient_id);
CREATE INDEX idx_patient_plans_status ON public.patient_plans(status);
CREATE INDEX idx_patient_plans_plan_code ON public.patient_plans(plan_code);
CREATE INDEX idx_patient_plans_mp_subscription_id ON public.patient_plans(mp_subscription_id);

-- pending_payments indexes
CREATE INDEX idx_pending_payments_status ON public.pending_payments(status);
CREATE INDEX idx_pending_payments_patient_email ON public.pending_payments(patient_email);
CREATE INDEX idx_pending_payments_payment_id ON public.pending_payments(payment_id);
CREATE INDEX idx_pending_payments_coupon_code ON public.pending_payments(coupon_code);

-- user_coupons indexes
CREATE INDEX idx_user_coupons_owner ON public.user_coupons(owner_user_id);
CREATE INDEX idx_user_coupons_code ON public.user_coupons(code);
CREATE INDEX idx_user_coupons_active ON public.user_coupons(is_active);

-- pending_employee_invites indexes
CREATE INDEX idx_pending_employee_invites_company_id ON public.pending_employee_invites(company_id);
CREATE INDEX idx_pending_employee_invites_email ON public.pending_employee_invites(email);
CREATE INDEX idx_pending_employee_invites_token ON public.pending_employee_invites(token);
CREATE INDEX idx_pending_employee_invites_status ON public.pending_employee_invites(status);

-- sso_tokens indexes
CREATE INDEX idx_sso_tokens_jti ON public.sso_tokens(jti);
CREATE INDEX idx_sso_tokens_patient_id ON public.sso_tokens(patient_id);

-- coupon_uses indexes
CREATE INDEX idx_coupon_uses_coupon_id ON public.coupon_uses(coupon_id);
CREATE INDEX idx_coupon_uses_payment_id ON public.coupon_uses(payment_id);

-- pending_family_invites indexes
CREATE INDEX idx_pending_family_invites_titular_patient ON public.pending_family_invites(titular_patient_id);
CREATE INDEX idx_pending_family_invites_titular_plan ON public.pending_family_invites(titular_plan_id);
CREATE INDEX idx_pending_family_invites_token ON public.pending_family_invites(token);
CREATE INDEX idx_pending_family_invites_status ON public.pending_family_invites(status);

-- metrics indexes
CREATE INDEX idx_metrics_type ON public.metrics(metric_type);
CREATE INDEX idx_metrics_created_at ON public.metrics(created_at);
CREATE INDEX idx_metrics_company_id ON public.metrics(company_id);

-- clicklife_registrations indexes
CREATE INDEX idx_clicklife_registrations_patient_id ON public.clicklife_registrations(patient_id);
CREATE INDEX idx_clicklife_registrations_cpf ON public.clicklife_registrations(cpf);
CREATE INDEX idx_clicklife_registrations_status ON public.clicklife_registrations(status);

-- manychat_contacts indexes
CREATE INDEX idx_manychat_contacts_subscriber_id ON public.manychat_contacts(subscriber_id);
CREATE INDEX idx_manychat_contacts_phone ON public.manychat_contacts(phone);
CREATE INDEX idx_manychat_contacts_cpf ON public.manychat_contacts(cpf);
