-- Atualizar preços das especialidades existentes

-- Neurologia: R$89,90 → R$119,90
UPDATE services SET price_cents = 11990 WHERE sku = 'PKS9388';

-- Infectologia: R$129,90 → R$119,90
UPDATE services SET price_cents = 11990 WHERE sku = 'MYX5186';

-- Nutrologia: já está R$119,90 (11990) - sem alteração
-- Geriatria: já está R$119,90 (11990) - sem alteração

-- Médico da Família: R$89,90 → R$119,90
UPDATE services SET price_cents = 11990 WHERE sku = 'DYY8522';

-- Reumatologia: já está R$129,90 (12990) - sem alteração
-- Urologia: já está R$109,90 (10990) - sem alteração

-- Adicionar novas especialidades
INSERT INTO services (sku, name, description, price_cents, category, is_active) VALUES
('IMU4471', 'Imunologista', 'Consulta com imunologista', 11990, 'especialistas', true),
('PRC6621', 'Proctologista', 'Consulta com proctologista', 12990, 'especialistas', true),
('PNE7783', 'Pneumologista', 'Consulta com pneumologista', 13990, 'especialistas', true)
ON CONFLICT (sku) DO UPDATE SET price_cents = EXCLUDED.price_cents, name = EXCLUDED.name, is_active = EXCLUDED.is_active;
