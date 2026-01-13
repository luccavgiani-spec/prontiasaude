-- Adicionar constraint UNIQUE no campo email da tabela patient_plans
-- para permitir que o upsert funcione corretamente
ALTER TABLE patient_plans 
ADD CONSTRAINT patient_plans_email_unique UNIQUE (email);