-- Remove the overly permissive public policy that exposes all appointments
DROP POLICY IF EXISTS "Public can view appointments by email" ON public.appointments;