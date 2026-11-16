// Prueba a ciegas de identificación de estilos (docs/ROADMAP_ESTILOS.md § 6.5).
//   node scripts/blind-test.mjs <carpeta de salida> [--clave]
// Escribe 28 páginas (4 por estilo, nivel adulto, sin fondo ni rótulo) numeradas al azar,
// un índice HTML para verlas y una hoja de respuestas. La clave (qué estilo es cada número)
// sólo se imprime con --clave: guárdala aparte y no la entregues a quien hace la prueba.
// La mezcla sale de una semilla fija, así que la clave se puede regenerar siempre igual.
import fs from "node:fs";
import path from "node:path";
import { createDoc } from "../js/core/svgDoc.js";
import { renderDocToSvgString } from "../js/core/svgRender.js";
import { generateMandalaClassic } from "../js/generators/mandalaClassic.js";
import { levelToGeneratorOpts } from "../js/core/levels.js";
import { BOOK_STYLES } from "../js/core/bookPlan.js";
import { mulberry32 } from "../js/core/prng.js";

const out = process.argv[2];
if (!out) { console.error("uso: node scripts/blind-test.mjs <carpeta> [--clave]"); process.exit(1); }
const SEED = 20261116, PER = 4;

// Páginas: cada estilo, cuatro semillas distintas
const items = [];
for (const style of BOOK_STYLES) for (let k = 0; k < PER; k++) {
  const seed = 1000 + items.length * 37;
  items.push({ style, seed, petals: [12, 16, 18, 20, 24][k % 5] });
}
// Mezcla fija
const rng = mulberry32(SEED), order = items.map((_, i) => i);
for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
const shuffled = order.map(i => items[i]);

const base = levelToGeneratorOpts("adulto");
fs.mkdirSync(path.join(out, "paginas"), { recursive: true });
const pages = shuffled.map((it, n) => {
  const doc = createDoc({ preset: "KDP_8_5x11", seed: it.seed, marginMm: 12 });
  generateMandalaClassic(doc, { ...base, organicLevel: 0.2, textures: false, pageBorder: true, seed: it.seed,
    petals: it.petals, styleMode: it.style });
  const svg = renderDocToSvgString(doc);
  const name = `pagina-${String(n + 1).padStart(2, "0")}.svg`;
  fs.writeFileSync(path.join(out, "paginas", name), svg);
  return { n: n + 1, name, svg };
});

fs.writeFileSync(path.join(out, "indice.html"),
`<!doctype html><meta charset="utf-8"><title>Prueba a ciegas · 28 páginas</title>
<body style="margin:0;background:#888;font:14px sans-serif">
<p style="margin:8px 12px;color:#fff">Mira cada página y escribe en la hoja de respuestas el estilo que crees que es. Sin límite de tiempo.</p>
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:8px">
${pages.map(p => `<div style="background:#fff"><div style="padding:3px 6px;background:#222;color:#fff">${p.n}</div>${p.svg.replace("<svg ", '<svg style="width:100%;height:auto;display:block" ')}</div>`).join("\n")}
</div></body>`);

const sheet = [
  "# Hoja de respuestas · prueba a ciegas de estilos",
  "",
  "Escribe el estilo que crees para cada página. Elige uno de estos siete:",
  "floral · geométrico · islámico · sashiko · céltico · azteca · yantra",
  "",
  "| Página | Tu respuesta | Seguridad (1–3) |",
  "|---|---|---|",
  ...pages.map(p => `| ${String(p.n).padStart(2, "0")} | | |`),
  "",
  "Nombre (opcional): ____________  Fecha: __________",
].join("\n");
fs.writeFileSync(path.join(out, "hoja-respuestas.md"), sheet + "\n");

console.error(`Páginas y material en ${out}/ (${pages.length} páginas, sin clave en la carpeta).`);
if (process.argv.includes("--clave")) {
  const key = Object.fromEntries(shuffled.map((it, i) => [String(i + 1).padStart(2, "0"), it.style]));
  console.log(JSON.stringify(key, null, 2));
}
