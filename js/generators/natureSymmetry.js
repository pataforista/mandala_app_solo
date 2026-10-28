// js/generators/natureSymmetry.js
// Capítulo «Simetrías de la naturaleza»: mandalas construidos con la regla geométrica
// real de cada organismo, no con su apariencia aproximada.
//  - Girasol: modelo de Vogel (1979). Flósculo n en r = c·√n, θ = n·137,508°.
//  - Copo de nieve: seis brazos idénticos (red hexagonal del hielo Ih) con ramas a ±60°.
//  - Estrella de mar: simetría pentarradial con la placa madrepórica fuera del centro.
//  - Diatomea céntrica: poros (areolas) en filas radiales y costillas, como en
//    Arachnoidiscus y Coscinodiscus.
// Cada página lleva una nota breve. Las cifras están redactadas con cautela («suelen»,
// «se estima»): son orientativas, no constantes universales.
import { mulberry32 } from "../core/prng.js";
import { PathBuilder } from "../core/pathBuilder.js";
import { wrapLines, svgText } from "../core/svgText.js";

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5)); // 137,507…°

export const NATURE_KINDS = ["girasol", "estrella", "copo", "diatomea"];

export const NATURE_TEXT = {
  girasol: {
    title: "Girasol · el ángulo áureo",
    // @a y @b: las espirales que tiene ESTE dibujo, contadas al dibujarlo (21 y 34, o 34 y 55,
    // según el número de flósculos); @c y @d: el par de Fibonacci siguiente, frecuente en
    // girasoles reales, para no repetir la misma cifra. Dos caracteres, igual que los
    // números: el corte de líneas no cambia al sustituirlos.
    body: "En el modelo clásico del girasol, cada flósculo queda girado unos 137,5° respecto al anterior: el ángulo áureo. Como ese giro nunca se repite exactamente, las semillas se empaquetan casi sin huecos. Busca las espirales que corren en los dos sentidos: en este dibujo hay @a y @b. En los girasoles reales suelen contarse números consecutivos de Fibonacci, como @c y @d, aunque no siempre.",
  },
  estrella: {
    title: "Estrella de mar · simetría de cinco",
    body: "Los equinodermos adultos tienen simetría pentarradial: cinco partes iguales alrededor de un eje. Sus larvas, en cambio, nadan con simetría bilateral, como la nuestra, y se reorganizan durante la metamorfosis. El pequeño círculo fuera del centro, la placa madrepórica, rompe la simetría: comunica con el mar el sistema hidráulico que mueve sus pies, el sistema vascular acuífero.",
  },
  copo: {
    title: "Copo de nieve · simetría de seis",
    body: "El hielo cristaliza en una red hexagonal; por eso los copos estrellados tienen seis brazos. Los brazos crecen casi igual porque viven, al mismo tiempo, los mismos cambios de temperatura y humedad durante la caída: ninguno copia a los otros. Como cada copo atraviesa nubes distintas, es muy improbable encontrar dos iguales.",
  },
  diatomea: {
    title: "Diatomea · un vidrio vivo",
    body: "Las diatomeas son algas de una sola célula que construyen su pared con sílice, el mismo compuesto del vidrio. En las diatomeas céntricas, como esta, los poros forman filas radiales. Ernst Haeckel las dibujó en «Kunstformen der Natur» (1899-1904). Se estima que producen entre una quinta y una cuarta parte del oxígeno de la Tierra.",
  },
};

