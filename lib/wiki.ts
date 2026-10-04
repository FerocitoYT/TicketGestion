async function summary(title: string): Promise<{ bio: string; photo: string } | null> {
  try {
    const r = await fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
      headers: { "User-Agent": "TicketGestion/1.0" },
      next: { revalidate: 86400 * 7 },
    });
    if (!r.ok) return null;
    const j = await r.json();
    if (j.type === "disambiguation") return null;
    const bio = typeof j.extract === "string" ? j.extract.slice(0, 1200) : "";
    if (!bio) return null;
    return {
      bio,
      photo: typeof j.thumbnail?.source === "string" ? j.thumbnail.source : "",
    };
  } catch {
    return null;
  }
}

// Bio y foto de respaldo desde Wikipedia (API pública, sin clave).
// 1º título directo (con reintento en formato título), 2º buscador de Wikipedia
// para nombres ambiguos como "Rosalía" (la cantante está en "Rosalía (cantante)").
export async function fetchWikiBio(name: string): Promise<{ bio: string; photo: string }> {
  const empty = { bio: "", photo: "" };
  const titleCase = name.toLowerCase().replace(/(^[\p{L}]|[\s\-'][\p{L}])/gu, (m) => m.toUpperCase());
  const direct = [name, titleCase].filter((v, i, a) => v && a.indexOf(v) === i);
  for (const cand of direct) {
    const hit = await summary(cand);
    if (hit) return hit;
  }
  try {
    const r = await fetch(
      `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(name + " cantante música")}&srlimit=5&namespace=0&format=json`,
      { headers: { "User-Agent": "TicketGestion/1.0" } }
    );
    if (!r.ok) return empty;
    const j = await r.json();
    const titles = ((j.query?.search || []) as { title?: string }[]).map((x) => x.title || "").filter(Boolean).slice(0, 3);
    for (const t of titles) {
      const hit = await summary(t);
      if (hit) return hit;
    }
  } catch {
    /* noop */
  }
  return empty;
}

export function slugify(s: string): string {
  return (
    s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) ||
    "artista"
  );
}
