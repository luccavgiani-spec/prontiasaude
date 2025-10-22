-- Inserir planos de assinatura recorrente na tabela services
-- Preços em centavos (R$ 23,99 = 2399 centavos)

-- ========== INDIVIDUAL COM ESPECIALISTAS ==========
INSERT INTO services (sku, name, price_cents, active, allows_recurring, recurring_frequency, recurring_frequency_type)
VALUES 
  ('IND_COM_ESP_1M', 'Plano Individual com Especialistas - Mensal', 2399, true, true, 1, 'months'),
  ('IND_COM_ESP_6M', 'Plano Individual com Especialistas - Semestral', 1799, true, true, 6, 'months'),
  ('IND_COM_ESP_12M', 'Plano Individual com Especialistas - Anual', 1599, true, true, 12, 'months'),

-- ========== FAMILIAR COM ESPECIALISTAS ==========
  ('FAM_COM_ESP_1M', 'Plano Familiar com Especialistas - Mensal', 3999, true, true, 1, 'months'),
  ('FAM_COM_ESP_6M', 'Plano Familiar com Especialistas - Semestral', 3399, true, true, 6, 'months'),
  ('FAM_COM_ESP_12M', 'Plano Familiar com Especialistas - Anual', 2990, true, true, 12, 'months'),

-- ========== INDIVIDUAL SEM ESPECIALISTAS ==========
  ('IND_SEM_ESP_1M', 'Plano Individual sem Especialistas - Mensal', 1999, true, true, 1, 'months'),
  ('IND_SEM_ESP_6M', 'Plano Individual sem Especialistas - Semestral', 1599, true, true, 6, 'months'),
  ('IND_SEM_ESP_12M', 'Plano Individual sem Especialistas - Anual', 1399, true, true, 12, 'months'),

-- ========== FAMILIAR SEM ESPECIALISTAS ==========
  ('FAM_SEM_ESP_1M', 'Plano Familiar sem Especialistas - Mensal', 2990, true, true, 1, 'months'),
  ('FAM_SEM_ESP_6M', 'Plano Familiar sem Especialistas - Semestral', 2690, true, true, 6, 'months'),
  ('FAM_SEM_ESP_12M', 'Plano Familiar sem Especialistas - Anual', 2430, true, true, 12, 'months')

ON CONFLICT (sku) DO UPDATE SET
  price_cents = EXCLUDED.price_cents,
  name = EXCLUDED.name,
  active = EXCLUDED.active,
  allows_recurring = EXCLUDED.allows_recurring,
  recurring_frequency = EXCLUDED.recurring_frequency,
  recurring_frequency_type = EXCLUDED.recurring_frequency_type;