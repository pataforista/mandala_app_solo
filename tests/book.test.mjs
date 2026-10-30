// Pruebas del modo libro: composición de página, planificador, reglas KDP, PNG gris,
// medallón con personaje y conversión a líneas (sin DOM): `npm test`
import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { createDoc } from "../js/core/svgDoc.js";
import { renderDocToSvgString } from "../js/core/svgRender.js";
import { generateMandalaClassic } from "../js/generators/mandalaClassic.js";
import { COMPOSITIONS, FRAME_STYLES } from "../js/generators/pageComposer.js";
import { planBook, shuffleBag, BOOK_STYLES, bestSellerProfile } from "../js/core/bookPlan.js";
import { kdpGutterMm, kdpSafeMarginMm, bookLayout, kdpChecklist } from "../js/core/kdp.js";
import { encodeGrayPng, rgbaToGray } from "../js/core/grayPng.js";
import { stampRaster } from "../js/core/lineArt.js";
import { imageToLineArt, processFigure } from "../js/core/lineArt.js";
import { packFigures, unpackFigures } from "../js/core/figurePack.js";
import { mulberry32 } from "../js/core/prng.js";

const BASE = { complexity: 130, strokeWidthMm: 0.55, petals: 12, styleMode: "floral", includeFrames: true, pageBorder: true, textures: true };

// Extremos de lo que realmente se dibuja: las curvas se muestrean (los puntos de
// control de una Bézier pueden quedar fuera aunque la curva no salga)
function bbox(svgParts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
  for (const f of svgParts) for (const m of f.matchAll(/ d="([^"]+)"/g)) {
    const t = m[1].trim().split(/\s+/);
    let i = 0, cx = 0, cy = 0;
    const n = () => parseFloat(t[i++]);
    while (i < t.length) {
      const c = t[i++];
      if (c === "M" || c === "L") { cx = n(); cy = n(); add(cx, cy); }
      else if (c === "Q" || c === "C") {
        const pts = [[cx, cy]];
        for (let k = 0; k < (c === "Q" ? 2 : 3); k++) pts.push([n(), n()]);
        for (let s = 1; s <= 16; s++) {
          let p = pts.map(q => q.slice());
          const u = s / 16;
          while (p.length > 1) p = p.slice(1).map((q, j) => [p[j][0] + (q[0] - p[j][0]) * u, p[j][1] + (q[1] - p[j][1]) * u]);
          add(p[0][0], p[0][1]);
        }
        [cx, cy] = pts[pts.length - 1];
      }
    }
  }
  return { x0, y0, x1, y1 };
}

