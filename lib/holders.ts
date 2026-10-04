// Titulares nominativos: una línea por entrada, formato "Nombre Apellidos" o "Nombre Apellidos | DNI/NIE".
export function parseHolders(raw: string, qty: number, fallback: string): { name: string; doc: string }[] {
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, qty);
  while (lines.length < qty) lines.push(fallback);
  return lines.map((l) => {
    const [name, doc] = l.split("|").map((s) => s.trim());
    return { name: (name || fallback).slice(0, 120), doc: (doc || "").slice(0, 40) };
  });
}
