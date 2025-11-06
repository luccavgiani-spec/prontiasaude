-- Inserir registro na tabela patients para cristielli@outlook.com
-- Dados extraídos do raw_user_meta_data do auth.users

INSERT INTO public.patients (
  id,
  email,
  first_name,
  last_name,
  cpf,
  phone_e164,
  birth_date,
  gender,
  cep,
  city,
  state,
  address_line,
  address_number,
  address_complement,
  terms_accepted_at,
  marketing_opt_in,
  profile_complete,
  intake_complete,
  clubeben_status,
  clubeben_retry_count,
  status_email,
  status_sms,
  source
)
VALUES (
  '0cf31ba1-2693-4673-acf7-f6951f53bb90'::uuid,
  'cristielli@outlook.com',
  'cristielli',
  'neves silva',
  '11237913683',
  '+5535984497180',
  '1992-09-29'::date,
  'F',
  '12916-450',
  'Bragança Paulista',
  'SP',
  'Avenida Fábio Montanari Ramos, Lagos de Santa Helena, Bragança Paulista - SP',
  '204',
  '',
  '2025-10-30T23:01:35.889Z'::timestamptz,
  true,
  true,
  false,
  'pending',
  0,
  1,
  1,
  'site'
)
ON CONFLICT (id) DO UPDATE SET
  clubeben_status = 'pending',
  clubeben_retry_count = 0,
  clubeben_last_sync = NULL
WHERE patients.clubeben_status IS NULL OR patients.clubeben_status != 'active';

-- Log da operação
DO $$
BEGIN
  RAISE NOTICE 'Registro criado/atualizado para cristielli@outlook.com com clubeben_status=pending';
END $$;