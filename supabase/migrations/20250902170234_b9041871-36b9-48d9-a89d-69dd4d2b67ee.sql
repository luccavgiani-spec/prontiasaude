-- Create patients table with all required fields
CREATE TABLE public.patients (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  address_line TEXT,
  cpf TEXT,
  phone_e164 TEXT,
  birth_date DATE,
  terms_accepted_at TIMESTAMPTZ,
  marketing_opt_in BOOLEAN DEFAULT false,
  profile_complete BOOLEAN DEFAULT false,
  intake_complete BOOLEAN DEFAULT false,
  has_allergies BOOLEAN,
  allergies TEXT,
  pregnancy_status TEXT CHECK (pregnancy_status IN ('never', 'pregnant_now', 'pregnant_past')),
  has_comorbidities BOOLEAN,
  comorbidities TEXT,
  has_chronic_meds BOOLEAN,
  chronic_meds TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own patient record" 
ON public.patients 
FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Users can update their own patient record" 
ON public.patients 
FOR UPDATE 
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own patient record" 
ON public.patients 
FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_patients_updated_at
BEFORE UPDATE ON public.patients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.patients (
    id, 
    first_name, 
    last_name, 
    address_line, 
    cpf, 
    phone_e164, 
    birth_date, 
    terms_accepted_at, 
    marketing_opt_in,
    profile_complete
  )
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    NEW.raw_user_meta_data ->> 'address_line',
    NEW.raw_user_meta_data ->> 'cpf',
    NEW.raw_user_meta_data ->> 'phone_e164',
    (NEW.raw_user_meta_data ->> 'birth_date')::date,
    CASE 
      WHEN NEW.raw_user_meta_data ->> 'terms_accepted_at' IS NOT NULL 
      THEN (NEW.raw_user_meta_data ->> 'terms_accepted_at')::timestamptz
      ELSE NULL
    END,
    COALESCE((NEW.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false),
    CASE 
      WHEN NEW.raw_user_meta_data ->> 'first_name' IS NOT NULL 
        AND NEW.raw_user_meta_data ->> 'last_name' IS NOT NULL
        AND NEW.raw_user_meta_data ->> 'address_line' IS NOT NULL
        AND NEW.raw_user_meta_data ->> 'cpf' IS NOT NULL
        AND NEW.raw_user_meta_data ->> 'phone_e164' IS NOT NULL
        AND NEW.raw_user_meta_data ->> 'birth_date' IS NOT NULL
        AND NEW.raw_user_meta_data ->> 'terms_accepted_at' IS NOT NULL
      THEN true
      ELSE false
    END
  );
  
  RETURN NEW;
END;
$$;

-- Trigger to automatically create patient record when user signs up
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();