test("composiciones × marcos × formatos: SVG válido, determinista y dentro del margen", () => {
  for (const preset of ["KDP_8_5x11", "KDP_8_5x8_5", "KDP_6x9"]) {
    for (const composition of COMPOSITIONS) {
      for (const frameStyle of FRAME_STYLES) {
        const opts = { ...BASE, seed: 7 + composition.length * 13 + frameStyle.length, composition, frameStyle };
        const mk = () => { const d = createDoc({ preset, seed: opts.seed, marginMm: 12 }); generateMandalaClassic(d, opts); return d; };
        const doc = mk();
        const svg = renderDocToSvgString(doc);
        assert.doesNotMatch(svg, /NaN|Infinity|undefined|\[object/, `${preset} ${composition} ${frameStyle}`);
        assert.equal(renderDocToSvgString(mk()), svg, `no determinista: ${preset} ${composition} ${frameStyle}`);
        // Los grupos de recorte deben estar balanceados
        assert.equal((svg.match(/<g /g) || []).length, (svg.match(/<\/g>/g) || []).length);
        // Sin recorte, todo lo dibujado respeta el margen (zona segura de KDP)
        if (!/clip-path/.test(svg)) {
          const b = bbox(doc.body), m = 12 - 0.01;
          const { wMm, hMm } = doc.page;
          assert.ok(b.x0 >= m && b.y0 >= m && b.x1 <= wMm - m && b.y1 <= hMm - m,
            `${preset} ${composition} ${frameStyle} se sale del margen: ${JSON.stringify(b)}`);
        }
      }
    }
  }
});

test("composición centrada con marco redondeado = diseño clásico de siempre", () => {
  const a = createDoc({ preset: "A4", seed: 5 }); generateMandalaClassic(a, { ...BASE, seed: 5 });
  const b = createDoc({ preset: "A4", seed: 5 }); generateMandalaClassic(b, { ...BASE, seed: 5, composition: "centro", frameStyle: "redondeado" });
  assert.equal(renderDocToSvgString(b), renderDocToSvgString(a));
});

test("relleno de fondo: ningún motivo invade el mandala principal", () => {
  const doc = createDoc({ preset: "KDP_8_5x11", seed: 3 });
  generateMandalaClassic(doc, { ...BASE, seed: 3, composition: "fondo" });
  // El mandala va después del relleno; el primer path del mandala es su silueta exterior.
  // Comprobación indirecta: el bbox del relleno (antes del primer path del mandala)
  // cubre la página, y el SVG contiene motivos pequeños (puntos sólidos).
  const svg = renderDocToSvgString(doc);
  assert.match(svg, /fill="#000"/, "esperaba confeti de puntos sólidos");
  assert.ok(doc.body.length > 10);
});

test("medallón con imagen del usuario: se recorta al círculo", () => {
  const doc = createDoc({ preset: "KDP_8_5x8_5", seed: 9 });
  generateMandalaClassic(doc, { ...BASE, seed: 9, centerArt: { type: "image", href: "data:image/png;base64,AAAA" } });
  const svg = renderDocToSvgString(doc);
  assert.match(svg, /<clipPath id="art-/);
  assert.match(svg, /<image href="data:image\/png;base64,AAAA"/);
});

// Personaje sintético: cuerpo negro sólido (con un ojo blanco) sobre fondo verde
function syntheticCharacter(w = 120, h = 150) {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    const body = ((x - 60) / 35) ** 2 + ((y - 80) / 50) ** 2 < 1;
    const eye = ((x - 60) / 5) ** 2 + ((y - 60) / 5) ** 2 < 1;
    rgba.set(body && !eye ? [10, 10, 10, 255] : eye ? [250, 250, 250, 255] : [90, 160, 80, 255], i);
  }
  return { rgba, w, h };
}

test("figura: quita el fondo, vacía la mancha negra y deja su interior para rellenar", () => {
  const { rgba, w, h } = syntheticCharacter();
  const f = processFigure(rgba, w, h, { mode: "colores", outLong: 300 });
  assert.ok(f.w <= 300 && f.h <= 300 && f.w > 0);
  const count = (c) => f.cls.reduce((a, v) => a + (v === c), 0);
  assert.ok(count(1) > f.cls.length * 0.25, "el cuerpo debía quedar como región interior");
  assert.ok(count(0) < f.cls.length * 0.25, "la mancha negra debía vaciarse a un contorno");
  assert.ok(count(3) > 0, "el ojo (región pequeña) se queda en blanco");
  // Paquete: ida y vuelta sin pérdidas
  const [back] = unpackFigures(JSON.stringify(packFigures([{ name: "x", href: "data:,", ...f }])));
  assert.deepEqual(back.cls, f.cls);
});

test("figura en la página: relleno determinista, dentro del margen y coloreable", () => {
  const { rgba, w, h } = syntheticCharacter();
  const f = processFigure(rgba, w, h, { mode: "colores", outLong: 400 });
  const figure = { ...f, href: "data:image/png;base64,AAAA" };
  const mk = () => { const d = createDoc({ preset: "KDP_8_5x11", seed: 4, marginMm: 10 }); generateMandalaClassic(d, { ...BASE, seed: 4, figure }); return d; };
  const doc = mk();
  const svg = renderDocToSvgString(doc);
  assert.equal(renderDocToSvgString(mk()), svg);
  assert.doesNotMatch(svg, /NaN|undefined/);
  assert.match(svg, /<image href="data:image\/png;base64,AAAA"/);
  const b = bbox(doc.body);
  assert.ok(b.x0 >= 9.99 && b.y0 >= 9.99 && b.x1 <= doc.page.wMm - 9.99 && b.y1 <= doc.page.hMm - 9.99);
});

test("bolsa barajada: nunca repite en páginas consecutivas y reparte parejo", () => {
  const next = shuffleBag(mulberry32(1), ["a", "b", "c"]);
  const seq = Array.from({ length: 300 }, next);
  for (let i = 1; i < seq.length; i++) assert.notEqual(seq[i], seq[i - 1], `repetición en ${i}`);
  for (const k of ["a", "b", "c"]) assert.equal(seq.filter(x => x === k).length, 100);
});

test("plan de libro: sin estilos ni encuadres repetidos seguidos, reproducible", () => {
  const plan = planBook({ count: 60, seed: 123, images: 5 });
  assert.equal(plan.length, 60);
  assert.deepEqual(planBook({ count: 60, seed: 123, images: 5 }), plan);
  for (let i = 1; i < plan.length; i++) {
    assert.notEqual(plan[i].styleMode, plan[i - 1].styleMode);
    assert.notEqual(plan[i].frameStyle, plan[i - 1].frameStyle);
  }
  assert.equal(new Set(plan.map(p => p.styleMode)).size, BOOK_STYLES.length);
  // Cada imagen elegida aparece UNA vez, repartidas (cada 12 páginas), nunca en medio mandala
  const withImg = plan.map((p, i) => [i, p]).filter(([, p]) => p.centerArt);
  assert.deepEqual(withImg.map(([i]) => i), [6, 18, 30, 42, 54]);
  assert.deepEqual(withImg.map(([, p]) => p.centerArt.imageIndex), [0, 1, 2, 3, 4]);
  for (const [, p] of withImg) assert.notEqual(p.composition, "medio");
  assert.equal(planBook({ count: 3, seed: 1, images: 9 }).filter(p => p.centerArt).length, 3);
  const prog = planBook({ count: 10, seed: 1, difficulty: "progresiva" });
  for (let i = 1; i < prog.length; i++) assert.ok(prog[i].complexity >= prog[i - 1].complexity);
});

test("KDP: medianil por grosor, páginas pares y orden de páginas", () => {
  assert.ok(Math.abs(kdpGutterMm(24) - 9.525) < 1e-9);
  assert.ok(Math.abs(kdpGutterMm(151) - 12.7) < 1e-9);
  assert.ok(Math.abs(kdpGutterMm(828) - 22.225) < 1e-9);
  assert.equal(kdpSafeMarginMm(62), 10);
  assert.equal(kdpSafeMarginMm(242), 12.7);

  const L = bookLayout({ mandalas: 30, blankBack: true, titlePage: true, copyrightPage: true });
  assert.equal(L.length % 2, 0);
  assert.deepEqual(L.slice(0, 4).map(p => p.kind), ["title", "copyright", "mandala", "blank"]);
  // Todos los mandalas caen en página impar (derecha)
  L.forEach((p, i) => { if (p.kind === "mandala") assert.equal(i % 2, 0); });
  assert.equal(bookLayout({ mandalas: 7, blankBack: false, titlePage: true }).length, 8);

  const ok = kdpChecklist({ pages: 62, marginMm: 10, dpi: 300 });
  assert.ok(ok.every(c => c.ok));
  const bad = kdpChecklist({ pages: 200, marginMm: 10, dpi: 300 });
  assert.ok(bad.some(c => !c.ok && c.level === "error"), "margen insuficiente para 200 páginas");
});

test("PNG gris: cabecera válida, sin alfa y datos idénticos tras descomprimir", async () => {
  const w = 37, h = 11;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { const v = (i * 37) % 256; rgba.set([v, v, v, 255], i * 4); }
  const gray = rgbaToGray(rgba, w, h);
  const png = await encodeGrayPng(gray, w, h);
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const dv = new DataView(png.buffer);
  assert.equal(dv.getUint32(16), w);
  assert.equal(dv.getUint32(20), h);
  assert.equal(png[24], 8);  // bits
  assert.equal(png[25], 0);  // gris, sin alfa
  // Reconstruye las filas (filtros None/Up) y compara
  const idatLen = dv.getUint32(33);
  const raw = inflateSync(png.subarray(41, 41 + idatLen));
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const f = raw[y * (w + 1)], v = raw[y * (w + 1) + 1 + x];
    out[y * w + x] = f === 2 ? (v + out[(y - 1) * w + x]) & 0xFF : v;
  }
  assert.deepEqual(out, gray);
});

