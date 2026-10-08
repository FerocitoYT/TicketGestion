"use client";
import { useEffect, useState } from "react";
import { seatName } from "@/lib/seats";

type Zone = {
  id: string; event_id: string; name: string; price_cents: number; capacity: number; sold: number;
  seat_rows: number; seat_cols: number; accessible: boolean;
};
type Event = { id: string; title: string; zones: Zone[] };

export default function TaquillaClient({ events, maxOrder }: { events: Event[]; maxOrder: number }) {
  const [eventId, setEventId] = useState(events[0]?.id || "");
  const [zoneId, setZoneId] = useState("");
  const [taken, setTaken] = useState<string[]>([]);
  const [seats, setSeats] = useState<string[]>([]);
  const [qty, setQty] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [holders, setHolders] = useState("");
  const [method, setMethod] = useState("efectivo");
  const [msg, setMsg] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const ev = events.find((e) => e.id === eventId);
  const zone = ev?.zones.find((z) => z.id === zoneId);
  const mapped = !!zone && zone.seat_rows > 0;

  useEffect(() => {
    setZoneId("");
    setSeats([]);
    setCodes([]);
  }, [eventId]);
  useEffect(() => {
    setSeats([]);
    if (!zone || !mapped) { setTaken([]); return; }
    fetch(`/api/zones/${zone.id}/seats`).then((r) => r.json())
      .then((j) => setTaken([...(j.taken || []), ...(j.held || [])]))
      .catch(() => {});
  }, [zoneId]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle(s: string) {
    if (taken.includes(s)) return;
    setSeats((x) => (x.includes(s) ? x.filter((y) => y !== s) : [...x, s].slice(0, maxOrder)));
  }

  async function sell(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    setCodes([]);
    const body = {
      eventId, zoneId: zone!.id,
      qty: mapped ? seats.length : qty,
      buyerName: name, buyerEmail: email, holders,
      seats: mapped ? seats : [],
      method,
    };
    if (mapped && seats.length === 0) { setMsg("Elige asientos en el plano."); setBusy(false); return; }
    const r = await fetch("/api/panel/taquilla", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    setBusy(false);
    if (!r.ok) { setMsg(j.error || "Error"); return; }
    setCodes(j.codes);
    setMsg(`Cobrado ${(j.total / 100).toFixed(2)} € en ${method}. Códigos listos para entregar.`);
    setSeats([]);
    setQty(1);
  }

  return (
    <>
      <div className="row">
        <label>Evento
          <select value={eventId} onChange={(e) => setEventId(e.target.value)}>
            {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </label>
        <label>Zona
          <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} required>
            <option value="">Elige…</option>
            {ev?.zones.map((z) => (
              <option key={z.id} value={z.id} disabled={z.capacity - z.sold <= 0}>
                {z.name} — {(z.price_cents / 100).toFixed(2)} € ({z.capacity - z.sold} libres)
              </option>
            ))}
          </select>
        </label>
      </div>
      {mapped && zone && (
        <>
          <p className="muted">Toca los asientos ({seats.length}):</p>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${zone.seat_cols}, 1fr)`, gap: 4, maxWidth: 520 }}>
            {Array.from({ length: zone.seat_rows }, (_, r) =>
              Array.from({ length: zone.seat_cols }, (_, c) => {
                const s = seatName(r, c);
                const busy = taken.includes(s);
                const sel = seats.includes(s);
                return (
                  <button key={s} type="button" disabled={busy} onClick={() => toggle(s)} title={s}
                    style={{
                      aspectRatio: "1", borderRadius: 6, border: "1px solid #c4d0e2",
                      cursor: busy ? "not-allowed" : "pointer",
                      background: busy ? "#c9d2e3" : sel ? "var(--tm-blue)" : "#fff",
                      color: sel ? "#fff" : "inherit", fontSize: 10, padding: 0,
                    }}>{s}</button>
                );
              })
            )}
          </div>
          {seats.length > 0 && <p><span className="badge">{[...seats].sort().join(", ")}</span></p>}
        </>
      )}
      {zone && (
        <form onSubmit={sell} className="form" style={{ marginTop: 12 }}>
          <div className="row">
            <label>Comprador<input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} placeholder="Nombre" /></label>
            <label>Email (opcional)<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Para enviarle el QR" /></label>
          </div>
          {!mapped && (
            <label>Cantidad<input type="number" min={1} max={maxOrder} value={qty} onChange={(e) => setQty(Math.min(maxOrder, Math.max(1, Number(e.target.value) || 1)))} required /></label>
          )}
          <label>Titulares (uno por línea: “Nombre | DNI”)<textarea value={holders} onChange={(e) => setHolders(e.target.value)} rows={2} placeholder="Ana López | 12345678A" /></label>
          <label>Cobro
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="efectivo">Efectivo</option>
              <option value="tarjeta">Tarjeta presencial</option>
              <option value="datofono">Datáfono</option>
            </select>
          </label>
          <button disabled={busy || (mapped && seats.length === 0)}>{busy ? "Cobrando…" : "Cobrar y emitir"}</button>
        </form>
      )}
      {msg && <p className={codes.length ? "alert ok" : "alert err"}>{msg}</p>}
      {codes.length > 0 && (
        <p><span className="badge">{codes.join(" · ")}</span><br />
          {codes.map((c) => <span key={c} style={{ marginRight: 10 }}><a href={`/t/${c}`}>QR {c}</a></span>)}
        </p>
      )}
    </>
  );
}
