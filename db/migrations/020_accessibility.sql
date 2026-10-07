-- Accesibilidad: zonas adaptadas y acompañante (gratis o de pago según evento)
ALTER TABLE zones ADD COLUMN IF NOT EXISTS accessible BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE zones ADD COLUMN IF NOT EXISTS companion_free BOOLEAN NOT NULL DEFAULT true;
