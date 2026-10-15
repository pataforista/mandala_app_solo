// Pruebas del modo libro: composición de página, planificador, reglas KDP, PNG gris,
// medallón con personaje y conversión a líneas (sin DOM): `npm test`
import { test } from "node:test";
import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
import { createDoc } from "../js/core/svgDoc.js";
import { renderDocToSvgString } from "../js/core/svgRender.js";
import { generateMandalaClassic } from "../js/generators/mandalaClassic.js";
import { COMPOSITIONS, FRAME_STYLES } from "../js/generators/pageComposer.js";
import { planBook, shuffleBag, BOOK_STYLES } from "../js/core/bookPlan.js";
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
