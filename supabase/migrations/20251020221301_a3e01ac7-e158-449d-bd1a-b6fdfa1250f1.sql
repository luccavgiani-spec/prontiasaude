-- Criar tabela para configurações administrativas
CREATE TABLE IF NOT EXISTS public.admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Apenas admins podem ler/escrever
CREATE POLICY "Only admins can manage settings"
ON public.admin_settings
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- Inserir valor default para force_clicklife
INSERT INTO public.admin_settings (key, value) 
VALUES ('force_clicklife', 'false')
ON CONFLICT (key) DO NOTHING;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_admin_settings_updated_at
BEFORE UPDATE ON public.admin_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();