-- Lista de espera por zona agotada
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  qty INT NOT NULL DEFAULT 1 CHECK (qty >= 1 AND qty <= 50),
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(zone_id, email)
);
CREATE INDEX IF NOT EXISTS idx_waitlist_zone ON waitlist(zone_id, notified_at);
