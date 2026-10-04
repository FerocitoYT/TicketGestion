-- Entradas nominativas: cada ticket queda asociado a una persona.
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS holder_doc TEXT NOT NULL DEFAULT '';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS holders JSONB NOT NULL DEFAULT '[]';
-- Los códigos antiguos TG-XXXXXXXX siguen siendo válidos; los nuevos son 8 chars estilo F8CL34RS.
