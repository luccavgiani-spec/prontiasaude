-- Fix: Remove DEFERRABLE constraint that prevents ON CONFLICT from working
-- This was causing the upsert in schedule-redirect to fail

-- 1. Drop existing deferrable constraint
ALTER TABLE appointments 
DROP CONSTRAINT IF EXISTS appointments_order_id_unique;

-- 2. Recreate as standard NOT DEFERRABLE constraint
ALTER TABLE appointments 
ADD CONSTRAINT appointments_order_id_unique 
UNIQUE (order_id);