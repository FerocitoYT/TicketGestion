-- Acreditaciones (prensa/VIP/invitados): entradas gratuitas con cupo, nominativas en puerta
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'general';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'venta';
