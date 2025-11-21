-- Corrigir email do usuário da PRIMECARE (caso atual)
UPDATE auth.users
SET 
  email = '56210013000140@empresa.prontia.com',
  email_confirmed_at = now(),
  updated_at = now()
WHERE id = '9e5d77d3-f5cb-4413-ac01-c1fca157ca1e';

-- Verificar se há outras empresas com emails incorretos (apenas para auditoria)
-- Esta query será executada mas não afetará dados, apenas para logging
DO $$
DECLARE
  incorrect_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO incorrect_count
  FROM companies c
  JOIN company_credentials cc ON c.id = cc.company_id
  JOIN auth.users u ON cc.user_id = u.id
  WHERE u.email NOT LIKE '%@empresa.prontia.com';
  
  IF incorrect_count > 0 THEN
    RAISE NOTICE 'Found % companies with incorrect email patterns', incorrect_count;
  END IF;
END $$;