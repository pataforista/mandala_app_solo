// Curaduría automática del libro (js/core/bookCurator.js) y la corrección de la métrica
// que la alimenta (puntos sólidos no son celdas).
import { test } from "node:test";
import assert from "node:assert/strict";
import { curateBook, curationTargets, attemptChoice, summarize, WEAK_SCORE, CURATE_TRIES } from "../js/core/bookCurator.js";
import { measureSvg, commercialScore } from "../js/core/commercialMetrics.js";
import { createDoc } from "../js/core/svgDoc.js";
import { renderDocToSvgString } from "../js/core/svgRender.js";
import { generateMandalaClassic } from "../js/generators/mandalaClassic.js";
import { planBook, bestSellerProfile, pageStrokeMm, applyPageOverride, BOOK_STRUCTURES } from "../js/core/bookPlan.js";
import { pageFingerprint } from "../js/core/variety.js";

// Huellas sintéticas: misma huella ⇒ gemelas; huellas al azar ⇒ distintas
const fpA = { radial: [1, 5, 2, 8, 3], spec: [1, 0, 3, 0, 2], grid: [4, 1, 1, 4] };
const fpRand = (k) => ({ radial: [k % 3, k % 5, k % 7, 1, k], spec: [k % 2, 3, k % 4, 1, 0], grid: [1, k % 3, 2, k % 5] });

test("curationTargets: flojas que se pueden cambiar y una página de cada par gemelo", () => {
  const pages = [
    { score: 80, fp: fpA, fixable: true },
    { score: 40, fp: fpRand(1), fixable: true },   // floja
    { score: 30, fp: null, fixable: false },       // floja de un grupo: no se toca sola
    { score: 85, fp: fpA, fixable: true },         // gemela de la 0: se rehace la posterior
  ];
  assert.deepEqual(curationTargets(pages), [1, 3]);
});

test("curateBook: se queda con el mejor intento y descarta los que serían gemelos", async () => {
  const pages = [
    { score: 80, fp: fpA, fixable: true },
    { score: 40, fp: fpRand(2), fixable: true },
  ];
  // Intento 1: puntúa alto pero es gemelo de la página 0; intento 2: bueno y distinto
  const res = await curateBook(pages, (i, k) => (k === 1
    ? { score: 95, fp: fpA, choice: { bump: 1 } }
    : { score: 70 + k, fp: fpRand(10 + k), choice: { bump: k } }), { tries: 3, good: 99 });
  assert.equal(res.changes.get(1).bump, 3);
  assert.equal(pages[1].score, 73);
  assert.equal(res.after.weak.length, 0);
  assert.equal(res.after.twins.length, 0);
});

test("curateBook: si ningún intento mejora, la página queda como estaba", async () => {
  const pages = [{ score: 50, fp: null, fixable: true }];
  const res = await curateBook(pages, () => ({ score: 20, fp: null, choice: { bump: 9 } }), { tries: 2 });
  assert.equal(res.changes.size, 0);
  assert.equal(pages[0].score, 50);
});

test("attemptChoice: primero otro diseño; después también un encuadre más limpio de los permitidos", () => {
  const allowed = ["centro", "fondo", "constelacion", "esquinas", "gigante"];
  const half = Math.ceil(CURATE_TRIES / 2);
  for (let k = 1; k <= half; k++) assert.deepEqual(attemptChoice(k, { current: "constelacion", allowed }), { bump: k });
  const later = Array.from({ length: CURATE_TRIES - half }, (_, n) => attemptChoice(half + n + 1, { current: "constelacion", allowed, startBump: 2 }));
  assert.ok(later.every(c => ["centro", "fondo", "gigante", "esquinas"].includes(c.composition)), JSON.stringify(later));
  assert.equal(later[0].bump, half + 3);
  // Nunca un encuadre que no esté permitido, ni cambia si se pide no hacerlo
  const c = attemptChoice(CURATE_TRIES, { current: "fondo", allowed: ["fondo", "centro"] }).composition;
  assert.ok(c === undefined || c === "centro", c);
  assert.equal(attemptChoice(CURATE_TRIES, { current: "constelacion", allowed, canReframe: false }).composition, undefined);
});

test("applyPageOverride: otro diseño cambia semilla, estructura y silueta; sin cambio, la página es la del plan", () => {
  const pg = { seed: 10, styleMode: "floral", structure: "corona", silhouette: "lotus", composition: "fondo" };
  assert.deepEqual(applyPageOverride(pg, null), { seed: 10, structure: "corona", silhouette: "lotus", composition: "fondo" });
  const a = applyPageOverride(pg, { bump: 1, composition: "centro" });
  assert.notEqual(a.seed, 10);
  assert.equal(a.structure, BOOK_STRUCTURES[1]);
  assert.notEqual(a.silhouette, "lotus");
  assert.equal(a.composition, "centro");
});

