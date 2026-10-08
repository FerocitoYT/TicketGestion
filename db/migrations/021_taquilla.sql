-- Taquilla presencial: método de cobro en el pedido
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT '';
