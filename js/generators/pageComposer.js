// js/generators/pageComposer.js
// Composición de página: dónde vive el mandala y qué ocupa el resto de la hoja.
// Un libro con 30 discos centrados sobre papel vacío se siente como una fotocopia
// repetida; los libros comerciales alternan encuadres (fondo lleno, constelación de
// mandalas pequeños, cuartos de mandala en las esquinas, recortes a sangre interior).
//
// El relleno usa empaquetado voraz de círculos: en cada paso se elige el punto con
// más espacio libre y se coloca un motivo que cabe ahí. Se adapta a cualquier formato
// (6×9, 8.5×11, cuadrado) sin reglas por tamaño, y garantiza que ningún motivo toque
// al mandala ni a otro motivo: todas las celdas quedan cerradas y coloreables.
import { mulberry32 } from "../core/prng.js";
import { PathBuilder } from "../core/pathBuilder.js";
import { drawFigure } from "./figureFill.js";

const TAU = Math.PI * 2;

export const COMPOSITIONS = ["centro", "fondo", "constelacion", "esquinas", "gigante", "medio"];
// "figura" (imagen del usuario rellena de mandalas) sólo existe si opts.figure trae datos
export const FRAME_STYLES = ["redondeado", "doble", "feston", "ninguno"];

// Motivos de relleno que mejor acompañan cada estilo del mandala
export const FILLERS = {
  floral:    { daisy: 3, heart: 2, leaf: 2, star: 0.5, sun: 1 },
  geometric: { daisy: 1, heart: 0.3, leaf: 0.5, star: 3, sun: 2 },
  islamico:  { daisy: 2, heart: 0.5, leaf: 1, star: 3, sun: 1 },
  sashiko:   { daisy: 2, heart: 1, leaf: 1, star: 1, sun: 2 },
  azteca:    { daisy: 1, heart: 0.3, leaf: 1, star: 2, sun: 3 },
  yantra:    { daisy: 3, heart: 0.5, leaf: 1, star: 1.5, sun: 2 },
  celtico:   { daisy: 2, heart: 2, leaf: 3, star: 0.5, sun: 1 },
};

/**
 * ¿Necesita esta llamada al generador el compositor de página?
 * El collage (centro/radio explícitos) y las llamadas internas dibujan sólo el disco.
 */
export function wantsComposition(opts) {
  if (opts._inner || opts.center || opts.centerMm || opts.radius || opts.radiusMm) return false;
  if (opts.figure || opts.figureRing) return true;
  const c = opts.composition ?? "centro";
  const f = opts.frameStyle ?? "redondeado";
  return c !== "centro" || f !== "redondeado";
}

/**
 * Dibuja la página completa: marco + mandala principal + elementos secundarios.
 * drawMandala(doc, opts) dibuja un disco con opts.center/opts.radius (generador clásico).
 */
