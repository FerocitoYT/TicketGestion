-- Promotores/afiliados por evento: código con descuento y comisión por venta
CREATE TABLE IF NOT EXISTS promoters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  commission_pct INT NOT NULL DEFAULT 10 CHECK (commission_pct >= 0 AND commission_pct <= 100),
  discount_pct INT NOT NULL DEFAULT 0 CHECK (discount_pct >= 0 AND discount_pct <= 100),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, code)
);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promoter_id UUID REFERENCES promoters(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS commission_cents INT NOT NULL DEFAULT 0;
