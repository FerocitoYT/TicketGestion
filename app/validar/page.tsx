"use client";
import { useState } from "react";

type Scan = { result: string; gate: string; created_at: string };
type Result = {
  ok?: boolean; error?: string; code?: string; event?: string; zone?: string;
  holder?: string; doc?: string; buyer?: string; email?: string; scans?: Scan[];
};

export default function Validar() {
  const [payload, setPayload] = useState("");
  const [gate, setGate] = useState("Puerta A");
  const [res, setRes] = useState<Result | null>(null);
  const [count, setCount] = useState({ ok: 0, no: 0 });
  async function validate(e: React.FormEvent) {
    e.preventDefault();
    setRes(null);
    const r = await fetch("/api/validar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload, gate }),
    });
    const j = (await r.json()) as Result;
    setRes(j);
    setCount((c) => ({ ok: c.ok + (j.ok ? 1 : 0), no: c.no + (j.ok ? 0 : 1) }));
    if (j.ok) setPayload("");
  }
  return (
    <>
      <h1>Control de acceso</h1>
      <p className="muted">Escanea el QR. Comprueba que el titular coincide con el DNI. Sesión: ✅ {count.ok} · ⛔ {count.no}</p>
      <form onSubmit={validate} className="form">
        <label>QR<input value={payload} onChange={(e) => setPayload(e.target.value)} required placeholder="F8CL34RS.firma" autoFocus /></label>
        <label>Puerta<input value={gate} onChange={(e) => setGate(e.target.value)} /></label>
        <button>Validar</button>
      </form>
      {res && (
        <div className="alert" style={{ background: res.ok ? "#0f3d26" : "#4d1620", marginTop: 14 }}>
          <h2 style={{ margin: "0 0 8px" }}>{res.ok ? "✅ ACCESO PERMITIDO" : "⛔ ACCESO DENEGADO"}</h2>
          {res.error && <p><strong>{res.error}</strong></p>}
          {res.code && (
            <table>
              <tbody>
                <tr><th>Código</th><td><strong>{res.code}</strong></td></tr>
                <tr><th>Titular</th><td><strong>{res.holder}</strong>{res.doc ? ` · ${res.doc}` : ""}</td></tr>
                <tr><th>Evento</th><td>{res.event}</td></tr>
                <tr><th>Zona</th><td>{res.zone}</td></tr>
                <tr><th>Comprador</th><td>{res.buyer} · {res.email}</td></tr>
              </tbody>
            </table>
          )}
          {!res.ok && res.code && <p className="muted">Posible reventa o QR copiado: retén la entrada y avisa al responsable.</p>}
          {res.scans && res.scans.length > 0 && (
            <p className="muted">Intentos previos: {res.scans.map((s) => `${s.result}@${s.gate}`).join(", ")}</p>
          )}
        </div>
      )}
    </>
  );
}
