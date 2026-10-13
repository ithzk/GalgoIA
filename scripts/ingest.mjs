// Carga los documentos de /knowledge a la tabla `conocimiento` de Supabase.
// Uso (PowerShell):
//   $env:SUPABASE_URL="https://xxx.supabase.co"
//   $env:SUPABASE_SERVICE_ROLE_KEY="..."
//   node scripts/ingest.mjs
// Cada archivo .md/.txt se divide en fragmentos (~1200 caracteres). Re-ejecutarlo reemplaza lo anterior.
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY: KEY } = process.env;
if (!SUPABASE_URL || !KEY) {
  console.error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const dir = fileURLToPath(new URL("../knowledge/", import.meta.url));

function chunk(text, max = 1200) {
  const out = [];
  let cur = "";
  for (const p of text.split(/\n\s*\n/)) {
    if ((cur + "\n\n" + p).length > max && cur) { out.push(cur.trim()); cur = p; }
    else cur = cur ? cur + "\n\n" + p : p;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

for (const file of (await readdir(dir)).filter((f) => /\.(md|txt)$/i.test(f) && f.toLowerCase() !== "readme.md")) {
  const raw = await readFile(path.join(dir, file), "utf8");
  const titulo = (raw.match(/^#\s+(.+)$/m)?.[1] || file.replace(/\.\w+$/, "")).trim();
  const categoria = raw.match(/^categoria:\s*(.+)$/im)?.[1]?.trim() || null;
  const rows = chunk(raw).map((contenido, i) => ({
    titulo: `${titulo} (parte ${i + 1})`, categoria, contenido, fuente: file,
  }));
  await fetch(`${SUPABASE_URL}/rest/v1/conocimiento?fuente=eq.${encodeURIComponent(file)}`, { method: "DELETE", headers: H });
  const r = await fetch(`${SUPABASE_URL}/rest/v1/conocimiento`, { method: "POST", headers: H, body: JSON.stringify(rows) });
  console.log(r.ok ? `✔ ${file}: ${rows.length} fragmentos` : `✘ ${file}: ${r.status} ${await r.text()}`);
}
