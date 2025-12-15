-- Política de leitura pública para o bucket assets
CREATE POLICY "Assets public read" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'assets');

-- Política de upload para admins
CREATE POLICY "Admins can upload to assets" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'assets' 
  AND public.is_admin()
);

-- Política de update para admins
CREATE POLICY "Admins can update assets" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'assets' AND public.is_admin())
WITH CHECK (bucket_id = 'assets' AND public.is_admin());

-- Política de delete para admins
CREATE POLICY "Admins can delete assets" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'assets' AND public.is_admin());