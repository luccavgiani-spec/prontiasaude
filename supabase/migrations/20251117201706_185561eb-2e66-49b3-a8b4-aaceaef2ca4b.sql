-- Remove colunas de antecedentes médicos da tabela patients
ALTER TABLE public.patients
DROP COLUMN IF EXISTS intake_complete,
DROP COLUMN IF EXISTS has_allergies,
DROP COLUMN IF EXISTS allergies,
DROP COLUMN IF EXISTS pregnancy_status,
DROP COLUMN IF EXISTS has_comorbidities,
DROP COLUMN IF EXISTS comorbidities,
DROP COLUMN IF EXISTS has_chronic_meds,
DROP COLUMN IF EXISTS chronic_meds;