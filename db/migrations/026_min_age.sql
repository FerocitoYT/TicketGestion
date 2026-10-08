-- Edad mínima del evento (0 = todos los públicos)
ALTER TABLE events ADD COLUMN IF NOT EXISTS min_age INT NOT NULL DEFAULT 0;
