"use client";
import { useEffect, useState } from "react";

type Stats = {
  at: string;
  totals: { capacity: number; sold: number; checked: number; denied: number };
  zones: { name: string; capacity: number; sold: number; checked: number }[];
  gates: { gate: string; ok: number; denied: number }[];
  slots: { slot: string; n: number }[];
};

export default function DirectoClient({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const [st, setSt] = useState<Stats | null>(null);
  async function load() {
    try {
      const r = await fetch(`/api/panel/directo/stats?event=${eventId}`);
      if (r.ok) setSt(await r.json());
    } catch { /* noop */ }
  }
  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);
  if (!st) return <p className="muted">Cargando directo…</p>;
  const maxSlot = Math.max(1, ...st.slots.map((s) => s.n));
  const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
  return (
    <>
      <p className="muted">Actualizado: {new Date(st.at).toLocaleTimeString("es-ES")} (cada 10 s) · {eventTitle}</p>
      <div className="trust" style={{ marginTop: 10 }}>
        <div><h4>{st.totals.checked} / {st.totals.sold}</h4><p>Dentro ({pct(st.totals.checked, st.totals.sold)}% de vendidas)</p></div>
        <div><h4>{pct(st.totals.sold, st.totals.capacity)}%</h4><p>Ocupación vendida ({st.totals.sold}/{st.totals.capacity})</p></div>
        <div><h4>{st.totals.denied}</h4><p>Denegados (reventa, duplicados…)</p></div>
      </div>
      <div className="section-title"><h2>Ritmo (15 min)</h2></div>
      {st.slots.length === 0 && <p className="muted">Sin accesos en las últimas 3 h.</p>}
      <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 120 }}>
        {st.slots.map((s) => (
          <div key={s.slot} title={`${s.slot}: ${s.n}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
            <div style={{ width: "100%", background: "var(--tm-blue)", borderRadius: 4, height: Math.max(4, (s.n / maxSlot) * 90) }} />
            <small className="muted">{s.slot}</small>
          </div>
        ))}
      </div>
      <div className="section-title"><h2>Por zona</h2></div>
      <table>
        <thead><tr><th>Zona</th><th>Vendidas</th><th>Dentro</th><th>% acceso</th></tr></thead>
        <tbody>
          {st.zones.map((z) => (
            <tr key={z.name}><td>{z.name}</td><td>{z.sold}/{z.capacity}</td><td>{z.checked}</td><td>{pct(z.checked, z.sold)}%</td></tr>
          ))}
        </tbody>
      </table>
      <div className="section-title"><h2>Por puerta</h2></div>
      <table>
        <thead><tr><th>Puerta</th><th>OK</th><th>Denegados</th></tr></thead>
        <tbody>
          {st.gates.map((g) => (
            <tr key={g.gate}><td>{g.gate}</td><td>{g.ok}</td><td>{g.denied}</td></tr>
          ))}
        </tbody>
      </table>
      {st.gates.length === 0 && <p className="muted">Sin escaneos todavía.</p>}
    </>
  );
}