export function composePage(doc, opts, drawMandala) {
  const {
    seed = 1, stroke = "#000", strokeWidthMm = 0.55, pageBorder = true, includeFrames = true,
    composition = "centro", frameStyle = "redondeado", styleMode = "floral",
    spacing = 0.3, outlineMode = false, complexity = 130,
  } = opts;
  const page = doc.page;
  const m = Number.isFinite(page.marginMm) ? page.marginMm : 10;
  const rng = mulberry32(((seed >>> 0) ^ 0x51ED270B) >>> 0);
  const mainW = Math.max(0.3, strokeWidthMm);
  const detailW = Math.max(0.3, strokeWidthMm * 0.7);
  const style = pageBorder ? frameStyle : "ninguno";

  // ---------- Marco ----------
  const frameItems = [];
  const emit = (arr, pb, w, fill = "none") => { const p = pb.toPath({ stroke, strokeWidthMm: w, fill }); if (p) arr.push(p); };
  const rect = (pb, x0, y0, x1, y1, rc) => {
    if (rc <= 0) { pb.moveTo(x0, y0).lineTo(x1, y0).lineTo(x1, y1).lineTo(x0, y1).close(); return; }
    pb.moveTo(x0 + rc, y0).lineTo(x1 - rc, y0).quadTo(x1, y0, x1, y0 + rc).lineTo(x1, y1 - rc).quadTo(x1, y1, x1 - rc, y1)
      .lineTo(x0 + rc, y1).quadTo(x0, y1, x0, y1 - rc).lineTo(x0, y0 + rc).quadTo(x0, y0, x0 + rc, y0).close();
  };
  let inset = 0; // distancia del margen al borde interior del marco
  if (style === "redondeado") {
    const pb = new PathBuilder(); rect(pb, m, m, page.wMm - m, page.hMm - m, 4); emit(frameItems, pb, mainW);
    if (includeFrames) { const p2 = new PathBuilder(); rect(p2, m + 2.5, m + 2.5, page.wMm - m - 2.5, page.hMm - m - 2.5, 2.4); emit(frameItems, p2, detailW); }
    inset = includeFrames ? 2.5 : 0;
  } else if (style === "doble") {
    const pb = new PathBuilder(); rect(pb, m, m, page.wMm - m, page.hMm - m, 0); emit(frameItems, pb, mainW);
    const p2 = new PathBuilder(); rect(p2, m + 3, m + 3, page.wMm - m - 3, page.hMm - m - 3, 0); emit(frameItems, p2, mainW);
    // Rombos en las esquinas, entre las dos líneas
    const d = new PathBuilder();
    for (const [x, y] of [[m + 1.5, m + 1.5], [page.wMm - m - 1.5, m + 1.5], [page.wMm - m - 1.5, page.hMm - m - 1.5], [m + 1.5, page.hMm - m - 1.5]]) {
      d.moveTo(x, y - 1.5).lineTo(x + 1.5, y).lineTo(x, y + 1.5).lineTo(x - 1.5, y).close();
    }
    emit(frameItems, d, detailW, stroke);
    inset = 3;
  } else if (style === "feston") {
    // Festones hacia afuera sobre un rectángulo interior; nunca salen del margen
    const bump = 4.5, x0 = m + bump, y0 = m + bump, x1 = page.wMm - m - bump, y1 = page.hMm - m - bump;
    const pb = new PathBuilder();
    const side = (ax, ay, bx, by, nx, ny) => {
      const len = Math.hypot(bx - ax, by - ay), n = Math.max(3, Math.round(len / (bump * 2)));
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n, tm = (t0 + t1) / 2;
        const px = ax + (bx - ax) * tm + nx * bump, py = ay + (by - ay) * tm + ny * bump; // control en el margen: la curva queda dentro
        pb.quadTo(px, py, ax + (bx - ax) * t1, ay + (by - ay) * t1);
      }
    };
    pb.moveTo(x0, y0);
    side(x0, y0, x1, y0, 0, -1); side(x1, y0, x1, y1, 1, 0); side(x1, y1, x0, y1, 0, 1); side(x0, y1, x0, y0, -1, 0);
    pb.close();
    emit(frameItems, pb, mainW);
    if (includeFrames) { const p2 = new PathBuilder(); rect(p2, x0 + 2, y0 + 2, x1 - 2, y1 - 2, 0); emit(frameItems, p2, detailW); }
    inset = bump + (includeFrames ? 2 : 0);
  }

  // Área de contenido (y de recorte) dentro del marco
  const gap = 1.6 + spacing * 3;
  const pad = style === "ninguno" ? 2 : inset + gap; // sin marco: holgura para las curvas de los motivos
  const A = { x0: m + pad, y0: m + pad, x1: page.wMm - m - pad, y1: page.hMm - m - pad };
  const aw = A.x1 - A.x0, ah = A.y1 - A.y0;
  const acx = (A.x0 + A.x1) / 2, acy = (A.y0 + A.y1) / 2;
  const maxR = Math.min(aw, ah) / 2;

  const sub = (x, y, r, extra = {}) => {
    const tmp = { page: doc.page, seed: doc.seed, meta: doc.meta, defs: doc.defs, body: [] };
    drawMandala(tmp, { ...opts, center: { x, y }, radius: r, pageBorder: false, _inner: true, ...extra });
    return tmp.body;
  };
  // Los mandalas pequeños llevan menos bandas y trazo fino: si no, se ven como manchas
  const miniOpts = (i, r = 20) => ({
    seed: ((seed >>> 0) + 7919 * (i + 1)) >>> 0,
    petals: [6, 8, 10, 12][Math.floor(rng() * 4)],
    complexity: 20,
    includeFrames: false,
    outlineMode: outlineMode || r < 30,
    maxBands: r < 16 ? 2 : r < 24 ? 3 : r < 32 ? 4 : undefined,
    detailSimplification: 0.7,
    strokeWidthMm: Math.max(0.3, strokeWidthMm * 0.75),
    centerArt: null,
  });

  // ---------- Mandala(s) estructurales ----------
  const obstacles = [];  // círculos que el relleno no debe invadir
  const content = [];
  let clip = false;
  let fill = null;       // { minis: bool } si la composición rellena el espacio libre

  switch (opts.figure ? "figura" : opts.figureRing ? "anillos" : composition) {
    case "anillos": {
      // Mandala con un anillo de la figura repetida: bandas clásicas por fuera, copias
      // grandes de la figura en medio (en espejo alterno) y la figura entera en el
      // medallón. Copias grandes y trazo grueso (versión "sello"): se pueden colorear.
      const ring = opts.figureRing;
      const R = maxR * 0.97;
      const rOut = R * (0.76 + rng() * 0.04);
      content.push(...sub(acx, acy, R, { maxBands: 3, centerArt: null }));
      const band = new PathBuilder();
      circle(band, acx, acy, rOut);
      emitTo(content, band, mainW, "#fff");
      const lineIn = rOut - Math.max(1.6, R * 0.025);
      const inner = new PathBuilder();
      circle(inner, acx, acy, lineIn);
      emitTo(content, inner, detailW);

      // Geometría exacta (resuelta con Wolfram): copia de alto h y ancho a·h, borde
      // interior a distancia d del centro. Cabe si
      //   a·h/2 ≤ d·tan(π/n)              (no invade la cuña de su vecina)
      //   (d + h)² + (a·h/2)² ≤ rExt²      (su esquina exterior no sale del anillo)
      // y el alto máximo es min(hTan, hIn):
      //   hTan = 2·rExt·t / √(4at + 4t² + a²(1+t²)),  t = tan(π/n)
      //   hIn  = 2·(√((4+a²)·rExt² − a²·rIn²) − 2·rIn) / (4+a²)
      // Se elige el n (6–12, par) que cubre más área n·a·h² sin bajar de un tamaño coloreable.
      const a = ring.w / ring.h;
      const rExt = lineIn - Math.max(1.2, R * 0.015), rInMin = R * 0.3;
      const hIn = (2 * (Math.sqrt((4 + a * a) * rExt * rExt - a * a * rInMin * rInMin) - 2 * rInMin)) / (4 + a * a);
      // Criterio: copias GRANDES primero (se colorean mejor). Se añaden copias sólo si
      // no encogen más de un 5 % respecto a la más grande posible; entre esas, la que
      // más área cubre (n·a·h²). Ej. figura alta (a = 0.6): 8 copias del mismo tamaño que 6.
      const cands = [6, 8, 10, 12].map(n => {
        const t = Math.tan(Math.PI / n);
        const hTan = (2 * rExt * t) / Math.sqrt(4 * a * t + 4 * t * t + a * a * (1 + t * t));
        const h = Math.min(hTan, hIn) * 0.94; // 6 % de holgura: las copias no se tocan
        return { n, h, t, cover: n * a * h * h };
      });
      const hMax = Math.max(...cands.map(c => c.h));
      const best = cands.filter(c => c.h >= hMax * 0.95).reduce((x, y) => (y.cover > x.cover ? y : x));
      const { n, h: sh, t } = best;
      const sw = a * sh;
      // Entre la posición más baja permitida y la que toca el anillo exterior: al medio
      const dMin = Math.max(rInMin, sw / (2 * t));
      const dMax = Math.sqrt(rExt * rExt - (sw / 2) ** 2) - sh;
      const d = Math.max(dMin, (dMin + dMax) / 2);
      const rm = d + sh / 2;
      const mirror = rng() < 0.6;
      for (let i = 0; i < n; i++) {
        const ang = (360 * i) / n;
        const x = acx + rm * Math.sin((ang * Math.PI) / 180), y = acy - rm * Math.cos((ang * Math.PI) / 180);
        const flip = mirror && i % 2 ? " scale(-1 1)" : "";
        content.push(`<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${ang.toFixed(2)})${flip}"><image href="${ring.href}" x="${(-sw / 2).toFixed(2)}" y="${(-sh / 2).toFixed(2)}" width="${sw.toFixed(2)}" height="${sh.toFixed(2)}" preserveAspectRatio="none" /></g>`);
      }
      const rIn = d;
      // Mandala interior con la figura completa en el medallón
      const ri = rIn - Math.max(1.5, R * 0.02);
      content.push(...sub(acx, acy, ri, { maxBands: 2, centerArt: ring.centerHref ? { type: "image", href: ring.centerHref, scale: 0.62 } : null }));
      obstacles.push({ x: acx, y: acy, r: R });
      fill = { minis: false };
      break;
    }
    case "figura": {
      content.push(...drawFigure({
        figure: opts.figure, A, seed, styleMode, outlineMode, stroke, mainW, detailW,
        fillInside: opts.figureFillInside ?? true, fillOutside: opts.figureFillOutside ?? true,
        density: opts.figureDensity ?? 0.3,
        sub: (x, y, r, i) => sub(x, y, r, miniOpts(i, r)),
      }));
      break;
    }
    case "fondo": {
      const R = maxR * (0.8 + rng() * 0.06);
      content.push(...sub(acx, acy, R));
      obstacles.push({ x: acx, y: acy, r: R });
      fill = { minis: false };
      break;
    }
    case "constelacion": {
      // opts.mainScale (mural): mandala principal más grande y centrado. El sorteo se
      // consume igual, para no alterar las páginas normales con la misma semilla.
      const rR = 0.7 + rng() * 0.08;
      const R = maxR * (opts.mainScale ?? rR);
      // En hojas verticales el mandala sube un poco y deja aire abajo para los pequeños
      const rOy = ah > aw * 1.15 ? -(ah / 2 - R) * (0.25 + rng() * 0.35) : 0;
      const oy = opts.mainScale ? 0 : rOy;
      content.push(...sub(acx, acy + oy, R));
      obstacles.push({ x: acx, y: acy + oy, r: R });
      fill = { minis: true };
      break;
    }
    case "esquinas": {
      const R = maxR * 0.8;
      const d = Math.hypot(aw / 2, ah / 2);
      const rq = Math.min(d - R - gap * 2, Math.min(aw, ah) * 0.42);
      if (rq > 12) {
        let i = 0;
        for (const [x, y] of [[A.x0, A.y0], [A.x1, A.y0], [A.x1, A.y1], [A.x0, A.y1]]) {
          content.push(...sub(x, y, rq, { ...miniOpts(i++, rq), seed: ((seed >>> 0) + 104729) >>> 0, complexity, outlineMode, strokeWidthMm, detailSimplification: opts.detailSimplification ?? 0.5 }));
          obstacles.push({ x, y, r: rq });
        }
      }
      content.push(...sub(acx, acy, R));
      obstacles.push({ x: acx, y: acy, r: R });
      clip = true;
      fill = { minis: false };
      break;
    }
    case "gigante": {
      // Recorte interior: el mandala desborda el marco y la página parece un acercamiento.
      // El radio supera la semidiagonal: el diseño cubre también las esquinas. Con un
      // radio menor sólo se recortaban las puntas de los pétalos exteriores y la página
      // parecía un mandala mal encuadrado, con esquinas vacías.
      const ox = aw * (rng() - 0.5) * 0.08, oy = ah * (rng() - 0.5) * 0.08;
      const R = Math.hypot(aw / 2 + Math.abs(ox), ah / 2 + Math.abs(oy)) * (1.04 + rng() * 0.12);
      content.push(...sub(acx + ox, acy + oy, R));
      clip = true;
      break;
    }
    case "medio": {
      // Medio mandala que nace del borde inferior (o superior): un amanecer.
      // Cabe a lo ancho (sólo lo corta la línea de base); si además se cortaba por los
      // lados, quedaba un fragmento sin forma reconocible.
      const top = rng() < 0.3;
      const y = top ? A.y0 : A.y1;
      const R = Math.min(aw * 0.48, ah * 0.62);
      content.push(...sub(acx, y, R));
      obstacles.push({ x: acx, y, r: R });
      clip = true;
      fill = { minis: true };
      break;
    }
    default: {
      const R = maxR;
      content.push(...sub(acx, acy, R));
      obstacles.push({ x: acx, y: acy, r: R });
    }
  }

  // ---------- Relleno del espacio libre ----------
  const fillItems = fill ? packFill({ A, obstacles, rng, gap, minis: fill.minis, style: styleMode,
    outlineMode, stroke, mainW, detailW, sub, miniOpts }) : [];

  // ---------- Ensamblado ----------
  // El relleno va detrás: si un motivo roza el mandala, el blanco del mandala lo tapa.
  const body = [...fillItems, ...content];
  if (clip) {
    const id = `frameclip-${(seed >>> 0).toString(36)}-${doc.defs.length}`;
    doc.defs.push(`<clipPath id="${id}"><rect x="${A.x0 - gap + 0.01}" y="${A.y0 - gap + 0.01}" width="${aw + 2 * gap - 0.02}" height="${ah + 2 * gap - 0.02}" /></clipPath>`);
    doc.body.push(`<g clip-path="url(#${id})">`, ...body, `</g>`);
    // Sin marco, el recorte dejaba celdas abiertas en el borde: una línea las cierra
    if (style === "ninguno") {
      const pb = new PathBuilder();
      rect(pb, A.x0 - gap, A.y0 - gap, A.x1 + gap, A.y1 + gap, 0);
      emit(frameItems, pb, mainW);
    }
  } else {
    doc.body.push(...body);
  }
  doc.body.push(...frameItems);
  return doc;
}

