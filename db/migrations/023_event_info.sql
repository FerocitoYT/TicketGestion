-- Info práctica del día del evento
ALTER TABLE events ADD COLUMN IF NOT EXISTS transport TEXT NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN IF NOT EXISTS parking TEXT NOT NULL DEFAULT '';
