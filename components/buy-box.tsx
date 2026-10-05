"use client";
import { useEffect, useState } from "react";
import { seatName } from "@/lib/seats";

type Session = { id: string; starts_at: string; ends_at: string | null };
type Zone = { id: string; name: string; price_cents: number; capacity: number; sold: number; session_id: string; seat_rows: number; seat_cols: number };

export default function BuyBox({ eventId, sessions, zones, maxOrder, simulated }: {
  eventId: string; sessions: Session[]; zones: Zone[]; maxOrder: number; simulated: boolean;
}) {
  const [sesId, setSesId] = useState(sessions[0]?.id || "");
  const [zoneId, setZoneId] = useState("");
  const [taken, setTaken] = useState<string[]>([]);
  const [mapSize, setMapSize] = useState({ rows: 0, cols: 0 });
  const [seats, setSeats] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const sesZones = zones.filter((z) => z.session_id === sesId);
  const zone = sesZones.find((z) => z.id === zoneId) || sesZones[0];
  const avail = (z: Zone) => z.capacity - z.sold;

  useEffect(() => {
    setZoneId("");
    setSeats([]);
  }, [sesId]);

  useEffect(() => {
    const zid = zone?.id || "";
    setSeats([]);
    if (!zid) return;
    const z = zones.find((x) => x.id === zid);
    if (!z || !z.seat_rows) { setTaken([]); setMapSize({ rows: 0, cols: 0 }); return; }
    fetch(`/api/zones/${zid}/seats`).then((r) => r.json()).then((j) => {
      setTaken(j.taken || []);
      setMapSize({ rows: j.rows || 0, cols: j.cols || 0 });
    }).catch(() => {});
  }, [zone?.id]);

  function toggle(seat: string) {
    if (taken.includes(seat)) return;
    setSeats((s) => (s.includes(seat) ? s.filter((x) => x !== seat) : [...s, seat].slice(0, maxOrder)));
  }

  const mapped = mapSize.rows > 0;
  const effectiveQty = mapped ? seats.length : qty;
  const fmt = (d: string) => new Date(d).toLocaleString("es-ES", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <form action="/api/checkout" method="post" className="form">
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="qty" value={String(Math.max(1, effectiveQty))} />
      <input type="hidden" name="seats" value={JSON.stringify(seats)} />
      {sessions.length > 1 && (
        <label>Fecha
          <select value={sesId} onChange={(e) => setSesId(e.target.value)}>
            {sessions.map((s) => <option key={s.id} value={s.id}>{fmt(s.starts_at)}</option>)}
          </select>
        </label>
      )}
      <label>Nombre completo<input name="buyerName" required placeholder="Tu nombre" /></label>
      <label>Email<input name="buyerEmail" type="email" required placeholder="tu@email.com" /></label>
      <label>Zona
        <select name="zoneId" required value={zone?.id || ""} onChange={(e) => setZoneId(e.target.value)}>
          <option value="" disabled>Elige zona…</option>
          {sesZones.map((z) => (
            <option key={z.id} value={z.id} disabled={avail(z) <= 0}>
              {z.name} — {(z.price_cents / 100).toFixed(2)} € ({avail(z)} disp.)
            </option>
          ))}
        </select>
      </label>
      {mapped && (
        <div>
          <p className="muted">Elige tus asientos ({seats.length}/{maxOrder}):</p>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${mapSize.cols}, 1fr)`, gap: 4, maxWidth: 420 }}>
            {Array.from({ length: mapSize.rows }, (_, r) =>
              Array.from({ length: mapSize.cols }, (_, c) => {
                const s = seatName(r, c);
                const busy = taken.includes(s);
                const sel = seats.includes(s);
                return (
                  <button key={s} type="button" disabled={busy} onClick={() => toggle(s)} title={s}
                    style={{
                      aspectRatio: "1", borderRadius: 6, border: "1px solid #c4d0e2", cursor: busy ? "not-allowed" : "pointer",
                      background: busy ? "#c9d2e3" : sel ? "var(--tm-blue)" : "#fff",
                      color: sel ? "#fff" : "inherit", fontSize: 10, padding: 0,
                    }}>{s}</button>
                );
              })
            )}
          </div>
          {seats.length > 0 && <p><span className="badge">{seats.sort().join(", ")}</span></p>}
        </div>
      )}
      {!mapped && (
        <div className="row">
          <label>Cantidad<input type="number" min={1} max={maxOrder} value={qty} onChange={(e) => setQty(Math.min(maxOrder, Math.max(1, Number(e.target.value) || 1)))} required /></label>
          <label>Código promo<input name="promo" placeholder="EARLY10" /></label>
        </div>
      )}
      {mapped && (
        <label>Código promo<input name="promo" placeholder="EARLY10" /></label>
      )}
      <label>Titulares (uno por línea: “Nombre | DNI”){mapped && " — se asignan en orden a los asientos elegidos"}<textarea name="holders" rows={2} placeholder="Ana López | 12345678A" /></label>
      {simulated ? (
        <>
          <p className="alert ok">Modo pruebas: pago simulado. Tarjeta 4242 4242 4242 4242.</p>
          <button disabled={mapped && seats.length === 0}>Pagar (simulado)</button>
        </>
      ) : (
        <button disabled={mapped && seats.length === 0}>Comprar con Stripe</button>
      )}
    </form>
  );
}
