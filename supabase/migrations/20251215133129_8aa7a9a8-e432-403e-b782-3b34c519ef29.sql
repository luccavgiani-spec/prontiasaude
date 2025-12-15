-- =====================================================
-- 1. ATUALIZAR TRIGGER handle_new_user para Google OAuth
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public 
AS $$
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
  _full_name text := null;
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

  -- =====================================================
  -- NOVO: Fallback para Google OAuth (full_name / name)
  -- =====================================================
  IF _first IS NULL THEN
    _full_name := new.raw_user_meta_data->>'full_name';
    IF _full_name IS NULL THEN
      _full_name := new.raw_user_meta_data->>'name';
    END IF;
    
    IF _full_name IS NOT NULL AND _full_name != '' THEN
      _first := split_part(_full_name, ' ', 1);
      -- Pegar tudo após o primeiro espaço como sobrenome
      IF position(' ' IN _full_name) > 0 THEN
        _last := substring(_full_name FROM position(' ' IN _full_name) + 1);
      END IF;
    END IF;
  END IF;

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

  INSERT INTO public.patients (
    id, first_name, last_name, address_line, cpf, phone_e164, birth_date, 
    gender, cep, city, state, address_number, address_complement, terms_accepted_at,
    profile_complete, email
  )
  VALUES (
    new.id, _first, _last, _addr, _cpf, _phone, _birth, 
    _gender, _cep, _city, _state, _number, _complement, _terms,
    _profile_complete, new.email
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

-- =====================================================
-- 2. BACKFILL: Atualizar usuários Google OAuth existentes
-- =====================================================
UPDATE public.patients p
SET 
  first_name = COALESCE(p.first_name, split_part(COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name'), ' ', 1)),
  last_name = COALESCE(p.last_name, 
    CASE 
      WHEN position(' ' IN COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', '')) > 0 
      THEN substring(COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name') FROM position(' ' IN COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name')) + 1)
      ELSE NULL
    END
  ),
  email = COALESCE(p.email, au.email)
FROM auth.users au
WHERE p.id = au.id
  AND p.first_name IS NULL
  AND (au.raw_user_meta_data->>'full_name' IS NOT NULL OR au.raw_user_meta_data->>'name' IS NOT NULL);