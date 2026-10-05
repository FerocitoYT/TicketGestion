"use client";
import { useEffect, useState } from "react";
import { seatName, findTogether } from "@/lib/seats";

export default function ComprarClient({ eventId, eventTitle, zone, maxOrder, simulated }: {
  eventId: string;
  eventTitle: string;
  zone: { id: string; name: string; price_cents: number; capacity: number; sold: number; seat_rows: number; seat_cols: number; session_label: string };
  maxOrder: number;
  simulated: boolean;
}) {
  const mapped = zone.seat_rows > 0;
  const [taken, setTaken] = useState<string[]>([]);
  const [held, setHeld] = useState<string[]>([]);
  const [seats, setSeats] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [want, setWant] = useState(2);
  const [hold, setHold] = useState<{ holdId: string; seats: string[]; expiresAt: string } | null>(null);
  const [msg, setMsg] = useState("");
  const [reserving, setReserving] = useState(false);
  const [left, setLeft] = useState(0);

  async function loadMap(holdId?: string) {
    try {
      const r = await fetch(`/api/zones/${zone.id}/seats${holdId ? `?hold=${holdId}` : ""}`);
      const j = await r.json();
      setTaken(j.taken || []);
      setHeld(j.held || []);
    } catch { /* noop */ }
  }
  useEffect(() => { loadMap(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  useEffect(() => {
    if (!hold) return;
    const tick = () => setLeft(Math.max(0, Math.ceil((new Date(hold.expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(() => {
      tick();
      if (new Date(hold.expiresAt).getTime() < Date.now()) {
        clearInterval(t);
        setHold(null);
        setMsg("La reserva caducó (10 min). Elige de nuevo.");
        loadMap();
      }
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hold?.holdId]);

  function toggle(seat: string) {
    if (hold || taken.includes(seat) || held.includes(seat)) return;
    setSeats((s) => (s.includes(seat) ? s.filter((x) => x !== seat) : [...s, seat].slice(0, maxOrder)));
  }
  function autoTogether() {
    if (hold) return;
    const block = findTogether(taken, held, zone.seat_rows, zone.seat_cols, Math.min(maxOrder, Math.max(1, want)));
    if (block.length === 0) setMsg(`No quedan ${want} asientos juntos. Prueba con menos o elige a mano.`);
    else { setMsg(""); setSeats(block); }
  }
  async function reserve() {
    if (seats.length === 0) return;
    setReserving(true);
    setMsg("");
    try {
      const r = await fetch("/api/holds", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ zoneId: zone.id, seats }),
      });
      const j = await r.json();
      if (!r.ok) { setMsg(j.error || "No se pudo reservar"); loadMap(); return; }
      setHold({ holdId: j.holdId, seats: j.seats, expiresAt: j.expiresAt });
      loadMap(j.holdId);
    } finally {
      setReserving(false);
    }
  }
  async function cancelHold() {
    if (hold) await fetch("/api/holds", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ holdId: hold.holdId }) }).catch(() => {});
    setHold(null);
    setSeats([]);
    loadMap();
  }

  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");

  return (
    <div>
      {!hold && mapped && (
        <>
          <p><strong>Paso 1 — elige tus asientos</strong> <span className="muted">({zone.name} · {zone.session_label})</span></p>
          <div className="row" style={{ maxWidth: 480 }}>
            <label>¿Cuántos juntos?<input type="number" min={1} max={maxOrder} value={want} onChange={(e) => setWant(Math.min(maxOrder, Math.max(1, Number(e.target.value) || 1)))} /></label>
            <button type="button" className="btn btn-blue" onClick={autoTogether}>Buscar juntos</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${zone.seat_cols}, 1fr)`, gap: 4, maxWidth: 520, marginTop: 10 }}>
            {Array.from({ length: zone.seat_rows }, (_, r) =>
              Array.from({ length: zone.seat_cols }, (_, c) => {
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
          <p className="muted" style={{ fontSize: 12 }}>Gris: vendido · Amarillo: reservado · Azul: tuyos</p>
          {seats.length > 0 && <p><span className="badge">{[...seats].sort().join(", ")}</span></p>}
          {msg && <p className="alert err">{msg}</p>}
          <button type="button" className="btn btn-blue" onClick={reserve} disabled={seats.length === 0 || reserving}>
            {reserving ? "Reservando…" : `Reservar ${seats.length} (${((zone.price_cents * seats.length) / 100).toFixed(2)} €)`}
          </button>
        </>
      )}
      {hold && (
        <form action="/api/checkout" method="post" className="form">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="zoneId" value={zone.id} />
          <input type="hidden" name="qty" value={String(hold.seats.length)} />
          <input type="hidden" name="seats" value={JSON.stringify(hold.seats)} />
          <input type="hidden" name="holdId" value={hold.holdId} />
          <p className="alert ok"><strong>Paso 2 — reservado para {eventTitle}</strong><br />{zone.name} · {[...hold.seats].sort().join(", ")} · Te quedan <strong>{mm}:{ss}</strong>. Sin pago se libera solo.</p>
          <label>Nombre completo<input name="buyerName" required placeholder="Tu nombre" /></label>
          <label>Email<input name="buyerEmail" type="email" required placeholder="tu@email.com" /></label>
          <label>Código promo<input name="promo" placeholder="EARLY10" /></label>
          <label>Titulares (uno por línea: “Nombre | DNI”, en orden de asiento)<textarea name="holders" rows={hold.seats.length} placeholder="Ana López | 12345678A" /></label>
          {simulated
            ? <><p className="alert ok">Modo pruebas: pago simulado. Tarjeta 4242 4242 4242 4242.</p><button>Pagar (simulado)</button></>
            : <button>Comprar con Stripe</button>}
          <button type="button" className="btn-ghost" onClick={cancelHold}>Cancelar reserva</button>
        </form>
      )}
      {!mapped && (
        <form action="/api/checkout" method="post" className="form">
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="zoneId" value={zone.id} />
          <label>Nombre completo<input name="buyerName" required placeholder="Tu nombre" /></label>
          <label>Email<input name="buyerEmail" type="email" required placeholder="tu@email.com" /></label>
          <div className="row">
            <label>Cantidad (máx {maxOrder})<input name="qty" type="number" min={1} max={maxOrder} defaultValue={1} required /></label>
            <label>Código promo<input name="promo" placeholder="EARLY10" /></label>
          </div>
          <label>Titulares (uno por línea: “Nombre | DNI | Asiento opcional”)<textarea name="holders" rows={2} placeholder="Ana López | 12345678A" /></label>
          {simulated
            ? <><p className="alert ok">Modo pruebas: pago simulado. Tarjeta 4242 4242 4242 4242.</p><button>Pagar (simulado)</button></>
            : <button>Comprar con Stripe</button>}
        </form>
      )}
    </div>
  );
}
