// Meteo del día del evento vía Open-Meteo (gratis, sin clave ni registro).
// https://open-meteo.com/en/docs — pronóstico hasta 16 días.
const WMO: Record<number, string> = {
  0: "Despejado", 1: "Casi despejado", 2: "Nuboso", 3: "Cubierto",
  45: "Niebla", 48: "Niebla", 51: "Llovizna", 53: "Llovizna", 55: "Llovizna",
  61: "Lluvia", 63: "Lluvia", 65: "Lluvia fuerte", 71: "Nieve", 73: "Nieve",
  75: "Nieve fuerte", 80: "Chubascos", 81: "Chubascos", 82: "Chubascos fuertes",
  95: "Tormenta", 96: "Tormenta", 99: "Tormenta",
};

export type Forecast = { tmax: number; precip: number; label: string };

export async function getForecast(city: string, dateIso: string): Promise<Forecast | null> {
  try {
    const day = dateIso.slice(0, 10);
    const diffDays = (new Date(day).getTime() - Date.now()) / 864e5;
    if (diffDays < -1 || diffDays > 16) return null;
    const g = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=es&format=json`,
      { next: { revalidate: 86400 * 30 } }
    );
    const gj = await g.json();
    const loc = gj.results?.[0];
    if (!loc) return null;
    const f = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}` +
        `&daily=temperature_2m_max,precipitation_probability_max,weathercode&timezone=auto&start_date=${day}&end_date=${day}`,
      { next: { revalidate: 3600 } }
    );
    const fj = await f.json();
    const d = fj.daily;
    if (!d?.time?.includes(day)) return null;
    const i = d.time.indexOf(day);
    return {
      tmax: Math.round(d.temperature_2m_max[i]),
      precip: Number(d.precipitation_probability_max[i] ?? 0),
      label: WMO[Number(d.weathercode[i])] || "—",
    };
  } catch {
    return null;
  }
}
