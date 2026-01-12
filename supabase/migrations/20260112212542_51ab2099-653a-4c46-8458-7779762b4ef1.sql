-- Adicionar colunas se não existirem
ALTER TABLE services ADD COLUMN IF NOT EXISTS allows_recurring boolean DEFAULT false;
ALTER TABLE services ADD COLUMN IF NOT EXISTS recurring_frequency integer;
ALTER TABLE services ADD COLUMN IF NOT EXISTS recurring_frequency_type text;

-- Limpar tabela para inserir dados corretos
DELETE FROM services;

-- ===== SERVIÇOS AVULSOS =====

-- Consultas
INSERT INTO services (sku, name, description, price_cents, category, is_active) VALUES
('ITC6534', 'Pronto Atendimento', 'Consulta médica online com clínico geral', 3990, 'consulta', true);

-- Psicologia
INSERT INTO services (sku, name, description, price_cents, category, is_active) VALUES
('ZXW2165', 'Psicólogo (sessão avulsa)', 'Sessão individual com psicólogo', 3999, 'psicologia', true),
('HXR8516', 'Psicólogo (pacote 4 sessões)', 'Pacote de 4 sessões com psicólogo', 14996, 'psicologia', true),
('YME9025', 'Psicólogo (pacote 8 sessões)', 'Pacote de 8 sessões com psicólogo', 27992, 'psicologia', true);

-- Exames e Laudos
INSERT INTO services (sku, name, description, price_cents, category, is_active) VALUES
('ULT3571', 'Solicitação de Exames', 'Consulta para solicitação de exames', 3490, 'exames', true),
('OVM9892', 'Laudos Psicológicos', 'Emissão de laudo psicológico', 12990, 'laudos', true);

-- ===== MÉDICOS ESPECIALISTAS =====
INSERT INTO services (sku, name, description, price_cents, category, is_active) VALUES
('BIR7668', 'Personal Trainer', 'Consulta com personal trainer', 5499, 'especialistas', true),
('VPN5132', 'Nutricionista', 'Consulta com nutricionista', 5990, 'especialistas', true),
('TQP5720', 'Cardiologista', 'Consulta com cardiologista', 8990, 'especialistas', true),
('HGG3503', 'Dermatologista', 'Consulta com dermatologista', 8990, 'especialistas', true),
('VHH8883', 'Endocrinologista', 'Consulta com endocrinologista', 8990, 'especialistas', true),
('TSB0751', 'Gastroenterologista', 'Consulta com gastroenterologista', 8990, 'especialistas', true),
('CCP1566', 'Ginecologista', 'Consulta com ginecologista', 8990, 'especialistas', true),
('FKS5964', 'Oftalmologista', 'Consulta com oftalmologista', 8990, 'especialistas', true),
('TVQ5046', 'Ortopedista', 'Consulta com ortopedista', 8990, 'especialistas', true),
('HMG9544', 'Pediatra', 'Consulta com pediatra', 8990, 'especialistas', true),
('HME8366', 'Otorrinolaringologista', 'Consulta com otorrinolaringologista', 8990, 'especialistas', true),
('DYY8522', 'Médico da Família', 'Consulta com médico da família', 8990, 'especialistas', true),
('QOP1101', 'Psiquiatra', 'Consulta com psiquiatra', 8990, 'especialistas', true),
('URO1099', 'Urologista', 'Consulta com urologista', 10990, 'especialistas', true),
('LZF3879', 'Nutrólogo', 'Consulta com nutrólogo', 11990, 'especialistas', true),
('YZD9932', 'Geriatria', 'Consulta com geriatra', 11990, 'especialistas', true),
('UDH3250', 'Reumatologista', 'Consulta com reumatologista', 12990, 'especialistas', true),
('PKS9388', 'Neurologista', 'Consulta com neurologista', 12990, 'especialistas', true),
('MYX5186', 'Infectologista', 'Consulta com infectologista', 12990, 'especialistas', true);

-- ===== PLANOS DE ASSINATURA (preço TOTAL do período) =====

-- Individual COM Especialistas
INSERT INTO services (sku, name, description, price_cents, category, is_active, allows_recurring, recurring_frequency, recurring_frequency_type) VALUES
('IND_COM_ESP_1M', 'Individual com Especialistas - Mensal', 'Plano individual mensal com acesso a especialistas', 2399, 'planos', true, true, 1, 'months'),
('IND_COM_ESP_6M', 'Individual com Especialistas - Semestral', 'Plano individual semestral com acesso a especialistas', 10794, 'planos', true, false, 6, 'months'),
('IND_COM_ESP_12M', 'Individual com Especialistas - Anual', 'Plano individual anual com acesso a especialistas', 19188, 'planos', true, false, 12, 'months');

-- Individual SEM Especialistas
INSERT INTO services (sku, name, description, price_cents, category, is_active, allows_recurring, recurring_frequency, recurring_frequency_type) VALUES
('IND_SEM_ESP_1M', 'Individual sem Especialistas - Mensal', 'Plano individual mensal básico', 1999, 'planos', true, true, 1, 'months'),
('IND_SEM_ESP_6M', 'Individual sem Especialistas - Semestral', 'Plano individual semestral básico', 9594, 'planos', true, false, 6, 'months'),
('IND_SEM_ESP_12M', 'Individual sem Especialistas - Anual', 'Plano individual anual básico', 16788, 'planos', true, false, 12, 'months');

-- Familiar COM Especialistas
INSERT INTO services (sku, name, description, price_cents, category, is_active, allows_recurring, recurring_frequency, recurring_frequency_type) VALUES
('FAM_COM_ESP_1M', 'Familiar com Especialistas - Mensal', 'Plano familiar mensal com acesso a especialistas', 3999, 'planos', true, true, 1, 'months'),
('FAM_COM_ESP_6M', 'Familiar com Especialistas - Semestral', 'Plano familiar semestral com acesso a especialistas', 20394, 'planos', true, false, 6, 'months'),
('FAM_COM_ESP_12M', 'Familiar com Especialistas - Anual', 'Plano familiar anual com acesso a especialistas', 35880, 'planos', true, false, 12, 'months');

-- Familiar SEM Especialistas
INSERT INTO services (sku, name, description, price_cents, category, is_active, allows_recurring, recurring_frequency, recurring_frequency_type) VALUES
('FAM_SEM_ESP_1M', 'Familiar sem Especialistas - Mensal', 'Plano familiar mensal básico', 2990, 'planos', true, true, 1, 'months'),
('FAM_SEM_ESP_6M', 'Familiar sem Especialistas - Semestral', 'Plano familiar semestral básico', 16140, 'planos', true, false, 6, 'months'),
('FAM_SEM_ESP_12M', 'Familiar sem Especialistas - Anual', 'Plano familiar anual básico', 29160, 'planos', true, false, 12, 'months');