
-- Atualiza a função handle_new_user para vincular a pacientes existentes em vez de criar duplicados
-- Quando um usuário Google OAuth faz login, verifica se já existe um patient com o mesmo email
-- Se existir, atualiza o user_id; se não existir, cria um novo registro

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  existing_patient_id uuid;
BEGIN
  -- Verificar se já existe um patient com este email (pode ter user_id NULL - casos de migração/Google OAuth)
  SELECT id INTO existing_patient_id
  FROM public.patients
  WHERE LOWER(email) = LOWER(NEW.email)
  LIMIT 1;

  IF existing_patient_id IS NOT NULL THEN
    -- Paciente já existe: apenas vincular o user_id
    UPDATE public.patients
    SET 
      user_id = NEW.id,
      -- Atualiza nome apenas se estiver vazio (preserva dados existentes)
      first_name = COALESCE(NULLIF(first_name, ''), NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'given_name'),
      last_name = COALESCE(NULLIF(last_name, ''), NEW.raw_user_meta_data->>'last_name', NEW.raw_user_meta_data->>'family_name'),
      updated_at = NOW()
    WHERE id = existing_patient_id;
    
    RAISE LOG 'handle_new_user: Linked existing patient % to user %', existing_patient_id, NEW.id;
  ELSE
    -- Paciente não existe: criar novo registro
    INSERT INTO public.patients (user_id, email, first_name, last_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'given_name'),
      COALESCE(NEW.raw_user_meta_data->>'last_name', NEW.raw_user_meta_data->>'family_name')
    );
    
    RAISE LOG 'handle_new_user: Created new patient for user %', NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Comentário explicativo
COMMENT ON FUNCTION public.handle_new_user() IS 
'Trigger que vincula novos usuários a pacientes existentes (por email) ou cria novo registro. 
Suporta vinculação automática para usuários Google OAuth que já tinham cadastro prévio.';
