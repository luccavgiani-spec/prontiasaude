-- Add environment column to password_reset_tokens
ALTER TABLE public.password_reset_tokens 
ADD COLUMN IF NOT EXISTS environment TEXT DEFAULT 'production';

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_environment 
ON public.password_reset_tokens(environment);