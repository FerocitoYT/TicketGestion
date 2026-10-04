// Cliente de Ticketmaster Discovery API (atracciones = artistas/equipos).
// Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
// Requiere TM_API_KEY (gratuita, ~5000 req/día).
export type TmAttraction = {
  tmId: string;
  name: string;
  image: string;
  genre: string;
  segment: string;
  url: string;
};

function pickImage(images: { url: string; width?: number }[] | undefined): string {
  if (!images?.length) return "";
  const sorted = [...images].sort((a, b) => (b.width || 0) - (a.width || 0));
  return sorted.find((i) => (i.width || 0) >= 300)?.url || sorted[0].url;
}

export async function searchAttractions(q: string, locale = "es"): Promise<{ attractions: TmAttraction[]; error?: string }> {
  const key = process.env.TM_API_KEY || "";
  if (!key || key.includes("replace_me")) return { attractions: [], error: "Configura TM_API_KEY para importar artistas (https://developer.ticketmaster.com)." };
  const url = `https://app.ticketmaster.com/discovery/v2/attractions.json?apikey=${encodeURIComponent(key)}&keyword=${encodeURIComponent(q)}&locale=${locale}&size=12&sort=name,asc`;
  try {
    const r = await fetch(url, { next: { revalidate: 86400 } });
    if (!r.ok) return { attractions: [], error: `Ticketmaster respondió ${r.status}` };
    const j = await r.json();
    const list = j._embedded?.attractions || [];
    return {
      attractions: list.map((a: Record<string, unknown>) => {
        const cl = (a.classifications as { segment?: { name?: string }; genre?: { name?: string } }[] | undefined)?.[0];
        return {
          tmId: String(a.id || ""),
          name: String(a.name || ""),
          image: pickImage(a.images as { url: string; width?: number }[] | undefined),
          genre: String(cl?.genre?.name || ""),
          segment: String(cl?.segment?.name || ""),
          url: String(a.url || ""),
        } as TmAttraction;
      }),
    };
  } catch {
    return { attractions: [], error: "No se pudo contactar con Ticketmaster" };
  }
}
