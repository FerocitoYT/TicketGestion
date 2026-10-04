// Control de acceso ligado a evento: un escáner solo valida sus eventos asignados
// y solo mientras el control está operativo (no cerrado a mano y dentro de hora fin + margen).
export type AccessEvent = {
  id: string;
  title: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  access_grace_minutes: number;
  access_closed: boolean;
};

export function accessState(e: AccessEvent, now: number = Date.now()): { open: boolean; reason: string } {
  if (e.status === "cancelled") return { open: false, reason: "Evento cancelado" };
  if (e.status !== "published") return { open: false, reason: "Evento no publicado" };
  if (e.access_closed) return { open: false, reason: "Control de acceso finalizado por la organización" };
  if (e.ends_at) {
    const limit = new Date(e.ends_at).getTime() + Number(e.access_grace_minutes || 0) * 60000;
    if (now > limit) return { open: false, reason: "Control finalizado (hora de fin superada)" };
  }
  return { open: true, reason: "" };
}