function emitTo(arr, pb, w, fill = "none", stroke = "#000") {
  const p = pb.toPath({ stroke, strokeWidthMm: w, fill });
  if (p) arr.push(p);
}

// ---------- Empaquetado voraz de círculos ----------
function packFill({ A, obstacles, rng, gap, minis, style, outlineMode, stroke, mainW, detailW, sub, miniOpts }) {
  const step = 2;
  const pts = [];
  for (let y = A.y0 + step / 2; y < A.y1; y += step) {
    for (let x = A.x0 + step / 2; x < A.x1; x += step) {
      const jx = x + (rng() - 0.5) * step * 0.8, jy = y + (rng() - 0.5) * step * 0.8;
      // Distancia al borde del área (para motivos dentro del marco)
      let a = Math.min(jx - A.x0, A.x1 - jx, jy - A.y0, A.y1 - jy);
      for (const o of obstacles) a = Math.min(a, Math.hypot(jx - o.x, jy - o.y) - o.r - gap);
      pts.push({ x: jx, y: jy, a });
    }
  }
  const W = FILLERS[style] || FILLERS.floral;
  const kinds = Object.keys(W);
  const pickKind = () => { let t = rng() * kinds.reduce((s, k) => s + W[k], 0); for (const k of kinds) { t -= W[k]; if (t <= 0) return k; } return kinds[0]; };

  const out = [];
  const main = new PathBuilder(), detail = new PathBuilder(), dots = new PathBuilder();
  const maxMini = minis ? 34 : 11;
  const dotMin = outlineMode ? 3.2 : 1.6; // por debajo, confeti que estorba al colorear
  let miniCount = 0;
  for (let guard = 0; guard < 600; guard++) {
    let best = null, bestScore = 0;
    for (const p of pts) {
      if (p.a <= dotMin) continue;
      const s = Math.min(p.a, maxMini) * (0.8 + rng() * 0.4);
      if (s > bestScore) { bestScore = s; best = p; }
    }
    if (!best) break;
    // Radio del motivo: un poco de variedad para que no parezca una rejilla
    // 0.97: los puntos de control de las curvas sobresalen ~1 % del radio
    const r = Math.min(best.a, maxMini) * (minis ? 0.97 : 0.75 + rng() * 0.22);
    const rot = rng() * TAU;
    if (minis && r >= 13 && miniCount < 14) {
      out.push(...sub(best.x, best.y, r, miniOpts(miniCount++, r)));
    } else if (r >= 4.2) {
      drawFiller(pickKind(), main, detail, best.x, best.y, r, rot, rng, !outlineMode);
    } else if (r >= 2.4) {
      drawFiller(rng() < 0.5 ? "ring" : (rng() < 0.5 ? "heart" : "star"), main, detail, best.x, best.y, r, rot, rng, false);
    } else {
      circle(dots, best.x, best.y, Math.max(0.55, r * 0.5));
    }
    const ob = { x: best.x, y: best.y, r };
    for (const p of pts) if (p.a > 0) p.a = Math.min(p.a, Math.hypot(p.x - ob.x, p.y - ob.y) - ob.r - gap);
  }
  const push = (pb, w, fill) => { const p = pb.toPath({ stroke, strokeWidthMm: w, fill }); if (p) out.push(p); };
  push(main, mainW, "#fff");
  push(detail, detailW, "none");
  push(dots, 0.2, stroke); // puntos sólidos: decoran sin crear celdas diminutas
  return out;
}

