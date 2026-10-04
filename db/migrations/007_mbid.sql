-- Artistas vía MusicBrainz en vez de Ticketmaster
ALTER TABLE artists ADD COLUMN IF NOT EXISTS mbid TEXT UNIQUE;
