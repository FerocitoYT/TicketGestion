-- Control de acceso ligado a evento
ALTER TABLE events ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN IF NOT EXISTS access_grace_minutes INT NOT NULL DEFAULT 120;
ALTER TABLE events ADD COLUMN IF NOT EXISTS access_closed BOOLEAN NOT NULL DEFAULT false;

-- Personal asignado a cada evento (una cuenta puede cubrir varios)
CREATE TABLE IF NOT EXISTS event_staff (
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);
