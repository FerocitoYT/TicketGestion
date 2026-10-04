// Fotos de artistas vía Deezer API (gratuita, sin clave).
// Docs: https://developers.deezer.com/api/search
// Se usa como respaldo cuando Wikipedia no tiene foto.
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}

export async function fetchDeezerPhoto(name: string): Promise<{ photo: string; fans: number }> {
  try {
    const r = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=8`);
    if (!r.ok) return { photo: "", fans: 0 };
    const j = await r.json();
    const list = (j.data || []) as { name?: string; nb_fan?: number; picture_big?: string }[];
    const target = norm(name);
    const scored = list
      .filter((a) => a.picture_big)
      .map((a) => ({ a, exact: norm(a.name || "") === target, fans: Number(a.nb_fan || 0) }))
      .sort((x, y) => Number(y.exact) - Number(x.exact) || y.fans - x.fans);
    const best = scored[0];
    if (!best || (!best.exact && best.fans < 100)) return { photo: "", fans: 0 };
    return { photo: best.a.picture_big || "", fans: best.fans };
  } catch {
    return { photo: "", fans: 0 };
  }
}
