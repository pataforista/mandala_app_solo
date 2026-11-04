// Actualiza las revisiones del precache de sw.js con un hash del contenido de cada archivo.
//   node scripts/sw-revisions.mjs          (reescribe sw.js)
//   node scripts/sw-revisions.mjs --check  (sólo comprueba; sale con error si alguna no coincide)
// Con una revisión escrita a mano, un cambio en index.html sin subir el número dejaba a
// los usuarios con la página vieja y el app.js nuevo. tests/sw.test.mjs exige que coincidan.
import fs from "node:fs";
import crypto from "node:crypto";

export function fileRevision(path) {
  const buf = fs.readFileSync(path);
  const data = /\.(html|m?js|json|css|svg)$/i.test(path)
    ? buf.toString("utf8").replace(/\r\n/g, "\n")
    : buf;
  return crypto.createHash("sha1").update(data).digest("hex").slice(0, 10);
}

export function precacheEntries(swSource) {
  return [...swSource.matchAll(/\{\s*url:\s*'([^']+)',\s*revision:\s*'([^']*)'\s*\}/g)].map(m => ({ url: m[1], revision: m[2], raw: m[0] }));
}

if (process.argv[1] && process.argv[1].endsWith("sw-revisions.mjs")) {
  const check = process.argv.includes("--check");
  let sw = fs.readFileSync("sw.js", "utf8");
  const stale = [];
  for (const e of precacheEntries(sw)) {
    const rev = fileRevision(e.url);
    if (rev !== e.revision) { stale.push(e.url); sw = sw.replace(e.raw, `{ url: '${e.url}', revision: '${rev}' }`); }
  }
  if (check) {
    if (stale.length) { console.error("Revisiones desactualizadas en sw.js:", stale.join(", ")); process.exit(1); }
    console.log("sw.js al día");
  } else {
    fs.writeFileSync("sw.js", sw);
    console.log(stale.length ? `Actualizadas: ${stale.join(", ")}` : "sw.js ya estaba al día");
  }
}
