-- Sesiones (varias fechas por evento) y mapa de asientos por zona
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_event ON sessions(event_id, starts_at);

-- Una sesión por evento existente con sus fechas actuales
INSERT INTO sessions (event_id, starts_at, ends_at)
SELECT id, starts_at, ends_at FROM events
ON CONFLICT DO NOTHING;

ALTER TABLE zones ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES sessions(id) ON DELETE CASCADE;
-- Vincula cada zona a la sesión de su evento
UPDATE zones z SET session_id = s.id FROM sessions s WHERE s.event_id = z.event_id AND z.session_id IS NULL;

-- Mapa de asientos: 0 = grada general sin numerar
ALTER TABLE zones ADD COLUMN IF NOT EXISTS seat_rows INT NOT NULL DEFAULT 0;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS seat_cols INT NOT NULL DEFAULT 0;

-- Anti-doble-venta de asientos (solo cuando hay asiento asignado)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_zone_seat ON tickets(zone_id, seat) WHERE seat <> '';
