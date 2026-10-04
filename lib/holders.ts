// Titulares nominativos: una línea por entrada.
// Formato: "Nombre Apellidos" | "DNI/NIE" | "Asiento (ej. F5-A12, opcional)".
// Ejemplo: "Ana López | 12345678A | F5-A12"
export function parseHolders(raw: string, qty: number, fallback: string): { name: string; doc: string; seat: string }[] {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, qty);
  while (lines.length < qty) lines.push(fallback);
  return lines.map((l) => {
    const [name, doc, seat] = l.split("|").map((s) => s.trim());
    return { name: (name || fallback).slice(0, 120), doc: (doc || "").slice(0, 40), seat: (seat || "").slice(0, 20) };
  });
}
