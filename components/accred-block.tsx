"use client";
import { useState } from "react";

type Accred = { code: string; kind: string; holder: string; status: string; zone: string };

const TYPES = [
  ["vip", "VIP"],
  ["prensa", "Prensa"],
  ["invitado", "Invitado"],
  ["staff", "Equipo"],
] as const;

export default function AccredBlock({ eventId, zones, existing }: {
  eventId: string;
  zones: { id: string; name: string }[];
  existing: Accred[];
}) {
  const [zoneId, setZoneId] = useState(zones[0]?.id || "");
  const [type, setType] = useState<string>("vip");
  const [qty, setQty] = useState(5);
  const [msg, setMsg] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Generando…");
    setCodes([]);
    const r = await fetch("/api/panel/acreditaciones", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId, zoneId, type, qty }),
    });
    const j = await r.json();
    if (!r.ok) { setMsg(j.error || "Error"); return; }
    setCodes(j.codes);
    setMsg(`${j.codes.length} acreditaciones generadas. Se nominan en puerta con DNI (o edita el titular desde Mis entradas si las asignas).`);
  }
  return (
    <>
      <table>
        <thead><tr><th>Código</th><th>Tipo</th><th>Titular</th><th>Zona</th><th>Estado</th><th>QR</th></tr></thead>
        <tbody>
          {existing.map((a) => (
            <tr key={a.code}>
              <td><strong>{a.code}</strong></td><td>{a.kind.toUpperCase()}</td>
              <td>{a.holder || <span className="muted">Sin asignar</span>}</td>
              <td>{a.zone}</td><td>{a.status}</td>
              <td><a href={`/t/${a.code}`}>Ver</a></td>
            </tr>
          ))}
        </tbody>
      </table>
      {existing.length === 0 && <p className="muted">Sin acreditaciones todavía.</p>}
      <form onSubmit={create} className="form" style={{ marginTop: 10 }}>
        <div className="row">
          <select value={zoneId} onChange={(e) => setZoneId(e.target.value)} required>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input type="number" min={1} max={100} value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} />
        </div>
        <button>Generar acreditaciones</button>
      </form>
      {msg && <p className="muted">{msg}</p>}
      {codes.length > 0 && (
        <p><span className="badge">{codes.join(" · ")}</span></p>
      )}
    </>
  );
}