export function circle(pb, x, y, rad) {
  const n = 8, k = (4 / 3) * Math.tan(Math.PI / (2 * n)) * rad;
  pb.moveTo(x + rad, y);
  for (let i = 0; i < n; i++) {
    const a0 = (i * TAU) / n, a1 = ((i + 1) * TAU) / n;
    pb.cubicTo(x + rad * Math.cos(a0) - k * Math.sin(a0), y + rad * Math.sin(a0) + k * Math.cos(a0),
      x + rad * Math.cos(a1) + k * Math.sin(a1), y + rad * Math.sin(a1) - k * Math.cos(a1),
      x + rad * Math.cos(a1), y + rad * Math.sin(a1));
  }
  pb.close();
}

// Motivos en coordenadas locales (u, v) ∈ [-1, 1], escalados a r y girados rot
export function drawFiller(kind, main, detail, x, y, r, rot, rng, withDetail) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const T = (u, v) => [x + r * (u * c - v * s), y + r * (u * s + v * c)];
  const M = (pb, u, v) => pb.moveTo(...T(u, v));
  const L = (pb, u, v) => pb.lineTo(...T(u, v));
  const Q = (pb, u1, v1, u, v) => pb.quadTo(...T(u1, v1), ...T(u, v));
  const C = (pb, u1, v1, u2, v2, u, v) => pb.cubicTo(...T(u1, v1), ...T(u2, v2), ...T(u, v));
  const big = withDetail && r > 7;

  if (kind === "daisy") {
    const n = 5 + Math.floor(rng() * 4), rc = 0.3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, w = Math.PI / n * 0.95;
      const p = (rr, aa) => [rr * Math.cos(aa), rr * Math.sin(aa)];
      M(main, ...p(rc * 0.9, a - w * 0.8));
      C(main, ...p(0.85, a - w * 1.25), ...p(1.02, a - w * 0.5), ...p(1.0, a));
      C(main, ...p(1.02, a + w * 0.5), ...p(0.85, a + w * 1.25), ...p(rc * 0.9, a + w * 0.8));
      main.close();
      if (big) { M(detail, ...p(rc + 0.12, a)); L(detail, ...p(0.72, a)); }
    }
    circle(main, x, y, r * rc);
    if (big) circle(detail, x, y, r * rc * 0.45);
  } else if (kind === "heart") {
    M(main, 0, 0.85);
    C(main, -0.55, 0.45, -1.0, 0.05, -0.92, -0.42);
    C(main, -0.82, -0.95, -0.15, -0.95, 0, -0.45);
    C(main, 0.15, -0.95, 0.82, -0.95, 0.92, -0.42);
    C(main, 1.0, 0.05, 0.55, 0.45, 0, 0.85);
    main.close();
    if (big) {
      M(detail, 0, 0.5);
      C(detail, -0.32, 0.26, -0.6, 0.02, -0.55, -0.27);
      C(detail, -0.48, -0.58, -0.1, -0.58, 0, -0.22);
      C(detail, 0.1, -0.58, 0.48, -0.58, 0.55, -0.27);
      C(detail, 0.6, 0.02, 0.32, 0.26, 0, 0.5);
      detail.close();
    }
  } else if (kind === "star") {
    const n = 5, ri = 0.45;
    for (let i = 0; i <= 2 * n; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / n, rr = i % 2 ? ri : 0.98;
      (i === 0 ? M : L)(main, rr * Math.cos(a), rr * Math.sin(a));
    }
    main.close();
    if (big) {
      for (let i = 0; i <= 2 * n; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / n, rr = i % 2 ? ri * 0.5 : 0.5;
        (i === 0 ? M : L)(detail, rr * Math.cos(a), rr * Math.sin(a));
      }
      detail.close();
    }
  } else if (kind === "sun") {
    const n = 8 + 2 * Math.floor(rng() * 3), ri = 0.55;
    for (let i = 0; i <= 2 * n; i++) {
      const a = (i * Math.PI) / n, rr = i % 2 ? ri : 0.98;
      (i === 0 ? M : L)(main, rr * Math.cos(a), rr * Math.sin(a));
    }
    main.close();
    circle(main, x, y, r * ri * 0.82);
    if (big) circle(detail, x, y, r * ri * 0.42);
  } else if (kind === "leaf") {
    // Hoja lanceolada con nervio central (y nervaduras si hay sitio)
    M(main, 0, 0.98);
    C(main, -0.72, 0.45, -0.62, -0.45, 0, -0.98);
    C(main, 0.62, -0.45, 0.72, 0.45, 0, 0.98);
    main.close();
    if (big) {
      M(detail, 0, 0.8); L(detail, 0, -0.72);
      for (const t of [0.35, -0.05, -0.4]) for (const sd of [-1, 1]) { M(detail, 0, t); L(detail, sd * 0.32, t - 0.28); }
    }
  } else {
    // ring: circulito con punto
    circle(main, x, y, r * 0.85);
    if (r > 3.2) circle(detail, x, y, r * 0.35);
  }
}