test("measureSvg: una forma de relleno sólido (punto negro) no cuenta como celda", () => {
  const sq = (x, s) => `M ${x} 0 L ${x + s} 0 L ${x + s} ${s} L ${x} ${s} Z`;
  const svg = `<svg><path d="${sq(0, 20)}" fill="#fff" stroke-width="0.8"/><path d="${sq(40, 1)}" fill="#000" stroke-width="0.2"/></svg>`;
  const m = measureSvg(svg);
  assert.equal(m.regiones, 1);
  assert.equal(m.pequenas, 0);
});

test("libro real: tras la curaduría no queda ninguna página floja ni gemela y la media no baja", async () => {
  const PRESET = "KDP_8_5x11";
  const base = { strokeWidthMm: 0.8, spacing: 0.4, minCellAreaMm2: 5, detailSimplification: 0.6, textures: false, includeFrames: true, pageBorder: true };
  const prof = bestSellerProfile(PRESET);
  const plan = planBook({ count: 14, seed: 7919, ...prof, difficulty: "progresiva", baseComplexity: 102 });
  const render = (pg, ov = null) => {
    const a = applyPageOverride(pg, ov);
    const o = { ...base, seed: a.seed, complexity: pg.complexity, petals: pg.petals, styleMode: pg.styleMode, composition: a.composition,
      frameStyle: pg.frameStyle, structure: a.structure, silhouette: a.silhouette, background: pg.background,
      strokeWidthMm: pageStrokeMm(0.8, pg.strokeScale) };
    const doc = createDoc({ preset: PRESET, seed: o.seed, marginMm: 12 });
    generateMandalaClassic(doc, o);
    const svg = renderDocToSvgString(doc);
    return { score: commercialScore(measureSvg(svg), { strokeWidthMm: o.strokeWidthMm, minCellAreaMm2: 5 }).score, fp: pageFingerprint(svg, doc.page) };
  };
  const pages = plan.map(pg => ({ ...render(pg), fixable: true }));
  const before = summarize(pages);
  // Los motores ya dibujan bien a la primera (antes de las correcciones de raíz: ~65)
  assert.ok(before.mean >= 75, `media sin curar ${before.mean}`);
  const res = await curateBook(pages, (i, k) => {
    const choice = attemptChoice(k, { current: plan[i].composition, allowed: prof.compositions });
    return { ...render(plan[i], choice), choice };
  });
  assert.equal(res.after.weak.length, 0, `flojas: ${res.after.weak} (mín ${res.after.min})`);
  assert.equal(res.after.twins.length, 0);
  assert.ok(res.after.mean >= before.mean, `${before.mean} → ${res.after.mean}`);
  assert.ok(res.after.min >= 65, `peor página ${res.after.min}`);
});

test("curateBook: una página floja de un grupo se rehace con todo el grupo (vale la peor de sus páginas)", async () => {
  const pages = [
    { score: 80, fp: null, fixable: false, group: "g0", groupFixable: true },
    { score: 45, fp: null, fixable: false, group: "g0", groupFixable: true },
    { score: 82, fp: fpRand(3), fixable: true },
  ];
  assert.deepEqual(curationTargets(pages), [0]);
  const res = await curateBook(pages, (i, k) => ({
    // Intento 1: sube la floja pero hunde la otra; intento 2: las dos bien
    members: k === 1 ? [{ i: 0, score: 40, fp: null }, { i: 1, score: 90, fp: null }] : [{ i: 0, score: 76, fp: null }, { i: 1, score: 78, fp: null }],
    choice: { bump: k },
  }), { tries: 2 });
  assert.equal(res.changes.get(0).bump, 2);
  assert.deepEqual([pages[0].score, pages[1].score], [76, 78]);
});

test("curateBook: las páginas naranja (60–69) se pulen con pocos intentos y sin cambiar el encuadre", async () => {
  const pages = [{ score: 65, fp: null, fixable: true }, { score: 90, fp: null, fixable: true }];
  const seen = [];
  const res = await curateBook(pages, (i, k) => { seen.push([i, k]); return { score: 70 + k, fp: null, choice: attemptChoice(k, { current: "constelacion", allowed: ["centro", "constelacion"] }) }; });
  assert.deepEqual(seen.map(([i]) => i), [0, 0, 0], "sólo la naranja, 3 intentos");
  assert.equal(res.changes.get(0).composition, undefined);
  assert.equal(pages[0].score, 73);
});
