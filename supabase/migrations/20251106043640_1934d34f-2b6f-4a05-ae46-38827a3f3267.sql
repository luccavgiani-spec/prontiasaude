-- Corrigir o campo email que ficou NULL para cristielli
UPDATE public.patients 
SET email = 'cristielli@outlook.com'
WHERE id = '0cf31ba1-2693-4673-acf7-f6951f53bb90'::uuid 
  AND cpf = '11237913683'
  AND email IS NULL;

-- Verificar se foi atualizado
DO $$
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email 
  FROM public.patients 
  WHERE id = '0cf31ba1-2693-4673-acf7-f6951f53bb90'::uuid;
  
  RAISE NOTICE 'Email após update: %', COALESCE(v_email, 'NULL');
END $$;