-- El control abre N minutos antes del inicio (por sesión); antes, deniega
ALTER TABLE events ADD COLUMN IF NOT EXISTS access_opens_minutes INT NOT NULL DEFAULT 120;
