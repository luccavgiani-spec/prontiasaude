-- PASSO 2: Restaurar especialidades Communicare
-- Lista padrão de especialidades que devem ser roteadas para Communicare

INSERT INTO public.admin_settings (key, value, updated_at)
VALUES (
  'communicare_specialties',
  '["Clínico Geral", "Psicólogo - 1 sessão", "Psicólogo - 4 sessões", "Psicólogo - 8 sessões", "Nutricionista"]',
  now()
)
ON CONFLICT (key) 
DO UPDATE SET 
  value = '["Clínico Geral", "Psicólogo - 1 sessão", "Psicólogo - 4 sessões", "Psicólogo - 8 sessões", "Nutricionista"]',
  updated_at = now();

-- Comentário: Esta migration restaura a lista correta de especialidades que devem ser
-- roteadas para Communicare durante horário comercial (Segunda-Sexta 8h-18h Brasília).
-- Todas as outras especialidades serão roteadas para ClickLife.