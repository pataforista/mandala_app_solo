// Guardia de impresión: ninguna tinta (trazo con su medio grosor) puede invadir el margen
// del libro. KDP sin sangrado rechaza o marca el interior si hay contenido en el medianil
// (9,5 mm con ≤ 150 páginas) o a menos de 6,35 mm del corte.
// Recorre libros completos como los arma la app: páginas normales de todas las
// composiciones y marcos, más las especiales (crece, misterio, naturaleza, mural,
// soluciones y portadillas de capítulo), en varios formatos y niveles de trazo.
import test from "node:test";
import assert from "node:assert/strict";
import { createDoc } from "../js/core/svgDoc.js";
import { renderDocToSvgString } from "../js/core/svgRender.js";
import { generateMandalaClassic } from "../js/generators/mandalaClassic.js";
import { withSpecialPages } from "../js/generators/specialPages.js";
import { inkBounds } from "../js/core/commercialMetrics.js";
import { kdpGutterMm, KDP_OUTSIDE_MARGIN_MM } from "../js/core/kdp.js";
import { levelToGeneratorOpts } from "../js/core/levels.js";
import {
  planBook, pageStrokeMm, addSpecialPages, insertChapterDividers, chapterLayout,
  BOOK_STYLES, BOOK_COMPOSITIONS, BOOK_FRAMES, SCATTER_BACKGROUNDS, PATTERN_BACKGROUNDS,
} from "../js/core/bookPlan.js";

const gen = withSpecialPages(generateMandalaClassic);
// Trazo y espaciado desde js/core/levels.js (con complejidad ágil para la batería de pruebas)
const LEVELS = {
  adulto: { ...levelToGeneratorOpts("adulto"), complexity: 80 },
  letra_grande: { ...levelToGeneratorOpts("letra_grande"), complexity: 60 },
  ninos: { ...levelToGeneratorOpts("ninos"), complexity: 20 },
};

function violation(svg, page, margin) {
  const b = inkBounds(svg);
  if (!b) return null;
  const worst = Math.min(b.x0, b.y0, page.wMm - b.x1, page.hMm - b.y1);
  return worst < margin - 0.01 ? +worst.toFixed(2) : null;
}

test("márgenes: ninguna composición ni marco pone tinta fuera del margen", () => {
  const bad = [];
  const margin = kdpGutterMm(100);
  const bgs = [...SCATTER_BACKGROUNDS, ...PATTERN_BACKGROUNDS];
  let n = 0;
  for (const preset of ["KDP_8_5x11", "KDP_6x9", "KDP_8_5x8_5"]) for (const [lvName, lv] of Object.entries(LEVELS))
    for (const composition of BOOK_COMPOSITIONS) for (const frameStyle of BOOK_FRAMES) {
      const doc = createDoc({ preset, seed: n, marginMm: margin });
      const strokeWidthMm = pageStrokeMm(lv.strokeWidthMm, 1.5); // el trazo más grueso que reparte el plan
      gen(doc, { ...lv, seed: 1000 + n, petals: 12, styleMode: BOOK_STYLES[n % BOOK_STYLES.length], strokeWidthMm,
        textures: false, pageBorder: true, composition, frameStyle, background: bgs[n % bgs.length] });
      n++;
      const v = violation(renderDocToSvgString(doc), doc.page, margin);
      if (v != null) bad.push(`${preset}/${lvName}/${composition}/${frameStyle}: ${v} mm`);
    }
  assert.deepEqual(bad, [], `Tinta dentro del margen de ${margin.toFixed(2)} mm:\n${bad.join("\n")}`);
});

test("márgenes: libro completo con páginas especiales respeta medianil y zona segura", () => {
  const bad = [];
  for (const preset of ["KDP_8_5x11", "KDP_6x9"]) for (const [lvName, lv] of Object.entries(LEVELS)) {
    const seed = preset.length * 7919 + lvName.length;
    const styles = BOOK_STYLES;
    const reg = planBook({ count: 16, seed, styles, difficulty: "progresiva", baseComplexity: lv.complexity,
      chapters: chapterLayout(16, styles) });
    const plan = insertChapterDividers(addSpecialPages(reg, { seed, growth: 1, mystery: 2, nature: true,
      mural: { cols: 2, rows: 2 }, difficulty: "progresiva", baseComplexity: lv.complexity, styles }), seed);
    // Margen como en la app: el medianil que pide KDP para el total de páginas (con reverso en blanco)
    const margin = Math.max(10, kdpGutterMm(plan.length * 2 + 4), KDP_OUTSIDE_MARGIN_MM);
    plan.forEach((pg, i) => {
      const o = { ...lv, seed: pg.seed, complexity: pg.complexity, petals: pg.petals, styleMode: pg.styleMode,
        strokeWidthMm: pageStrokeMm(lv.strokeWidthMm, pg.strokeScale ?? 1), textures: false, pageBorder: true };
      if (pg.special) Object.assign(o, { special: { ...pg.special } }, pg.silhouette ? { silhouette: pg.silhouette } : {});
      else Object.assign(o, { composition: pg.composition, frameStyle: pg.frameStyle, structure: pg.structure, silhouette: pg.silhouette, background: pg.background });
      // La guía del mural es una miniatura escalada (transform) a ≥ 3 mm del margen por
      // construcción; inkBounds no aplica transformaciones, así que no se mide aquí
      if (pg.special?.type === "mural" && pg.special.guide) return;
      const doc = createDoc({ preset, seed: o.seed, marginMm: margin });
      gen(doc, o);
      const v = violation(renderDocToSvgString(doc), doc.page, margin);
      if (v != null) bad.push(`${preset}/${lvName} pág. ${i + 1} (${pg.special?.type || pg.composition}/${pg.frameStyle || "-"}): ${v} mm`);
    });
  }
  assert.deepEqual(bad, [], `Tinta dentro del margen:\n${bad.join("\n")}`);
});
