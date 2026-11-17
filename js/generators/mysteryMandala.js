// js/generators/mysteryMandala.js
// «Mandala misterioso»: una rejilla polar de celdas (anillos × sectores, con giro
// alterno como un rosetón) esconde una figura. Las celdas cuyo centro cae dentro de la
// figura llevan un punto pequeño; al colorearlas de oscuro aparece la silueta.
// La simetría del mandala queda intacta: sólo los puntos la rompen.
//
// Las figuras son predicados geométricos (sin imágenes ni DOM): se prueban en Node y
// el resultado es exacto y reproducible. Coordenadas de la figura: x a la derecha,
// y hacia arriba, figura dentro de [-1, 1]².
import { mulberry32 } from "../core/prng.js";
import { pageTexts } from "../core/pageTexts.js";
import { PathBuilder } from "../core/pathBuilder.js";
import { svgText, wrapLines } from "../core/svgText.js";
import { maskTest } from "./mysteryMasks.js";

const TAU = Math.PI * 2;

const inEllipse = (x, y, cx, cy, rx, ry, rot = 0) => {
  const c = Math.cos(rot), s = Math.sin(rot);
  const u = (x - cx) * c + (y - cy) * s, v = -(x - cx) * s + (y - cy) * c;
  return (u / rx) ** 2 + (v / ry) ** 2 <= 1;
};
const inPoly = (x, y, pts) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const STAR = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 ? 0.42 : 1, a = Math.PI / 2 + (i * Math.PI) / 5;
  return [r * Math.cos(a), r * Math.sin(a) - 0.05];
});

