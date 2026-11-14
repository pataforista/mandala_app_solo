// Banco de pruebas por motor × nivel × estilo, perfiles de producto e identidad de estilo.
//   node scripts/bench-styles.mjs [semillas=10] [--html CARPETA]
// 1) Puntuación comercial media/mínima de cada motor en cada nivel y estilo.
// 2) Identidad de estilo: parecido (huella de variety.js) entre dos estilos con la MISMA
//    semilla. Si cambiar de estilo apenas cambia la página, el parecido se acerca a 1.
// 3) Perfiles de producto: páginas flojas antes de la curaduría (libro de 40, progresivo).
// --html escribe láminas (una por motor y nivel) para mirarlas en el navegador.
// Línea base y lectura de resultados: docs/REVISION_MOTORES_2026-11.md
import fs from "node:fs";
import { createDoc } from "../js/core/svgDoc.js";
import { renderDocToSvgString } from "../js/core/svgRender.js";
import { generateMandalaClassic } from "../js/generators/mandalaClassic.js";
import { generateMandalaRadial } from "../js/generators/mandalaRadial.js";
import { generateMandalaLayers } from "../js/generators/mandalaLayers.js";
import { measureSvg, commercialScore } from "../js/core/commercialMetrics.js";
import { levelToGeneratorOpts, COLORING_PRESETS } from "../js/core/levels.js";
import { pageFingerprint, fingerprintSimilarity } from "../js/core/variety.js";
import { planBook, bestSellerProfile, pageStrokeMm, chapterLayout, PRODUCT_PROFILES, BOOK_STYLES } from "../js/core/bookPlan.js";
import { summarize } from "../js/core/bookCurator.js";

const args = process.argv.slice(2);
const SEEDS = Number(args.find(a => /^\d+$/.test(a))) || 10;
const HTML = args.includes("--html") ? args[args.indexOf("--html") + 1] : null;
const PRESET = "KDP_8_5x11";
const ENGINES = { classic: generateMandalaClassic, radial: generateMandalaRadial, layers: generateMandalaLayers };
const LEVELS = ["ninos", "letra_grande", "adulto", "experto"];
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

function levelOpts(level) {
  const p = COLORING_PRESETS[level];
  const layers = Object.fromEntries(Object.entries(p).filter(([k]) => k.startsWith("layer")));
  return { ...levelToGeneratorOpts(level), ...layers, organicLevel: p.organic, textures: p.textures, pageBorder: true, kaleidoscope: true };
}
function render(engine, opts) {
  const doc = createDoc({ preset: PRESET, seed: opts.seed, marginMm: 12 });
  ENGINES[engine](doc, opts);
  const svg = renderDocToSvgString(doc);
  const score = commercialScore(measureSvg(svg), { strokeWidthMm: opts.strokeWidthMm, minCellAreaMm2: opts.minCellAreaMm2 }).score;
  return { svg, score, fp: pageFingerprint(svg, doc.page) };
}

// ---------- 1 y 2: motor × nivel × estilo, e identidad de estilo ----------
const rows = [], identity = [], sheets = {};
for (const engine of Object.keys(ENGINES)) for (const level of LEVELS) {
  const base = levelOpts(level);
  const byStyle = {};
  for (const st of BOOK_STYLES) {
    byStyle[st] = [];
    for (let s = 1; s <= SEEDS; s++) {
      const seed = s * 31 + 7;
      byStyle[st].push(render(engine, { ...base, seed, petals: [12, 16, 18, 20, 24][seed % 5], styleMode: st }));
    }
    const sc = byStyle[st].map(r => r.score);
    rows.push({ motor: engine, nivel: level, estilo: st, media: +avg(sc).toFixed(1), mín: Math.min(...sc) });
    (sheets[`${engine}_${level}`] ??= []).push({ label: `${st} · ${sc[0]}`, svg: byStyle[st][0].svg });
  }
  const sims = [];
  for (let i = 0; i < BOOK_STYLES.length; i++) for (let j = i + 1; j < BOOK_STYLES.length; j++)
    for (let s = 0; s < SEEDS; s++) sims.push(fingerprintSimilarity(byStyle[BOOK_STYLES[i]][s].fp, byStyle[BOOK_STYLES[j]][s].fp));
  identity.push({ motor: engine, nivel: level, "parecido entre estilos (media)": +avg(sims).toFixed(3), "pares ≥ 0,90": `${sims.filter(x => x >= 0.9).length}/${sims.length}` });
}
console.log("1. Puntuación por motor, nivel y estilo");
console.table(rows);
console.log("2. Identidad de estilo (misma semilla, distinto estilo; 1 = página idéntica)");
console.table(identity);

// ---------- 3: perfiles de producto ----------
const PAGES = 40, prof = bestSellerProfile(PRESET), prows = [];
const cases = [["más vendidos", null, "adulto"], ...Object.entries(PRODUCT_PROFILES).map(([k, v]) => [k, v, "adulto"]),
  ["más vendidos", null, "experto"], ["intricate_sacred", PRODUCT_PROFILES.intricate_sacred, "experto"]];
for (const [name, prod, level] of cases) {
  const base = levelOpts(level);
  const styles = prod?.styles ?? prof.styles, styleWeights = prod?.styleWeights ?? prof.styleWeights;
  const bc = prod?.complexity ?? base.complexity, stroke = prod?.strokeBase ?? base.strokeWidthMm;
  const pages = [];
  for (const seed of [7919, 15838]) {
    const plan = planBook({ count: PAGES, seed, ...prof, styles, styleWeights, difficulty: "progresiva", baseComplexity: bc, fillCentro: true,
      patternOnly: prod?.patternOnly ?? prof.patternOnly, useBackground: prod?.useBackground ?? true, chapters: chapterLayout(PAGES, styles, styleWeights) });
    for (const pg of plan) pages.push({ c: pg.complexity, ...render("classic", { ...base, seed: pg.seed, complexity: pg.complexity, petals: pg.petals, styleMode: pg.styleMode,
      strokeWidthMm: pageStrokeMm(stroke, pg.strokeScale ?? 1), composition: pg.composition, frameStyle: pg.frameStyle, structure: pg.structure, silhouette: pg.silhouette, background: pg.background }) });
  }
  const s = summarize(pages);
  prows.push({ perfil: name, nivel: level, media: +s.mean.toFixed(1), mín: s.min, "flojas (<60)": `${s.weak.length}/${pages.length}`, "complejidad máx": Math.max(...pages.map(p => p.c)) });
}
console.log("3. Perfiles de producto antes de la curaduría (2 libros de 40 páginas, dificultad progresiva)");
console.table(prows);

if (HTML) {
  fs.mkdirSync(HTML, { recursive: true });
  for (const [k, v] of Object.entries(sheets)) fs.writeFileSync(`${HTML}/${k}.html`,
    `<!doctype html><meta charset="utf-8"><title>${k}</title><body style="margin:0;background:#888;display:grid;grid-template-columns:repeat(4,1fr);gap:6px;padding:6px;font:14px sans-serif">` +
    v.map(p => `<div style="background:#fff"><div style="padding:2px 6px;background:#222;color:#fff">${p.label}</div>${p.svg.replace(/<\?xml[^>]*>/, "").replace("<svg ", '<svg style="width:100%;height:auto;display:block" ')}</div>`).join("") + "</body>");
  console.log(`Láminas en ${HTML}/`);
}
