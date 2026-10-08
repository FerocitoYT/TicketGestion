-- Entradas regalo: sin nominar hasta que el agasajado la activa con sus datos
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS is_gift BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_gift BOOLEAN NOT NULL DEFAULT false;
