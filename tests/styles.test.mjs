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
