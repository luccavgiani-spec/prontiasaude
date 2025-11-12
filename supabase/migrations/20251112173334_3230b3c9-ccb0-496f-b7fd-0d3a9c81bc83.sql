-- Adicionar coluna manychat_contact_id na tabela patients
ALTER TABLE public.patients 
ADD COLUMN IF NOT EXISTS manychat_contact_id text;

-- Criar índices para otimizar buscas
CREATE INDEX IF NOT EXISTS idx_patients_email 
ON public.patients(email);

CREATE INDEX IF NOT EXISTS idx_patients_manychat_contact_id 
ON public.patients(manychat_contact_id) 
WHERE manychat_contact_id IS NOT NULL;

-- Criar tabela auxiliar manychat_contacts
CREATE TABLE IF NOT EXISTS public.manychat_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  phone_e164 text,
  cpf text,
  contact_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.manychat_contacts ENABLE ROW LEVEL SECURITY;

-- RLS: Apenas admins podem gerenciar (functions usam service_role)
CREATE POLICY "Only admins can manage manychat_contacts"
ON public.manychat_contacts FOR ALL
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

-- Índices únicos para evitar duplicação
CREATE UNIQUE INDEX IF NOT EXISTS manychat_contacts_contact_id_unique 
ON public.manychat_contacts(contact_id);

CREATE UNIQUE INDEX IF NOT EXISTS manychat_contacts_email_unique 
ON public.manychat_contacts(email) 
WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS manychat_contacts_cpf_unique 
ON public.manychat_contacts(cpf) 
WHERE cpf IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS manychat_contacts_phone_unique 
ON public.manychat_contacts(phone_e164) 
WHERE phone_e164 IS NOT NULL;

-- Trigger para atualizar updated_at
CREATE TRIGGER set_timestamp 
BEFORE UPDATE ON public.manychat_contacts
FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();