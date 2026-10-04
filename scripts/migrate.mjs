import { readFileSync, readdirSync } from "fs";
import { neon } from "@neondatabase/serverless";

function loadEnv() {
  try {
    const txt = readFileSync(".env.local", "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}
loadEnv();
const sql = neon(process.env.DATABASE_URL);
const files = readdirSync("db/migrations").filter((f) => f.endsWith(".sql")).sort();
for (const f of files) {
  console.log("Applying", f);
  const content = readFileSync(`db/migrations/${f}`, "utf8");
  // Split naive by statement is handled by neon? Send whole file via multiple queries:
  // neon() supports single query; use function to run raw via multiple statements is not supported,
  // so split on semicolons at line ends conservatively.
  const stmts = content.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
  for (const s of stmts) {
    await sql.query(s);
  }
}
console.log("Migrations OK:", files.join(", "));
