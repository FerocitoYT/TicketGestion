"use client";
import { useState } from "react";

export default function Validar() {
  const [payload, setPayload] = useState("");
  const [gate, setGate] = useState("Puerta A");
  const [res, setRes] = useState<string>("");
  async function validate(e: React.FormEvent) {
    e.preventDefault();
    setRes("Validando…");
    const r = await fetch("/api/validar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload, gate }),
    });
    const j = await r.json();
    setRes(j.ok ? `✅ ACCESO OK — ${j.event} · ${j.zone} · ${j.code}` : `⛔ ${j.error || "denegado"}`);
  }
  return (
    <>
      <h1>Validar acceso</h1>
      <p className="muted">Pega el contenido del QR o escríbelo. El sistema bloquea el doble uso.</p>
      <form onSubmit={validate} className="form">
        <label>QR<input value={payload} onChange={(e) => setPayload(e.target.value)} required placeholder="TG-XXXX.YYYY" /></label>
        <label>Puerta<input value={gate} onChange={(e) => setGate(e.target.value)} /></label>
        <button>Validar</button>
      </form>
      {res && <p className="alert" style={{ background: "#14224d" }}>{res}</p>}
    </>
  );
}