export const MYSTERY_SHAPES = {
  corazon: { name: "corazón", test: (x, y) => { const X = x * 1.22, Y = y * 1.22 + 0.15; return (X * X + Y * Y - 1) ** 3 - X * X * Y ** 3 <= 0; } },
  estrella: { name: "estrella", test: (x, y) => inPoly(x, y, STAR) },
  gato: {
    name: "gato",
    test: (x, y) => {
      const head = inEllipse(x, y, 0, -0.18, 0.66, 0.6)
        || inPoly(x, y, [[-0.62, 0.05], [-0.52, 0.9], [-0.1, 0.36]])
        || inPoly(x, y, [[0.62, 0.05], [0.52, 0.9], [0.1, 0.36]]);
      const eyes = inEllipse(x, y, -0.25, -0.06, 0.12, 0.17) || inEllipse(x, y, 0.25, -0.06, 0.12, 0.17);
      return head && !eyes;
    },
  },
  mariposa: {
    name: "mariposa",
    test: (x, y) => inEllipse(x, y, -0.45, 0.32, 0.48, 0.36, -0.5) || inEllipse(x, y, 0.45, 0.32, 0.48, 0.36, 0.5)
      || inEllipse(x, y, -0.34, -0.4, 0.32, 0.3, 0.4) || inEllipse(x, y, 0.34, -0.4, 0.32, 0.3, -0.4)
      || inEllipse(x, y, 0, 0, 0.1, 0.7),
  },
  luna: { name: "luna", test: (x, y) => inEllipse(x, y, -0.05, 0, 0.92, 0.92) && !inEllipse(x, y, 0.33, 0.18, 0.78, 0.78) },
  pez: {
    name: "pez",
    test: (x, y) => (inEllipse(x, y, -0.15, 0, 0.66, 0.42) || inPoly(x, y, [[0.38, 0], [0.95, 0.45], [0.95, -0.45]]))
      && !inEllipse(x, y, -0.48, 0.08, 0.09, 0.09),
  },
  casa: {
    name: "casa",
    test: (x, y) => {
      const body = (x >= -0.58 && x <= 0.58 && y >= -0.82 && y <= 0.12) || inPoly(x, y, [[-0.85, 0.1], [0.85, 0.1], [0, 0.88]]);
      const door = x >= -0.15 && x <= 0.15 && y >= -0.82 && y <= -0.3;
      const win = x >= 0.25 && x <= 0.46 && y >= -0.32 && y <= -0.1;
      return body && !door && !win;
    },
  },
  // Figuras añadidas (de 7 a 20): siluetas simples que se reconocen a la escala de la rejilla.
  arbol: { name: "árbol", test: (x, y) => inEllipse(x, y, 0, 0.22, 0.62, 0.62) || (x >= -0.14 && x <= 0.14 && y >= -0.88 && y <= -0.2) },
  flor: {
    name: "flor",
    test: (x, y) => {
      for (let k = 0; k < 5; k++) { const a = Math.PI / 2 + (k * 2 * Math.PI) / 5; if (inEllipse(x, y, 0.42 * Math.cos(a), 0.28 + 0.42 * Math.sin(a), 0.3, 0.2, a)) return true; }
      return inEllipse(x, y, 0, 0.28, 0.2, 0.2) || (x >= -0.07 && x <= 0.07 && y >= -0.9 && y <= 0.1);
    },
  },
  hoja: { name: "hoja", test: (x, y) => inEllipse(x, y, 0.05, 0.05, 0.85, 0.42, 0.75) || (Math.abs(x + y + 0.95) < 0.08 && x < -0.45) },
  gota: { name: "gota", test: (x, y) => inEllipse(x, y, 0, -0.3, 0.58, 0.58) || inPoly(x, y, [[-0.5, -0.05], [0.5, -0.05], [0, 0.95]]) },
  campana: {
    name: "campana",
    test: (x, y) => inPoly(x, y, [[-0.2, 0.75], [0.2, 0.75], [0.45, 0.2], [0.55, -0.45], [0.75, -0.6], [-0.75, -0.6], [-0.55, -0.45], [-0.45, 0.2]])
      || inEllipse(x, y, 0, 0.8, 0.14, 0.1) || inEllipse(x, y, 0, -0.75, 0.16, 0.14),
  },
  ancla: {
    name: "ancla",
    test: (x, y) => {
      const ring = inEllipse(x, y, 0, 0.72, 0.22, 0.22) && !inEllipse(x, y, 0, 0.72, 0.1, 0.1);
      const shaft = x >= -0.08 && x <= 0.08 && y >= -0.75 && y <= 0.52;
      const bar = y >= 0.25 && y <= 0.38 && x >= -0.42 && x <= 0.42;
      const arc = inEllipse(x, y, 0, -0.35, 0.75, 0.55) && !inEllipse(x, y, 0, -0.35, 0.6, 0.42) && y <= -0.35;
      return ring || shaft || bar || arc;
    },
  },
  barco: {
    name: "barco",
    // Casco ancho abajo y dos velas grandes; la vela mayor cubre el centro (si no, queda un hueco)
    test: (x, y) => inPoly(x, y, [[-0.92, -0.3], [0.92, -0.3], [0.62, -0.78], [-0.62, -0.78]])
      || inPoly(x, y, [[-0.06, -0.22], [-0.06, 0.95], [0.78, -0.22]]) || inPoly(x, y, [[-0.2, -0.22], [-0.2, 0.72], [-0.72, -0.22]]),
  },
  pajaro: {
    name: "pájaro",
    test: (x, y) => inEllipse(x, y, -0.05, -0.1, 0.55, 0.36) || inEllipse(x, y, 0.5, 0.25, 0.24, 0.24)
      || inPoly(x, y, [[0.7, 0.3], [0.95, 0.22], [0.7, 0.16]]) || inPoly(x, y, [[-0.3, 0.05], [0.15, 0.1], [-0.35, 0.72]])
      || inPoly(x, y, [[-0.55, -0.05], [-0.95, 0.2], [-0.9, -0.3]]),
  },
  trebol: {
    name: "trébol",
    test: (x, y) => inEllipse(x, y, 0, 0.5, 0.33, 0.33) || inEllipse(x, y, -0.36, 0.0, 0.33, 0.33) || inEllipse(x, y, 0.36, 0.0, 0.33, 0.33)
      || inEllipse(x, y, 0, 0.12, 0.2, 0.2) || (Math.abs(x - 0.25 * (y + 0.2)) < 0.07 && y <= -0.15 && y >= -0.9),
  },
  manzana: {
    name: "manzana",
    test: (x, y) => inEllipse(x, y, -0.28, -0.1, 0.48, 0.62) || inEllipse(x, y, 0.28, -0.1, 0.48, 0.62)
      || (x >= -0.05 && x <= 0.06 && y >= 0.45 && y <= 0.82) || inEllipse(x, y, 0.28, 0.7, 0.22, 0.1, 0.5),
  },
  seta: {
    name: "seta",
    test: (x, y) => (inEllipse(x, y, 0, 0.1, 0.9, 0.7) && y >= 0.1) || (x >= -0.22 && x <= 0.22 && y >= -0.85 && y <= 0.12),
  },
  nube: {
    name: "nube",
    test: (x, y) => inEllipse(x, y, -0.45, -0.12, 0.38, 0.32) || inEllipse(x, y, 0.45, -0.12, 0.38, 0.32)
      || inEllipse(x, y, -0.05, 0.18, 0.45, 0.42) || (x >= -0.75 && x <= 0.75 && y >= -0.44 && y <= -0.1),
  },
  sol: {
    name: "sol",
    test: (x, y) => {
      if (inEllipse(x, y, 0, 0, 0.45, 0.45)) return true;
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4, c = Math.cos(a), s = Math.sin(a);
        if (inPoly(x, y, [[0.55 * c - 0.16 * s, 0.55 * s + 0.16 * c], [0.95 * c, 0.95 * s], [0.55 * c + 0.16 * s, 0.55 * s - 0.16 * c]])) return true;
      }
      return false;
    },
  },
};
// Siluetas de boceto (mysteryMasks.js): sustituyen a las geométricas del mismo nombre y suman 15.
for (const [k, name] of Object.entries({"perro": "perro", "gato": "gato", "colibri": "colibrí", "caballo": "caballo", "jirafa": "jirafa", "pino": "pino", "tulipan": "tulipán", "montana": "sol y montaña", "nube": "nube", "mariposa": "mariposa", "buho": "búho", "pez": "pez", "oso": "oso", "saturno": "Saturno", "cohete": "cohete", "ovni": "ovni", "avion": "avión", "torre_eiffel": "torre Eiffel", "ubicacion": "ubicación", "gota": "gota"})) MYSTERY_SHAPES[k] = { name, test: maskTest(k) };
export const MYSTERY_KEYS = Object.keys(MYSTERY_SHAPES);
/** Máximo de mandalas misteriosos por libro: uno por figura distinta. */
export const MYSTERY_MAX = MYSTERY_KEYS.length;