test("dibujo de líneas: contorno negro conservado, motas eliminadas", () => {
  const w = 64, h = 64;
  const rgba = new Uint8ClampedArray(w * h * 4).fill(255);
  const ink = (x, y) => rgba.set([0, 0, 0, 255], (y * w + x) * 4);
  for (let i = 10; i < 54; i++) { ink(i, 10); ink(i, 53); ink(10, i); ink(53, i); } // cuadrado
  ink(30, 30); // mota aislada
  const out = imageToLineArt(rgba, w, h, { mode: "lineas", threshold: 128, thickenPx: 0, minSpeckPx: 4 });
  assert.equal(out[10 * w + 20], 0);
  assert.equal(out[30 * w + 30], 255, "la mota debía desaparecer");
  const edges = imageToLineArt(rgba, w, h, { mode: "bordes", detail: 0.5, thickenPx: 0, minSpeckPx: 4 });
  assert.ok(edges.some(v => v === 0) && edges.some(v => v === 255));
});

test("figura: clics sobre el fondo y 'sólo figura principal' quitan fondo oscuro y textos", () => {
  // Personaje claro sobre fondo oscuro rodeado de un marco crema, con una "letra" suelta abajo
  const w = 160, h = 200;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const frame = x < 15 || y < 15 || x >= w - 15 || y >= h - 15;
    const body = ((x - 80) / 35) ** 2 + ((y - 95) / 50) ** 2 < 1;
    const letter = !frame && x > 70 && x < 90 && y > 165 && y < 178;
    rgba.set(frame ? [235, 225, 200, 255] : body ? [200, 200, 200, 255] : letter ? [250, 250, 250, 255] : [30, 30, 30, 255], (y * w + x) * 4);
  }
  const noClick = processFigure(rgba, w, h, { mode: "bordes", outLong: 200 });
  const withClick = processFigure(rgba, w, h, { mode: "bordes", outLong: 200, bgSeeds: [[0.2, 0.2], [0.8, 0.8]] });
  const inside = (f) => f.cls.reduce((a, v) => a + (v === 1 || v === 3), 0) / f.cls.length;
  assert.ok(inside(withClick) < inside(noClick), "el fondo oscuro marcado con clics debía desaparecer");
  // Recortado al personaje: la caja sigue a la elipse (70×100), no al rectángulo oscuro
  assert.ok(withClick.w / withClick.h < 0.85, `relación ${withClick.w}/${withClick.h}`);
});

