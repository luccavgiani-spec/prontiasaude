-- Ajusta colunas e adiciona flags se faltarem
ALTER TABLE public.patients
  ALTER COLUMN terms_accepted_at DROP NOT NULL;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS profile_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS intake_complete boolean NOT NULL DEFAULT false;

-- Policies (idempotentes)
DROP POLICY IF EXISTS "patients_insert_self" ON public.patients;
DROP POLICY IF EXISTS "patients_update_own" ON public.patients;
DROP POLICY IF EXISTS "patients_select_own" ON public.patients;

CREATE POLICY "patients_insert_self"
  ON public.patients FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "patients_update_own"
  ON public.patients FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "patients_select_own"
  ON public.patients FOR SELECT
  USING (auth.uid() = id);

-- Trigger resiliente: cria linha mínima após novo usuário (com Google ou e-mail)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _first text := null;
  _last  text := null;
  _phone text := null;
  _birth date := null;
  _addr  text := null;
  _cpf   text := null;
  _terms timestamptz := null;
BEGIN
  _first := new.raw_user_meta_data->>'first_name';
  _last  := new.raw_user_meta_data->>'last_name';
  _phone := new.raw_user_meta_data->>'phone_e164';
  _addr  := new.raw_user_meta_data->>'address_line';
  _cpf   := new.raw_user_meta_data->>'cpf';

  BEGIN
    _birth := (new.raw_user_meta_data->>'birth_date')::date;
  EXCEPTION WHEN others THEN
    _birth := null;
  END;

  BEGIN
    _terms := (new.raw_user_meta_data->>'terms_accepted_at')::timestamptz;
  EXCEPTION WHEN others THEN
    _terms := null;
  END;

  INSERT INTO public.patients (
    id, first_name, last_name, address_line, cpf, phone_e164, birth_date, terms_accepted_at,
    profile_complete, intake_complete
  )
  VALUES (
    new.id, _first, _last, _addr, _cpf, _phone, _birth, _terms,
    false, false
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();