-- Adicionar constraint única em order_id para evitar duplicação de appointments
ALTER TABLE appointments 
ADD CONSTRAINT appointments_order_id_unique 
UNIQUE (order_id) 
DEFERRABLE INITIALLY DEFERRED;