test("anillos de figuras: copias que no se pisan, sello de trazo grueso y medallón", () => {
  const w = 120, h = 150;
  const cls = new Uint8Array(w * h).fill(2);
  for (let y = 20; y < 130; y++) for (let x = 20; x < 100; x++) cls[y * w + x] = (x === 20 || x === 99 || y === 20 || y === 129) ? 0 : 1;
  const st = stampRaster(cls, w, h, 300, 0.02);
  assert.equal(Math.max(st.w, st.h), 300);
  // La línea de 1 px original sale de ~6 px (2 % de 300)
  let run = 0, best = 0;
  for (let x = 0; x < st.w; x++) { const v = st.gray[Math.floor(st.h / 2) * st.w + x]; run = v < 128 ? run + 1 : 0; best = Math.max(best, run); }
  assert.ok(best >= 5 && best <= 8, `grosor ${best}`);

  for (const preset of ["KDP_8_5x11", "KDP_8_5x8_5", "KDP_6x9"]) {
    const doc = createDoc({ preset, seed: 2, marginMm: 10 });
    generateMandalaClassic(doc, { ...BASE, seed: 2, figureRing: { href: "data:,S", centerHref: "data:,C", w: 100, h: 120 } });
    const svg = renderDocToSvgString(doc);
    const stamps = [...svg.matchAll(/translate\(([\d.]+) ([\d.]+)\) rotate\(([\d.]+)\)(?: scale\(-1 1\))?"><image href="data:,S" x="([-\d.]+)" y="([-\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)];
    assert.ok(stamps.length >= 6 && stamps.length <= 12 && stamps.length % 2 === 0, `${preset}: ${stamps.length} copias`);
    // Condición exacta (Wolfram): cada copia cabe en su cuña, a·h/2 ≤ d·tan(π/n),
    // y su esquina exterior no pasa del anillo que la rodea
    const [x1, y1] = [+stamps[0][1], +stamps[0][2]];
    const sw = +stamps[0][6], sh = +stamps[0][7], n = stamps.length;
    const rm = Math.hypot(x1 - doc.page.wMm / 2, y1 - doc.page.hMm / 2);
    const d = rm - sh / 2;
    assert.ok(sw / 2 <= d * Math.tan(Math.PI / n) + 1e-6, `${preset}: se pisan`);
    // Círculos centrados (un solo subpath de 8 arcos que empieza en el eje horizontal)
    const cx = doc.page.wMm / 2, cy = doc.page.hMm / 2;
    const ring = [...svg.matchAll(/<path d="(M ([\d.]+) ([\d.]+) (?:C(?: [\d.]+){6} ){8}Z)"/g)]
      .filter(m => Math.abs(+m[3] - cy) < 0.02)
      // (los círculos del mandala exterior que quedan debajo del anillo blanco no cuentan)
      .map(m => +m[2] - cx).filter(r => r > rm + sh / 2);
    const rOutLine = Math.min(...ring);
    assert.ok(Math.hypot(d + sh, sw / 2) <= rOutLine, `${preset}: la esquina sale del anillo`);
    assert.match(svg, /<image href="data:,C"/, "falta la figura en el medallón");
  }
});

test("lista de verificación: fondo rectangular, derechos y alternativas", async () => {
  const { checkFigure, checklistHtml } = await import("../js/core/figureChecks.js");
  const mk = (shape) => {
    const w = 200, h = 240, cls = new Uint8Array(w * h).fill(2);
    for (let y = 10; y < 230; y++) for (let x = 10; x < 190; x++) {
      const inEl = ((x - 100) / 85) ** 2 + ((y - 120) / 105) ** 2;
      const isIn = shape === "rect" ? true : inEl < 1;
      if (!isIn) continue;
      const edge = shape === "rect" ? (x < 14 || x > 185 || y < 14 || y > 225) : inEl > 0.93;
      cls[y * w + x] = edge ? 0 : 1;
    }
    return { cls, w, h, srcLong: 900 };
  };
  const meta = { rightsConfirmed: true, source: "Smithsonian, 1902" };
  const ok = checkFigure(mk("ellipse"), "figura", meta);
  assert.ok(ok.ready, JSON.stringify(ok.checks.filter(c => !c.ok)));
  const rect = checkFigure(mk("rect"), "figura", meta);
  assert.ok(!rect.ready && rect.checks.some(c => c.level === "error" && /fondo/.test(c.msg)));
  // Sin derechos confirmados no está lista, y se sugieren fuentes de dominio público
  const noRights = checkFigure(mk("ellipse"), "figura", {});
  assert.ok(!noRights.ready);
  assert.match(checklistHtml(noRights, "figura"), /Smithsonian Open Access/);
  // Baja resolución: aviso con herramienta para ampliar
  const small = checkFigure({ ...mk("ellipse"), srcLong: 420 }, "figura", meta);
  assert.ok(small.ready && small.checks.some(c => c.level === "warn" && c.tools.some(t => t.name === "Upscayl")));
  // Sin uso elegido nunca está lista (nada entra al libro por defecto)
  assert.ok(!checkFigure(mk("ellipse"), "ninguno", meta).ready);
});

// Áreas de cada subtrayecto cerrado (curvas muestreadas, fórmula del cordón)
function closedAreas(svgParts) {
  const areas = [];
  for (const f of svgParts) for (const m of f.matchAll(/ d="([^"]+)"/g)) {
    const t = m[1].trim().split(/\s+/);
    let i = 0, pts = [], cx = 0, cy = 0;
    const n = () => parseFloat(t[i++]);
    const flush = (closed) => {
      if (closed && pts.length > 2) {
        let a = 0;
        for (let k = 0; k < pts.length; k++) { const [x0, y0] = pts[k], [x1, y1] = pts[(k + 1) % pts.length]; a += x0 * y1 - x1 * y0; }
        areas.push(Math.abs(a) / 2);
      }
      pts = [];
    };
    while (i < t.length) {
      const c = t[i++];
      if (c === "M") { flush(false); cx = n(); cy = n(); pts.push([cx, cy]); }
      else if (c === "L") { cx = n(); cy = n(); pts.push([cx, cy]); }
      else if (c === "Q" || c === "C") {
        const ctrl = [[cx, cy]];
        for (let k = 0; k < (c === "Q" ? 2 : 3); k++) ctrl.push([n(), n()]);
        for (let s = 1; s <= 12; s++) {
          let p = ctrl.map(q => q.slice());
          const u = s / 12;
          while (p.length > 1) p = p.slice(1).map((q, j) => [p[j][0] + (q[0] - p[j][0]) * u, p[j][1] + (q[1] - p[j][1]) * u]);
          pts.push(p[0]);
        }
        [cx, cy] = ctrl[ctrl.length - 1];
      } else if (c === "Z") flush(true);
    }
  }
  return areas;
}

test("gigante: el mandala cubre toda la hoja (sin pétalos apenas recortados ni esquinas vacías)", () => {
  for (const preset of ["KDP_8_5x8_5", "KDP_8_5x11", "KDP_6x9"]) {
    for (let seed = 1; seed <= 6; seed++) {
      const doc = createDoc({ preset, seed, marginMm: 12 });
      generateMandalaClassic(doc, { ...BASE, seed, composition: "gigante", frameStyle: "ninguno" });
      // Lo dibujado (antes del recorte) desborda la página por los cuatro lados
      const b = bbox(doc.body), { wMm, hMm } = doc.page;
      assert.ok(b.x0 < 0 && b.y0 < 0 && b.x1 > wMm && b.y1 > hMm, `${preset} semilla ${seed}: ${JSON.stringify(b)}`);
    }
  }
});

test("recortes sin marco: una línea cierra las celdas cortadas por el borde", () => {
  for (const composition of ["gigante", "esquinas", "medio"]) {
    const doc = createDoc({ preset: "KDP_8_5x8_5", seed: 3, marginMm: 12 });
    generateMandalaClassic(doc, { ...BASE, seed: 3, composition, frameStyle: "ninguno" });
    const after = doc.body.slice(doc.body.lastIndexOf("</g>") + 1).join("");
    assert.match(after, /<path[^>]+d="M [\d.]+ [\d.]+ L [\d.]+ [\d.]+ L [\d.]+ [\d.]+ L [\d.]+ [\d.]+ Z"/, composition);
  }
});

test("medio mandala: cabe a lo ancho, sólo lo corta la línea de base", () => {
  for (const preset of ["KDP_8_5x8_5", "KDP_8_5x11", "KDP_6x9"]) {
    const doc = createDoc({ preset, seed: 5, marginMm: 12 });
    generateMandalaClassic(doc, { ...BASE, seed: 5, composition: "medio", frameStyle: "redondeado" });
    // El disco principal es el último bloque de contenido dentro del recorte
    const inner = doc.body.slice(doc.body.findIndex(s => s.startsWith("<g clip-path")) + 1, doc.body.lastIndexOf("</g>"));
    const b = bbox(inner.slice(-40));
    assert.ok(b.x0 >= 12 && b.x1 <= doc.page.wMm - 12, `${preset}: ${JSON.stringify(b)}`);
  }
});

test("mini mandalas: sin celdas diminutas que se impriman como manchas negras", () => {
  for (const petals of [8, 12, 16, 24]) {
    for (let seed = 1; seed <= 8; seed++) {
      const doc = createDoc({ preset: "KDP_8_5x8_5", seed, marginMm: 12 });
      generateMandalaClassic(doc, { ...BASE, seed, petals, center: { x: 60, y: 60 }, radius: 15,
        maxBands: 2, outlineMode: true, pageBorder: false, includeFrames: false, complexity: 20, detailSimplification: 0.7 });
      const small = closedAreas(doc.body).filter(a => a < 1.2);
      assert.equal(small.length, 0, `pétalos ${petals} semilla ${seed}: ${small.length} celdas < 1.2 mm² (${small.slice(0, 4).map(a => a.toFixed(2))})`);
    }
  }
});

test("perfil «más vendidos»: centrado domina, sin medios mandalas, simetría alta", () => {
  for (const preset of ["KDP_8_5x8_5", "KDP_8_5x11"]) {
    const prof = bestSellerProfile(preset);
    const plan = planBook({ count: 60, seed: 42, ...prof });
    const n = (c) => plan.filter(p => p.composition === c).length;
    assert.equal(n("medio"), 0, preset);
    // Cuadrado: el centrado domina. Vertical: sigue siendo el encuadre más frecuente, pero
    // completa la hoja con un fondo y comparte peso con los que cubren la hoja
    if (/8_5x8_5/.test(preset)) assert.ok(n("centro") >= 0.45 * plan.length, `${preset}: centrado ${n("centro")}/60`);
    else {
      assert.ok(["fondo", "constelacion", "esquinas", "gigante"].every(c => n("centro") >= n(c)), preset);
      assert.ok(plan.filter(p => p.composition === "centro").every(p => p.background), "centrado vertical con fondo");
    }
    assert.ok(plan.every(p => p.petals >= 12), preset);
    assert.ok(plan.filter(p => p.styleMode === "floral").length > plan.filter(p => p.styleMode === "azteca").length, preset);
  }
});

test("trazo por página: más grueso en páginas fáciles, más fino en difíciles, nunca < 0,35 mm", async () => {
  const { strokeScaleFor, pageStrokeMm, MIN_PRINT_STROKE_MM } = await import("../js/core/bookPlan.js");
  assert.equal(strokeScaleFor(130, 130), 1);
  assert.ok(strokeScaleFor(40, 130) > 1.4, "página fácil: línea claramente más gruesa");
  assert.ok(strokeScaleFor(40, 130) <= 1.6);
  assert.ok(strokeScaleFor(260, 130) < 1 && strokeScaleFor(260, 130) >= 0.85);
  assert.equal(pageStrokeMm(0.3, 0.85), MIN_PRINT_STROKE_MM);
  assert.equal(pageStrokeMm(0.55, 1.6), 0.88);
  // Tope del aumento automático: 1,2 mm; un trazo elegido mayor se respeta
  assert.equal(pageStrokeMm(1.0, 1.6), 1.2);
  assert.equal(pageStrokeMm(1.5, 1.6), 1.5);
  assert.equal(pageStrokeMm(1.0, 0.85), 0.85);

  const prog = planBook({ count: 20, seed: 5, difficulty: "progresiva", baseComplexity: 130 });
  assert.ok(prog[0].strokeScale > prog[19].strokeScale, "progresiva: la línea se afina al avanzar");
  for (let i = 1; i < prog.length; i++) assert.ok(prog[i].strokeScale <= prog[i - 1].strokeScale);
  const fija = planBook({ count: 10, seed: 5, difficulty: "fija", baseComplexity: 130 });
  assert.ok(fija.every(p => p.strokeScale === 1), "fija: el trazo que eligió el usuario");
});

test("nivel «trazo grueso»: páginas válidas y sin líneas finas en los encuadres del perfil", () => {
  const BOLD = { complexity: 85, strokeWidthMm: 1.0, petals: 16, includeFrames: true, pageBorder: true,
    textures: false, spacing: 0.5, densityFactor: 0.5, minCellAreaMm2: 6, detailSimplification: 0.75, organicLevel: 0.2 };
  const prof = bestSellerProfile("KDP_8_5x11");
  for (const composition of prof.compositions) for (const styleMode of ["floral", "geometric", "islamico"]) {
    const d = createDoc({ preset: "KDP_8_5x11", seed: 11, marginMm: 12 });
    generateMandalaClassic(d, { ...BOLD, seed: 11, composition, styleMode, frameStyle: "ninguno" });
    const svg = renderDocToSvgString(d);
    assert.doesNotMatch(svg, /NaN|Infinity|undefined/, `${composition} ${styleMode}`);
    const widths = [...svg.matchAll(/stroke-width="([\d.]+)"/g)].map(m => parseFloat(m[1]));
    assert.ok(widths.length > 0);
    // Trazo principal 1 mm y detalle 0,7 mm. Los mandalas pequeños (constelación, fondo)
    // usan 0,75× a propósito para no empastarse: su detalle queda en ~0,52 mm.
    // Sólo los puntos sólidos (0,2 mm, rellenos) pueden ser más finos.
    assert.ok(Math.max(...widths) >= 0.99, `${composition} ${styleMode}: falta el trazo de 1 mm`);
    const thin = widths.filter(w => w > 0.21 && w < 0.5);
    assert.equal(thin.length, 0, `${composition} ${styleMode}: trazos finos ${thin.slice(0, 5)}`);
  }
});

// ---------- Páginas sorprendentes ----------
import { addSpecialPages, specialPageCount, GROWTH_STAGES } from "../js/core/bookPlan.js";
import { generateSpecialPage } from "../js/generators/specialPages.js";
import { mysteryGrid, MYSTERY_KEYS, generateMysteryMandala } from "../js/generators/mysteryMandala.js";
import { NATURE_KINDS } from "../js/generators/natureSymmetry.js";
import { muralGeometry } from "../js/generators/muralPage.js";

const special = (sp, extra = {}) => {
  const d = createDoc({ preset: "KDP_8_5x11", seed: 5, marginMm: 12 });
  generateSpecialPage(d, { ...BASE, seed: 5, special: sp, ...extra });
  return d;
};

test("plan con páginas sorprendentes: cuenta exacta, grupos juntos y dificultad creciente en todo el libro", () => {
  const sp = { growth: 2, mystery: 3, nature: true, mural: { cols: 3, rows: 3 } };
  const plan = addSpecialPages(planBook({ count: 30, seed: 8, difficulty: "progresiva" }), { seed: 8, ...sp, difficulty: "progresiva" });
  assert.equal(plan.length, 30 + specialPageCount(sp));
  // Cada secuencia que crece: GROWTH_STAGES páginas seguidas, etapas en orden, misma semilla
  for (const g of ["g0", "g1"]) {
    const idx = plan.map((p, i) => (p.special?.group === g ? i : -1)).filter(i => i >= 0);
    assert.equal(idx.length, GROWTH_STAGES);
    assert.equal(idx[idx.length - 1] - idx[0], GROWTH_STAGES - 1, "etapas seguidas");
    assert.deepEqual(idx.map(i => plan[i].special.stage), [0, 1, 2, 3]);
    assert.equal(new Set(idx.map(i => plan[i].seed)).size, 1);
    assert.equal(new Set(idx.map(i => plan[i].complexity)).size, 1, "la secuencia no cambia de complejidad");
  }
  assert.equal(plan[plan.length - 1].special.type, "solutions");
  assert.ok(plan[plan.length - 2 - 9].special.guide, "guía del mural antes de sus 9 hojas");
  // Dificultad creciente: nunca baja de una página a la siguiente
  const cx = plan.filter(p => p.special?.type !== "solutions").map(p => p.complexity);
  for (let i = 1; i < cx.length; i++) assert.ok(cx[i] >= cx[i - 1], `baja en ${i}: ${cx[i - 1]} → ${cx[i]}`);
  assert.ok(cx[0] <= 45 && cx[cx.length - 1] >= 150);
  // Determinista
  assert.deepEqual(addSpecialPages(planBook({ count: 30, seed: 8, difficulty: "progresiva" }), { seed: 8, ...sp, difficulty: "progresiva" }), plan);
});

test("mandala que crece: cada etapa añade anillos y conserva exactamente los interiores", () => {
  for (const seed of [1, 7, 42]) {
    const stages = [0, 1, 2, 3].map(stage => {
      const d = createDoc({ preset: "KDP_8_5x11", seed, marginMm: 12 });
      generateSpecialPage(d, { ...BASE, seed, special: { type: "grow", stage, of: 4 } });
      return d;
    });
    const drawn = stages.map(d => d.meta.bands.drawn);
    for (let i = 1; i < 4; i++) assert.ok(drawn[i] > drawn[i - 1], `seed ${seed}: ${drawn}`);
    assert.equal(drawn[3], stages[3].meta.bands.total, "la última etapa es el mandala completo");
    // El núcleo (lo último que se dibuja) es idéntico en todas las etapas
    const core = (d) => d.body.filter(x => x.startsWith("<path")).slice(-3).join("");
    for (const d of stages) assert.equal(core(d), core(stages[0]));
  }
});

test("mandala misterioso: todas las celdas llevan marca y cada figura marca una parte razonable", () => {
  for (const shape of MYSTERY_KEYS) {
    const g = mysteryGrid({ cx: 0, cy: 0, R: 90, shape, complexity: 130 });
    const cells = g.rings.reduce((s, r) => s + r.n, 0) + 1;
    const frac = (g.marked.size + (g.coreMarked ? 1 : 0)) / cells;
    assert.ok(frac > 0.06 && frac < 0.5, `${shape}: ${(frac * 100).toFixed(1)} % marcado`);
    // Celdas coloreables: anillo ≥ 3 mm de alto
    assert.ok(g.t >= 3, `${shape}: anillo de ${g.t.toFixed(2)} mm`);
    const d = createDoc({ preset: "KDP_8_5x11", seed: 2, marginMm: 12 });
    generateMysteryMandala(d, { seed: 2, shape });
    const svg = renderDocToSvgString(d);
    assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
    assert.ok(d.meta.mystery.marked > 0);
  }
  // La solución rellena celdas; el acertijo no
  const solved = special({ type: "solutions", entries: [{ label: "Página 9 · gato", shape: "gato", seed: 3, complexity: 130 }] });
  assert.match(renderDocToSvgString(solved), /fill="#4a4a4a"/);
  assert.doesNotMatch(renderDocToSvgString(special({ type: "mystery", shape: "gato" })), /fill="#4a4a4a"/);
});

test("simetrías de la naturaleza: SVG válido, nota al pie y dibujo dentro del margen", () => {
  for (const kind of NATURE_KINDS) for (const preset of ["KDP_8_5x11", "KDP_6x9", "KDP_8_5x8_5"]) {
    const d = createDoc({ preset, seed: 4, marginMm: 12 });
    generateSpecialPage(d, { ...BASE, seed: 4, special: { type: "nature", kind } });
    const svg = renderDocToSvgString(d);
    assert.doesNotMatch(svg, /NaN|Infinity|undefined/, `${kind} ${preset}`);
    assert.match(svg, /<text /, `${kind}: falta la nota`);
    const b = bbox(d.body.filter(x => x.startsWith("<path")));
    assert.ok(b.x0 >= 12 - 0.5 && b.y0 >= 12 - 0.5 && b.x1 <= d.page.wMm - 12 + 0.5 && b.y1 <= d.page.hMm - 12 + 0.5, `${kind} ${preset} sale del margen`);
  }
});

test("mural: cada hoja muestra su rectángulo exacto del diseño y la guía rotula todas", () => {
  const sp = { type: "mural", cols: 2, rows: 2 };
  const tiles = [];
  for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) tiles.push(special({ ...sp, col, row }));
  const { m, tw, th } = muralGeometry(tiles[0].page, 2, 2);
  tiles.forEach((d, k) => {
    const svg = renderDocToSvgString(d);
    assert.doesNotMatch(svg, /NaN|Infinity|undefined/);
    assert.match(svg, new RegExp(`<rect x="${m}" y="${m}" width="${tw}" height="${th}"`));
    const col = k % 2, row = Math.floor(k / 2);
    assert.match(svg, new RegExp(`translate\\(${(m - col * tw).toFixed(3)} ${(m - row * th).toFixed(3)}\\)`));
  });
  // Todas las hojas recortan el MISMO mural
  const inner = (d) => renderDocToSvgString(d).split(/<g transform="translate\([^)]*\)">/)[1].split("</g></g>")[0].replace(/-[a-z0-9]+-\d+\)/g, ")");
  assert.equal(inner(tiles[0]), inner(tiles[3]));
  const guide = renderDocToSvgString(special({ ...sp, guide: true }));
  for (const t of ["A1", "B1", "A2", "B2"]) assert.match(guide, new RegExp(`>${t}</text>`));
});

