-- Inserir cupons promocionais do sistema (owner_user_id = NULL indica cupom do sistema)
INSERT INTO user_coupons (code, discount_percentage, coupon_type, is_active, owner_user_id, pix_key)
VALUES 
  ('BEMVINDO10', 10, 'SERVICE', true, NULL, NULL),
  ('CLUBEPRONTIA15', 15, 'SERVICE', true, NULL, NULL)
ON CONFLICT (code) DO UPDATE SET
  discount_percentage = EXCLUDED.discount_percentage,
  is_active = true;

-- Adicionar política RLS para permitir que usuários criem seus próprios cupons
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_coupons' 
    AND policyname = 'Users can create own coupons'
  ) THEN
    CREATE POLICY "Users can create own coupons"
      ON user_coupons
      FOR INSERT
      WITH CHECK (owner_user_id = auth.uid());
  END IF;
END $$;