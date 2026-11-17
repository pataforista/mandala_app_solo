// js/generators/styles/common.js
// Primitivas polares compartidas por el motor clásico y por las gramáticas de estilo.
// Todo dibuja sobre un PathBuilder en coordenadas polares (radio mm, ángulo rad) alrededor de (cx, cy).
// Extraído sin cambios de mandalaClassic.js: la prueba dorada (scripts/golden-styles.mjs) exige
// que ninguna página cambie.
import { flattenSubpaths } from "../../core/commercialMetrics.js";

export const TAU = Math.PI * 2;

// La silueta es lo que se reconoce al hojear: más peso en lotus, la forma más reconocible.
export const DEFAULT_SILHOUETTES = ["lotus", "lotus", "lotus", "scallop", "scallop", "ogee", "ogee"];
// Núcleos del medallón central. La espiral áurea queda fuera: una espiral nunca tiene simetría
// rotacional N, y el mandala la exige.
export const DEFAULT_CORES = ["flor_radiante", "flor_vida", "estrella_compuesta"];

/** Primitivas ligadas a un centro: P, M, C, L, circle, petalShape, heartShape, ogeeShape. */
export function polarKit(cx, cy) {
  const P = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const circle = (pb, x, y, rad) => {
    const n = rad > 30 ? 12 : 8;
    const k = (4 / 3) * Math.tan(Math.PI / (2 * n)) * rad;
    pb.moveTo(x + rad, y);
    for (let i = 0; i < n; i++) {
      const a0 = (i * TAU) / n, a1 = ((i + 1) * TAU) / n;
      pb.cubicTo(
        x + rad * Math.cos(a0) - k * Math.sin(a0), y + rad * Math.sin(a0) + k * Math.cos(a0),
        x + rad * Math.cos(a1) + k * Math.sin(a1), y + rad * Math.sin(a1) - k * Math.cos(a1),
        x + rad * Math.cos(a1), y + rad * Math.sin(a1));
    }
    pb.close();
  };
  const C = (pb, r1, a1, r2, a2, r3, a3) => { const [x1, y1] = P(r1, a1), [x2, y2] = P(r2, a2), [x3, y3] = P(r3, a3); pb.cubicTo(x1, y1, x2, y2, x3, y3); };
  const M = (pb, rr, a) => pb.moveTo(...P(rr, a));
  const L = (pb, rr, a) => pb.lineTo(...P(rr, a));

  const petalShape = (pb, r0, r1, a, w, belly = 1.05, round = false) => {
    const h = r1 - r0;
    M(pb, r0, a - w);
    if (round) {
      C(pb, r0 + h * 0.45, a - w * belly, r1, a - w * 0.85, r1, a);
      C(pb, r1, a + w * 0.85, r0 + h * 0.45, a + w * belly, r0, a + w);
    } else {
      C(pb, r0 + h * 0.45, a - w * belly, r0 + h * 0.85, a - w * 0.3, r1, a);
      C(pb, r0 + h * 0.85, a + w * 0.3, r0 + h * 0.45, a + w * belly, r0, a + w);
    }
    pb.close();
  };
  const heartShape = (pb, r0, r1, a, w) => {
    const h = r1 - r0;
    M(pb, r0 + h * 0.04, a);
    C(pb, r0 + h * 0.35, a - w * 0.95, r1 + h * 0.06, a - w * 1.0, r1 - h * 0.04, a - w * 0.4);
    C(pb, r1 - h * 0.1, a - w * 0.12, r1 - h * 0.22, a - w * 0.05, r1 - h * 0.2, a);
    C(pb, r1 - h * 0.22, a + w * 0.05, r1 - h * 0.1, a + w * 0.12, r1 - h * 0.04, a + w * 0.4);
    C(pb, r1 + h * 0.06, a + w * 1.0, r0 + h * 0.35, a + w * 0.95, r0 + h * 0.04, a);
    pb.close();
  };
  const ogeeShape = (pb, r0, r1, a, w) => {
    const h = r1 - r0;
    M(pb, r0, a - w * 0.8);
    C(pb, r0 + h * 0.2, a - w * 1.15, r0 + h * 0.5, a - w * 1.05, r0 + h * 0.62, a - w * 0.55);
    C(pb, r0 + h * 0.75, a - w * 0.2, r1 - h * 0.12, a - w * 0.08, r1, a);
    C(pb, r1 - h * 0.12, a + w * 0.08, r0 + h * 0.75, a + w * 0.2, r0 + h * 0.62, a + w * 0.55);
    C(pb, r0 + h * 0.5, a + w * 1.05, r0 + h * 0.2, a + w * 1.15, r0, a + w * 0.8);
    pb.close();
  };
  return { P, circle, C, M, L, petalShape, heartShape, ogeeShape };
}