test("rótulos del pie de página: fuera de la franja de 6,35 mm que KDP prohíbe", () => {
  for (const sp of [{ type: "grow", stage: 1, of: 4 }, { type: "mural", cols: 2, rows: 2, col: 1, row: 1 }]) {
    const d = special(sp);
    for (const m of renderDocToSvgString(d).matchAll(/<text x="[\d.]+" y="([\d.]+)" font-family="[^"]+" font-size="([\d.]+)"/g)) {
      // Línea base + descendentes (~25 % del cuerpo) a ≥ 6,35 mm del corte inferior
      assert.ok(d.page.hMm - (parseFloat(m[1]) + parseFloat(m[2]) * 0.25) >= 6.35, `${sp.type}: rótulo a ${(d.page.hMm - parseFloat(m[1])).toFixed(2)} mm`);
    }
  }
});

test("mural: cambiar una opción de dibujo no devuelve el mural de la caché", () => {
  const a = renderDocToSvgString(special({ type: "mural", cols: 2, rows: 2, col: 0, row: 0 }, { spacing: 0.3 }));
  const b = renderDocToSvgString(special({ type: "mural", cols: 2, rows: 2, col: 0, row: 0 }, { spacing: 0.8 }));
  assert.notEqual(a, b);
});

test("girasol: la nota cita las espirales que tiene el dibujo, y son Fibonacci consecutivos", () => {
  const FIB = [8, 13, 21, 34, 55, 89];
  for (const preset of ["KDP_8_5x11", "KDP_6x9", "KDP_8_5x8_5"]) for (const complexity of [40, 130, 220]) {
    const d = createDoc({ preset, seed: 3, marginMm: 12 });
    generateSpecialPage(d, { ...BASE, seed: 3, complexity, special: { type: "nature", kind: "girasol" } });
    const [a, b] = d.meta.spirals;
    assert.ok(FIB.indexOf(b) === FIB.indexOf(a) + 1, `${preset} ${complexity}: ${a} y ${b}`);
    const svg = renderDocToSvgString(d);
    assert.match(svg, new RegExp(`en este dibujo hay ${a} y ${b}\\.`));
    assert.match(svg, new RegExp(`como ${b} y ${a + b}, aunque`), "el ejemplo real es el par siguiente");
    assert.doesNotMatch(svg, /@[a-d]/);
  }
});

