// Identificabilidad de estilo: ¿se puede saber el estilo de una página mirando sólo su dibujo?
//   node scripts/bench-identity.mjs [páginas por estilo=40] [nivel=adulto]
// Cada estilo genera páginas como en un libro (planBook con ese único estilo: silueta,
// estructura y pétalos varían), centradas y sin fondo para aislar el disco. De cada página
// se extraen rasgos de FORMA (no de posición): proporción de rectas, esquinas vivas,
// redondez de las celdas, cruces de línea… Un clasificador de centroide más cercano se
// entrena con la mitad de las páginas y se evalúa con la otra mitad.
//   Acierto 14 % = azar (7 estilos). Meta del roadmap de estilos: ≥ 80 %.
// Imprime el acierto por estilo y la matriz de confusión (fila = estilo real).
// Lectura y metas: docs/ROADMAP_ESTILOS.md
import { createDoc } from "../js/core/svgDoc.js";
import { renderDocToSvgString } from "../js/core/svgRender.js";
import { generateMandalaClassic } from "../js/generators/mandalaClassic.js";
import { flattenSubpaths } from "../js/core/commercialMetrics.js";
import { levelToGeneratorOpts } from "../js/core/levels.js";
import { planBook, bestSellerProfile, pageStrokeMm, BOOK_STYLES } from "../js/core/bookPlan.js";

const PER = Number(process.argv[2]) || 40, LEVEL = process.argv[3] || "adulto";
const PRESET = "KDP_8_5x11";
const base = { ...levelToGeneratorOpts(LEVEL), organicLevel: 0.2, textures: false, pageBorder: false };

/** Rasgos de forma de una página (independientes del giro y de la posición de las bandas). */
export function shapeFeatures(svg) {
  let nL = 0, nC = 0, len = 0, sharp = 0, right = 0, closed = 0, circ = 0, tiny = 0, open = 0;
  for (const m of svg.matchAll(/<path\b[^>]*\sd="([^"]+)"/g)) {
    nL += (m[1].match(/[Ll]/g) || []).length;
    nC += (m[1].match(/[CcQqAa]/g) || []).length;
    for (const sub of flattenSubpaths(m[1])) {
      const p = sub.pts, n = p.length;
      if (n < 3) continue;
      let per = 0, area = 0;
      for (let i = 0; i < n; i++) {
        const a = p[i], b = p[(i + 1) % n];
        if (!sub.closed && i === n - 1) break;
        per += Math.hypot(b[0] - a[0], b[1] - a[1]);
        area += a[0] * b[1] - b[0] * a[1];
      }
      for (let i = sub.closed ? 0 : 1; i < (sub.closed ? n : n - 1); i++) {
        const a = p[(i - 1 + n) % n], b = p[i], c = p[(i + 1) % n];
        const u = [b[0] - a[0], b[1] - a[1]], v = [c[0] - b[0], c[1] - b[1]];
        const lu = Math.hypot(...u), lv = Math.hypot(...v);
        if (lu < 0.3 || lv < 0.3) continue;
        const t = Math.abs(Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1])) * 180 / Math.PI;
        if (t > 40) sharp++;
        if (t > 75 && t < 105) right++;
      }
      len += per;
      if (sub.closed) {
        area = Math.abs(area) / 2; closed++;
        if (per > 0) circ += (4 * Math.PI * area) / (per * per);
        if (area < 12) tiny++;
      } else open++;
    }
  }
  const tot = Math.max(1, closed + open);
  return [nL / Math.max(1, nL + nC), sharp / Math.max(1, len) * 100, right / Math.max(1, sharp), circ / Math.max(1, closed), tiny / Math.max(1, closed), open / tot, Math.log(1 + closed)];
}
export const FEATURE_NAMES = ["rectas", "esquinas/100mm", "ángulos rectos", "redondez", "celdas chicas", "trazos abiertos", "log celdas"];

const data = {};
for (const st of BOOK_STYLES) {
  const prof = bestSellerProfile(PRESET);
  const plan = planBook({ count: PER, seed: 4242, ...prof, styles: [st], styleWeights: [1], compositions: ["centro"], compositionWeights: [1],
    frames: ["ninguno"], frameWeights: [1], difficulty: "mixta", baseComplexity: base.complexity, fillCentro: false, useBackground: false });
  data[st] = plan.map(pg => {
    const doc = createDoc({ preset: PRESET, seed: pg.seed, marginMm: 12 });
    generateMandalaClassic(doc, { ...base, seed: pg.seed, complexity: pg.complexity, petals: pg.petals, styleMode: st, structure: pg.structure,
      silhouette: pg.silhouette, strokeWidthMm: pageStrokeMm(base.strokeWidthMm, pg.strokeScale ?? 1), center: { x: doc.page.wMm / 2, y: doc.page.hMm / 2 }, radius: 80 });
    return shapeFeatures(renderDocToSvgString(doc));
  });
}
// Normalización con las páginas de entrenamiento (índices pares); prueba con las impares
const train = (st) => data[st].filter((_, i) => i % 2 === 0), test = (st) => data[st].filter((_, i) => i % 2 === 1);
const all = BOOK_STYLES.flatMap(train), F = all[0].length;
const mean = Array.from({ length: F }, (_, f) => all.reduce((s, x) => s + x[f], 0) / all.length);
const sd = Array.from({ length: F }, (_, f) => Math.sqrt(all.reduce((s, x) => s + (x[f] - mean[f]) ** 2, 0) / all.length) || 1);
const z = (x) => x.map((v, f) => (v - mean[f]) / sd[f]);
const cent = Object.fromEntries(BOOK_STYLES.map(st => { const t = train(st).map(z); return [st, Array.from({ length: F }, (_, f) => t.reduce((s, x) => s + x[f], 0) / t.length)]; }));
const classify = (x) => { const v = z(x); let best = null, bd = Infinity; for (const st of BOOK_STYLES) { const d = v.reduce((s, q, f) => s + (q - cent[st][f]) ** 2, 0); if (d < bd) { bd = d; best = st; } } return best; };

const conf = {}; let hit = 0, n = 0;
for (const st of BOOK_STYLES) {
  conf[st] = Object.fromEntries(BOOK_STYLES.map(s => [s, 0]));
  for (const x of test(st)) { const c = classify(x); conf[st][c]++; n++; if (c === st) hit++; }
  conf[st]["acierto %"] = Math.round(100 * conf[st][st] / test(st).length);
}
console.log(`Identificabilidad de estilo · nivel ${LEVEL} · ${PER} páginas por estilo (mitad de prueba)`);
console.table(conf);
console.log("Centroides (en desviaciones estándar):");
console.table(Object.fromEntries(BOOK_STYLES.map(st => [st, Object.fromEntries(FEATURE_NAMES.map((nm, f) => [nm, +cent[st][f].toFixed(2)]))])));
console.log(`Acierto global: ${(100 * hit / n).toFixed(1)} % (azar: ${(100 / BOOK_STYLES.length).toFixed(1)} %)`);
