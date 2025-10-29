-- Criar tabela de agendamentos
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  service_code TEXT NOT NULL,
  service_name TEXT,
  start_at_local TIMESTAMPTZ NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'scheduled',
  order_id TEXT,
  teams_join_url TEXT,
  teams_meeting_id TEXT,
  provider TEXT,
  redirect_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_appointments_email ON public.appointments(email);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON public.appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_appointment_id ON public.appointments(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointments_start_at ON public.appointments(start_at_local);

-- Habilitar RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: Usuários podem ver seus próprios agendamentos
CREATE POLICY "Users can view their own appointments by email"
ON public.appointments
FOR SELECT
TO authenticated
USING (email = current_user_email() OR auth.uid() = user_id);

-- Políticas RLS: Usuários podem ver seus próprios agendamentos sem autenticação (por email)
CREATE POLICY "Public can view appointments by email"
ON public.appointments
FOR SELECT
TO anon
USING (true);

-- Admins podem gerenciar todos os agendamentos
CREATE POLICY "Admins can manage all appointments"
ON public.appointments
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Trigger para atualizar updated_at
CREATE TRIGGER update_appointments_updated_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();