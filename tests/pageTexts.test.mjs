// Textos impresos dentro de las páginas: mismo contenido en cada idioma, nada en español
// dentro de un libro en inglés y ningún rótulo más ancho que el área segura.
import test from "node:test";
import assert from "node:assert/strict";
import { createDoc } from "../js/core/svgDoc.js";
import { renderDocToSvgString } from "../js/core/svgRender.js";
import { generateSpecialPage } from "../js/generators/specialPages.js";
import { MYSTERY_SHAPES } from "../js/generators/mysteryMandala.js";
import { CHAPTERS } from "../js/core/bookPlan.js";
import { PAGE_TEXTS, PAGE_LANGS } from "../js/core/pageTexts.js";
import { KDP_OUTSIDE_MARGIN_MM } from "../js/core/kdp.js";
import { CHAR_EM } from "../js/core/svgText.js";

const NATURE = Object.keys(PAGE_TEXTS.es.nature);
const BASE = { complexity: 90, strokeWidthMm: 0.8, petals: 12, styleMode: "floral", includeFrames: true, pageBorder: true, textures: false };

// Una página de cada tipo que lleva texto
const SPECIALS = [
  { type: "grow", stage: 0, of: 4 }, { type: "grow", stage: 3, of: 4 },
  { type: "mystery", shape: "gato", n: 1, of: 3 },
  ...NATURE.map(kind => ({ type: "nature", kind })),
  { type: "mural", cols: 2, rows: 2, col: 0, row: 1 }, { type: "mural", cols: 3, rows: 3, guide: true },
  { type: "solutions", entries: [{ label: "x", shape: "gato", seed: 3, complexity: 90 }] },
  ...CHAPTERS.map((c, i) => ({ type: "chapter", n: i + 1, of: 4, title: c.title })),
];

function texts(svg) {
  return [...svg.matchAll(/<text\b([^>]*)>([^<]*)<\/text>/g)].map(([, a, t]) => ({
    x: +/\sx="([-\d.]+)"/.exec(a)[1], size: +/font-size="([\d.]+)"/.exec(a)[1],
    anchor: /text-anchor="(\w+)"/.exec(a)?.[1] || "start", text: t.replace(/&amp;/g, "&").replace(/&[a-z]+;/g, "x"),
  }));
}

test("textos de página: los idiomas tienen las mismas claves y cubren formas, notas y capítulos", () => {
  const shape = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v && typeof v === "object" && !Array.isArray(v) ? shape(v) : typeof v]));
  for (const lang of PAGE_LANGS) assert.deepEqual(shape(PAGE_TEXTS[lang]), shape(PAGE_TEXTS.es), `claves de «${lang}»`);
  for (const k of Object.keys(MYSTERY_SHAPES)) assert.ok(PAGE_TEXTS.en.shapes[k], `falta la forma «${k}»`);
  for (const c of CHAPTERS) assert.equal(PAGE_TEXTS.es.chapterTitles[c.key], c.title, `capítulo «${c.key}»`);
});

test("textos de página: un libro en inglés no imprime español", () => {
  const SPANISH = /[áéíóúñ¿¡]|\b(Capítulo|Misterioso|Mandala que|hoja|etapa|Soluciones|Arma tu|columna|fila|arriba|derecha|Tamaño|Jardín|Geometría)\b/i;
  for (const sp of SPECIALS) {
    const d = createDoc({ preset: "KDP_8_5x11", seed: 5, marginMm: 10 });
    generateSpecialPage(d, { ...BASE, seed: 5, special: sp, lang: "en" });
    for (const t of texts(renderDocToSvgString(d))) assert.doesNotMatch(t.text, SPANISH, `${sp.type}: «${t.text}»`);
  }
});

test("textos de página: ningún rótulo se sale del área segura (estimación por ancho medio de letra)", () => {
  const EM = CHAR_EM; // el mismo ancho que usa wrapLines al cortar las líneas
  const bad = [];
  for (const lang of PAGE_LANGS) for (const preset of ["KDP_6x9", "KDP_8_5x11", "KDP_8_5x8_5"]) for (const sp of SPECIALS) {
    const margin = 9.6;
    const d = createDoc({ preset, seed: 5, marginMm: margin });
    generateSpecialPage(d, { ...BASE, seed: 5, special: sp, lang });
    for (const t of texts(renderDocToSvgString(d))) {
      const w = t.text.length * t.size * EM;
      const x0 = t.anchor === "middle" ? t.x - w / 2 : t.anchor === "end" ? t.x - w : t.x;
      // Lados: el medianil (los rótulos van en ambas caras); se exige el margen del libro
      if (x0 < margin - 0.01 || x0 + w > d.page.wMm - margin + 0.01) bad.push(`${lang}/${preset}/${sp.type}: «${t.text}» (${w.toFixed(0)} mm)`);
    }
    assert.ok(KDP_OUTSIDE_MARGIN_MM < margin);
  }
  assert.deepEqual(bad, [], bad.join("\n"));
});

test("textos de las páginas de venta (BOOK_TEXTS): mismos campos en cada idioma", async () => {
  // export.js usa window/document sólo dentro de funciones: importarlo en Node es seguro
  const { BOOK_TEXTS } = await import("../js/core/export.js");
  const keys = (o) => Object.keys(o).sort();
  for (const lang of Object.keys(BOOK_TEXTS)) assert.deepEqual(keys(BOOK_TEXTS[lang]), keys(BOOK_TEXTS.es), `BOOK_TEXTS.${lang}`);
  assert.deepEqual(Object.keys(BOOK_TEXTS).sort(), [...PAGE_LANGS].sort(), "los idiomas del libro y de las páginas coinciden");
});
