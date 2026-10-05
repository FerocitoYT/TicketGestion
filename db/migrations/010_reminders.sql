-- Recordatorios pre-evento (sin duplicados)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMPTZ;
