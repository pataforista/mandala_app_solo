// Prueba dorada: hash SHA-256 del SVG de cada página de una matriz fija.
//   node scripts/golden-styles.mjs --write   guarda tests/golden/styles.json
//   node scripts/golden-styles.mjs           compara con lo guardado (sale con 1 si algo cambió)
//   --styles a,b                             restringe la comparación a esos estilos
// Sirve para refactorizar el motor clásico sin cambiar ni una página.
import fs from "node:fs";
import crypto from "node:crypto";
import { createDoc } from "../js/core/svgDoc.js";
import { renderDocToSvgString } from "../js/core/svgRender.js";
import { generateMandalaClassic } from "../js/generators/mandalaClassic.js";
import { levelToGeneratorOpts } from "../js/core/levels.js";
import { BOOK_STYLES } from "../js/core/bookPlan.js";

const FILE = new URL("../tests/golden/styles.json", import.meta.url);
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const only = arg("--styles")?.split(",");
const LEVELS = ["ninos", "letra_grande", "adulto", "experto"];
const EXTRA = [
  { name: "fondo", o: { composition: "fondo", background: "jardin", frameStyle: "ninguno" } },
  { name: "esquinas", o: { composition: "esquinas", frameStyle: "doble" } },
  { name: "trama", o: { composition: "centro", background: "ondas", frameStyle: "ninguno" } },
];
const STRUCT = ["corona", "heroe", "equilibrio", "nucleo", "aurea", "doble"];

function page(o) {
  const doc = createDoc({ preset: "KDP_8_5x11", seed: o.seed, marginMm: 12 });
  generateMandalaClassic(doc, o);
  return crypto.createHash("sha256").update(renderDocToSvgString(doc)).digest("hex").slice(0, 16);
}
const out = {};
for (const st of BOOK_STYLES) {
  if (only && !only.includes(st)) continue;
  for (const lv of LEVELS) for (let s = 1; s <= 10; s++) {
    const seed = s * 31 + 7;
    out[`${st}|${lv}|${s}`] = page({ ...levelToGeneratorOpts(lv), organicLevel: 0.2, textures: lv === "experto", pageBorder: true, seed, petals: [12, 16, 18, 20, 24][seed % 5], styleMode: st, structure: STRUCT[s % STRUCT.length] });
  }
  for (const e of EXTRA) for (let s = 1; s <= 3; s++)
    out[`${st}|${e.name}|${s}`] = page({ ...levelToGeneratorOpts("adulto"), organicLevel: 0.2, textures: false, pageBorder: true, seed: s * 53 + 5, petals: 16, styleMode: st, ...e.o });
}
if (process.argv.includes("--write")) {
  // Con --styles se reemplazan sólo las páginas de esos estilos y el resto se conserva
  const prev = only && fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, "utf8")) : {};
  const keep = Object.fromEntries(Object.entries(prev).filter(([k]) => !only.includes(k.split("|")[0])));
  fs.writeFileSync(FILE, JSON.stringify({ ...keep, ...out }, null, 0));
  console.log(`Guardados ${Object.keys(out).length} hashes${only ? ` (${only.join(", ")})` : ""}`);
}
else {
  const gold = JSON.parse(fs.readFileSync(FILE, "utf8"));
  const bad = Object.keys(out).filter(k => gold[k] !== out[k]);
  console.log(`${Object.keys(out).length - bad.length}/${Object.keys(out).length} páginas idénticas`);
  if (bad.length) { console.log("Cambiadas:", bad.slice(0, 15).join(", "), bad.length > 15 ? `… (+${bad.length - 15})` : ""); process.exit(1); }
}