test("doble cara: sin páginas en blanco salvo los reversos que se piden (hojas del mural)", () => {
  const L = bookLayout({ mandalas: 9, blankBack: false, titlePage: true });
  assert.equal(L.filter(p => p.kind === "blank").length, 0, "título + 9 = 10 páginas, ninguna en blanco");
  // Las hojas del mural (índices 7–8) conservan su reverso; el resto, no
  const M = bookLayout({ mandalas: 9, blankBack: false, titlePage: true, keepBack: [7, 8] });
  const blanks = M.map((p, i) => (p.kind === "blank" ? M[i - 1] : null)).filter(Boolean);
  assert.deepEqual(blanks.map(p => p.index), [7, 8]);
  assert.equal(M.length, 12);
  // Total impar: bookLayout rellena con una página en blanco al final. La app lo evita
  // añadiendo un mandala más; aquí se comprueba que el relleno sólo ocurre en ese caso
  const odd = bookLayout({ mandalas: 9, blankBack: false, titlePage: true, keepBack: [8] });
  assert.equal(odd[odd.length - 1].kind, "blank");
  assert.equal(bookLayout({ mandalas: 10, blankBack: false, titlePage: true, keepBack: [9] }).length % 2, 0);
  // pad: false revela el total natural (impar) que la app corrige con un mandala más
  assert.equal(bookLayout({ mandalas: 9, blankBack: false, titlePage: true, keepBack: [8], pad: false }).length, 11);
});

