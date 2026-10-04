// TheAudioDB nivel gratuito (clave pública "123", sin registro).
// Búsqueda por MusicBrainz ID: foto + biografía en español + género.
// Docs: https://www.theaudiodb.com/free_music_api
export async function fetchAudioDbByMbid(mbid: string): Promise<{ photo: string; bio: string; genre: string }> {
  const empty = { photo: "", bio: "", genre: "" };
  try {
    const r = await fetch(`https://www.theaudiodb.com/api/v1/json/123/artist-mb.php?i=${encodeURIComponent(mbid)}`);
    if (!r.ok) return empty;
    const j = await r.json();
    const a = (j.artists || [])[0] as Record<string, unknown> | undefined;
    if (!a) return empty;
    return {
      photo: typeof a.strArtistThumb === "string" ? a.strArtistThumb : "",
      bio: typeof a.strBiographyES === "string" && a.strBiographyES ? (a.strBiographyES as string).slice(0, 1500) : "",
      genre: typeof a.strGenre === "string" ? (a.strGenre as string).slice(0, 80) : "",
    };
  } catch {
    return empty;
  }
}
