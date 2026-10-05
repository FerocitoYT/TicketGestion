"use client";
import { useEffect, useState } from "react";
import { seatName } from "@/lib/seats";

type Session = { id: string; starts_at: string; ends_at: string | null };
type Zone = { id: string; name: string; price_cents: number; capacity: number; sold: number; session_id: string; seat_rows: number; seat_cols: number };

// Paso 1: elige fecha, zona y asientos en el plano → se reservan 10 min.
// Paso 2: datos del comprador + pago con cuenta atrás. Sin pago, se liberan solos.
export default function BuyBox({ eventId, sessions, zones, maxOrder, simulated }: {
  eventId: string; sessions: Session[]; zones: Zone[]; maxOrder: number; simulated: boolean;
}) {
  const [sesId, setSesId] = useState(sessions[0]?.id || "");
  const [zoneId, setZoneId] = useState("");
  const [taken, setTaken] = useState<string[]>([]);
  const [held, setHeld] = useState<string[]>([]);
  const [mapSize, setMapSize] = useState({ rows: 0, cols: 0 });
  const [seats, setSeats] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [hold, setHold] = useState<{ holdId: string; seats: string[]; expiresAt: string } | null>(null);
  const [holdError, setHoldError] = useState("");
  const [reserving, setReserving] = useState(false);
  const [left, setLeft] = useState(0);

  const sesZones = zones.filter((z) => z.session_id === sesId);
  const zone = sesZones.find((z) => z.id === zoneId) || sesZones[0];
  const avail = (z: Zone) => z.capacity - z.sold;
  const mapped = !!zone && zone.seat_rows > 0;
  const fmt = (d: string) => new Date(d).toLocaleString("es-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  useEffect(() => {
    setZoneId("");
    setSeats([]);
    setHold(null);
  }, [sesId]);

  async function loadMap(zid: string, holdId?: string) {
    setSeats([]);
    const z = zones.find((x) => x.id === zid);
    if (!z || !z.seat_rows) { setTaken([]); setHeld([]); setMapSize({ rows: 0, cols: 0 }); return; }
    try {
      const r = await fetch(`/api/zones/${zid}/seats${holdId ? `?hold=${holdId}` : ""}`);
      const j = await r.json();
      setTaken(j.taken || []);
      setHeld(j.held || []);
      setMapSize({ rows: j.rows || 0, cols: j.cols || 0 });
    } catch { /* noop */ }
  }

  useEffect(() => {
    if (zone?.id) loadMap(zone.id, hold?.holdId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone?.id]);

  useEffect(() => {
    if (!hold) return;
    const tick = () => setLeft(Math.max(0, Math.ceil((new Date(hold.expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(() => {
      tick();
      if (new Date(hold.expiresAt).getTime() < Date.now()) {
        clearInterval(t);
        setHold(null);
        setHoldError("La reserva caducó (10 min). Elige de nuevo los asientos.");
        if (zone?.id) loadMap(zone.id);
      }
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hold?.holdId]);

  function toggle(seat: string) {
    if (taken.includes(seat) || held.includes(seat) || hold) return;
    setSeats((s) => (s.includes(seat) ? s.filter((x) => x !== seat) : [...s, seat].slice(0, maxOrder)));
  }

  async function reserve() {
    if (!zone || seats.length === 0) return;
    setReserving(true);
    setHoldError("");
    try {
      const r = await fetch("/api/holds", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ zoneId: zone.id, seats }),
      });
      const j = await r.json();
      if (!r.ok) {
        setHoldError(j.error || "No se pudo reservar");
        loadMap(zone.id);
        return;
      }
      setHold({ holdId: j.holdId, seats: j.seats, expiresAt: j.expiresAt });
      loadMap(zone.id, j.holdId);
    } finally {
      setReserving(false);
    }
  }

  async function cancelHold() {
    if (hold) await fetch("/api/holds", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ holdId: hold.holdId }) }).catch(() => {});
    setHold(null);
    setSeats([]);
    if (zone?.id) loadMap(zone.id);
  }

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div>
      {sessions.length > 1 && !hold && (
        <label>Fecha
          <select value={sesId} onChange={(e) => setSesId(e.target.value)}>
            {sessions.map((s) => <option key={s.id} value={s.id}>{fmt(s.starts_at)}</option>)}
          </select>
        </label>
      )}
      {!hold && (
        <>
          <label>Zona
            <select value={zone?.id || ""} onChange={(e) => setZoneId(e.target.value)} required>
              <option value="" disabled>Elige zona…</option>
              {sesZones.map((z) => (
                <option key={z.id} value={z.id} disabled={avail(z) <= 0}>
                  {z.name} — {(z.price_cents / 100).toFixed(2)} € ({avail(z)} disp.)
                </option>
              ))}
            </select>
          </label>
          {mapped && zone && (
            <div>
              <p className="muted">Paso 1 — elige tus asientos ({seats.length}/{maxOrder}):</p>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${mapSize.cols}, 1fr)`, gap: 4, maxWidth: 420 }}>
                {Array.from({ length: mapSize.rows }, (_, r) =>
                  Array.from({ length: mapSize.cols }, (_, c) => {
                    const s = seatName(r, c);
                    const busy = taken.includes(s);
                    const other = held.includes(s);
                    const sel = seats.includes(s);
                    return (
                      <button key={s} type="button" disabled={busy || other} onClick={() => toggle(s)} title={s}
                        style={{
                          aspectRatio: "1", borderRadius: 6, border: "1px solid #c4d0e2",
                          cursor: busy || other ? "not-allowed" : "pointer",
                          background: busy ? "#c9d2e3" : other ? "#f0c96a" : sel ? "var(--tm-blue)" : "#fff",
                          color: sel ? "#fff" : "inherit", fontSize: 10, padding: 0,
                        }}>{s}</button>
                      );
                  })
                )}
              </div>
              <p className="muted" style={{ fontSize: 12 }}>Gris: vendido · Amarillo: reservado por otro · Azul: tuyos</p>
              {seats.length > 0 && <p><span className="badge">{[...seats].sort().join(", ")}</span></p>}
              {holdError && <p className="alert err">{holdError}</p>}
              <button type="button" className="btn btn-blue" onClick={reserve} disabled={seats.length === 0 || reserving} style={{ marginTop: 8 }}>
                {reserving ? "Reservando…" : `Reservar ${seats.length} asiento${seats.length === 1 ? "" : "s"} (10 min)`}
              </button>
            </div>
          )}
          {!mapped && zone && (
            <form action="/api/checkout" method="post" className="form" style={{ marginTop: 12 }}>
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="zoneId" value={zone.id} />
              <input type="hidden" name="qty" value={String(Math.max(1, Math.min(maxOrder, qty)))} />
              <label>Nombre completo<input name="buyerName" required placeholder="Tu nombre" /></label>
              <label>Email<input name="buyerEmail" type="email" required placeholder="tu@email.com" /></label>
              <div className="row">
                <label>Cantidad<input type="number" min={1} max={maxOrder} value={qty} onChange={(e) => setQty(Math.min(maxOrder, Math.max(1, Number(e.target.value) || 1)))} required /></label>
                <label>Código promo<input name="promo" placeholder="EARLY10" /></label>
              </div>
              <label>Titulares (uno por línea: “Nombre | DNI | Asiento opcional”)<textarea name="holders" rows={2} placeholder="Ana López | 12345678A" /></label>
              {simulated
                ? <><p className="alert ok">Modo pruebas: pago simulado. Tarjeta 4242 4242 4242 4242.</p><button>Pagar (simulado)</button></>
                : <button>Comprar con Stripe</button>}
            </form>
          )}
        </>
      )}
      {hold && zone && (
        <form action="/api/checkout" method="post" className="form">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="zoneId" value={zone.id} />
          <input type="hidden" name="qty" value={String(hold.seats.length)} />
          <input type="hidden" name="seats" value={JSON.stringify(hold.seats)} />
          <input type="hidden" name="holdId" value={hold.holdId} />
          <p className="alert ok">Paso 2 — Asientos reservados: <strong>{[...hold.seats].sort().join(", ")}</strong><br />Te quedan <strong>{mm}:{ss}</strong> para pagar. Sin pago, se liberan solos.</p>
          <label>Nombre completo<input name="buyerName" required placeholder="Tu nombre" /></label>
          <label>Email<input name="buyerEmail" type="email" required placeholder="tu@email.com" /></label>
          <label>Código promo<input name="promo" placeholder="EARLY10" /></label>
          <label>Titulares (uno por línea: “Nombre | DNI”, en orden de asiento)<textarea name="holders" rows={2} placeholder="Ana López | 12345678A" /></label>
          {simulated
            ? <><p className="alert ok">Modo pruebas: pago simulado. Tarjeta 4242 4242 4242 4242.</p><button>Pagar (simulado)</button></>
            : <button>Comprar con Stripe</button>}
          <button type="button" className="btn-ghost" onClick={cancelHold}>Cancelar reserva</button>
        </form>
      )}
    </div>
  );
}
