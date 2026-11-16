// Gramáticas de estilo del motor clásico (docs/ROADMAP_ESTILOS.md).
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { STYLE_GRAMMARS, grammarOf } from "../js/generators/styles/index.js";
import { KNOWN_MOTIFS } from "../js/generators/mandalaClassic.js";
import { BOOK_STYLES, BOOK_SILHOUETTES, SILHOUETTES_BY_STYLE, SILHOUETTE_FAMILY } from "../js/core/bookPlan.js";

test("hay una gramática por cada estilo del libro, y ninguna de sobra", () => {
  assert.deepEqual(Object.keys(STYLE_GRAMMARS).sort(), [...BOOK_STYLES].sort());
  for (const id of BOOK_STYLES) assert.equal(STYLE_GRAMMARS[id].id, id);
});

test("un estilo desconocido usa la gramática floral", () => {
  assert.equal(grammarOf("inexistente"), STYLE_GRAMMARS.floral);
});

test("toda gramática nombra sólo motivos que el motor sabe dibujar, con pesos positivos", () => {
  for (const [id, g] of Object.entries(STYLE_GRAMMARS)) {
    assert.ok(Object.keys(g.motifs).length >= 4, `${id}: pocos motivos`);
    for (const [m, w] of Object.entries(g.motifs)) {
      assert.ok(KNOWN_MOTIFS.includes(m) || typeof g.exclusive?.[m]?.draw === "function", `${id}: motivo desconocido «${m}»`);
      assert.ok(w > 0, `${id}: peso no positivo en «${m}»`);
    }
    assert.ok(g.silhouettes.length > 0 && g.cores.length > 0, `${id}: sin siluetas o núcleos`);
  }
});

test("el núcleo nunca es una espiral (no tiene simetría rotacional N)", () => {
  for (const g of Object.values(STYLE_GRAMMARS)) assert.ok(!g.cores.includes("espiral_aurea"));
});

test("prueba dorada: ningún estilo cambia una página sin que se regenere a propósito", () => {
  // Falla si una página de la matriz fija cambió. Si el cambio es intencionado:
  //   node scripts/golden-styles.mjs --write --styles <estilo>   y explicarlo en el PR.
  const out = execFileSync("node", ["scripts/golden-styles.mjs"], { encoding: "utf8", timeout: 240000 });
  assert.match(out, /(\d+)\/\1 páginas idénticas/);
});

test("vetos: ningún peso de un estilo está en su lista de vetados, ni su silueta por defecto", () => {
  for (const [id, g] of Object.entries(STYLE_GRAMMARS)) {
    for (const m of g.banned) {
      assert.ok(!(m in g.motifs), `${id}: «${m}» está vetado y tiene peso`);
      assert.ok(!g.silhouettes.includes(m), `${id}: «${m}» está vetado y es silueta`);
    }
  }
});

test("vetos: en 60 páginas reales por estilo no aparece ningún motivo vetado", async () => {
  const { createDoc } = await import("../js/core/svgDoc.js");
  const { generateMandalaClassic } = await import("../js/generators/mandalaClassic.js");
  const { levelToGeneratorOpts } = await import("../js/core/levels.js");
  for (const [id, g] of Object.entries(STYLE_GRAMMARS)) {
    for (let s = 1; s <= 60; s++) {
      const doc = createDoc({ preset: "KDP_8_5x11", seed: s, marginMm: 12 });
      // Con y sin la silueta que impone el plan del libro (cualquiera de las del libro, incluso ajena)
      const silhouette = s % 2 ? BOOK_SILHOUETTES[s % BOOK_SILHOUETTES.length] : undefined;
      generateMandalaClassic(doc, { ...levelToGeneratorOpts(["adulto", "ninos", "letra_grande"][s % 3]), seed: s * 17, petals: [12, 16, 20][s % 3], styleMode: id, silhouette });
      const used = doc.meta.discs[0].motifs; // todas las bandas, silueta incluida
      for (const m of g.banned) assert.ok(!used.includes(m), `${id} seed ${s}: dibujó el motivo vetado «${m}» (${used.join(",")})`);
    }
  }
});

