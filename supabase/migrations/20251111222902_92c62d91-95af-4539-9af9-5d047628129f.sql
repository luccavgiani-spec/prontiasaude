-- Preencher emails NULL em public.patients buscando de auth.users
UPDATE public.patients
SET 
  email = auth.users.email,
  updated_at = NOW()
FROM auth.users
WHERE public.patients.id = auth.users.id
  AND public.patients.email IS NULL
  AND auth.users.email IS NOT NULL;