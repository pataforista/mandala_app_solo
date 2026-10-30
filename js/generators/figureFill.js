// js/generators/figureFill.js
// Figura rellena de mandalas (estilo de la tortuga o el mono "zentangle"): la imagen
// del usuario, ya convertida a contorno por processFigure, se coloca en la página y
// cada región cerrada de su interior se llena con mandalas pequeños, flores y puntos.
//
// Mismo principio que el relleno de fondo: empaquetado voraz de círculos, pero el
// espacio libre sale de una transformada de distancia sobre la rejilla de la figura.
// Cada motivo cabe entero dentro de su región, así que nunca cruza una línea del dibujo.
import { mulberry32 } from "../core/prng.js";
import { PathBuilder } from "../core/pathBuilder.js";
import { distanceTransform } from "../core/lineArt.js";
import { FILLERS, drawFiller, circle } from "./pageComposer.js";

/**
 * figure: { href, cls, w, h } (cls: 0 tinta, 1 interior, 2 exterior; ver processFigure)
 * A: área de contenido en mm { x0, y0, x1, y1 }
 * sub(x, y, r, opts): dibuja un mandala pequeño y devuelve sus fragmentos SVG
 * Devuelve los fragmentos SVG (imagen + relleno).
 */
export function drawFigure({ figure, A, seed = 1, styleMode = "floral", fillInside = true, fillOutside = true,
  density = 0.6, outlineMode = false, stroke = "#000", mainW = 0.55, detailW = 0.4, sub }) {
  const rng = mulberry32(((seed >>> 0) ^ 0xF16A7E) >>> 0);
  const aw = A.x1 - A.x0, ah = A.y1 - A.y0;
  // La figura ocupa todo lo posible sin deformarse
  const k = Math.min(aw / figure.w, ah / figure.h) * 0.98;
  const fw = figure.w * k, fh = figure.h * k;
  const fx = A.x0 + (aw - fw) / 2, fy = A.y0 + (ah - fh) / 2;
  const out = [`<image href="${figure.href}" x="${fx}" y="${fy}" width="${fw}" height="${fh}" preserveAspectRatio="none" />`];
  if (!fillInside && !fillOutside) return out;

  // ---------- Rejilla en mm sobre el área ----------
  const cell = 0.6;
  const gw = Math.max(2, Math.floor(aw / cell)), gh = Math.max(2, Math.floor(ah / cell));
  const zone = new Uint8Array(gw * gh); // 0 bloqueada, 1 interior, 2 exterior
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const x = A.x0 + (gx + 0.5) * cell, y = A.y0 + (gy + 0.5) * cell;
    const px = Math.floor((x - fx) / k), py = Math.floor((y - fy) / k);
    zone[gy * gw + gx] = px < 0 || py < 0 || px >= figure.w || py >= figure.h ? 2 : figure.cls[py * figure.w + px];
  }
  const blocked = new Uint8Array(gw * gh);
  for (let i = 0; i < zone.length; i++) blocked[i] = zone[i] === 0 ? 1 : 0;
  const dist = distanceTransform(blocked, gw, gh, true);

  // Holgura respecto a las líneas: dentro, ceñida (como en los libros); fuera, más aire
  // (≥1 mm: entre dos líneas tiene que caber la punta de un rotulador)
  const gapIn = 1.5, gapOut = 2.5; // más aire entre motivos
  const avail = new Float32Array(gw * gh);
  for (let i = 0; i < avail.length; i++) {
    const z = zone[i];
    const on = (z === 1 && fillInside) || (z === 2 && fillOutside);
    avail[i] = on ? dist[i] * cell - (z === 1 ? gapIn : gapOut) : -1;
  }

  const W = FILLERS[styleMode] || FILLERS.floral;
  const kinds = Object.keys(W);
  const pickKind = () => { let t = rng() * kinds.reduce((s, q) => s + W[q], 0); for (const q of kinds) { t -= W[q]; if (t <= 0) return q; } return kinds[0]; };
  const main = new PathBuilder(), detail = new PathBuilder(), dots = new PathBuilder();
  const d = Math.max(0, Math.min(1, density));
  // Coloreable ante todo: ningún motivo con radio < ~2.5 mm (celdas de ≥ 5 mm) y nada
  // de confeti. Más densidad ⇒ motivos algo más pequeños y más numerosos.
  const minR = outlineMode ? 5.5 : 5.0 - d * 1.2;
  const maxIn = 18 - d * 3, maxOut = 14 - d * 2.5;
  let minis = 0;
  for (let guard = 0; guard < 2500; guard++) {
    let best = -1, bestScore = 0;
    for (let i = 0; i < avail.length; i++) {
      const a = avail[i];
      if (a < minR) continue;
      const s = Math.min(a, zone[i] === 1 ? maxIn : maxOut) * (0.85 + rng() * 0.3);
      if (s > bestScore) { bestScore = s; best = i; }
    }
    if (best < 0) break;
    const inside = zone[best] === 1;
    const gx = best % gw, gy = (best / gw) | 0;
    const x = A.x0 + (gx + 0.5) * cell, y = A.y0 + (gy + 0.5) * cell;
    const r = Math.min(avail[best], inside ? maxIn : maxOut);
    const rot = rng() * Math.PI * 2;
    if (inside && r >= 8 && minis < 30) {
      out.push(...sub(x, y, r, minis++));
    } else if (r >= 4.5) {
      // Detalle interior sólo en motivos grandes: si no, las celdas quedan diminutas
      drawFiller(pickKind(), main, detail, x, y, r, rot, rng, !outlineMode && r >= 8);
    } else {
      drawFiller(rng() < 0.5 ? "ring" : (rng() < 0.5 ? "heart" : "daisy"), main, detail, x, y, r, rot, rng, false);
    }
    // Actualiza el espacio libre sólo en el entorno del motivo nuevo
    const reach = Math.ceil((r + Math.max(maxIn, maxOut) + gapOut) / cell);
    for (let yy = Math.max(0, gy - reach); yy < Math.min(gh, gy + reach + 1); yy++) {
      for (let xx = Math.max(0, gx - reach); xx < Math.min(gw, gx + reach + 1); xx++) {
        const j = yy * gw + xx;
        if (avail[j] < 0) continue;
        const g = zone[j] === 1 ? gapIn : gapOut;
        const v = Math.hypot((xx - gx) * cell, (yy - gy) * cell) - r - g;
        if (v < avail[j]) avail[j] = v;
      }
    }
  }
  for (const [pb, w, fill] of [[main, mainW, "#fff"], [detail, detailW, "none"], [dots, 0.2, stroke]]) {
    const p = pb.toPath({ stroke, strokeWidthMm: w, fill });
    if (p) out.push(p);
  }
  return out;
}

