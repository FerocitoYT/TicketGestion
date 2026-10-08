"use client";
import { useState } from "react";

export default function ActivarRegalo({ code0 }: { code0: string }) {
  const [code, setCode] = useState(code0);
  const [name, setName] = useState("");
  const [doc, setDoc] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Activando…");
    const r = await fetch("/api/regalo/activar", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, name, doc }),
    });
    const j = await r.json();
    setOk(r.ok);
    setMsg(r.ok ? `¡Lista! Tu entrada para ${j.event} queda a tu nombre. Lleva tu DNI en puerta.` : (j.error || "Error"));
  }
  if (ok) return <p className="alert ok">{msg}</p>;
  return (
    <form onSubmit={submit} className="form">
      <label>Código regalo<input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().trim())} required placeholder="F8CL34RS" /></label>
      <label>Tu nombre<input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Nombre Apellidos" /></label>
      <label>Tu DNI/NIE<input value={doc} onChange={(e) => setDoc(e.target.value)} required placeholder="12345678A" /></label>
      <button>Activar mi entrada</button>
      {msg && <p className="alert err">{msg}</p>}
    </form>
  );
}
