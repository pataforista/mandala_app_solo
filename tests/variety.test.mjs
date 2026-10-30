// Variedad entre páginas: huella geométrica, reparto del plan y fondos (sin DOM): `npm test`
import { test } from "node:test";
import assert from "node:assert/strict";
import { createDoc } from "../js/core/svgDoc.js";
import { renderDocToSvgString } from "../js/core/svgRender.js";
import { generateMandalaClassic, STRUCTURES } from "../js/generators/mandalaClassic.js";
import { BACKGROUNDS, PATTERN_THEMES } from "../js/generators/pageComposer.js";
import { planBook, bestSellerProfile, BOOK_STRUCTURES, PATTERN_BACKGROUNDS } from "../js/core/bookPlan.js";
import { pageFingerprint, fingerprintSimilarity, similarPairs, TWIN_THRESHOLD } from "../js/core/variety.js";
import { measureSvg, commercialScore } from "../js/core/commercialMetrics.js";

const BASE = { strokeWidthMm: 0.8, complexity: 100, includeFrames: true, pageBorder: true, textures: false,
  spacing: 0.4, minCellAreaMm2: 5, detailSimplification: 0.6, styleMode: "floral", petals: 16, frameStyle: "ninguno" };
const page = (o, preset = "KDP_8_5x11") => {
  const doc = createDoc({ preset, seed: o.seed, marginMm: 10 });
  generateMandalaClassic(doc, { ...BASE, ...o });
  const svg = renderDocToSvgString(doc);
  return { svg, doc, fp: pageFingerprint(svg, doc.page) };
};

test("huella: una página es idéntica a sí misma y la gemela se parece más que una página distinta", () => {
  const a = page({ seed: 1, composition: "centro", silhouette: "lotus", structure: "corona" });
  const twin = page({ seed: 2, composition: "centro", silhouette: "lotus", structure: "corona" });
  const other = page({ seed: 2, composition: "centro", silhouette: "diamond", structure: "heroe" });
  const bg = page({ seed: 2, composition: "fondo", background: "escamas", silhouette: "heart", structure: "nucleo" });
  assert.ok(Math.abs(fingerprintSimilarity(a.fp, a.fp) - 1) < 1e-9);
  const sT = fingerprintSimilarity(a.fp, twin.fp), sO = fingerprintSimilarity(a.fp, other.fp), sB = fingerprintSimilarity(a.fp, bg.fp);
  assert.ok(sT > sO, `gemela ${sT.toFixed(3)} > distinta ${sO.toFixed(3)}`);
  assert.ok(sO > sB, `otro centrado ${sO.toFixed(3)} > página con trama ${sB.toFixed(3)}`);
  assert.ok(sB < TWIN_THRESHOLD);
  const pairs = similarPairs([a.fp, null, a.fp, bg.fp]);
  assert.deepEqual(pairs.map(p => [p.i, p.j]), [[0, 2]], "las nulas no se comparan");
});

test("plan: estructura y fondo repartidos sin repetir en páginas seguidas", () => {
  for (const seed of [1, 7]) {
    const plan = planBook({ count: 50, seed, ...bestSellerProfile("KDP_8_5x11") });
    assert.ok(plan.every(p => BOOK_STRUCTURES.includes(p.structure)));
    for (let i = 1; i < plan.length; i++) assert.notEqual(plan[i].structure, plan[i - 1].structure, `estructura, págs. ${i}-${i + 1}`);
    assert.ok(new Set(plan.map(p => p.structure)).size === BOOK_STRUCTURES.length);
    // Fondo sólo donde hay espacio que decorar; tramas sólo en «fondo decorado»
    for (const p of plan) {
      if (p.composition === "gigante") assert.equal(p.background, null);
      else if (p.composition === "centro") assert.ok(p.background, "hoja vertical: el centrado completa la hoja");
      else assert.ok(BACKGROUNDS.includes(p.background));
      if (PATTERN_BACKGROUNDS.includes(p.background)) assert.ok(["fondo", "centro"].includes(p.composition));
    }
    if (seed === 1) {
      const sq = planBook({ count: 50, seed, ...bestSellerProfile("KDP_8_5x8_5") });
      assert.ok(sq.filter(p => p.composition === "centro").every(p => p.background === null), "cuadrado: centrado limpio");
    }
    // Páginas vecinas nunca comparten fondo; los fondos decorados usan casi todos los temas
    for (let i = 1; i < plan.length; i++) if (plan[i].background) assert.notEqual(plan[i].background, plan[i - 1].background, `fondo, págs. ${i}-${i + 1}`);
    const fondos = plan.filter(p => p.composition === "fondo").map(p => p.background);
    assert.ok(new Set(fondos.slice(0, BACKGROUNDS.length)).size >= 5, `semilla ${seed}: ${fondos.join(",")}`);
  }
});

test("estructuras y fondos: se dibujan con celdas coloreables y la estructura por defecto no cambia", () => {
  for (const structure of Object.keys(STRUCTURES)) {
    const { svg } = page({ seed: 7, composition: "centro", silhouette: "round", structure }, "KDP_8_5x8_5");
    const { score } = commercialScore(measureSvg(svg), { strokeWidthMm: 0.8, minCellAreaMm2: 5 });
    assert.ok(score >= 60, `${structure}: ${score}`);
  }
  for (const background of BACKGROUNDS) {
    const { svg } = page({ seed: 5, composition: "fondo", background, silhouette: "round" });
    const m = measureSvg(svg);
    assert.ok(m.regiones > 50, background);
    assert.ok(commercialScore(m, { strokeWidthMm: 0.8, minCellAreaMm2: 5 }).score >= 55, background);
    if (PATTERN_THEMES.includes(background)) assert.ok(svg.includes('fill="#fff"'), "halo blanco");
  }
  // Sin estructura ni fondo pedidos, la página es la de siempre
  const plain = page({ seed: 3, composition: "fondo" }).svg;
  assert.equal(page({ seed: 3, composition: "fondo", structure: "corona", background: "jardin" }).svg, plain);
});
