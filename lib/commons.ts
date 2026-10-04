// Fotos de artistas vía Wikimedia Commons (gratuito, sin clave ni registro).
// Suele tener fotos de conciertos aunque Wikipedia no tenga miniatura.
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export async function fetchCommonsPhoto(name: string): Promise<string> {
  try {
    const url =
      `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(name + " cantante concierto")}` +
      `&gsrnamespace=6&gsrlimit=20&prop=imageinfo&iiprop=url%7Csize%7Cmime&iiurlwidth=500&format=json`;
    const r = await fetch(url, { headers: { "User-Agent": "TicketGestion/1.0" } });
    if (!r.ok) return "";
    const j = await r.json();
    const pages = Object.values((j.query?.pages || {}) as Record<string, {
      title?: string;
      imageinfo?: { mime?: string; width?: number; thumburl?: string }[];
    }>);
    const words = norm(name).split(/\s+/).filter((w) => w.length > 2);
    const scored = pages
      .map((p) => {
        const info = p.imageinfo?.[0];
        const t = norm(p.title || "");
        if (!info || (info.mime !== "image/jpeg" && info.mime !== "image/png")) return null;
        if ((info.width || 0) < 300) return null;
        if (/signature|firma|logo|cover|album|poster|ticket/.test(t)) return null;
        const hits = words.filter((w) => t.includes(w)).length;
        if (hits === 0) return null;
        return { hits, thumb: (info.thumburl || "").split("?")[0] };
      })
      .filter((x): x is { hits: number; thumb: string } => Boolean(x && x.thumb))
      .sort((a, b) => b.hits - a.hits);
    return scored[0]?.thumb || "";
  } catch {
    return "";
  }
}
