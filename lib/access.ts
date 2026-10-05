// Control de acceso ligado a evento: un escáner solo valida sus eventos asignados
// y solo mientras el control está operativo:
//   - desde (inicio sesión − apertura) hasta (fin sesión + margen), o inicio/fin del evento;
//   - nunca si está cerrado a mano o cancelado/sin publicar.
export type AccessEvent = {
  id: string;
  title: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  access_grace_minutes: number;
  access_closed: boolean;
  access_opens_minutes?: number;
  session_starts_at?: string | null;
};

function fmtDay(d: string): string {
  return new Date(d).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

// Regla de puerta: abre a las 00:00 del día del evento (o de la sesión) y
// cierra 1 h después del inicio. El cierre manual y el estado mandan siempre.
export function accessState(e: AccessEvent, now: number = Date.now()): { open: boolean; reason: string } {
  if (e.status === "cancelled") return { open: false, reason: "Evento cancelado" };
  if (e.status !== "published") return { open: false, reason: "Evento no publicado" };
  if (e.access_closed) return { open: false, reason: "Control de acceso finalizado por la organización" };
  const start = new Date(e.session_starts_at || e.starts_at).getTime();
  const dayStart = new Date(start);
  dayStart.setHours(0, 0, 0, 0);
  if (now < dayStart.getTime()) {
    return { open: false, reason: `El control abre el ${fmtDay(new Date(dayStart).toISOString())}` };
  }
  if (now > start + 3600e3) {
    return { open: false, reason: "Control finalizado (1 h después del inicio)" };
  }
  return { open: true, reason: "" };
}