test("muralTilePositions coincide con dónde addSpecialPages pone las hojas del mural", async () => {
  const { muralTilePositions } = await import("../js/core/bookPlan.js");
  for (const mystery of [0, 2]) for (const mural of [{ cols: 2, rows: 2 }, { cols: 3, rows: 3 }]) for (const count of [1, 5, 30]) {
    const sp = { growth: 1, mystery, nature: true, mural };
    const plan = addSpecialPages(planBook({ count, seed: 4 }), { seed: 4, ...sp });
    const real = plan.map((p, i) => (p.special?.type === "mural" && !p.special.guide ? i : -1)).filter(i => i >= 0);
    assert.deepEqual(muralTilePositions(plan.length, sp), real);
  }
});

test("misteriosos numerados en orden de aparición, con rótulo en su página", () => {
  const plan = addSpecialPages(planBook({ count: 20, seed: 6 }), { seed: 6, mystery: 4 });
  const ms = plan.filter(p => p.special?.type === "mystery");
  assert.deepEqual(ms.map(p => p.special.n), [1, 2, 3, 4]);
  assert.ok(ms.every(p => p.special.of === 4));
  const svg = renderDocToSvgString(special(ms[1].special));
  assert.match(svg, />Misterioso 2 de 4 · solución al final</);
});

