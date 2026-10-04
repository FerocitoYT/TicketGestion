// Siembra el catálogo nacional: ~45 artistas españoles (foto + bio + género).
// Todo sin claves: MusicBrainz (ES) + TheAudioDB + Wikipedia + Commons.
// Uso: node scripts/seed-all-spain.mjs  (tarda varios minutos por cortesía 1req/s)
import { readFileSync } from "fs";
import { neon } from "@neondatabase/serverless";

const NAMES = [
  "Pablo Alborán", "Vanesa Martín", "Malú", "Pastora Soler", "Niña Pastori",
  "Estopa", "Fito y Fitipaldis", "Melendi", "Dani Martín", "Leiva",
  "Joaquín Sabina", "Joan Manuel Serrat", "Miguel Bosé", "Raphael", "Julio Iglesias",
  "Enrique Iglesias", "David Bustamante", "Chenoa", "Mónica Naranjo", "Marta Sánchez",
  "Amaral", "La Oreja de Van Gogh", "Vetusta Morla", "Love of Lesbian", "Izal",
  "Lori Meyers", "Dorian", "Fangoria", "Nathy Peluso", "C. Tangana",
  "Quevedo", "Bad Gyal", "Rels B", "Dellafuente", "Morad",
  "Saiko", "Lola Índigo", "Ana Mena", "Camarón de la Isla", "Paco de Lucía",
  "Ketama", "India Martínez", "Rozalén", "Sergio Dalma", "David DeMaría",
];

const UA = "TicketGestion/1.0";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function norm(s) { return (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }
function slugify(s) {
  return norm(s).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || "artista";
}
async function jget(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

const txt = readFileSync(".env.local", "utf8");
let url = "";
for (const l of txt.split("\n")) { const m = l.match(/^DATABASE_URL=(.*)$/); if (m) url = m[1].trim(); }
const sql = neon(url);

let done = 0, skipped = 0;
for (const name of NAMES) {
  try {
    // 1. MusicBrainz España
    const mb = await jget(`https://musicbrainz.org/ws/2/artist/?query=${encodeURIComponent(`artist:"${name}" AND area:"Spain"`)}&fmt=json&limit=5`);
    await sleep(1200);
    const hit = (mb.artists || [])[0];
    if (!hit) { console.log("SIN MB:", name); continue; }
    const exists = await sql`SELECT id FROM artists WHERE mbid=${hit.id} OR name=${hit.name} LIMIT 1`;
    if (exists[0]) { skipped++; continue; }
    const genre = ((hit.tags || []).sort((a, b) => (b.count || 0) - (a.count || 0))[0]?.name) || "";
    // 2. TheAudioDB por MBID
    let photo = "", bio = "", agenre = "";
    try {
      const t = await jget(`https://www.theaudiodb.com/api/v1/json/123/artist-mb.php?i=${hit.id}`);
      const a = (t.artists || [])[0] || {};
      photo = a.strArtistThumb || ""; bio = (a.strBiographyES || "").slice(0, 1500); agenre = (a.strGenre || "").slice(0, 80);
    } catch {}
    // 3. Wikipedia bio/foto
    if (!bio || !photo) {
      try {
        const w = await jget(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.name)}`);
        if (w.type !== "disambiguation" && w.extract) {
          if (!bio) bio = w.extract.slice(0, 1200);
          if (!photo && w.thumbnail?.source) photo = w.thumbnail.source;
        }
      } catch {}
    }
    let slug = slugify(hit.name);
    const dupe = await sql`SELECT id FROM artists WHERE slug=${slug} LIMIT 1`;
    if (dupe[0]) slug = `${slug}-${hit.id.slice(0, 6)}`;
    await sql`INSERT INTO artists (name, slug, photo_url, bio, genre, mbid) VALUES (${hit.name}, ${slug}, ${photo}, ${bio}, ${agenre || genre}, ${hit.id})`;
    done++;
    console.log(`OK (${done})`, hit.name, photo ? "[foto]" : "[sin foto]", bio ? "[bio]" : "[sin bio]");
  } catch (e) {
    console.log("ERROR:", name, e.message);
  }
}
const n = await sql`SELECT COUNT(*) AS n FROM artists`;
console.log(`Hecho. Nuevos: ${done}, ya estaban: ${skipped}, total: ${n[0].n}`);
