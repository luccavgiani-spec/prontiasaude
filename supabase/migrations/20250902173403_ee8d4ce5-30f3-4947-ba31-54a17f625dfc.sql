-- Fix the function search path security issue
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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