/** Página completa: dibujo + nota científica al pie (opts.captions, por defecto sí). */
export function generateNaturePage(doc, opts) {
  const {
    kind = "girasol", seed = 1, stroke = "#000", strokeWidthMm = 0.55,
    complexity = 130, captions = true,
  } = opts;
  const page = doc.page;
  const m = Number.isFinite(page.marginMm) ? page.marginMm : 10;
  const rng = mulberry32(((seed >>> 0) ^ 0x6E47A11E) >>> 0);
  const mainW = Math.max(0.3, strokeWidthMm);
  const detailW = Math.max(0.3, strokeWidthMm * 0.7);
  const cF = Math.max(0, Math.min(1, (complexity - 20) / 300));
  const out = [];
  const emit = (pb, w, fill = "none") => { const p = pb.toPath({ stroke, strokeWidthMm: w, fill }); if (p) out.push(p); };

  // ---------- Nota al pie ----------
  const text = [];
  let capH = 0;
  if (captions && NATURE_TEXT[kind]) {
    const t = NATURE_TEXT[kind];
    const maxW = page.wMm - 2 * m - 10;
    const ts = Math.max(4, Math.min(5.4, page.wMm / 40));
    const bs = Math.max(3, Math.min(3.6, page.wMm / 62));
    const lines = wrapLines(t.body, maxW, bs);
    capH = ts * 2.1 + lines.length * bs * 1.38 + 3;
    const top = page.hMm - m - capH;
    const rule = new PathBuilder();
    rule.moveTo(page.wMm / 2 - 18, top).lineTo(page.wMm / 2 + 18, top);
    text.push(rule.toPath({ stroke, strokeWidthMm: 0.3 }));
    text.push(svgText(page.wMm / 2, top + ts * 1.5, t.title, { size: ts, weight: "bold" }));
    lines.forEach((l, i) => text.push(svgText(page.wMm / 2, top + ts * 1.5 + ts * 0.6 + (i + 1) * bs * 1.38, l, { size: bs })));
  }

  const x0 = m + 3, x1 = page.wMm - m - 3, y0 = m + 3, y1 = page.hMm - m - 3 - capH;
  const g = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, R: Math.min(x1 - x0, y1 - y0) / 2 - 1, rng, cF, mainW, detailW, emit };
  const drawn = (DRAW[kind] || DRAW.girasol)(g) || {};
  // La nota cita lo que el lector puede contar en esta página, no una cifra genérica
  const fill = (s) => {
    if (!drawn.spirals) return s;
    const [a, b] = drawn.spirals;
    return s.replace("@a", a).replace("@b", b).replace("@c", b).replace("@d", a + b);
  };
  doc.body.push(...out, ...text.map(fill));
  if (doc.meta) { doc.meta.nature = kind; if (drawn.spirals) doc.meta.spirals = drawn.spirals; }
  return doc;
}

/**
 * Espirales (parástiquias) que el ojo sigue en el borde del disco: cada flósculo exterior
 * se une a sus dos vecinos más cercanos, y la diferencia de índice con cada vecino es el
 * número de espirales de esa familia. Devuelve los dos números más frecuentes, de menor a
 * mayor (p. ej. [21, 34]). Se cuentan en el 20 % exterior, donde el lector las cuenta.
 */
