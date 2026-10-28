// Banco de pruebas visual: genera lotes de páginas con cada motor y mide su legibilidad
// para colorear. Sólo lee; no cambia ningún generador.
//   node scripts/bench-metrics.mjs [semillas=24]
// Las métricas viven en js/core/commercialMetrics.js (la misma que usa la app).
import { createDoc } from "../js/core/svgDoc.js";
import { renderDocToSvgString } from "../js/core/svgRender.js";
import { generateMandalaClassic } from "../js/generators/mandalaClassic.js";
import { generateMandalaRadial } from "../js/generators/mandalaRadial.js";
import { generateMandalaLayers } from "../js/generators/mandalaLayers.js";
import { measureSvg } from "../js/core/commercialMetrics.js";

const SEEDS = Number(process.argv[2]) || 24;
const FORMATS = ["KDP_6x9", "KDP_8_5x11"];
const STYLES = ["sashiko", "floral", "geometric", "islamico", "azteca", "yantra", "celtico"];
const BASE = {
  complexity: 130, organicLevel: 0.25, strokeWidthMm: 0.55,
  includeFrames: true, pageBorder: false, kaleidoscope: true, textures: true,
  layer1Intensity: 0.85, layer2Intensity: 0.75, layer3Intensity: 0.8, layer4Intensity: 0.7,
  layer5Intensity: 0.55, layer6Intensity: 0.8, layer7Intensity: 0.65, layer8Intensity: 0.35,
};
const ENGINES = { classic: generateMandalaClassic, radial: generateMandalaRadial, layers: generateMandalaLayers };

function run(engine, seed, format) {
  const petals = 6 + (seed % 10) * 2;
  const opts = { ...BASE, seed, petals, styleMode: STYLES[seed % STYLES.length] };
  const doc = createDoc({ preset: format, seed, marginMm: 10 });
  ENGINES[engine](doc, opts);
  const center = { x: doc.page.wMm / 2, y: doc.page.hMm / 2 };
  return measureSvg(renderDocToSvgString(doc), { petals: engine === "classic" ? petals : null, center });
}

const avg = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const rows = [];
for (const engine of Object.keys(ENGINES)) for (const format of FORMATS) {
  const res = [];
  for (let seed = 1; seed <= SEEDS; seed++) res.push(run(engine, seed, format));
  rows.push({
    motor: engine, formato: format,
    regiones: avg(res.map(r => r.regiones)).toFixed(0),
    "pequeñas%": avg(res.map(r => r.pequenas)).toFixed(1),
    "aspecto%": avg(res.map(r => r.aspecto)).toFixed(1),
    "huecos%": avg(res.map(r => r.huecos)).toFixed(1),
    "finas%": avg(res.map(r => r.finas)).toFixed(1),
    "asimetría (peor)": res.some(r => r.asimetria !== undefined) ? Math.max(...res.map(r => r.asimetria ?? 0)).toFixed(3) : "n/a",
  });
}
console.table(rows);