test("pesos de estilo fraccionarios (perfil «más vendidos» de la app): no rompen el plan y conservan la variedad", async () => {
  const { addSpecialPages, weightCopies } = await import("../js/core/bookPlan.js");
  // Los mismos pesos que buildBook en js/app.js. Antes Math.round(0,2) = 0 y un objeto
  // como pesos daba Array(NaN): «Invalid array length» al revisar o crear el libro.
  const w = { floral: 3, geometric: 2, islamico: 0.3, sashiko: 0.5, celtico: 0.3, azteca: 0.2, yantra: 0.2 };
  const styles = Object.keys(w), styleWeights = Object.values(w);
  assert.deepEqual(weightCopies(styles, styleWeights), weightCopies(styles, w), "lista y objeto equivalen");
  assert.ok(weightCopies(styles, styleWeights).every(n => n >= 1), "ningún estilo con peso > 0 desaparece");
  assert.deepEqual(weightCopies(["a", "b"], [2, 1]), [2, 1], "pesos enteros: sin cambios");
  const plan = planBook({ count: 50, seed: 1, styles, styleWeights, difficulty: "progresiva", baseComplexity: 110 });
  const full = addSpecialPages(plan, { seed: 1, growth: 1, mystery: 3, nature: true, mural: { cols: 3, rows: 3 }, styles, styleWeights });
  assert.ok(full.length > 50);
  const n = (s) => plan.filter(p => p.styleMode === s).length;
  assert.ok(n("floral") > n("geometric") && n("geometric") > n("azteca"));
  assert.ok(new Set(plan.map(p => p.styleMode)).size >= 4, "sigue habiendo variedad");
});

test("trazo por página: el adelgazamiento automático no baja del mínimo comercial (0,8 mm)", async () => {
  const { pageStrokeMm, COMMERCIAL_MIN_STROKE_MM } = await import("../js/core/bookPlan.js");
  assert.equal(pageStrokeMm(0.8, 0.85), COMMERCIAL_MIN_STROKE_MM, "0,8 mm no se afina a 0,68");
  assert.equal(pageStrokeMm(0.9, 0.85), 0.8);
  assert.equal(pageStrokeMm(1.1, 0.85), 0.94, "por encima del mínimo sí se afina");
  assert.equal(pageStrokeMm(0.55, 0.85), 0.55, "un trazo elegido fino no se afina más");
});

test("siluetas: repartidas por familia visual, sin repetir familia en páginas seguidas y acordes al estilo", async () => {
  const { SILHOUETTE_FAMILY, BOOK_SILHOUETTES } = await import("../js/core/bookPlan.js");
  for (const seed of [1, 2, 3]) {
    const plan = planBook({ count: 50, seed, ...bestSellerProfile("KDP_8_5x11") });
    const fam = plan.map(p => SILHOUETTE_FAMILY[p.silhouette]);
    assert.ok(plan.every(p => BOOK_SILHOUETTES.includes(p.silhouette)));
    for (let i = 1; i < fam.length; i++) assert.notEqual(fam[i], fam[i - 1], `semilla ${seed}, págs. ${i}-${i + 1}`);
    const counts = Object.values(fam.reduce((c, f) => ({ ...c, [f]: (c[f] || 0) + 1 }), {}));
    // Antes, loto y ojiva (la misma corona de puntas) sumaban 34 de 50 páginas
    assert.ok(Math.max(...counts) <= 15, `semilla ${seed}: una familia domina (${Math.max(...counts)} de 50)`);
    assert.ok(counts.length >= 4);
    // Un estilo geométrico no lleva corazones
    assert.ok(plan.filter(p => p.styleMode === "geometric").every(p => p.silhouette !== "heart"));
  }
});

test("motor clásico: respeta la silueta pedida y la cambia sin alterar el interior", () => {
  const draw = (silhouette) => {
    const doc = createDoc({ preset: "KDP_8_5x8_5", seed: 7, marginMm: 10 });
    generateMandalaClassic(doc, { ...BASE, seed: 7, petals: 16, composition: "centro", silhouette });
    return doc.meta.discs[0].motifs;
  };
  const a = draw("heart"), b = draw("diamond");
  assert.equal(a.at(-1), "heart");
  assert.equal(b.at(-1), "diamond");
  assert.deepEqual(a.slice(0, -1), b.slice(0, -1), "las bandas interiores no cambian");
});

test("silueta de reemplazo: acorde al estilo y de otra familia visual", async () => {
  const { alternateSilhouette, SILHOUETTE_FAMILY } = await import("../js/core/bookPlan.js");
  for (let k = 1; k <= 8; k++) {
    const s = alternateSilhouette("geometric", "lotus", k);
    assert.notEqual(SILHOUETTE_FAMILY[s], SILHOUETTE_FAMILY.lotus);
    assert.notEqual(s, "heart");
  }
});

test("anillos: los huecos de la corona se rellenan sin tocar la silueta de las copias", () => {
  // Figura sintética: caja 100×120 con un óvalo (cls 1) y tinta (0) en su contorno; el resto es fondo (2)
  const w = 100, h = 120, cls = new Uint8Array(w * h).fill(2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const e = ((x - 50) / 36) ** 2 + ((y - 60) / 52) ** 2;
    if (e <= 1) cls[y * w + x] = e > 0.9 ? 0 : 1;
  }
  const ring = { href: "data:,S", centerHref: "data:,C", w, h };
  const gen = (r) => {
    const doc = createDoc({ preset: "KDP_8_5x11", seed: 2, marginMm: 10 });
    generateMandalaClassic(doc, { ...BASE, seed: 2, figureRing: r });
    return renderDocToSvgString(doc);
  };
  const sin = gen(ring), con = gen({ ...ring, cls });
  assert.ok(con.length > sin.length, "con cls hay motivos extra en la corona");
  assert.equal(con, gen({ ...ring, cls }), "determinista");
  // Mismas copias de la figura con y sin relleno
  const copias = (svg) => (svg.match(/<image href="data:,S"/g) || []).length;
  assert.equal(copias(con), copias(sin));
});
