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
