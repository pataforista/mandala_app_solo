// Lámina de un estilo para revisarlo a ojo: 12 páginas (4 niveles × 3 semillas) como en un libro.
//   node scripts/style-sheet.mjs <estilo> <carpeta> [semilla=1]
// Escribe <carpeta>/<estilo>.html; cada página lleva nivel, puntuación y motivos por banda.
import fs from "node:fs";
import { createDoc } from "../js/core/svgDoc.js";
import { renderDocToSvgString } from "../js/core/svgRender.js";
import { generateMandalaClassic } from "../js/generators/mandalaClassic.js";
import { measureSvg, commercialScore } from "../js/core/commercialMetrics.js";
import { levelToGeneratorOpts } from "../js/core/levels.js";
import { planBook, bestSellerProfile, pageStrokeMm } from "../js/core/bookPlan.js";

const [style, dir, seed0 = "1"] = process.argv.slice(2);
const PRESET = "KDP_8_5x11", cells = [];
for (const level of ["ninos", "letra_grande", "adulto", "experto"]) {
  const base = { ...levelToGeneratorOpts(level), organicLevel: 0.2, textures: level === "experto", pageBorder: false };
  const plan = planBook({ count: 3, seed: Number(seed0) * 101 + level.length, ...bestSellerProfile(PRESET), styles: [style], styleWeights: [1],
    compositions: ["centro"], compositionWeights: [1], frames: ["ninguno"], frameWeights: [1], difficulty: "mixta", baseComplexity: base.complexity, fillCentro: false, useBackground: false });
  for (const pg of plan) {
    const o = { ...base, seed: pg.seed, complexity: pg.complexity, petals: pg.petals, styleMode: style, structure: pg.structure, silhouette: pg.silhouette,
      strokeWidthMm: pageStrokeMm(base.strokeWidthMm, pg.strokeScale ?? 1) };
    const doc = createDoc({ preset: "KDP_8_5x8_5", seed: pg.seed, marginMm: 8 });
    generateMandalaClassic(doc, o);
    const svg = renderDocToSvgString(doc);
    const sc = commercialScore(measureSvg(svg), { strokeWidthMm: o.strokeWidthMm, minCellAreaMm2: o.minCellAreaMm2 }).score;
    cells.push(`<div style="background:#fff"><div style="padding:2px 6px;background:#222;color:#fff">${level} · ${sc} · ${doc.meta.discs[0].motifs.join(" ")}</div>${svg.replace("<svg ", '<svg style="width:100%;height:auto;display:block" ')}</div>`);
  }
}
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(`${dir}/${style}.html`, `<!doctype html><meta charset="utf-8"><title>${style}</title><body style="margin:0;background:#888;display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:6px;font:13px sans-serif">${cells.join("")}</body>`);
console.log(`${dir}/${style}.html`);
