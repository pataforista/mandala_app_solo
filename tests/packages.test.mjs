import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { unpackFigures } from "../js/core/figurePack.js";
import { createDoc } from "../js/core/svgDoc.js";
import { renderDocToSvgString } from "../js/core/svgRender.js";
import { generateMandalaClassic } from "../js/generators/mandalaClassic.js";

const USES = new Set(["figura", "anillos", "medallon", "extra", "ninguno"]);
const catalog = JSON.parse(fs.readFileSync("assets/catalogo.json", "utf-8"));
const packs = catalog.map(item => ({ item, figs: unpackFigures(fs.readFileSync(item.file, "utf-8")) }));

test("catálogo: ids únicos, archivos existentes y conteo declarado = figuras reales", () => {
  assert.equal(new Set(catalog.map(c => c.id)).size, catalog.length);
  for (const { item, figs } of packs) {
    assert.equal(figs.length, item.count, `${item.id}: count ${item.count} ≠ ${figs.length}`);
    assert.ok(USES.has(item.defaultUse), `${item.id}: defaultUse inválido`);
  }
});

test("paquetes: nombres únicos, usos válidos, imagen y regiones coherentes", () => {
  for (const { item, figs } of packs) {
    const names = new Set();
    for (const f of figs) {
      assert.ok(f.name && !names.has(f.name), `${item.id}: nombre vacío o repetido (${f.name})`);
      names.add(f.name);
      assert.ok(USES.has(f.use), `${item.id}/${f.name}: uso inválido ${f.use}`);
      assert.ok(f.w > 0 && f.h > 0 && f.cls.length === f.w * f.h, `${item.id}/${f.name}: dimensiones`);
      assert.ok(String(f.href).startsWith("data:image/"), `${item.id}/${f.name}: href`);
    }
  }
});

test("paquetes: una página con una figura de cada paquete se dibuja sin NaN/undefined", () => {
  for (const { item, figs } of packs) {
    const fig = figs.find(f => f.use === "figura") || figs[0];
    const doc = createDoc({ preset: "KDP_8_5x11", seed: 7, marginMm: 10 });
    const opts = { seed: 7, styleMode: "floral", composition: "centro", frameStyle: "redondeado", complexity: 130, strokeWidthMm: 0.8, petals: 12 };
    if (fig.use === "figura") { opts.composition = "figura"; opts.figure = fig; }
    else opts.extraArt = [{ href: fig.href, w: fig.w, h: fig.h }];
    generateMandalaClassic(doc, opts);
    const svg = renderDocToSvgString(doc).replace(/data:image\/[^;]+;base64,[^"]+/g, "");
    assert.ok(!/NaN|undefined|\[object/.test(svg), `${item.id}: SVG inválido`);
  }
});