export function visibleSpirals(pts) {
  const N = pts.length, counts = new Map();
  for (let i = Math.floor(N * 0.8); i < N; i++) {
    const near = [];
    for (let j = 0; j < N; j++) if (j !== i) near.push([Math.hypot(pts[j][0] - pts[i][0], pts[j][1] - pts[i][1]), Math.abs(j - i)]);
    near.sort((a, b) => a[0] - b[0]);
    for (const [, k] of near.slice(0, 2)) counts.set(k, (counts.get(k) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k).sort((a, b) => a - b);
}

// ---------- Primitivas ----------
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

function polygon(pb, pts) {
  pb.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) pb.lineTo(pts[i][0], pts[i][1]);
  pb.close();
}

// Pétalo con base en r0 (±w rad) y punta en r1, alrededor de (cx, cy)
function petal(pb, cx, cy, r0, r1, a, w) {
  const P = (r, t) => [cx + r * Math.cos(t), cy + r * Math.sin(t)];
  const h = r1 - r0;
  pb.moveTo(...P(r0, a - w));
  pb.cubicTo(...P(r0 + h * 0.45, a - w * 1.05), ...P(r0 + h * 0.85, a - w * 0.35), ...P(r1, a));
  pb.cubicTo(...P(r0 + h * 0.85, a + w * 0.35), ...P(r0 + h * 0.45, a + w * 1.05), ...P(r0, a + w));
  pb.close();
}

const DRAW = {
  // Modelo de Vogel: las espirales (parástiquias) no se dibujan; emergen solas
  girasol({ cx, cy, R, rng, cF, mainW, detailW, emit }) {
    const rDisc = R * 0.6;
    const nRays = R > 60 ? 34 : 21;
    const step = TAU / nRays;
    const back = new PathBuilder(), front = new PathBuilder(), veins = new PathBuilder();
    for (let i = 0; i < nRays; i++) {
      const a = -Math.PI / 2 + i * step;
      petal(back, cx, cy, rDisc * 0.9, R, a + step / 2, step * 0.47);
      petal(front, cx, cy, rDisc * 0.9, R * 0.88, a, step * 0.5);
      const v0 = rDisc * 1.06, v1 = R * 0.74;
      veins.moveTo(cx + v0 * Math.cos(a), cy + v0 * Math.sin(a)).lineTo(cx + v1 * Math.cos(a), cy + v1 * Math.sin(a));
    }
    emit(back, mainW, "#fff"); emit(front, mainW, "#fff"); emit(veins, detailW);
    const disc = new PathBuilder(); circle(disc, cx, cy, rDisc); emit(disc, mainW, "#fff");
    const rim = new PathBuilder(); circle(rim, cx, cy, rDisc - 2.6); emit(rim, detailW);
    // Más complejidad ⇒ más flósculos, pero nunca de menos de ~3 mm de diámetro
    const c = Math.max(3.0, Math.min(5.0, rDisc / Math.sqrt(150 + cF * 200))); // flósculos más grandes
    const rho = c * 0.62;
    const fl = new PathBuilder();
    const turn = rng() * TAU;
    const pts = [];
    for (let n = 1; ; n++) {
      const r = c * Math.sqrt(n + 0.5);
      if (r + rho > rDisc - 3.4) break;
      const t = turn + n * GOLDEN_ANGLE;
      pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]);
      circle(fl, ...pts[pts.length - 1], rho);
    }
    emit(fl, mainW);
    return { spirals: visibleSpirals(pts) };
  },

  // Dendrita estelar: ramas a ±60° del brazo, paralelas a los brazos vecinos
  copo({ cx, cy, R, rng, mainW, detailW, emit }) {
    const ws = Math.max(2.8, R * 0.042);   // medio ancho del brazo
    const wb = Math.max(2.2, R * 0.030);   // medio ancho de las ramas
    const rc = R * 0.17;                   // placa central
    const rt = Math.max(4, R * 0.075);     // placa de la punta
    const tipD = R - rt;
    const nBr = 3 + Math.floor(rng() * 3);
    const d0 = rc * 1.3, d1 = tipD - rt * 1.3;
    const spacing = (d1 - d0) / nBr;
    const amp = 0.75 + rng() * 0.5;
    const jitter = Array.from({ length: nBr }, () => 0.8 + rng() * 0.4);
    const S60 = Math.sin(Math.PI / 3);
    // Ramas de un brazo: misma lista para los seis (el copo es el mismo en cada brazo)
    const branches = [];
    for (let j = 0; j < nBr; j++) {
      const d = d0 + spacing * (j + 0.5);
      const env = Math.pow(Math.sin(Math.PI * (j + 0.6) / (nBr + 0.2)), 0.8);
      let L = R * (0.14 + 0.3 * env * amp) * jitter[j];
      L = Math.min(L, d * 0.82 - 2 * wb);                                   // no choca con la rama del brazo vecino
      L = Math.min(L, -d / 2 + Math.sqrt((0.97 * R) ** 2 - 0.75 * d * d));  // no sale del radio
      if (L > wb * 3.2 && spacing * S60 > wb * 2.6) branches.push({ d, L });
    }
    // Barra hexagonal alargada con base en el origen y punta en x = len
    const bar = (pb, ox, oy, ang, len, hw) => {
      const c = Math.cos(ang), s = Math.sin(ang);
      const pts = [[0, -hw], [len - hw * 1.2, -hw], [len, 0], [len - hw * 1.2, hw], [0, hw]];
      polygon(pb, pts.map(([u, v]) => [ox + u * c - v * s, oy + u * s + v * c]));
    };
    const hex = (pb, x, y, r, rot = 0) => polygon(pb, Array.from({ length: 6 }, (_, i) => [x + r * Math.cos(rot + i * TAU / 6), y + r * Math.sin(rot + i * TAU / 6)]));

    const br = new PathBuilder(), shafts = new PathBuilder(), tips = new PathBuilder(), bars = new PathBuilder();
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + k * TAU / 6;
      const ux = Math.cos(a), uy = Math.sin(a);
      for (const { d, L } of branches) for (const sgn of [-1, 1]) bar(br, cx + d * ux, cy + d * uy, a + sgn * Math.PI / 3, L, wb);
      bar(shafts, cx, cy, a, tipD, ws);
      hex(tips, cx + tipD * ux, cy + tipD * uy, rt, a);
      // Travesaños en cada nudo: dividen el brazo en celdas coloreables
      for (const { d } of branches) {
        const px = -uy, py = ux;
        bars.moveTo(cx + d * ux + px * ws, cy + d * uy + py * ws).lineTo(cx + d * ux - px * ws, cy + d * uy - py * ws);
      }
    }
    emit(br, mainW, "#fff"); emit(shafts, mainW, "#fff"); emit(bars, detailW); emit(tips, mainW, "#fff");
    const tipIn = new PathBuilder();
    if (rt > 5.5) for (let k = 0; k < 6; k++) { const a = -Math.PI / 2 + k * TAU / 6; hex(tipIn, cx + tipD * Math.cos(a), cy + tipD * Math.sin(a), rt * 0.5, a); }
    emit(tipIn, detailW);
    // Placa central: hexágono con un anillo y seis celdas
    const plate = new PathBuilder(); hex(plate, cx, cy, rc, -Math.PI / 2); emit(plate, mainW, "#fff");
    const inner = new PathBuilder(); hex(inner, cx, cy, rc * 0.58, -Math.PI / 2 + Math.PI / 6);
    const spokes = new PathBuilder();
    for (let k = 0; k < 6; k++) {
      const a = -Math.PI / 2 + k * TAU / 6;
      // Del vértice del hexágono interior al de la placa
      const ai = a + Math.PI / 6, rIn = rc * 0.58;
      spokes.moveTo(cx + rIn * Math.cos(ai), cy + rIn * Math.sin(ai)).lineTo(cx + rc * Math.cos(ai), cy + rc * Math.sin(ai));
    }
    emit(inner, detailW); emit(spokes, detailW);
    const core = new PathBuilder(); hex(core, cx, cy, rc * 0.22, -Math.PI / 2); emit(core, detailW);
  },

  // Cinco brazos: bandas anidadas del mismo contorno, divididas por radios
  estrella({ cx, cy, R, rng, mainW, detailW, emit }) {
    const a = 0.41 + rng() * 0.05, k = 1.1 + rng() * 0.35;
    const rf = (th) => R * (a + (1 - a) * Math.pow((1 + Math.cos(5 * th)) / 2, k)); // th = 0: brazo hacia arriba
    const P = (r, th) => [cx + r * Math.sin(th), cy - r * Math.cos(th)];
    const outline = (pb, s) => {
      const n = 400;
      for (let i = 0; i <= n; i++) {
        const th = (i / n) * TAU, [x, y] = P(s * rf(th), th);
        if (i === 0) pb.moveTo(x, y); else if (i < n) pb.lineTo(x, y);
      }
      pb.close();
    };
    const scales = [1, 0.8, 0.62, 0.46, 0.32];
    const body = new PathBuilder(); outline(body, 1); emit(body, mainW, "#fff");
    const bands = new PathBuilder();
    for (const s of scales.slice(1)) outline(bands, s);
    emit(bands, detailW);
    // Radios: centro de cada brazo y punto medio entre brazos
    const rays = new PathBuilder();
    for (let j = 0; j < 10; j++) {
      const th = (j * Math.PI) / 5;
      rays.moveTo(...P(scales[scales.length - 1] * rf(th), th)).lineTo(...P(rf(th) * 0.995, th));
    }
    emit(rays, detailW);
    // Placas (osículos) en los nudos de cada brazo, más pequeñas hacia la punta
    const plates = new PathBuilder();
    const pr = Math.max(1.7, R * 0.024);
    for (let j = 0; j < 5; j++) {
      const th = (j * 2 * Math.PI) / 5, rArm = rf(th);
      for (const s of [0.46, 0.62, 0.8]) circle(plates, ...P(s * rArm, th), pr * (1.25 - s * 0.45));
      for (const s of [0.87, 0.93]) circle(plates, ...P(s * rArm, th), pr * 0.72);
    }
    emit(plates, mainW, "#fff");
    // Disco central con cinco pétalos
    const rIn = scales[scales.length - 1] * R * a;
    const flower = new PathBuilder();
    for (let j = 0; j < 5; j++) petal(flower, cx, cy, rIn * 0.25, scales[scales.length - 1] * R * 0.82, -Math.PI / 2 + (j * TAU) / 5, (TAU / 5) * 0.3);
    emit(flower, detailW, "#fff");
    const c0 = new PathBuilder(); circle(c0, cx, cy, rIn * 0.38); emit(c0, mainW, "#fff");
    // Placa madrepórica: fuera del centro, entre dos brazos (interradio)
    const thM = Math.PI / 5 + (rng() < 0.5 ? 0 : 2 * Math.PI / 5);
    const rM = rf(thM) * (0.46 + 0.62) / 2;
    const mr = Math.max(2.6, R * 0.034);
    const mad = new PathBuilder(); circle(mad, ...P(rM, thM), mr); emit(mad, mainW, "#fff");
    const madIn = new PathBuilder(); circle(madIn, ...P(rM, thM), mr * 0.5); emit(madIn, detailW);
  },

  // Diatomea céntrica: zona hialina, costillas radiales, filas de areolas y borde estriado
  diatomea({ cx, cy, R, rng, cF, mainW, detailW, emit }) {
    const rH = R * (0.12 + rng() * 0.04);
    const rimIn = R * 0.88;
    const outer = new PathBuilder(); circle(outer, cx, cy, R); emit(outer, mainW, "#fff");
    // Estrías del borde: celdas de ~3,5 mm
    const nr = Math.max(48, Math.round((TAU * R) / 3.6 / 8) * 8);
    const striae = new PathBuilder();
    for (let i = 0; i < nr; i++) {
      const t = (i * TAU) / nr;
      striae.moveTo(cx + rimIn * Math.cos(t), cy + rimIn * Math.sin(t)).lineTo(cx + R * Math.cos(t), cy + R * Math.sin(t));
    }
    emit(striae, detailW);
    const rim = new PathBuilder(); circle(rim, cx, cy, rimIn); emit(rim, mainW, "#fff");
    // Costillas y areolas
    const nRibs = [12, 16, 20, 24][Math.floor(rng() * 4)];
    const t = Math.max(3.4, Math.min(5.6, 5.6 - cF * 2.2));
    const rows = Math.max(3, Math.floor((rimIn - rH - 1.5) / t));
    const tt = (rimIn - rH - 1.5) / rows;
    const ribs = new PathBuilder();
    for (let i = 0; i < nRibs; i++) {
      const a = (i * TAU) / nRibs;
      ribs.moveTo(cx + rH * Math.cos(a), cy + rH * Math.sin(a)).lineTo(cx + rimIn * Math.cos(a), cy + rimIn * Math.sin(a));
    }
    const rings = new PathBuilder(), pores = new PathBuilder();
    const ringEvery = 2 + Math.floor(rng() * 2);
    for (let row = 0; row < rows; row++) {
      const r0 = rH + row * tt, rm = r0 + tt / 2;
      if (row > 0 && row % ringEvery === 0) circle(rings, cx, cy, r0);
      // Areolas por sector: múltiplo de las costillas, celda ~cuadrada
      let per = 1;
      while ((TAU * rm) / (nRibs * (per + 1)) >= tt * 0.95) per++;
      const n = nRibs * per, step = TAU / n;
      const rho = 0.34 * Math.min(tt, rm * step);
      if (Math.PI * rho * rho < 2.5) continue;
      for (let i = 0; i < n; i++) circle(pores, cx + rm * Math.cos((i + 0.5) * step), cy + rm * Math.sin((i + 0.5) * step), rho);
    }
    emit(ribs, detailW); emit(rings, detailW); emit(pores, mainW, "#fff");
    const hyal = new PathBuilder(); circle(hyal, cx, cy, rH); emit(hyal, mainW, "#fff");
    const hIn = new PathBuilder(); circle(hIn, cx, cy, rH * 0.45); emit(hIn, detailW);
  },
};
