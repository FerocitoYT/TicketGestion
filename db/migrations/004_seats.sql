-- Asiento opcional por entrada (solo recintos con asientos numerados)
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS seat TEXT NOT NULL DEFAULT '';
