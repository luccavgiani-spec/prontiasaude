-- Criar índices para otimizar políticas RLS e queries

-- Índices para tabela patients (políticas usam id = auth.uid())
CREATE INDEX IF NOT EXISTS idx_patients_id ON public.patients(id);
CREATE INDEX IF NOT EXISTS idx_patients_email ON public.patients(email);
CREATE INDEX IF NOT EXISTS idx_patients_cpf ON public.patients(cpf);
CREATE INDEX IF NOT EXISTS idx_patients_manychat_contact_id ON public.patients(manychat_contact_id);

-- Índices para tabela user_roles (políticas usam user_id e role)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role ON public.user_roles(user_id, role);

-- Índices para tabela companies
CREATE INDEX IF NOT EXISTS idx_companies_id ON public.companies(id);
CREATE INDEX IF NOT EXISTS idx_companies_cnpj ON public.companies(cnpj);

-- Índices para tabela company_credentials (políticas usam user_id e company_id)
CREATE INDEX IF NOT EXISTS idx_company_credentials_user_id ON public.company_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_company_credentials_company_id ON public.company_credentials(company_id);

-- Índices para tabela appointments (muito usada)
CREATE INDEX IF NOT EXISTS idx_appointments_email ON public.appointments(email);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON public.appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_order_id ON public.appointments(order_id);
CREATE INDEX IF NOT EXISTS idx_appointments_appointment_id ON public.appointments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);

-- Índices para tabela patient_plans
CREATE INDEX IF NOT EXISTS idx_patient_plans_user_id ON public.patient_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_patient_plans_email ON public.patient_plans(email);
CREATE INDEX IF NOT EXISTS idx_patient_plans_status ON public.patient_plans(status);
CREATE INDEX IF NOT EXISTS idx_patient_plans_plan_code ON public.patient_plans(plan_code);

-- Índices para tabela coupon_uses
CREATE INDEX IF NOT EXISTS idx_coupon_uses_owner_user_id ON public.coupon_uses(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_uses_used_by_user_id ON public.coupon_uses(used_by_user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_uses_coupon_id ON public.coupon_uses(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_uses_payment_id ON public.coupon_uses(payment_id);
CREATE INDEX IF NOT EXISTS idx_coupon_uses_reviewed ON public.coupon_uses(reviewed);

-- Índices para tabela pending_payments
CREATE INDEX IF NOT EXISTS idx_pending_payments_email ON public.pending_payments(email);
CREATE INDEX IF NOT EXISTS idx_pending_payments_status ON public.pending_payments(status);
CREATE INDEX IF NOT EXISTS idx_pending_payments_payment_id ON public.pending_payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_pending_payments_coupon_id ON public.pending_payments(coupon_id);
CREATE INDEX IF NOT EXISTS idx_pending_payments_processed ON public.pending_payments(processed);

-- Índices para tabela user_coupons
CREATE INDEX IF NOT EXISTS idx_user_coupons_owner_user_id ON public.user_coupons(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_user_coupons_code ON public.user_coupons(code);
CREATE INDEX IF NOT EXISTS idx_user_coupons_is_active ON public.user_coupons(is_active);

-- Índices para tabela manychat_contacts
CREATE INDEX IF NOT EXISTS idx_manychat_contacts_contact_id ON public.manychat_contacts(contact_id);
CREATE INDEX IF NOT EXISTS idx_manychat_contacts_email ON public.manychat_contacts(email);
CREATE INDEX IF NOT EXISTS idx_manychat_contacts_cpf ON public.manychat_contacts(cpf);
CREATE INDEX IF NOT EXISTS idx_manychat_contacts_phone_e164 ON public.manychat_contacts(phone_e164);

-- Índices para tabela company_employees
CREATE INDEX IF NOT EXISTS idx_company_employees_company_id ON public.company_employees(company_id);
CREATE INDEX IF NOT EXISTS idx_company_employees_user_id ON public.company_employees(user_id);
CREATE INDEX IF NOT EXISTS idx_company_employees_cpf ON public.company_employees(cpf);
CREATE INDEX IF NOT EXISTS idx_company_employees_email ON public.company_employees(email);