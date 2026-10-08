-- Packs de grupo: N entradas de una zona a precio cerrado
CREATE TABLE IF NOT EXISTS packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  qty INT NOT NULL CHECK (qty >= 2 AND qty <= 50),
  price_cents INT NOT NULL CHECK (price_cents >= 0),
  max_uses INT NOT NULL DEFAULT 0,
  used INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pack_id UUID REFERENCES packs(id) ON DELETE SET NULL;
