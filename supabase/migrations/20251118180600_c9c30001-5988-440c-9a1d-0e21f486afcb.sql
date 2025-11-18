-- Corrigir função handle_new_user() removendo referência a intake_complete
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _first text := null;
  _last  text := null;
  _phone text := null;
  _birth date := null;
  _addr  text := null;
  _cpf   text := null;
  _gender text := null;
  _cep text := null;
  _city text := null;
  _state text := null;
  _number text := null;
  _complement text := null;
  _terms timestamptz := null;
  _profile_complete boolean := false;
BEGIN
  -- Extrair dados do metadata
  _first := new.raw_user_meta_data->>'first_name';
  _last  := new.raw_user_meta_data->>'last_name';
  _phone := new.raw_user_meta_data->>'phone_e164';
  _addr  := new.raw_user_meta_data->>'address_line';
  _cpf   := new.raw_user_meta_data->>'cpf';
  _gender := new.raw_user_meta_data->>'gender';
  _cep := new.raw_user_meta_data->>'cep';
  _city := new.raw_user_meta_data->>'city';
  _state := new.raw_user_meta_data->>'state';
  _number := new.raw_user_meta_data->>'address_number';
  _complement := new.raw_user_meta_data->>'address_complement';

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

  -- Verificar se perfil está completo (todos os campos obrigatórios preenchidos)
  IF _first IS NOT NULL AND _last IS NOT NULL AND _cpf IS NOT NULL 
     AND _phone IS NOT NULL AND _birth IS NOT NULL AND _gender IS NOT NULL
     AND _cep IS NOT NULL AND _city IS NOT NULL AND _state IS NOT NULL 
     AND _addr IS NOT NULL AND _terms IS NOT NULL THEN
    _profile_complete := true;
  END IF;

  -- INSERT SEM intake_complete (coluna removida)
  INSERT INTO public.patients (
    id, first_name, last_name, address_line, cpf, phone_e164, birth_date, 
    gender, cep, city, state, address_number, address_complement, terms_accepted_at,
    profile_complete
  )
  VALUES (
    new.id, _first, _last, _addr, _cpf, _phone, _birth, 
    _gender, _cep, _city, _state, _number, _complement, _terms,
    _profile_complete
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$function$;