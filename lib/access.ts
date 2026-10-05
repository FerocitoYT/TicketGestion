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

function fmtStart(d: string): string {
  return new Date(d).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function accessState(e: AccessEvent, now: number = Date.now()): { open: boolean; reason: string } {
  if (e.status === "cancelled") return { open: false, reason: "Evento cancelado" };
  if (e.status !== "published") return { open: false, reason: "Evento no publicado" };
  if (e.access_closed) return { open: false, reason: "Control de acceso finalizado por la organización" };
  const start = new Date(e.session_starts_at || e.starts_at).getTime();
  const opens = Number(e.access_opens_minutes ?? 120);
  if (now < start - opens * 60000) {
    return { open: false, reason: `El control abre el ${fmtStart(new Date(start - opens * 60000).toISOString())}` };
  }
  if (e.ends_at) {
    const limit = new Date(e.ends_at).getTime() + Number(e.access_grace_minutes || 0) * 60000;
    if (now > limit) return { open: false, reason: "Control finalizado (hora de fin superada)" };
  }
  return { open: true, reason: "" };
}
