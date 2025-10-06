-- Add DELETE policy to patients table to prevent unauthorized deletion
-- Users can only delete their own patient record
CREATE POLICY "patients_delete_own" 
ON public.patients 
FOR DELETE 
USING (auth.uid() = id);

-- Note: For production healthcare applications, consider implementing 
-- soft-delete pattern (deleted_at column) instead of hard deletes
-- to maintain audit trails and comply with medical record retention requirements