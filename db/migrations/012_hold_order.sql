-- Vincula el pedido con su reserva de asientos (para liberarla al pagar)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS hold_id UUID;
