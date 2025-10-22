-- Ativar plano IND_COM_ESP_1M (30 dias) para Victoria Toledo Silva (CPF: 45165957888)
INSERT INTO patient_plans (
  user_id,
  email,
  plan_code,
  plan_expires_at,
  status
) VALUES (
  'a1ed8d8d-4b26-4737-97eb-22ea687238fc',
  (SELECT email FROM auth.users WHERE id = 'a1ed8d8d-4b26-4737-97eb-22ea687238fc'),
  'IND_COM_ESP_1M',
  NOW() + INTERVAL '30 days',
  'active'
);

-- Ativar plano IND_COM_ESP_1M (30 dias) para Lucca Vicchiatti Giani (CPF: 40416699871)
INSERT INTO patient_plans (
  user_id,
  email,
  plan_code,
  plan_expires_at,
  status
) VALUES (
  '9ca4f6f7-7e9f-4e79-87a2-20027db6a8e3',
  (SELECT email FROM auth.users WHERE id = '9ca4f6f7-7e9f-4e79-87a2-20027db6a8e3'),
  'IND_COM_ESP_1M',
  NOW() + INTERVAL '30 days',
  'active'
);