/**
 * Geometría de la rejilla (pura): anillos con sus celdas y si cada celda va marcada.
 * Devuelve { cx, cy, R, Rg, rCore, rings: [{ r0, r1, n, off, twist }], marked: Set("i:j"), coreMarked }
 */
export function mysteryGrid({ cx, cy, R, shape = "corazon", complexity = 130 }) {
  const test = (MYSTERY_SHAPES[shape] || MYSTERY_SHAPES.corazon).test;
  const cF = Math.max(0, Math.min(1, (complexity - 20) / 300));
  const Rg = R * 0.86;
  const rCore = Math.max(4, Rg * 0.07);
  const nR = 12 + Math.round(cF * 5); // menos anillos = celdas más grandes
  const t = (Rg - rCore) / nR;
  const S = Rg * 0.66; // la figura ocupa ~2/3 del disco: se reconoce y no toca el borde
  const inside = (r, a) => test((r * Math.cos(a)) / S, -(r * Math.sin(a)) / S);
  const rings = [];
  const marked = new Set();
  for (let i = 0; i < nR; i++) {
    const r0 = rCore + i * t, r1 = r0 + t, rm = (r0 + r1) / 2;
    let n = 8;
    while ((TAU * rm) / n > t * 1.45) n *= 2;
    const step = TAU / n;
    const off = -Math.PI / 2 + (i % 2 ? step / 2 : 0);
    const twist = (i % 2 ? 1 : -1) * step * 0.22;
    rings.push({ r0, r1, n, off, twist });
    for (let j = 0; j < n; j++) if (inside(rm, off + (j + 0.5) * step + twist / 2)) marked.add(`${i}:${j}`);
  }
  return { cx, cy, R, Rg, rCore, t, rings, marked, coreMarked: inside(0, 0) };
}