// ---------- Cintas entrelazadas ----------
// Una cinta es una franja de ancho fijo dibujada con sus dos bordes. Donde dos cintas se
// cruzan, la que pasa por debajo interrumpe sus bordes justo en los bordes de la otra: así
// cada tramo de cinta queda como una celda cerrada que se puede colorear.

/** Recorre t0…t1 y emite en `pb` los tramos donde visible(t) es cierto, con el corte afinado por bisección. */
function visibleRuns(pb, t0, t1, steps, pointAt, visible) {
  const cut = (a, b) => { // a visible, b oculto (o al revés): frontera
    const va = visible(a);
    for (let i = 0; i < 14; i++) { const m = (a + b) / 2; if (visible(m) === va) a = m; else b = m; }
    return va ? a : b;
  };
  let prevT = t0, prevV = visible(t0);
  if (prevV) pb.moveTo(...pointAt(t0));
  for (let i = 1; i <= steps; i++) {
    const t = t0 + ((t1 - t0) * i) / steps, v = visible(t);
    if (v && prevV) pb.lineTo(...pointAt(t));
    else if (v && !prevV) { pb.moveTo(...pointAt(cut(prevT, t))); pb.lineTo(...pointAt(t)); }
    else if (!v && prevV) pb.lineTo(...pointAt(cut(prevT, t)));
    prevT = t; prevV = v;
  }
}

/**
 * Trenza de dos cabos alrededor del centro: dos cintas que ondulan en contrafase sobre el
 * radio `rm` y se cruzan dos veces por periodo, alternando arriba y abajo.
 *   amp: amplitud de la línea central (mm) · w: ancho de cinta (mm) · periods: ondas por vuelta
 *   shape: "sin" (curva, celta) | "tri" (zigzag de rectas, lacería islámica)
 */
export function braid(pb, P, { rm, amp, w, periods, off = 0, shape = "sin" }) {
  const K = 0.96, AK = Math.asin(K);
  const f = shape === "tri" ? (p) => Math.asin(K * Math.cos(p)) / AK : (p) => Math.cos(p);
  const df = shape === "tri" ? (p) => (-K * Math.sin(p) / Math.sqrt(1 - (K * Math.cos(p)) ** 2)) / AK : (p) => -Math.sin(p);
  const k = periods / rm; // dφ/du: la fase avanza `periods` vueltas en un perímetro
  for (const strand of [1, -1]) for (const side of [1, -1]) {
    // Punto del borde `side` del cabo `strand` en la fase p, en coordenadas de banda (u, v)
    const edge = (p) => {
      const s = strand * amp * df(p) * k, n = Math.hypot(1, s);
      return { u: p / k - (side * (w / 2) * s) / n, v: strand * amp * f(p) + (side * (w / 2)) / n };
    };
    const pointAt = (p) => { const e = edge(p); return P(rm + e.v, off + e.u / rm); };
    const visible = (p) => {
      const e = edge(p), q = e.u * k;                       // fase del otro cabo bajo este punto
      const cross = Math.round((q - Math.PI / 2) / Math.PI); // cruce más cercano
      const over = (((cross % 2) + 2) % 2 === 0) === (strand === 1);
      if (over) return true;
      const so = -strand * amp * df(q) * k;
      return Math.abs(e.v + strand * amp * f(q)) / Math.hypot(1, so) >= w / 2;
    };
    visibleRuns(pb, 0, 2 * Math.PI * periods, periods * 64, pointAt, visible);
  }
}

/**
 * Cadena de eslabones: `count` anillos de cinta con centro sobre el radio `rc`, cada uno
 * enlazado con sus dos vecinos (pasa por encima en el cruce exterior y por debajo en el interior).
 *   rho: radio de la línea central del anillo · w: ancho de cinta
 */
export function ringChain(pb, P, { cx, cy, rc, count, rho, w, off = 0 }) {
  const step = (2 * Math.PI) / count;
  const center = (i) => P(rc, off + i * step);
  for (let i = 0; i < count; i++) {
    const [x0, y0] = center(i), prev = center(i - 1), next = center(i + 1);
    for (const side of [1, -1]) {
      const r = rho + (side * w) / 2;
      const pointAt = (t) => [x0 + r * Math.cos(t), y0 + r * Math.sin(t)];
      const inRing = (p, c) => Math.abs(Math.hypot(p[0] - c[0], p[1] - c[1]) - rho) < w / 2;
      const visible = (t) => {
        const p = pointAt(t), outer = Math.hypot(p[0] - cx, p[1] - cy) > rc;
        // Con el siguiente: este anillo pasa por encima fuera y por debajo dentro; con el anterior, al revés
        if (inRing(p, next) && !outer) return false;
        if (inRing(p, prev) && outer) return false;
        return true;
      };
      // Empieza mirando al centro del mandala desplazado un cuarto de vuelta: lejos de los cruces
      const t0 = off + i * step + Math.PI;
      visibleRuns(pb, t0, t0 + 2 * Math.PI, 96, pointAt, visible);
    }
  }
}

