"use client";
import { useState } from "react";

export default function Votar({ code0 }: { code0: string }) {
  const [code, setCode] = useState(code0);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Enviando…");
    const r = await fetch("/api/encuestas/votar", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, rating, comment }),
    });
    const j = await r.json();
    setOk(r.ok);
    setMsg(r.ok ? "¡Gracias por tu opinión!" : (j.error || "Error"));
  }
  if (ok) return <p className="alert ok">{msg}</p>;
  return (
    <form onSubmit={submit} className="form">
      <label>Código de tu entrada<input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().trim())} required placeholder="F8CL34RS" /></label>
      <label>Tu valoración
        <select value={rating} onChange={(e) => setRating(Number(e.target.value))}>
          <option value={5}>★★★★★ — Increíble</option>
          <option value={4}>★★★★ — Muy bien</option>
          <option value={3}>★★★ — Bien</option>
          <option value={2}>★★ — Regular</option>
          <option value={1}>★ — Mal</option>
        </select>
      </label>
      <label>Comentario (opcional)<textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={500} placeholder="¿Qué te pareció?" /></label>
      <button>Votar</button>
      {msg && <p className="alert err">{msg}</p>}
    </form>
  );
}