test("libro: las siluetas de cada estilo respetan sus vetos y el motor las sabe dibujar", () => {
  for (const [id, list] of Object.entries(SILHOUETTES_BY_STYLE)) {
    const g = STYLE_GRAMMARS[id];
    for (const s of list) {
      assert.ok(!g.banned.includes(s), `${id}: la silueta «${s}» está vetada`);
      assert.ok(KNOWN_MOTIFS.includes(s) || g.exclusive?.[s]?.silhouette, `${id}: silueta desconocida «${s}»`);
      assert.ok(SILHOUETTE_FAMILY[s], `«${s}» no tiene familia visual`);
    }
  }
});

test("motivos exclusivos: sólo aparecen en su estilo y la cuota de firma se cumple", async () => {
  const { createDoc } = await import("../js/core/svgDoc.js");
  const { generateMandalaClassic } = await import("../js/generators/mandalaClassic.js");
  const { levelToGeneratorOpts } = await import("../js/core/levels.js");
  const owner = {};
  for (const [id, g] of Object.entries(STYLE_GRAMMARS)) for (const m of Object.keys(g.exclusive || {})) {
    assert.ok(!owner[m] && !KNOWN_MOTIFS.includes(m), `«${m}» está en dos estilos o pisa un motivo común`);
    owner[m] = id;
  }
  for (const [id, g] of Object.entries(STYLE_GRAMMARS)) {
    let signed = 0;
    const total = 60;
    for (let s = 1; s <= total; s++) {
      const doc = createDoc({ preset: "KDP_8_5x11", seed: s, marginMm: 12 });
      generateMandalaClassic(doc, { ...levelToGeneratorOpts(["adulto", "ninos", "letra_grande"][s % 3]), seed: s * 23, petals: [12, 16, 20][s % 3], styleMode: id,
        silhouette: BOOK_SILHOUETTES[s % BOOK_SILHOUETTES.length] });
      const used = doc.meta.discs[0].motifs;
      for (const m of used) if (owner[m]) assert.equal(owner[m], id, `${id} dibujó «${m}», exclusivo de ${owner[m]}`);
      if (used.some(m => owner[m] === id)) signed++;
    }
    if (g.quota) assert.ok(signed >= total * 0.95, `${id}: sólo ${signed}/${total} páginas llevan firma`);
  }
});

test("puntuación por estilo: ningún estilo baja de su suelo (adulto, 24 semillas)", async () => {
  // Suelos = medida tras E10 (docs/lineas-base/estilos-E10.txt) menos 3 puntos de holgura.
  // Si un cambio de dibujo baja un estilo de aquí, se mide y se decide; no se sube la holgura.
  const FLOOR = { floral: 77, geometric: 78, islamico: 79, sashiko: 77, celtico: 81, azteca: 75, yantra: 80 };
  const { createDoc } = await import("../js/core/svgDoc.js");
  const { renderDocToSvgString } = await import("../js/core/svgRender.js");
  const { generateMandalaClassic } = await import("../js/generators/mandalaClassic.js");
  const { measureSvg, commercialScore } = await import("../js/core/commercialMetrics.js");
  const { levelToGeneratorOpts } = await import("../js/core/levels.js");
  for (const id of BOOK_STYLES) {
    let sum = 0;
    const n = 24;
    for (let s = 1; s <= n; s++) {
      const o = { ...levelToGeneratorOpts("adulto"), organicLevel: 0.2, textures: false, pageBorder: true, seed: s * 31 + 7, petals: [12, 16, 18, 20, 24][s % 5], styleMode: id };
      const doc = createDoc({ preset: "KDP_8_5x11", seed: o.seed, marginMm: 12 });
      generateMandalaClassic(doc, o);
      sum += commercialScore(measureSvg(renderDocToSvgString(doc)), { strokeWidthMm: o.strokeWidthMm, minCellAreaMm2: o.minCellAreaMm2 }).score;
    }
    assert.ok(sum / n >= FLOOR[id], `${id}: media ${(sum / n).toFixed(1)} < suelo ${FLOOR[id]}`);
  }
});

test("capítulos: cada estilo del libro pertenece a un capítulo y sólo a uno", async () => {
  const { CHAPTERS } = await import("../js/core/bookPlan.js");
  for (const id of BOOK_STYLES) assert.equal(CHAPTERS.filter(c => c.styles.includes(id)).length, 1, `estilo «${id}»`);
  for (const c of CHAPTERS) assert.ok(CHAPTERS.some(o => o.key === c.near), `capítulo «${c.key}»: afín desconocido`);
});
