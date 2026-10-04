// Catálogo de artistas españoles vía MusicBrainz (gratuito, sin clave).
// Docs: https://musicbrainz.org/doc/MusicBrainz_API/Search
// Cortesía: 1 req/seg + User-Agent identificativo.
export type MbArtist = {
  mbid: string;
  name: string;
  info: string;
  area: string;
  genre: string;
};

const UA = "TicketGestion/1.0 (https://github.com/FerocitoYT/TicketGestion)";

export async function searchArtistsSpain(q: string): Promise<{ artists: MbArtist[]; error?: string }> {
  const query = `artist:"${q}" AND area:"Spain"`;
  const url = `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(query)}&fmt=json&limit=12`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (r.status === 503) return { artists: [], error: "MusicBrainz ocupado, prueba en unos segundos" };
    if (!r.ok) return { artists: [], error: `MusicBrainz respondió ${r.status}` };
    const j = await r.json();
    const list = (j.artists || []) as Record<string, unknown>[];
    return {
      artists: list.map((a) => {
        const tags = ((a.tags as { name?: string; count?: number }[] | undefined) || [])
          .sort((x, y) => (y.count || 0) - (x.count || 0));
        const parts = [
          a.type ? String(a.type) : "",
          a.disambiguation ? String(a.disambiguation) : "",
        ].filter(Boolean);
        return {
          mbid: String(a.id || ""),
          name: String(a.name || ""),
          info: parts.join(" · "),
          area: String((a.area as { name?: string } | undefined)?.name || ""),
          genre: String(tags[0]?.name || ""),
        } as MbArtist;
      }),
    };
  } catch {
    return { artists: [], error: "No se pudo contactar con MusicBrainz" };
  }
}
