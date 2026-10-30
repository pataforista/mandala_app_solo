// Banco de pruebas de repetición: genera libros completos y mide cuántos pares de páginas
// son gemelas según la huella geométrica (js/core/variety.js), la misma que usa la revisión.
//   node scripts/bench-variety.mjs [libros=10] [--antiguo]
// --antiguo: sin silueta, estructura, tema de fondo ni capítulos (como antes), para comparar.
// Calibración del umbral (0,90), revisada a ojo sobre los pares de un libro de 50 páginas:
// pares ≥ 0,90 se veían casi iguales; pares de 0,81–0,85 ya se distinguían al hojear.
import { createDoc } from "../js/core/svgDoc.js";
import { renderDocToSvgString } from "../js/core/svgRender.js";
import { generateMandalaClassic } from "../js/generators/mandalaClassic.js";
import { planBook, bestSellerProfile, pageStrokeMm, chapterLayout } from "../js/core/bookPlan.js";
import { pageFingerprint, fingerprintSimilarity, TWIN_THRESHOLD } from "../js/core/variety.js";

const BOOKS = Number(process.argv[2]) || 10;
const OLD = process.argv.includes("--antiguo");
const PRESET = "KDP_8_5x11", PAGES = 50;
const BASE = { strokeWidthMm: 0.8, includeFrames: true, pageBorder: true, textures: false, spacing: 0.4,
  minCellAreaMm2: 5, detailSimplification: 0.6 };
const W = { floral: 3, geometric: 2, islamico: 0.3, sashiko: 0.5, celtico: 0.3, azteca: 0.2, yantra: 0.2 };

const rows = [];
for (let b = 1; b <= BOOKS; b++) {
  const plan = planBook({ count: PAGES, seed: b, ...bestSellerProfile(PRESET), styles: Object.keys(W), styleWeights: Object.values(W),
    difficulty: "progresiva", baseComplexity: 102,
    ...(OLD ? { fillCentro: false } : { chapters: chapterLayout(PAGES, Object.keys(W), Object.values(W)) }) });
  const fps = plan.map(p => {
    const o = { ...BASE, seed: p.seed, complexity: p.complexity, petals: p.petals, styleMode: p.styleMode,
      composition: p.composition, frameStyle: p.frameStyle, strokeWidthMm: pageStrokeMm(0.8, p.strokeScale) };
    if (!OLD) Object.assign(o, { silhouette: p.silhouette, structure: p.structure, background: p.background });
    const doc = createDoc({ preset: PRESET, seed: p.seed, marginMm: 10 });
    generateMandalaClassic(doc, o);
    return pageFingerprint(renderDocToSvgString(doc), doc.page);
  });
  const sims = [];
  for (let i = 0; i < fps.length; i++) for (let j = i + 1; j < fps.length; j++) sims.push(fingerprintSimilarity(fps[i], fps[j]));
  sims.sort((x, y) => y - x);
  rows.push({ libro: b, "gemelas (≥0,90)": sims.filter(s => s >= TWIN_THRESHOLD).length, "parecidas (≥0,85)": sims.filter(s => s >= 0.85).length,
    "parecido máx": sims[0].toFixed(3), mediana: sims[Math.floor(sims.length / 2)].toFixed(3) });
}
console.table(rows);
const avg = (k) => (rows.reduce((s, r) => s + Number(r[k]), 0) / rows.length).toFixed(2);
console.log(`${OLD ? "Antiguo" : "Actual"}: gemelas por libro ${avg("gemelas (≥0,90)")} · parecidas ${avg("parecidas (≥0,85)")} · parecido máx ${avg("parecido máx")}`);
