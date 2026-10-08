-- Sorteos entre asistentes validados
CREATE TABLE IF NOT EXISTS raffles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  prize TEXT NOT NULL,
  winners_count INT NOT NULL DEFAULT 1 CHECK (winners_count >= 1 AND winners_count <= 100),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','drawn')),
  drawn_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS raffle_winners (
  raffle_id UUID NOT NULL REFERENCES raffles(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (raffle_id, ticket_id)
);