/** Página completa del mandala misterioso. opts.reveal = true rellena la solución. */
export function generateMysteryMandala(doc, opts) {
  const {
    seed = 1, shape = "corazon", stroke = "#000", strokeWidthMm = 0.55, complexity = 130,
    pageBorder = true, reveal = false, instructions = true,
  } = opts;
  const page = doc.page;
  const m = Number.isFinite(page.marginMm) ? page.marginMm : 10;
  const rng = mulberry32(((seed >>> 0) ^ 0x3157E41) >>> 0);
  const mainW = Math.max(0.7, strokeWidthMm);
  const detailW = Math.max(0.5, strokeWidthMm * 0.65);
  const bottomText = instructions ? 9 : 0;
  const cx = opts.center?.x ?? page.wMm / 2;
  const cy = opts.center?.y ?? (page.hMm - bottomText) / 2;
  const R = opts.radius ?? Math.min(page.wMm - 2 * m - 12, page.hMm - 2 * m - 12 - 2 * bottomText) / 2;
  const g = mysteryGrid({ cx, cy, R, shape, complexity });
  const out = [];
  const emit = (pb, w, fill = "none", st = stroke) => { const p = pb.toPath({ stroke: st, strokeWidthMm: w, fill }); if (p) out.push(p); };
  const P = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];

  if (pageBorder && !opts.radius) {
    const h = mainW / 2; // borde exterior del trazo justo en el margen
    const pb = new PathBuilder(), x0 = m + h, y0 = m + h, x1 = page.wMm - m - h, y1 = page.hMm - m - h, rc = 4;
    pb.moveTo(x0 + rc, y0).lineTo(x1 - rc, y0).quadTo(x1, y0, x1, y0 + rc).lineTo(x1, y1 - rc).quadTo(x1, y1, x1 - rc, y1)
      .lineTo(x0 + rc, y1).quadTo(x0, y1, x0, y1 - rc).lineTo(x0, y0 + rc).quadTo(x0, y0, x0 + rc, y0).close();
    emit(pb, mainW);
  }

  // ---------- Corona de pétalos (decorativa, sin puntos) ----------
  const nPet = [16, 24][Math.floor(rng() * 2)];
  const back = new PathBuilder(), front = new PathBuilder();
  const petal = (pb, r0, r1, a, w) => {
    const h = r1 - r0;
    pb.moveTo(...P(r0, a - w));
    pb.cubicTo(...P(r0 + h * 0.45, a - w * 1.1), ...P(r1, a - w * 0.85), ...P(r1, a));
    pb.cubicTo(...P(r1, a + w * 0.85), ...P(r0 + h * 0.45, a + w * 1.1), ...P(r0, a + w));
    pb.close();
  };
  const ps = TAU / nPet;
  for (let i = 0; i < nPet; i++) {
    const a = -Math.PI / 2 + i * ps;
    petal(back, g.Rg * 0.97, R, a + ps / 2, ps * 0.48);
    petal(front, g.Rg * 0.97, R * 0.95 - (R - g.Rg) * 0.2, a, ps * 0.5);
  }
  emit(back, mainW, "#fff"); emit(front, mainW, "#fff");
  const disc = new PathBuilder(); circle(disc, cx, cy, g.Rg); emit(disc, mainW, "#fff");

  // ---------- Solución: celdas marcadas rellenas ----------
  const edge = (pb, r0, a0, r1, a1, first) => {
    // Lado «radial» con giro: curva suave en coordenadas polares
    const pts = [1, 2, 3].map(k => P(r0 + ((r1 - r0) * k) / 3, a0 + ((a1 - a0) * k) / 3));
    if (first) pb.moveTo(...P(r0, a0));
    pb.cubicTo(...pts[0], ...pts[1], ...pts[2]);
  };
  const arc = (pb, r, a0, a1) => {
    const n = Math.max(1, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 6)));
    for (let k = 0; k < n; k++) {
      const s0 = a0 + ((a1 - a0) * k) / n, s1 = a0 + ((a1 - a0) * (k + 1)) / n;
      const h = (4 / 3) * Math.tan((s1 - s0) / 4) * r;
      pb.cubicTo(cx + r * Math.cos(s0) - h * Math.sin(s0), cy + r * Math.sin(s0) + h * Math.cos(s0),
        cx + r * Math.cos(s1) + h * Math.sin(s1), cy + r * Math.sin(s1) - h * Math.cos(s1),
        ...P(r, s1));
    }
  };
  if (reveal) {
    const fill = new PathBuilder();
    g.rings.forEach((ring, i) => {
      const step = TAU / ring.n;
      for (let j = 0; j < ring.n; j++) {
        if (!g.marked.has(`${i}:${j}`)) continue;
        const a = ring.off + j * step;
        edge(fill, ring.r0, a, ring.r1, a + ring.twist, true);
        arc(fill, ring.r1, a + ring.twist, a + step + ring.twist);
        // Vuelta por el otro lado radial, de afuera hacia adentro
        const pts = [2, 1, 0].map(k => P(ring.r0 + ((ring.r1 - ring.r0) * k) / 3, a + step + (ring.twist * k) / 3));
        fill.cubicTo(...pts[0], ...pts[1], ...pts[2]);
        arc(fill, ring.r0, a + step, a);
        fill.close();
      }
    });
    if (g.coreMarked) circle(fill, cx, cy, g.rCore);
    emit(fill, 0.01, "#4a4a4a", "none");
  }

  // ---------- Rejilla ----------
  const rings = new PathBuilder(), radial = new PathBuilder();
  circle(rings, cx, cy, g.rCore);
  g.rings.forEach((ring) => {
    circle(rings, cx, cy, ring.r1);
    const step = TAU / ring.n;
    for (let j = 0; j < ring.n; j++) { const a = ring.off + j * step; edge(radial, ring.r0, a, ring.r1, a + ring.twist, true); }
  });
  emit(radial, detailW); emit(rings, detailW);
  const rim = new PathBuilder(); circle(rim, cx, cy, g.Rg); emit(rim, mainW);

  // ---------- Marcas ----------
  // Punto = color oscuro (la figura); raya corta = color claro (el fondo). Todas las
  // celdas llevan marca: si sólo las de la figura la tuvieran, la silueta se vería
  // antes de colorear y se perdería la sorpresa.
  if (!reveal) {
    const dots = new PathBuilder(), dashes = new PathBuilder();
    const dr = Math.max(0.55, Math.min(0.75, g.t * 0.16));
    const dl = dr * 1.3;
    const mark = (r, a, dark) => {
      if (dark) { circle(dots, ...P(r, a), dr); return; }
      // Raya tangencial: no se confunde con los lados radiales de la celda
      const [x, y] = P(r, a), ux = -Math.sin(a), uy = Math.cos(a);
      dashes.moveTo(x - ux * dl, y - uy * dl).lineTo(x + ux * dl, y + uy * dl);
    };
    g.rings.forEach((ring, i) => {
      const step = TAU / ring.n, rm = (ring.r0 + ring.r1) / 2;
      for (let j = 0; j < ring.n; j++) mark(rm, ring.off + (j + 0.5) * step + ring.twist / 2, g.marked.has(`${i}:${j}`));
    });
    mark(0, 0, g.coreMarked);
    emit(dashes, 0.35);
    emit(dots, 0.2, stroke);
  }

  if (instructions && !opts.radius) {
    // Cortada al ancho útil: en una línea no cabía en 6×9; si ocupa dos, sube la primera
    const lines = wrapLines(pageTexts(opts.lang).mysteryHint, page.wMm - 2 * m - 10, 3.4);
    lines.forEach((l, i) => out.push(svgText(page.wMm / 2, page.hMm - m - 5 - (lines.length - 1 - i) * 4.4, l, { size: 3.4, italic: true })));
  }
  doc.body.push(...out);
  if (doc.meta) doc.meta.mystery = { shape, marked: g.marked.size + (g.coreMarked ? 1 : 0) };
  return doc;
}