/**
 * Rellena los huecos blancos de la corona de «anillos»: el espacio entre copias vecinas y entre
 * ellas y el medallón. Mismo principio que drawFigure (empaquetado voraz de círculos sobre una
 * transformada de distancia), pero el espacio bloqueado es la silueta real de cada copia
 * (cls ≠ 2), no su caja. Cada motivo cabe entero en su hueco, sin tocar el dibujo.
 *
 * cx, cy: centro. rLo, rHi: radios interior y exterior de la corona (mm).
 * n, rm, sw, sh, mirror: las copias (nº, radio de su centro, ancho y alto en mm, espejo alterno).
 * cls, fw, fh: clases por píxel de la figura y su tamaño. Devuelve fragmentos SVG.
 */
export function drawRingGaps({ cx, cy, rLo, rHi, n, rm, sw, sh, mirror, cls, fw, fh, seed = 1, styleMode = "floral",
  outlineMode = false, stroke = "#000", mainW = 0.55, detailW = 0.4 }) {
  const rng = mulberry32(((seed >>> 0) ^ 0x6A9511) >>> 0);
  const cell = 0.7, gap = 1.6;
  const g = Math.ceil((2 * rHi) / cell), x0 = cx - rHi, y0 = cy - rHi;
  const wedge = 360 / n;
  const blocked = new Uint8Array(g * g);
  for (let gy = 0; gy < g; gy++) for (let gx = 0; gx < g; gx++) {
    const dx = x0 + (gx + 0.5) * cell - cx, dy = y0 + (gy + 0.5) * cell - cy;
    const r = Math.hypot(dx, dy);
    if (r < rLo || r > rHi) { blocked[gy * g + gx] = 1; continue; }
    // Copia más cercana por ángulo (cada caja cabe en su cuña)
    let deg = (Math.atan2(dx, -dy) * 180) / Math.PI; if (deg < 0) deg += 360;
    const i = Math.round(deg / wedge) % n, a = (i * wedge * Math.PI) / 180;
    const ex = dx - rm * Math.sin(a), ey = dy + rm * Math.cos(a);
    let u = ex * Math.cos(a) + ey * Math.sin(a);
    const v = -ex * Math.sin(a) + ey * Math.cos(a);
    if (mirror && i % 2) u = -u;
    const px = Math.floor(((u + sw / 2) / sw) * fw), py = Math.floor(((v + sh / 2) / sh) * fh);
    if (px >= 0 && py >= 0 && px < fw && py < fh && cls[py * fw + px] !== 2) blocked[gy * g + gx] = 1;
  }
  const dist = distanceTransform(blocked, g, g, true);
  const avail = new Float32Array(g * g);
  for (let i = 0; i < avail.length; i++) avail[i] = blocked[i] ? -1 : dist[i] * cell - gap;

  const W = FILLERS[styleMode] || FILLERS.floral;
  const kinds = Object.keys(W);
  const pickKind = () => { let t = rng() * kinds.reduce((s, q) => s + W[q], 0); for (const q of kinds) { t -= W[q]; if (t <= 0) return q; } return kinds[0]; };
  const main = new PathBuilder(), detail = new PathBuilder(), dots = new PathBuilder();
  const minR = outlineMode ? 3.6 : 3.0, maxR = 9; // coloreable: nada de confeti
  for (let guard = 0; guard < 400; guard++) {
    let best = -1, bestScore = 0;
    for (let i = 0; i < avail.length; i++) {
      const a = avail[i];
      if (a < 1.4) continue;
      const s = Math.min(a, maxR) * (0.85 + rng() * 0.3);
      if (s > bestScore) { bestScore = s; best = i; }
    }
    if (best < 0) break;
    const gx = best % g, gy = (best / g) | 0;
    const x = x0 + (gx + 0.5) * cell, y = y0 + (gy + 0.5) * cell;
    const r = Math.min(avail[best], maxR);
    if (r >= minR) drawFiller(pickKind(), main, detail, x, y, r, rng() * Math.PI * 2, rng, !outlineMode && r >= 6);
    else circle(dots, x, y, Math.max(0.5, r * 0.5)); // hueco pequeño: un punto sólido, sin celdas diminutas
    const reach = Math.ceil((r + maxR + gap) / cell);
    for (let yy = Math.max(0, gy - reach); yy < Math.min(g, gy + reach + 1); yy++) {
      for (let xx = Math.max(0, gx - reach); xx < Math.min(g, gx + reach + 1); xx++) {
        const j = yy * g + xx;
        if (avail[j] < 0) continue;
        const v = Math.hypot((xx - gx) * cell, (yy - gy) * cell) - r - gap;
        if (v < avail[j]) avail[j] = v;
      }
    }
  }
  const out = [];
  for (const [pb, w, fill] of [[main, mainW, "#fff"], [detail, detailW, "none"], [dots, 0.2, stroke]]) {
    const p = pb.toPath({ stroke, strokeWidthMm: w, fill });
    if (p) out.push(p);
  }
  return out;
}
