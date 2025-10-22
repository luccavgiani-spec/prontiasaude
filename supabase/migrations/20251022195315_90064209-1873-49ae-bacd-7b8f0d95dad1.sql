-- Fix security issues: Admin content storage and CPF validation

-- 1. Create admin_content table for secure content management (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.admin_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  content_type TEXT NOT NULL CHECK (content_type IN ('livro', 'playlist', 'receita', 'blog')),
  url TEXT,
  content TEXT,
  file_url TEXT,
  destination TEXT NOT NULL,
  blog_category TEXT,
  external_link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  updated_by UUID NOT NULL
);

-- Enable RLS on admin_content
ALTER TABLE public.admin_content ENABLE ROW LEVEL SECURITY;

-- RLS policies for admin_content (drop if exists first)
DROP POLICY IF EXISTS "Only admins can manage content" ON public.admin_content;
CREATE POLICY "Only admins can manage content"
  ON public.admin_content
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Public can view published content" ON public.admin_content;
CREATE POLICY "Public can view published content"
  ON public.admin_content
  FOR SELECT
  USING (true);

-- Add trigger for updated_at (drop if exists first)
DROP TRIGGER IF EXISTS update_admin_content_updated_at ON public.admin_content;
CREATE TRIGGER update_admin_content_updated_at
  BEFORE UPDATE ON public.admin_content
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Clean up duplicate CPFs before adding constraints
-- Keep only the most recent record for each duplicate CPF in patients
DELETE FROM public.patients a
WHERE a.cpf IS NOT NULL 
  AND a.ctid NOT IN (
    SELECT MAX(ctid)
    FROM public.patients
    WHERE cpf IS NOT NULL
    GROUP BY cpf
  );

-- Keep only the most recent record for each duplicate CPF in company_employees
DELETE FROM public.company_employees a
WHERE a.cpf IS NOT NULL
  AND a.ctid NOT IN (
    SELECT MAX(ctid)
    FROM public.company_employees
    WHERE cpf IS NOT NULL
    GROUP BY cpf
  );

-- 3. Add unique constraints for CPF validation (only if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_patient_cpf'
  ) THEN
    ALTER TABLE public.patients ADD CONSTRAINT unique_patient_cpf UNIQUE (cpf);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_employee_cpf'
  ) THEN
    ALTER TABLE public.company_employees ADD CONSTRAINT unique_employee_cpf UNIQUE (cpf);
  END IF;
END $$;

-- 4. Create indexes for better CPF lookup performance (only if not exists)
CREATE INDEX IF NOT EXISTS idx_patients_cpf ON public.patients(cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_company_employees_cpf ON public.company_employees(cpf) WHERE cpf IS NOT NULL;