"use client";
import { useState } from "react";

export default function Transferir({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  return <TransferForm codePromise={searchParams} />;
}

import { use } from "react";
function TransferForm({ codePromise }: { codePromise: Promise<{ code?: string }> }) {
  const sp = use(codePromise);
  const [code, setCode] = useState(sp.code || "");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [doc, setDoc] = useState("");
  const [msg, setMsg] = useState("");
  const [ok, setOk] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Procesando…");
    setOk(false);
    const r = await fetch("/api/transferir", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, email, name, doc }),
    });
    const j = await r.json();
    setMsg(r.ok ? `Entrada transferida a ${j.holder}. El nuevo titular debe llevar su DNI en puerta.` : (j.error || "Error"));
    setOk(r.ok);
  }
  return (
    <>
      <p className="crumbs"><a href="/">Inicio</a> / Transferir entrada</p>
      <h1>Transferir entrada</h1>
      <p className="muted">Cambia el titular de tu entrada (regalo o reventa entre particulares). Solo quien compró (email del pedido) puede hacerlo. El control nominativo se mantiene: en puerta pedirán el DNI del nuevo titular.</p>
      <form onSubmit={submit} className="form">
        <label>Código de la entrada<input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().trim())} required placeholder="F8CL34RS" /></label>
        <label>Email de compra<input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" placeholder="tu@email.com" /></label>
        <label>Nuevo titular<input value={name} onChange={(e) => setName(e.target.value)} required placeholder="Nombre Apellidos" /></label>
        <label>DNI/NIE del nuevo titular<input value={doc} onChange={(e) => setDoc(e.target.value)} required placeholder="12345678A" /></label>
        <button>Transferir</button>
      </form>
      {msg && <p className={ok ? "alert ok" : "alert err"}>{msg}</p>}
    </>
  );
}
