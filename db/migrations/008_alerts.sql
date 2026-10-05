-- Alertas de artista: avisar por email de nuevos eventos
CREATE TABLE IF NOT EXISTS artist_alerts (
  artist_id UUID NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (artist_id, email)
);
