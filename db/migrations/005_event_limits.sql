-- Límites por evento para controlar aforo y acaparamiento
ALTER TABLE events ADD COLUMN IF NOT EXISTS max_per_order INT NOT NULL DEFAULT 10;
ALTER TABLE events ADD COLUMN IF NOT EXISTS max_per_buyer INT NOT NULL DEFAULT 0;
