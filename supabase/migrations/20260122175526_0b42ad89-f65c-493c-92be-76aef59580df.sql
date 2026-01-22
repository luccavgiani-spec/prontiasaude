-- Deletar usuário Auth órfão que está bloqueando cadastro de empresas
-- Este usuário foi criado em 12/Jan mas não tem empresa correspondente
DELETE FROM auth.users WHERE email = '56210013000140@empresa.prontia.com';