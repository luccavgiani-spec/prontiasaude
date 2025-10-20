-- Criar usuário admin: suporte@prontiasaude.com.br
-- Nota: Este é um script de exemplo. Para criar o usuário, execute os comandos abaixo manualmente:

-- 1. No Supabase Dashboard → Authentication → Users → Invite User
--    Email: suporte@prontiasaude.com.br
--    
-- 2. Após criar, obter o user_id e executar:

-- INSERT INTO public.user_roles (user_id, role)
-- VALUES ('USER_ID_AQUI', 'admin');

-- Como alternativa, pode-se usar a Supabase Admin API para criar o usuário programaticamente
-- mas isso requer acesso service_role_key que não está disponível via SQL direto.

-- Para propósitos de documentação, este comentário registra a necessidade de criar:
-- Email: suporte@prontiasaude.com.br
-- Senha: admin123!
-- Role: admin

-- IMPORTANTE: Execute este comando manualmente no Supabase Dashboard após criar o usuário:
-- INSERT INTO public.user_roles (user_id, role) 
-- SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'suporte@prontiasaude.com.br';
