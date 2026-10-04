"use client";
import { useState } from "react";

type Mb = { mbid: string; name: string; info: string; area: string; genre: string };
type Art = { id: string; name: string; photo: string };

export default function ArtistSearch({ eventId, attached }: { eventId: string; attached: Art[] }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Mb[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [mName, setMName] = useState("");

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setMsg("Buscando en MusicBrainz…");
    const r = await fetch("/api/panel/artists/search?q=" + encodeURIComponent(q));
    const j = await r.json();
    setRes(j.artists || []);
    setMsg(j.error || (j.artists?.length ? "" : "Sin resultados en España"));
  }
  async function attach(a: Mb) {
    setBusy(true);
    const r = await fetch("/api/panel/artists/attach", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId, mbid: a.mbid, name: a.name, genre: a.genre }),
    });
    const j = await r.json();
    setBusy(false);
    if (r.ok) location.reload();
    else setMsg(j.error || "Error");
  }
  async function createManual(e: React.FormEvent) {
    e.preventDefault();
    if (!mName.trim()) return;
    const r = await fetch("/api/panel/artists/create", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId, name: mName.trim() }),
    });
    if (r.ok) location.reload();
    else setMsg("Error al crear");
  }
  async function detach(id: string) {
    await fetch("/api/panel/artists/detach", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId, artistId: id }),
    });
    location.reload();
  }

  return (
    <>
      {attached.length > 0 && (
        <div className="row" style={{ marginBottom: 10 }}>
          {attached.map((a) => (
            <span key={a.id} className="badge" style={{ fontSize: 14 }}>
              {a.photo && <img src={a.photo} alt="" width={22} height={22} style={{ borderRadius: "50%", verticalAlign: -6 }} />} {a.name}
              {" "}<button onClick={() => detach(a.id)} style={{ background: "none", border: 0, cursor: "pointer", color: "inherit" }} title="Quitar">✕</button>
            </span>
          ))}
        </div>
      )}
      <form onSubmit={search} className="row">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar artista español…" style={{ maxWidth: 300 }} />
        <button disabled={busy}>Buscar</button>
      </form>
      {msg && <p className="muted">{msg}</p>}
      {res.map((a) => (
        <div key={a.mbid} className="zone" style={{ marginTop: 8 }}>
          <div>
            <div><strong>{a.name}</strong></div>
            <span className="muted">{[a.info, a.genre, a.area].filter(Boolean).join(" · ")}</span>
          </div>
          <button onClick={() => attach(a)} disabled={busy}>Añadir</button>
        </div>
      ))}
      <form onSubmit={createManual} className="row" style={{ marginTop: 10 }}>
        <input value={mName} onChange={(e) => setMName(e.target.value)} placeholder="O crea artista manual: nombre…" style={{ maxWidth: 300 }} />
        <button>Crear y vincular</button>
      </form>
    </>
  );
}
