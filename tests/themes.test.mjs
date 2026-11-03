// Temas de libro e ilustraciones: cada paquete del catálogo se puede elegir desde la
// pestaña del libro, cada tema tiene fondos dibujables y los fondos de las figuras siguen
// al tema (antes: margaritas y corazones alrededor de todas las figuras). `npm test`
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { BOOK_THEMES, planBook, bestSellerProfile, PATTERN_BACKGROUNDS } from "../js/core/bookPlan.js";
import { BACKGROUNDS, SCATTER_THEMES, scatterWeights, varyWeights } from "../js/generators/pageComposer.js";
import { createDoc } from "../js/core/svgDoc.js";
import { renderDocToSvgString } from "../js/core/svgRender.js";
import { generateMandalaClassic } from "../js/generators/mandalaClassic.js";
import { unpackFigures } from "../js/core/figurePack.js";

const catalog = JSON.parse(fs.readFileSync("assets/catalogo.json", "utf8"));
const html = fs.readFileSync("index.html", "utf8");

test("cada tema del libro: paquetes del catálogo, fondos dibujables y opción en la interfaz", () => {
  const ids = new Set(catalog.map(c => c.id));
  for (const [key, t] of Object.entries(BOOK_THEMES)) {
    assert.ok(Array.isArray(t.packages), `${key}: lista de paquetes`);
    for (const p of t.packages) assert.ok(ids.has(p), `${key}: paquete ${p} no existe`);
    for (const b of t.backgrounds || []) assert.ok(BACKGROUNDS.includes(b), `${key}: fondo ${b}`);
    if (t.scatterTheme) {
      assert.ok(SCATTER_THEMES[t.scatterTheme], `${key}: fondo suelto ${t.scatterTheme}`);
      assert.ok(t.backgrounds.includes(t.scatterTheme), `${key}: su fondo suelto entra en el reparto`);
    }
    if (key !== "none") assert.match(html, new RegExp(`<sl-option value="${key}">`), `${key}: opción en el selector de tema`);
  }
  // Navidad cargaba el paquete de dinosaurios zentangle
  assert.ok(!BOOK_THEMES.navidad.packages.includes("zentangle"));
});

test("cada paquete de ilustraciones se puede marcar en la pestaña del libro", () => {
  for (const c of catalog) assert.match(html, new RegExp(`size="small" class="bookPkg" value="${c.id}"`), c.id);
  // y algún tema lo propone (salvo los adornos, que acompañan)
  const proposed = new Set(Object.values(BOOK_THEMES).flatMap(t => t.packages));
  for (const c of catalog) assert.ok(proposed.has(c.id), `ningún tema propone ${c.id}`);
});

test("con tema, las tramas sólo caen donde se dibujan y el fondo no se reduce a dos", () => {
  for (const key of Object.keys(BOOK_THEMES).filter(k => k !== "none")) {
    const t = BOOK_THEMES[key];
    const plan = planBook({ count: 50, seed: 3, ...bestSellerProfile("KDP_8_5x11"), styles: t.styles, styleWeights: t.styleWeights, backgrounds: t.backgrounds });
    for (const p of plan) {
      if (!p.background) continue;
      assert.ok(t.backgrounds.includes(p.background), `${key}: ${p.background}`);
      if (PATTERN_BACKGROUNDS.includes(p.background)) assert.ok(["fondo", "centro"].includes(p.composition), `${key}: trama en ${p.composition}`);
    }
    assert.ok(new Set(plan.map(p => p.background).filter(Boolean)).size >= 3, `${key}: variedad de fondos`);
  }
});

test("fondos de figura: el tema de la figura elige los motivos y cada página mezcla otros", () => {
  assert.equal(scatterWeights("naturaleza"), SCATTER_THEMES.bosque);
  assert.equal(scatterWeights(null, "jardin", "oceano"), SCATTER_THEMES.oceano);
  assert.equal(scatterWeights("nada"), null);
  const a = varyWeights(SCATTER_THEMES.oceano, 1), b = varyWeights(SCATTER_THEMES.oceano, 2);
  assert.ok(Object.keys(a).length >= 3 && Object.keys(a).every(k => SCATTER_THEMES.oceano[k]));
  assert.notDeepEqual(a, b);

  const fig = unpackFigures(fs.readFileSync("assets/figuras-marinas.json", "utf8"))[0];
  const draw = (figure, extra = {}) => {
    const doc = createDoc({ preset: "KDP_8_5x11", seed: 11, marginMm: 10 });
    generateMandalaClassic(doc, { seed: 11, complexity: 100, petals: 12, styleMode: "floral", strokeWidthMm: 0.8, figure, ...extra });
    return renderDocToSvgString(doc);
  };
  // Sin tema propio, la figura conserva el relleno de siempre
  const plain = draw({ ...fig, theme: "" });
  assert.equal(draw({ ...fig, theme: "desconocido" }), plain);
  const themed = draw(fig);
  assert.notEqual(themed, plain);
  assert.doesNotMatch(themed, /NaN|undefined/);
});
