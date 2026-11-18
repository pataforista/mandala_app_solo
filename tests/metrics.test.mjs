// Pruebas de las piezas nuevas: conteo armónico por banda y métricas para colorear.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fitBandCount } from "../js/core/bandMetrics.js";
import { measureSvg, commercialScore } from "../js/core/commercialMetrics.js";

test("fitBandCount: elige sólo entre los candidatos (simetría armónica)", () => {
  const candidates = [6, 12, 24, 48];
  for (const [r0, r1] of [[5, 15], [20, 22], [40, 60], [60, 90]]) {
    assert.ok(candidates.includes(fitBandCount({ r0, r1, candidates, aspect: 0.8, minArea: 4 })));
  }
});

// Mismo formato que emite PathBuilder: comandos separados por espacios
const rect = (x, y, w, h) => `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;

test("measureSvg: una celda grande no cuenta como pequeña; una de 2×2 mm sí", () => {
  const svg = `<svg><path d="${rect(0, 0, 20, 20)}" stroke-width="0.8"/><path d="${rect(50, 50, 2, 2)}" stroke-width="0.8"/></svg>`;
  const m = measureSvg(svg);
  assert.equal(m.regiones, 2);
  assert.equal(m.pequenas, 50);
  assert.equal(m.aspecto, 0);
});

test("measureSvg: detecta trazos finos (< 0,7 mm)", () => {
  const svg = `<svg><path d="${rect(0, 0, 20, 20)}" stroke-width="0.3"/><path d="${rect(40, 40, 20, 20)}" stroke-width="0.9"/></svg>`;
  assert.equal(measureSvg(svg).finas, 50);
});

test("commercialScore: 100 para un diseño sin defectos y menos con trazo fino", () => {
  const clean = { regiones: 100, pequenas: 0, aspecto: 0, huecos: 0, finas: 0 };
  assert.equal(commercialScore(clean, { strokeWidthMm: 0.9, minCellAreaMm2: 6 }).score, 100);
  const thin = commercialScore(clean, { strokeWidthMm: 0.4, minCellAreaMm2: 6 });
  assert.ok(thin.score < 100);
  assert.ok(thin.issues.some(i => i.includes("grosor")));
});

// Lo que se imprime: un relleno blanco pintado DESPUÉS tapa lo de abajo; uno pintado antes, no.
test("measureSvg: los trazos tapados por un relleno blanco posterior o recortados no cuentan como huecos", () => {
  const line = (y) => `M 10 ${y} L 30 ${y}`;
  // Dos líneas paralelas a 0,8 mm: hueco estrecho
  const pair = `<path d="${line(20)}" fill="none" stroke-width="0.8"/><path d="${line(20.8)}" fill="none" stroke-width="0.8"/>`;
  const disc = `<path d="M 5 5 L 40 5 L 40 40 L 5 40 Z" fill="#fff" stroke-width="0.8"/>`;
  const vb = (body) => `<svg viewBox="0 0 100 100">${body}</svg>`;
  assert.ok(measureSvg(vb(pair)).huecos > 50, "visibles: hueco estrecho");
  // El cuadrado blanco pintado encima tapa las dos líneas: sólo quedan sus 4 esquinas
  assert.equal(measureSvg(vb(pair + disc)).huecos, 0);
  // Pintado antes, no tapa nada
  assert.ok(measureSvg(vb(disc + pair)).huecos > 0);
  // Recortadas por un clip-path que las deja fuera
  const clip = `<defs><clipPath id="c"><rect x="50" y="50" width="40" height="40" /></clipPath></defs>`;
  assert.equal(measureSvg(vb(`${clip}<g clip-path="url(#c)">${pair}</g>`)).huecos, 0);
});

test("nivel experto: la puntuación propia mide celdas dentro del disco, astillas y puntos de contraste", async () => {
  const { expertScore, regionAreas } = await import("../js/core/commercialMetrics.js");
  const { createDoc } = await import("../js/core/svgDoc.js");
  const { renderDocToSvgString } = await import("../js/core/svgRender.js");
  const { generateMandalaClassic } = await import("../js/generators/mandalaClassic.js");
  const { levelToGeneratorOpts, COLORING_PRESETS } = await import("../js/core/levels.js");
  const p = COLORING_PRESETS.experto, layers = Object.fromEntries(Object.entries(p).filter(([k]) => k.startsWith("layer")));
  const doc = createDoc({ preset: "KDP_8_5x8_5", seed: 38, marginMm: 12 });
  generateMandalaClassic(doc, { ...levelToGeneratorOpts("experto"), ...layers, organicLevel: p.organic, textures: p.textures, pageBorder: false, kaleidoscope: true, seed: 38, petals: 16, styleMode: "floral" });
  const svg = renderDocToSvgString(doc);
  const r = expertScore(svg, doc.page);
  assert.ok(Number.isInteger(r.score) && r.score >= 0 && r.score <= 100, "puntuación entera 0–100");
  assert.ok(r.partes["celdas en el disco"] > 300, "un mandala experto tiene cientos de celdas en el disco");
  assert.ok(r.partes["puntos de contraste"] >= 1, "el experto lleva puntos de contraste");
  // Una página en blanco no tiene celdas: no puede puntuar alto
  const blank = createDoc({ preset: "KDP_8_5x8_5", seed: 1, marginMm: 12 });
  assert.ok(expertScore(renderDocToSvgString(blank), blank.page).score < 60, "una página vacía no puntúa como experto");
  // Las áreas son mm² reales: las regiones del disco suman menos que el disco
  const { areas, discArea } = regionAreas(svg, doc.page);
  assert.ok(areas.reduce((t, a) => t + a, 0) < discArea, "las regiones caben en el disco");
});
