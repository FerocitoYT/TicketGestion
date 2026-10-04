// Top canciones vía iTunes Search API (gratuito, sin clave).
// Devuelve canciones ordenadas por popularidad, con carátula y preview de 30 s.
// iTunes no publica cifras de reproducciones: se calcula un ÍNDICE de popularidad
// transparente a partir del puesto (100 el #1, decay progresivo), etiquetado como índice.
export type TopSong = { title: string; album: string; artwork: string; preview: string; popularity: number };

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

export async function fetchTopSongs(artist: string, limit = 5): Promise<TopSong[]> {
  try {
    const r = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(artist)}&entity=song&limit=25&country=ES`,
      { next: { revalidate: 86400 } }
    );
    if (!r.ok) return [];
    const j = await r.json();
    const tracks = ((j.results || []) as Record<string, unknown>[]).filter((t) => t.trackName);
    const target = norm(artist);
    const mine = tracks.filter((t) => norm(String(t.artistName || "")).includes(target) || target.includes(norm(String(t.artistName || ""))));
    const picked = (mine.length >= 3 ? mine : tracks).slice(0, limit);
    return picked.map((t, i) => ({
      title: String(t.trackName || ""),
      album: String(t.collectionName || ""),
      artwork: String(t.artworkUrl100 || "").replace("100x100", "200x200"),
      preview: String(t.previewUrl || ""),
      popularity: Math.round(100 / Math.pow(i + 1, 0.7)),
    }));
  } catch {
    return [];
  }
}
