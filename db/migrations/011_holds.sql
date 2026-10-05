-- Reservas temporales de asientos (10 min): si no se paga, se liberan solos
CREATE TABLE IF NOT EXISTS seat_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hold_id UUID NOT NULL,
  zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  seat TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_hold_seat ON seat_holds(zone_id, seat);
CREATE INDEX IF NOT EXISTS idx_holds_expiry ON seat_holds(expires_at);