/**
 * Página de soluciones: miniaturas resueltas de cada mandala misterioso del libro.
 * entries: [{ label, shape, seed, complexity }]
 */
export function generateMysterySolutions(doc, { entries = [], stroke = "#000", lang = "es" } = {}) {
  const page = doc.page;
  const m = Number.isFinite(page.marginMm) ? page.marginMm : 10;
  doc.body.push(svgText(page.wMm / 2, m + 12, pageTexts(lang).solutionsTitle, { size: 6, weight: "bold" }));
  if (!entries.length) return doc;
  const cols = entries.length <= 2 ? entries.length : entries.length <= 6 ? 2 : 3;
  const rows = Math.ceil(entries.length / cols);
  const top = m + 20, aw = page.wMm - 2 * m, ah = page.hMm - top - m;
  const cw = aw / cols, ch = ah / rows;
  const r = Math.min(cw, ch - 9) / 2 - 3;
  entries.forEach((e, k) => {
    const x = m + cw * (k % cols + 0.5), y = top + ch * Math.floor(k / cols) + (ch - 9) / 2;
    const sub = { page, seed: e.seed, meta: {}, defs: doc.defs, body: [] };
    generateMysteryMandala(sub, { seed: e.seed, shape: e.shape, complexity: e.complexity, center: { x, y }, radius: r,
      strokeWidthMm: 0.32, reveal: true, pageBorder: false, instructions: false, stroke });
    doc.body.push(...sub.body);
    doc.body.push(svgText(x, y + r + 7, e.label, { size: 3.6 }));
  });
  return doc;
}

function circle(pb, x, y, r) {
  const n = 8, k = (4 / 3) * Math.tan(Math.PI / (2 * n)) * r;
  pb.moveTo(x + r, y);
  for (let i = 0; i < n; i++) {
    const a0 = (i * TAU) / n, a1 = ((i + 1) * TAU) / n;
    pb.cubicTo(
      x + r * Math.cos(a0) - k * Math.sin(a0), y + r * Math.sin(a0) + k * Math.cos(a0),
      x + r * Math.cos(a1) + k * Math.sin(a1), y + r * Math.sin(a1) - k * Math.cos(a1),
      x + r * Math.cos(a1), y + r * Math.sin(a1));
  }
  pb.close();
}
