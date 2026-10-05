// Minutos que dura la reserva de asientos sin pago.
export const HOLD_MINUTES = 10;
// Mapa de asientos: filas A..Z, columnas 1..N. Etiqueta: letra+numero (ej. F12).
export function seatName(row: number, col: number): string {
  return `${String.fromCharCode(65 + row)}${col + 1}`;
}
export function parseSeatMap(rows: number, cols: number): string[] {
  const out: string[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push(seatName(r, c));
  return out;
}
export function normalizeSeat(s: string): string {
  return s.trim().toUpperCase().slice(0, 20);
}
export function validSeat(seat: string, rows: number, cols: number): boolean {
  const m = /^([A-Z]{1,2})(\d{1,3})$/.exec(normalizeSeat(seat));
  if (!m) return false;
  const r = m[1].length === 1 ? m[1].charCodeAt(0) - 65 : 26 + (m[1].charCodeAt(0) - 65) * 26 + (m[1].charCodeAt(1) - 65);
  const c = Number(m[2]) - 1;
  return r >= 0 && r < rows && c >= 0 && c < cols;
}
