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

// MusicBrainz no usa API keys (acceso anónimo) pero exige cortesía: ~1 req/seg.
// Este throttle en memoria evita 503 por ráfagas desde el panel.
let lastCall = 0;
async function courteousFetch(url: string): Promise<Response> {
  const wait = 1100 - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();
  return fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
}

export async function searchArtistsSpain(q: string): Promise<{ artists: MbArtist[]; error?: string }> {
  const clean = q.trim().replace(/"/g, "");
  // 1º artistas de España (área principal), 2º resto del mundo como respaldo
  // (muchos artistas españoles no tienen el área informada en MusicBrainz).
  const queries = [
    `(artist:"${clean}" OR alias:"${clean}") AND area:"Spain"`,
    `(artist:"${clean}" OR alias:"${clean}")`,
  ];
  const seen = new Set<string>();
  const out: MbArtist[] = [];
  for (const query of queries) {
    if (out.length >= 25) break;
    const url = `https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(query)}&fmt=json&limit=25`;
    let j: { artists?: Record<string, unknown>[] };
    try {
      const r = await courteousFetch(url);
      if (r.status === 503) return { artists: out, error: "MusicBrainz ocupado, prueba en unos segundos" };
      if (!r.ok) continue;
      j = await r.json();
    } catch {
      continue;
    }
    for (const a of j.artists || []) {
      const mbid = String(a.id || "");
      if (!mbid || seen.has(mbid)) continue;
      seen.add(mbid);
      const tags = ((a.tags as { name?: string; count?: number }[] | undefined) || [])
        .sort((x, y) => (y.count || 0) - (x.count || 0));
      const parts = [
        a.type ? String(a.type) : "",
        a.disambiguation ? String(a.disambiguation) : "",
      ].filter(Boolean);
      out.push({
        mbid,
        name: String(a.name || ""),
        info: parts.join(" · "),
        area: String((a.area as { name?: string } | undefined)?.name || ""),
        genre: String(tags[0]?.name || ""),
      });
      if (out.length >= 25) break;
    }
  }
  // Españoles primero, resto después.
  out.sort((a, b) => Number(b.area === "Spain") - Number(a.area === "Spain"));
  return { artists: out };
}