// ---------- Polígonos en coordenadas de celda ----------
/** Polígono en coordenadas de celda: u (0…1 a lo ancho del paso) y v (0…1 del radio interior al
 *  exterior). Los tramos de radio constante siguen el arco, no la cuerda.
 *  open: no traza el lado de cierre. Se usa cuando la base descansa sobre un aro: cerrada, su
 *  cuerda recta dejaría una astilla contra el arco. */
export function cellPoly(ctx, pb, b, a0, pts, open = false) {
  const step = ctx.TAU / b.n, h = b.r1 - b.r0;
  const at = (u, v) => ctx.P(b.r0 + v * h, a0 + u * step);
  pts.forEach(([u, v], i) => {
    if (!i) return pb.moveTo(...at(u, v));
    const [pu, pv] = pts[i - 1];
    // Mismo radio: se subdivide el arco para que no quede una cuerda recta
    const n = pv === v ? Math.max(1, Math.ceil(Math.abs(u - pu) * step / 0.07)) : 1;
    for (let k = 1; k <= n; k++) pb.lineTo(...at(pu + ((u - pu) * k) / n, v));
  });
  if (!open) pb.close();
}

// ---------- Ecos: contornos interiores de las celdas grandes ----------
// Los mandalas de libro intrincado no dejan una celda grande vacía: cada pétalo o escama lleva
// dentro uno o dos contornos concéntricos, como una ondulación. Medido sobre cuatro referencias
// (disco normalizado a 600 px): las celdas mayores del 0,4 % del disco ocupan entre 0 y 19 % de
// la superficie; las de mis páginas de nivel experto, entre 18 y 31 %.
function hullArea(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (list) => { const h = []; for (const q of list) { while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop(); h.push(q); } return h; };
  const lo = half(p), up = half(p.slice().reverse());
  const hull = lo.slice(0, -1).concat(up.slice(0, -1));
  let a = 0; for (let i = 0; i < hull.length; i++) { const [x, y] = hull[i], [u, v] = hull[(i + 1) % hull.length]; a += x * v - u * y; }
  return Math.abs(a) / 2;
}

/**
 * Contornos interiores («ecos») de las formas cerradas de un trazo SVG (atributo d, con el
 * formato de PathBuilder). Cada forma cerrada y casi convexa se copia escalada hacia su centro
 * si el hueco entre un contorno y el siguiente se puede colorear (`minGap` mm) y la copia más
 * pequeña conserva `minCell` mm² de área. Se omiten las formas cuyo centro cae junto al centro
 * del mandala (anillos que lo rodean). Devuelve el atributo d de los ecos, o "" si no hay.
 *   scales: factores de escala de fuera adentro, p. ej. [0.66, 0.36]
 */
export function echoPaths(d, { scales, minGap = 1.6, minArea = 20, minCell = 6.5, centre = null, keepOut = 0 }) {
  const out = [];
  for (const sub of d.split(/(?=M )/)) {
    if (!/ Z\s*$/.test(sub.trim())) continue;                    // sólo formas cerradas
    const flat = flattenSubpaths(sub)[0];
    if (!flat || flat.pts.length < 4) continue;
    const pts = flat.pts, n = pts.length;
    let A = 0, P = 0, gx = 0, gy = 0;
    for (let i = 0; i < n; i++) {
      const [x, y] = pts[i], [u, v] = pts[(i + 1) % n], k = x * v - u * y;
      A += k; gx += (x + u) * k; gy += (y + v) * k; P += Math.hypot(u - x, v - y);
    }
    A = Math.abs(A) / 2;
    if (A < minArea || A / hullArea(pts) < 0.9) continue;       // pequeña o cóncava: el eco se saldría
    const sg = Math.sign((pts.reduce((s2, [x, y], i) => s2 + (x * pts[(i + 1) % n][1] - pts[(i + 1) % n][0] * y), 0)) || 1);
    const cx = gx / (6 * A * sg), cy = gy / (6 * A * sg);
    if (centre && Math.hypot(cx - centre[0], cy - centre[1]) < keepOut) continue;
    const r = (2 * A) / P;                                       // radio inscrito aproximado
    let prev = 1;
    for (const k of scales) {
      if ((prev - k) * r < minGap || k * k * A < minCell) break;
      const tok = sub.trim().split(/\s+/), res = [];
      for (let i = 0; i < tok.length; i++) {
        if (/^[MLCQZ]$/.test(tok[i])) { res.push(tok[i]); continue; }
        const x = parseFloat(tok[i]), y = parseFloat(tok[++i]);
        res.push((cx + (x - cx) * k).toFixed(2), (cy + (y - cy) * k).toFixed(2));
      }
      out.push(res.join(" "));
      prev = k;
    }
  }
  return out.join(" ");
}
