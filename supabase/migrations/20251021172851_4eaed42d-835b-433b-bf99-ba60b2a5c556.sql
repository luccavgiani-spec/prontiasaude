-- Adicionar role 'company' ao enum existente
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'company';