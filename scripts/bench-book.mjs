// Banco de pruebas de libros completos: arma libros como la app (perfil «los más vendidos»,
// capítulos, dificultad creciente, una secuencia que crece y un mural), mide cada página
// con la misma puntuación de la revisión y aplica la curaduría automática.
//   node scripts/bench-book.mjs [libros=3] [páginas=50] [formato=KDP_8_5x11] [nivel=adulto] [--sin-curar]
// Imprime, por libro, la calidad antes y después de la curaduría, y el reparto de estilos,
// encuadres y siluetas (variedad).
import { createDoc } from "../js/core/svgDoc.js";
import { renderDocToSvgString } from "../js/core/svgRender.js";
import { generateMandalaClassic } from "../js/generators/mandalaClassic.js";
import { withSpecialPages } from "../js/generators/specialPages.js";
import { planBook, bestSellerProfile, pageStrokeMm, chapterLayout, addSpecialPages, insertChapterDividers, applyPageOverride } from "../js/core/bookPlan.js";
import { measureSvg, commercialScore } from "../js/core/commercialMetrics.js";
import { pageFingerprint } from "../js/core/variety.js";
import { curateBook, attemptChoice, summarize, CURATE_TRIES } from "../js/core/bookCurator.js";

const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
const BOOKS = Number(args[0]) || 3, PAGES = Number(args[1]) || 50, PRESET = args[2] || "KDP_8_5x11", LEVEL = args[3] || "adulto";
const CURATE = !process.argv.includes("--sin-curar");

// Niveles de la app (COLORING_PRESETS en js/app.js), sólo lo que usa el motor clásico
const LEVELS = {
  adulto: { complexity: 110, densityFactor: 0.65, strokeWidthMm: 0.8, spacing: 0.4, minCellAreaMm2: 5, detailSimplification: 0.6, outlineMode: false, includeFrames: true },
  letra_grande: { complexity: 85, densityFactor: 0.5, strokeWidthMm: 1.1, spacing: 0.5, minCellAreaMm2: 7, detailSimplification: 0.75, outlineMode: false, includeFrames: true },
  ninos: { complexity: 40, densityFactor: 0.35, strokeWidthMm: 0.8, spacing: 0.6, minCellAreaMm2: 6, detailSimplification: 0.85, outlineMode: true, includeFrames: false },
};
const lv = LEVELS[LEVEL];
const base = { ...lv, organicLevel: 0.2, textures: false, pageBorder: true, kaleidoscope: true,
  complexity: Math.max(20, Math.round(lv.complexity * Math.min(1.6, Math.max(0.3, lv.densityFactor / 0.7)))) };
const W = { floral: 3, geometric: 2, islamico: 0.3, sashiko: 0.5, celtico: 0.3, azteca: 0.2, yantra: 0.2 }; // BESTSELLER_STYLE_W
const gen = withSpecialPages(generateMandalaClassic);
const tall = !/8_5x8_5/.test(PRESET);

function buildPlan(seed) {
  const prof = bestSellerProfile(PRESET);
  const styles = Object.keys(W), styleWeights = Object.values(W);
  const reg = planBook({ count: PAGES, seed, ...prof, styles, styleWeights, difficulty: "progresiva",
    baseComplexity: base.complexity, fillCentro: tall, chapters: chapterLayout(PAGES, styles, styleWeights) });
  return { prof, plan: insertChapterDividers(addSpecialPages(reg, { seed, growth: 1, mural: { cols: 2, rows: 2 },
    difficulty: "progresiva", baseComplexity: base.complexity, styles, styleWeights }), seed) };
}

function renderPage(pg, ov = null) {
  const a = applyPageOverride(pg, ov); // en una página especial sólo cuenta la semilla
  const o = { ...base, seed: a.seed, complexity: pg.complexity, petals: pg.petals, styleMode: pg.styleMode,
    strokeWidthMm: pageStrokeMm(base.strokeWidthMm, pg.strokeScale ?? 1) };
  if (pg.special) Object.assign(o, { special: { ...pg.special } }, pg.silhouette ? { silhouette: pg.silhouette } : {});
  else Object.assign(o, { composition: a.composition, frameStyle: pg.frameStyle, structure: a.structure, silhouette: a.silhouette, background: pg.background });
  const doc = createDoc({ preset: PRESET, seed: o.seed, marginMm: 12 });
  gen(doc, o);
  const svg = renderDocToSvgString(doc);
  const scorable = !pg.special || pg.special.type === "grow" || pg.special.type === "mural";
  return {
    score: scorable ? commercialScore(measureSvg(svg), { strokeWidthMm: o.strokeWidthMm, minCellAreaMm2: o.minCellAreaMm2 }).score : null,
    fp: pg.special ? null : pageFingerprint(svg, doc.page),
    composition: o.composition,
  };
}

const fmt = (s) => `media ${s.mean.toFixed(1)} · mín ${s.min} · flojas ${s.weak.length} · gemelas ${s.twins.length}`;
const rows = [];
for (let b = 1; b <= BOOKS; b++) {
  const seed = b * 7919;
  const { prof, plan } = buildPlan(seed);
  const pages = plan.map(pg => ({ ...renderPage(pg), fixable: !pg.special, group: pg.special?.group ?? null, groupFixable: true }));
  const before = summarize(pages);
  let after = before, changed = 0, reframed = 0;
  const finalComp = {};
  if (CURATE) {
    const res = await curateBook(pages, (i, k) => {
      const g = plan[i].special?.group;
      if (g != null) {
        const choice = { bump: k };
        return { members: plan.map((pg, j) => [pg, j]).filter(([pg]) => pg.special?.group === g).map(([pg, j]) => ({ i: j, ...renderPage(pg, choice) })), choice };
      }
      const choice = attemptChoice(k, { current: plan[i].composition, allowed: prof.compositions, canReframe: !plan[i].centerArt });
      return { ...renderPage(plan[i], choice), choice };
    }, { tries: CURATE_TRIES });
    after = res.after; changed = res.changes.size;
    reframed = [...res.changes.values()].filter(c => c.composition).length;
    for (const [i, c] of res.changes) if (c.composition) finalComp[i] = c.composition;
  }
  // Variedad final: reparto de encuadres de las páginas normales
  const comps = {};
  plan.forEach((pg, i) => { if (!pg.special) { const c = finalComp[i] || pg.composition; comps[c] = (comps[c] || 0) + 1; } });
  rows.push({ libro: b, páginas: plan.length, antes: fmt(before), después: CURATE ? fmt(after) : "—", rehechas: changed, "otro encuadre": reframed, encuadres: Object.entries(comps).map(([k, v]) => `${k} ${v}`).join(" · ") });
}
console.table(rows);
