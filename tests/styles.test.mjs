// Gramáticas de estilo del motor clásico (docs/ROADMAP_ESTILOS.md).
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { STYLE_GRAMMARS, grammarOf } from "../js/generators/styles/index.js";
import { KNOWN_MOTIFS } from "../js/generators/mandalaClassic.js";
import { BOOK_STYLES } from "../js/core/bookPlan.js";

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
      assert.ok(KNOWN_MOTIFS.includes(m), `${id}: motivo desconocido «${m}»`);
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
      generateMandalaClassic(doc, { ...levelToGeneratorOpts(["adulto", "ninos", "letra_grande"][s % 3]), seed: s * 17, petals: [12, 16, 20][s % 3], styleMode: id });
      const used = doc.meta.discs[0].motifs; // todas las bandas, silueta incluida
      for (const m of g.banned) assert.ok(!used.includes(m), `${id} seed ${s}: dibujó el motivo vetado «${m}» (${used.join(",")})`);
    }
  }
});
