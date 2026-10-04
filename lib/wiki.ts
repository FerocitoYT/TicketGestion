// Bio y foto de respaldo desde Wikipedia (API pública, sin clave).
// Se usa para completar artistas importados sin bio.
export async function fetchWikiBio(name: string): Promise<{ bio: string; photo: string }> {
  try {
    const r = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`, {
      headers: { "User-Agent": "TicketGestion/1.0" },
      next: { revalidate: 86400 * 7 },
    });
    if (!r.ok) return { bio: "", photo: "" };
    const j = await r.json();
    if (j.type === "disambiguation") return { bio: "", photo: "" };
    return {
      bio: typeof j.extract === "string" ? j.extract.slice(0, 1200) : "",
      photo: typeof j.thumbnail?.source === "string" ? j.thumbnail.source : "",
    };
  } catch {
    return { bio: "", photo: "" };
  }
}

export function slugify(s: string): string {
  return (
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) ||
    "artista"
  );
}
