"use client";
import { useState } from "react";

export default function MisEntradas() {
  const [email, setEmail] = useState("");
  const [tickets, setTickets] = useState<{ code: string; event: string; zone: string; status: string; holder?: string }[]>([]);
  const [err, setErr] = useState("");
  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const r = await fetch("/api/mis-entradas?email=" + encodeURIComponent(email));
    const j = await r.json();
    if (!r.ok) setErr(j.error || "Error");
    else setTickets(j.tickets);
  }
  return (
    <>
      <h1>Mis entradas</h1>
      <form onSubmit={lookup} className="form">
        <label>Email de compra<input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" /></label>
        <button>Recuperar entradas</button>
      </form>
      {err && <p className="alert err">{err}</p>}
      {tickets.map((t) => (
        <div key={t.code} className="card" style={{ marginTop: 10 }}>
          <strong>{t.code}</strong> · {t.event} · {t.zone} · {t.status}{t.holder ? ` · ${t.holder}` : ""}
          <br /><a href={`/t/${encodeURIComponent(t.code)}`}>Ver QR</a>
          {t.status === "valid" && <> · <a href={`/transferir?code=${encodeURIComponent(t.code)}`}>Transferir</a></>}
        </div>
      ))}
    </>
  );
}
