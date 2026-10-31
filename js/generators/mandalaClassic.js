// js/generators/mandalaClassic.js
// Motor "Clásico": la gramática de los mandalas que se venden en libros para colorear.
//  - Bandas concéntricas; cada banda se llena por completo con UN motivo repetido.
//  - Conteos armónicos del número base de pétalos (N/2, N, 2N, 3N, 4N): simetría exacta.
//  - Pintor de afuera hacia adentro con relleno blanco: los pétalos de cada banda nacen
//    "detrás" de la banda interior y las capas se ocultan entre sí, sin cruces de línea.
//  - Celdas cerradas de tamaño coloreable; los detalles finos respetan minCellArea.
//  - Tres niveles de trazo: contorno (grueso), detalle (medio), vestido (fino: nervios, punteados).
//  - Detalle "premium": stippling, nervaduras-cápsula, pétalo-dentro-pétalo, doble contorno en siluetas.
import { mulberry32 } from "../core/prng.js";
import { PathBuilder, coloringCullArea, coloringMinCell } from "../core/pathBuilder.js";
import { wantsComposition, composePage } from "./pageComposer.js";
import { drawMedallionWeb } from "./figureFill.js";
import { fitBandCount } from "../core/bandMetrics.js";

const TAU = Math.PI * 2;
const MIN_LINE_MM = 0.55; // por debajo, la imprenta lo reproduce gris o lo pierde

// Pesos de motivos por estilo: el estilo cambia el "acento" sin romper la gramática
// Nuevos motivos: voluta, antemia, roseta, flame — se integran con pesos bajos para no dominar
const STYLE_WEIGHTS = {
  floral:    { petal: 3, round: 3, lotus: 3, leaf: 3, scallop: 2, heart: 2, beads: 1, triangle: 0.5, diamond: 0.5, ogee: 1, chevron: 0.3, roseta: 1.5, flame: 0.8, voluta: 0.6, antemia: 0.5 },
  geometric: { petal: 2, round: 0.5, lotus: 1, leaf: 0.5, scallop: 1, heart: 0.3, beads: 2, triangle: 3, diamond: 3, ogee: 1, chevron: 2, roseta: 0.8, flame: 0.3, voluta: 0.4, antemia: 2 },
  islamico:  { petal: 2, round: 1, lotus: 2, leaf: 1, scallop: 2, heart: 0.5, beads: 1.5, triangle: 1, diamond: 2, ogee: 3, chevron: 1, roseta: 1.5, flame: 0.5, voluta: 1, antemia: 2.5 },
  sashiko:   { petal: 2, round: 2, lotus: 2, leaf: 1, scallop: 3, heart: 1, beads: 2, triangle: 1, diamond: 1.5, ogee: 1, chevron: 1, roseta: 1, flame: 0.5, voluta: 0.8, antemia: 0.6 },
  azteca:    { petal: 2, round: 0.5, lotus: 1, leaf: 0.5, scallop: 1, heart: 0.5, beads: 1.5, triangle: 3, diamond: 2, ogee: 1, chevron: 3, roseta: 0.6, flame: 2, voluta: 0.3, antemia: 2.5 },
  yantra:    { petal: 3, round: 1, lotus: 3, leaf: 1, scallop: 1, heart: 0.5, beads: 1.5, triangle: 2.5, diamond: 1.5, ogee: 1.5, chevron: 1, roseta: 2, flame: 1, voluta: 0.8, antemia: 1 },
  celtico:   { petal: 1.5, round: 2, lotus: 2, leaf: 2, scallop: 2.5, heart: 2, beads: 1.5, triangle: 0.5, diamond: 1, ogee: 2, chevron: 0.5, roseta: 1.2, flame: 0.8, voluta: 1.5, antemia: 0.5 },
};

// Proporción ancho-de-celda / alto-de-banda que mejor luce cada motivo
const ASPECT = { petal: 0.75, round: 0.85, lotus: 0.8, leaf: 0.6, scallop: 1.5, heart: 1.0, beads: 1.0, triangle: 0.9, diamond: 1.2, ogee: 0.8, chevron: 1.4, voluta: 0.7, antemia: 0.9, roseta: 1.0, flame: 0.65 };
// La silueta es lo que se reconoce al hojear: más peso en lotus, la forma más reconocible
const SILHOUETTE = ["lotus", "lotus", "lotus", "scallop", "scallop", "ogee", "ogee"];

const MOTIFS_OK = (m) => Object.prototype.hasOwnProperty.call(ASPECT, m);

// Perfiles de estructura: cuánto pesa cada parte del disco.
export const STRUCTURES = {
  corona:     { sil: 2.4, hero: 1.6, core: null },
  equilibrio: { sil: 1.35, hero: 1.15, core: null },
  nucleo:     { sil: 1.7, hero: 1.0, core: 0.3, dropBand: true },
  heroe:      { sil: 1.2, hero: 2.8, core: null },
  aurea:      { sil: 1.618, hero: 1.0, core: null, golden: true }, // proporción áurea
  doble:      { sil: 1.8, hero: 1.4, core: 0.25, doubleRing: true }, // anillo doble decorado
};

// ---------- Variantes de núcleo ----------
// Cuatro formas de dibujar el medallón central. Cada una con su propio radio mínimo
// para que quepa. El sorteo usa el RNG de la página para no alterar la secuencia.
const CORE_VARIANTS = ["flor_radiante", "flor_vida", "espiral_aurea", "estrella_compuesta"];

export function generateMandalaClassic(doc, opts) {
  if (wantsComposition(opts)) return composePage(doc, opts, generateMandalaClassic);
  const {
    seed = 1,
    petals = 12,
    stroke = "#000",
    strokeWidthMm = 0.55,
    complexity = 130,
    styleMode = "floral",
    includeFrames = true,
    pageBorder = true,
    textures = true,
    outlineMode = false,
    detailSimplification = 0.5,
    spacing = 0.3,
  } = opts;

  const page = doc?.page ?? { wMm: 210, hMm: 297, marginMm: 10 };
  const marginMm = Number.isFinite(page.marginMm) ? page.marginMm : 10;
  const cx = opts.center?.x ?? opts.centerMm?.x ?? page.wMm / 2;
  const cy = opts.center?.y ?? opts.centerMm?.y ?? page.hMm / 2;
  const R = opts.radius ?? opts.radiusMm ?? (Math.min(page.wMm, page.hMm) / 2 - marginMm - (pageBorder ? 6 : 2));

  const rng = mulberry32(seed >>> 0);
  const N = Math.max(4, Math.min(32, Math.round(petals)));
  const cF = Math.max(0, Math.min(1, (complexity - 20) / 300));
  const detail = !outlineMode && detailSimplification < 0.85;
  const richDetail = detail && cF > 0.35 && detailSimplification < 0.6;

  // Tres niveles de trazo más marcados: el contorno destaca, el detalle es sutil, el vestido es fino
  const mainW = Math.max(0.8, strokeWidthMm);
  const detailW = Math.max(MIN_LINE_MM, strokeWidthMm * 0.55);
  const vestW = Math.max(0.5, strokeWidthMm * 0.45);
  // Jerarquía de trazo por nivel: bandas exteriores más gruesas, interiores más finas.
  // Esto da profundidad y guía el ojo hacia el centro. El factor varía de 0.9 (interior) a 1.15 (exterior).
  // Se respetan los mínimos para no caer en "trazos finos" (< 0.5 mm) que se pierden al imprimir.
  const bandScale = (b) => 0.9 + 0.25 * (b.k / Math.max(1, B - 1));
  const mainWFor = (b) => Math.max(0.8, mainW * bandScale(b));
  const detailWFor = (b) => Math.max(MIN_LINE_MM, detailW * bandScale(b));
  const vestWFor = (b) => Math.max(0.5, vestW * bandScale(b));
  const cull = coloringCullArea(opts);
  // Los detalles interiores (pétalo dentro de pétalo, brillos, nervios cerrados) respetan la
  // celda mínima del nivel: antes sólo se aplicaba una fracción (1 mm² con «Adulto», que
  // promete 5 mm²) y quedaban celdas que no se pueden colorear con lápiz
  const minCell = Math.max(cull, coloringMinCell(opts), 2.5 * (R / 90) ** 2, 2);

  const P = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const out = [];
  const emit = (pb, w, fill = "none") => {
    const p = pb.toPath({ stroke, strokeWidthMm: w, fill });
    if (p) out.push(p);
  };
  const mainPB = () => new PathBuilder();
  const detailPB = () => new PathBuilder({ minClosedArea: minCell });

  // ---------- Reparto de bandas ----------
  const art = opts.centerArt && opts.centerArt.href ? opts.centerArt : null;
  const artFrac = art ? Math.max(0.25, Math.min(0.6, art.scale ?? 0.42)) : 0;
  let B = outlineMode ? 3 + Math.round(cF * 1.5 + rng() * 0.6) : 4 + Math.round(cF * 2.5 + rng() * 0.8);
  const ST = STRUCTURES[opts.structure] || STRUCTURES.corona;
  if (art) B = Math.max(3, B - Math.round(artFrac * 6));
  else if (ST.dropBand && !opts.minBands) B = Math.max(3, B - 1);
  if (opts.minBands) B = Math.max(B, opts.minBands);
  if (opts.maxBands) B = Math.max(2, Math.min(B, opts.maxBands));
  const rCoreBase = art ? R * artFrac : Math.max(R * (0.14 + rng() * 0.04), Math.min(R * 0.32, 5.5));
  const rCore = !art && ST.core ? Math.max(rCoreBase, R * ST.core) : rCoreBase;
  
  // Reparto de bandas: proporción áurea o estándar
  const phi = 1.618033988749895;
  const weights = Array.from({ length: B }, (_, k) => {
    let w;
    if (ST.golden) {
      // Crecimiento áureo suavizado: cada banda es √φ ≈ 1,27× la anterior. Con φ entero
      // (1,618×) la banda más interna de un disco de 6 bandas quedaba en un 4 % del radio:
      // celdas de 2–3 mm imposibles de colorear (media 58 frente a 68 del resto)
      w = Math.pow(phi, (k - B + 1) / 2);
    } else {
      w = 0.7 + rng() * 0.5;
      if (k === B - 1) w *= ST.sil;
      if (k === B - 2) w *= ST.hero;
      if (k === 0) w *= 0.8;
    }
    return w;
  });
  const beadSlots = new Set();
  for (let k = 1; k < B - 2; k++) if (!beadSlots.has(k - 1) && rng() < 0.22 + spacing * 0.2) { beadSlots.add(k); weights[k] *= 0.5; }
  const wSum = weights.reduce((a, b) => a + b, 0);
  const bands = [];
  let r = rCore;
  for (let k = 0; k < B; k++) {
    const h = (R - rCore) * weights[k] / wSum;
    bands.push({ r0: r, r1: r + h, k });
    r += h;
  }

  // ---------- Elección de motivos ----------
  const W = STYLE_WEIGHTS[styleMode] || STYLE_WEIGHTS.floral;
  const pickMotif = (exclude) => {
    // voluta, roseta, antemia excluidos: sus formas tienen simetría local que no
    // coincide con la simetría radial del mandala (espirales, pétalos locales)
    const keys = Object.keys(W).filter(m => m !== exclude && m !== "beads"
      && m !== "voluta" && m !== "roseta" && m !== "antemia"
      && !(outlineMode && (m === "chevron" || m === "flame")));
    let t = rng() * keys.reduce((s, m) => s + W[m], 0);
    for (const m of keys) { t -= W[m]; if (t <= 0) return m; }
    return keys[0];
  };
  const harmonics = (outlineMode ? [0.5, 1, 2] : [0.5, 1, 2, 3, 4, 6]).map(f => N * f).filter(n => Number.isInteger(n) && n >= 4 && n <= 128);
  let prev = null;
  for (const b of bands) {
    const h = b.r1 - b.r0, rm = (b.r0 + b.r1) / 2;
    if (b.k === B - 1) {
      const drawn = SILHOUETTE[Math.floor(rng() * SILHOUETTE.length)];
      b.motif = opts.silhouette && MOTIFS_OK(opts.silhouette) ? opts.silhouette : drawn;
    }
    // Cuentas sólo en bandas de 5 mm o más: en una más estrecha cada cuenta quedaba por
    // debajo de 6 mm² y pegada a los anillos (26 % de las celdas de cuentas eran diminutas)
    else if (beadSlots.has(b.k) && h >= 5) b.motif = "beads";
    else b.motif = pickMotif(prev);
    prev = b.motif;
    const minArc = Math.max(4.5 * (R / 90), 3.2);
    const ok = harmonics.filter(n => TAU * rm / n >= minArc);
    const pool = ok.length ? ok : [harmonics[0]];
    b.n = fitBandCount({ r0: b.r0, r1: b.r1, candidates: pool, aspect: ASPECT[b.motif], minArea: minCell });
    b.off = -Math.PI / 2 + ((b.k % 2) ? Math.PI / b.n : 0);
  }

  // ---------- Primitivas ----------
  // Círculo con 8 arcos Bézier (error < 0.001%): para círculos grandes (>30mm) usamos 12
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

  // ---------- Detalle premium: helpers ----------
  // Stippling: puntos a lo largo de una línea radial (como un "camino de hormigas")
  // Solo se activa cuando la banda es lo bastante grande para que los puntos sean coloreables
  const stipple = (pb, rStart, rEnd, a, count, dotRad) => {
    if (!textures || !richDetail) return;
    if (rEnd - rStart < 6) return; // banda demasiado estrecha para punteado
    for (let i = 1; i <= count; i++) {
      const t = i / (count + 1);
      const rr = rStart + (rEnd - rStart) * t;
      const [x, y] = P(rr, a);
      // Umbral alto: los puntos deben ser claramente coloreables (≥ 2× minCell)
      if (Math.PI * dotRad * dotRad >= minCell * 2) circle(pb, x, y, dotRad);
    }
  };
  // Nervadura-cápsula: línea cerrada muy estrecha (como una lente) que se puede colorear
  // Solo se activa con texturas (es un detalle "premium")
  const capsuleVein = (pb, rStart, rEnd, a, width) => {
    if (!textures) return;
    const h = rEnd - rStart;
    if (h < 3 || width < 0.2) return;
    // Verificar que el área de la cápsula sea suficiente para colorear
    const approxArea = h * width * 2;
    if (approxArea < minCell * 1.5) return;
    const [x0, y0] = P(rStart, a);
    const [x1, y1] = P(rEnd, a);
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 1.5) return;
    const nx = -dy / len * width, ny = dx / len * width;
    const [mx, my] = [(x0 + x1) / 2, (y0 + y1) / 2];
    pb.moveTo(x0, y0).quadTo(mx + nx, my + ny, x1, y1).quadTo(mx - nx, my - ny, x0, y0).close();
  };
  // Pétalo interior (pétalo-dentro-pétalo): un pétalo más pequeño dentro del principal
  const innerPetal = (pb, r0, r1, a, w, belly = 1.05, round = false) => {
    petalShape(pb, r0, r1, a, w, belly, round);
  };

  // Pétalo puntiagudo simétrico: base en r0 (±w), punta en r1
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
  const fitW = (step, frac) => (step / 2) * frac;

  // Punto decorativo entre pétalos
  const gapDots = (pb, b, rr, frac = 0.55) => {
    if (!textures || !detail || b.k === B - 1) return;
    const step = TAU / b.n;
    const rad = Math.min((b.r1 - b.r0) * 0.11, rr * step * 0.5 * (1 - frac) * 0.8);
    if (Math.PI * rad * rad < minCell * 1.2) return;
    for (let i = 0; i < b.n; i++) circle(pb, ...P(rr, b.off + (i + 0.5) * step), rad);
  };

  // ---------- Motivos (dibujan la banda completa) ----------
  const MOTIFS = {
    petal(b) {
      const step = TAU / b.n, h = b.r1 - b.r0, w = fitW(step, 0.96);
      const m = mainPB(), d = detailPB(), v = detailPB();
      for (let i = 0; i < b.n; i++) {
        const a = b.off + i * step;
        petalShape(m, b.r0 - h * 0.06, b.r1, a, w);
        if (detail) {
          innerPetal(d, b.r0 + h * 0.18, b.r1 - h * 0.2, a, w * 0.52);
          if (textures) {
            capsuleVein(v, b.r0 + h * 0.28, b.r1 - h * 0.36, a, w * 0.1);
            stipple(v, b.r0 + h * 0.25, b.r1 - h * 0.3, a - w * 0.3, 3, Math.min(h * 0.04, 0.7));
            stipple(v, b.r0 + h * 0.25, b.r1 - h * 0.3, a + w * 0.3, 3, Math.min(h * 0.04, 0.7));
          }
        }
      }
      emit(m, mainWFor(b), "#fff"); gapDots(d, b, b.r1 - h * 0.22); emit(d, detailWFor(b)); emit(v, vestWFor(b));
    },
    round(b) {
      const step = TAU / b.n, h = b.r1 - b.r0, w = fitW(step, 0.94);
      const m = mainPB(), d = detailPB(), v = detailPB();
      for (let i = 0; i < b.n; i++) {
        const a = b.off + i * step;
        petalShape(m, b.r0 - h * 0.06, b.r1, a, w, 1.1, true);
        if (detail) {
          petalShape(d, b.r0 + h * 0.16, b.r1 - h * 0.2, a, w * 0.55, 1.1, true);
          if (textures) {
            stipple(v, b.r0 + h * 0.25, b.r1 - h * 0.3, a, 2, Math.min(h * 0.05, 0.8));
            capsuleVein(v, b.r0 + h * 0.3, b.r1 - h * 0.35, a - w * 0.2, w * 0.07);
            capsuleVein(v, b.r0 + h * 0.3, b.r1 - h * 0.35, a + w * 0.2, w * 0.07);
          }
        }
      }
      emit(m, mainWFor(b), "#fff"); gapDots(d, b, b.r1 - h * 0.2); emit(d, detailWFor(b)); emit(v, vestWFor(b));
    },
    lotus(b) {
      const step = TAU / b.n, h = b.r1 - b.r0, w = fitW(step, 0.98);
      const back = mainPB(), front = mainPB(), d = detailPB(), v = detailPB();
      for (let i = 0; i < b.n; i++) {
        const a = b.off + i * step;
        petalShape(back, b.r0 - h * 0.06, b.r1, a + step / 2, w);
        petalShape(front, b.r0 - h * 0.06, b.r1 - h * 0.22, a, w * 1.02);
        if (detail) {
          petalShape(d, b.r0 + h * 0.14, b.r1 - h * 0.42, a, w * 0.5);
          if (textures) {
            capsuleVein(v, b.r0 + h * 0.2, b.r1 - h * 0.35, a, w * 0.08);
            stipple(v, b.r0 + h * 0.22, b.r1 - h * 0.32, a, 3, Math.min(h * 0.035, 0.6));
          }
        }
      }
      emit(back, mainWFor(b), "#fff"); emit(front, mainWFor(b), "#fff"); emit(d, detailWFor(b)); emit(v, vestWFor(b));
    },
    leaf(b) {
      const step = TAU / b.n, h = b.r1 - b.r0, w = fitW(step, 0.8);
      const m = mainPB(), d = detailPB(), v = detailPB();
      for (let i = 0; i < b.n; i++) {
        const a = b.off + i * step;
        petalShape(m, b.r0 + h * 0.04, b.r1 - h * 0.02, a, w, 1.25);
        if (detail) {
          // Nervio central como cápsula (más grueso, siempre visible)
          capsuleVein(d, b.r0 + h * 0.12, b.r1 - h * 0.12, a, w * 0.12);
          if (textures) {
            const veins = richDetail ? 4 : 3;
            for (let vi = 1; vi <= veins; vi++) {
              const t = vi / (veins + 1), rr = b.r0 + h * (0.15 + t * 0.55);
              for (const s of [-1, 1]) {
                capsuleVein(v, rr, rr + h * 0.12, a + s * w * 0.45 * (1 - t * 0.4), w * 0.06);
              }
            }
            stipple(v, b.r0 + h * 0.2, b.r1 - h * 0.25, a, 2, Math.min(h * 0.03, 0.5));
          }
        }
      }
      emit(m, mainWFor(b), "#fff"); gapDots(d, b, (b.r0 + b.r1) / 2, 0.8); emit(d, detailWFor(b)); emit(v, vestWFor(b));
    },
    scallop(b) {
      const step = TAU / b.n, h = b.r1 - b.r0;
      const m = mainPB(), d = detailPB(), v = detailPB();
      const bump = (pb, rIn, rOut, a, half) => {
        M(pb, rIn, a - half);
        C(pb, rOut, a - half, rOut, a - half * 0.4, rOut, a);
        C(pb, rOut, a + half * 0.4, rOut, a + half, rIn, a + half);
      };
      for (let i = 0; i < b.n; i++) bump(m, b.r0 + h * 0.15, b.r1, b.off + i * step, step / 2);
      // Como silueta exterior cada lóbulo es grande: un solo contorno interior lo deja pobre.
      // Arcos concéntricos + pétalo central (estilo abanico), sin puntos que parezcan remaches.
      const nested = detail && b.k === B - 1 && h * 0.14 >= 2.5;
      if (nested) {
        // Los arcos nacen del anillo (no de una cuerda recta): se leen como abanico, no como letras «D»
        const ring = b.r0 + h * 0.15;
        for (let i = 0; i < b.n; i++) {
          const a = b.off + i * step;
          bump(d, ring, b.r1 - h * 0.15, a, step * 0.4);
          bump(d, ring, b.r1 - h * 0.37, a, step * 0.27);
          petalShape(d, ring, b.r1 - h * 0.55, a, step * 0.12, 1.15, true);
        }
      } else if (detail) {
        for (let i = 0; i < b.n; i++) { bump(d, b.r0 + h * 0.18, b.r1 - h * 0.3, b.off + i * step, step * 0.36); d.close(); }
        if (textures && richDetail) {
          for (let i = 0; i < b.n; i++) {
            const rad = Math.min(h * 0.06, (b.r0 + h * 0.35) * step * 0.08);
            if (rad > 0.7) circle(v, ...P(b.r0 + h * 0.35, b.off + (i + 0.5) * step), rad);
          }
          for (let i = 0; i < b.n; i++) {
            const rad = Math.min(h * 0.04, (b.r0 + h * 0.4) * step * 0.06);
            if (rad > 0.5) circle(v, ...P(b.r0 + h * 0.42, b.off + i * step), rad);
          }
        }
      }
      const disc = mainPB(); circle(disc, cx, cy, b.r0 + h * 0.15);
      emit(m, mainWFor(b), "#fff"); emit(disc, mainWFor(b), "#fff"); emit(d, detailWFor(b)); emit(v, vestWFor(b));
    },
    heart(b) {
      const step = TAU / b.n, h = b.r1 - b.r0, w = fitW(step, 0.92);
      const m = mainPB(), d = detailPB(), v = detailPB();
      for (let i = 0; i < b.n; i++) {
        const a = b.off + i * step;
        heartShape(m, b.r0, b.r1, a, w);
        if (detail) {
          heartShape(d, b.r0 + h * 0.2, b.r1 - h * 0.15, a, w * 0.5);
          if (textures) {
            capsuleVein(v, b.r0 + h * 0.25, b.r1 - h * 0.3, a - w * 0.25, w * 0.06);
            capsuleVein(v, b.r0 + h * 0.25, b.r1 - h * 0.3, a + w * 0.25, w * 0.06);
            capsuleVein(v, b.r0 + h * 0.22, b.r1 - h * 0.25, a, w * 0.07);
            stipple(v, b.r0 + h * 0.3, b.r1 - h * 0.2, a - w * 0.35, 2, Math.min(h * 0.03, 0.5));
            stipple(v, b.r0 + h * 0.3, b.r1 - h * 0.2, a + w * 0.35, 2, Math.min(h * 0.03, 0.5));
          }
        }
      }
      emit(m, mainWFor(b), "#fff"); emit(d, detailWFor(b)); emit(v, vestWFor(b));
    },
    ogee(b) {
      const step = TAU / b.n, h = b.r1 - b.r0, w = fitW(step, 0.95);
      const m = mainPB(), d = detailPB(), v = detailPB();
      for (let i = 0; i < b.n; i++) {
        const a = b.off + i * step;
        ogeeShape(m, b.r0 - h * 0.05, b.r1, a, w);
        if (detail) {
          ogeeShape(d, b.r0 + h * 0.12, b.r1 - h * 0.18, a, w * 0.55);
          if (textures) {
            ogeeShape(v, b.r0 + h * 0.22, b.r1 - h * 0.32, a, w * 0.3);
            stipple(v, b.r0 + h * 0.15, b.r1 - h * 0.2, a, 2, Math.min(h * 0.035, 0.6));
          }
        }
      }
      emit(m, mainWFor(b), "#fff"); gapDots(d, b, b.r1 - h * 0.25); emit(d, detailWFor(b)); emit(v, vestWFor(b));
    },
    triangle(b) {
      const step = TAU / b.n, h = b.r1 - b.r0;
      const m = mainPB(), d = detailPB(), v = detailPB();
      M(m, b.r0, b.off - step / 2);
      for (let i = 0; i < b.n; i++) { const a = b.off + i * step; L(m, b.r1, a); L(m, b.r0, a + step / 2); }
      m.close();
      if (detail) for (let i = 0; i < b.n; i++) {
        const a = b.off + i * step;
        M(d, b.r0 + h * 0.18, a - step * 0.28); L(d, b.r1 - h * 0.3, a); L(d, b.r0 + h * 0.18, a + step * 0.28); d.close();
        if (textures && richDetail) {
          M(v, b.r1 - h * 0.08, a + step / 2 - step * 0.18); L(v, b.r0 + h * 0.5, a + step / 2); L(v, b.r1 - h * 0.08, a + step / 2 + step * 0.18);
          stipple(v, b.r0 + h * 0.3, b.r1 - h * 0.2, a + step / 2, 2, Math.min(h * 0.04, 0.6));
        }
      }
      const ring = mainPB(); circle(ring, cx, cy, b.r1);
      emit(ring, mainWFor(b), "#fff"); emit(m, mainWFor(b), "#fff"); emit(d, detailWFor(b)); emit(v, vestWFor(b));
    },
    diamond(b) {
      const step = TAU / b.n, h = b.r1 - b.r0, rm = (b.r0 + b.r1) / 2;
      const m = mainPB(), d = detailPB(), v = detailPB();
      for (let i = 0; i < b.n; i++) {
        const a = b.off + i * step;
        M(m, b.r0, a); L(m, rm, a - step / 2); L(m, b.r1, a); L(m, rm, a + step / 2); m.close();
        if (detail) {
          M(d, b.r0 + h * 0.2, a); L(d, rm, a - step * 0.27); L(d, b.r1 - h * 0.2, a); L(d, rm, a + step * 0.27); d.close();
          if (textures && richDetail) {
            const ri = b.r0 + h * 0.35, ro = b.r1 - h * 0.35;
            M(v, ri + (rm - ri) * 0.5, a); L(v, rm, a - step * 0.12); L(v, ro - (ro - rm) * 0.5, a); L(v, rm, a + step * 0.12);
            stipple(v, b.r0 + h * 0.3, b.r1 - h * 0.3, a, 2, Math.min(h * 0.035, 0.55));
          }
        }
      }
      const ring = mainPB(); circle(ring, cx, cy, b.r1);
      emit(ring, mainWFor(b), "#fff"); emit(m, mainWFor(b), "#fff"); emit(d, detailWFor(b)); emit(v, vestWFor(b));
    },
    chevron(b) {
      const step = TAU / b.n, h = b.r1 - b.r0;
      const m = mainPB(), d = detailPB();
      const ring = mainPB(); circle(ring, cx, cy, b.r1);
      // Dos filas de zigzag con celdas cerradas entre ellas
      for (const [lo, hi] of [[b.r0 + h * 0.1, b.r0 + h * 0.5], [b.r0 + h * 0.5, b.r1 - h * 0.1]]) {
        M(m, lo, b.off);
        for (let i = 0; i < b.n; i++) { const a = b.off + i * step; L(m, hi, a + step / 2); L(m, lo, a + step); }
      }
      if (detail && richDetail) {
        // Líneas internas en zigzag más finas (celdas cerradas coloreables)
        for (const [lo, hi] of [[b.r0 + h * 0.15, b.r0 + h * 0.35], [b.r0 + h * 0.65, b.r1 - h * 0.15]]) {
          M(d, lo, b.off);
          for (let i = 0; i < b.n; i++) { const a = b.off + i * step; L(d, hi, a + step / 2); L(d, lo, a + step); }
        }
      }
      emit(ring, mainWFor(b), "#fff"); emit(m, detailWFor(b)); emit(d, vestWFor(b));
    },
    beads(b) {
      const step = TAU / b.n, h = b.r1 - b.r0, rm = (b.r0 + b.r1) / 2;
      const ring = mainPB(); circle(ring, cx, cy, b.r1);
      const m = mainPB(), d = detailPB(), v = detailPB();
      // Radio: holgura de ~0,18·h con cada anillo (antes 0,14·h: hueco < 1 mm en bandas finas)
      const rad = Math.min(h * 0.32, rm * Math.sin(step / 2) * 0.8);
      for (let i = 0; i < b.n; i++) {
        const [x, y] = P(rm, b.off + i * step);
        circle(m, x, y, rad);
        if (detail && rad > 2.2) {
          // Círculo interno (brillo)
          circle(d, x, y, rad * 0.45);
          // Arco de brillo (textura de superficie)
          if (richDetail && rad > 3.5) {
            const arcR = rad * 0.65;
            const a0 = b.off + i * step - 0.4;
            const a1 = b.off + i * step + 0.4;
            const [ax, ay] = P(rm - rad * 0.15, a0);
            const [bx, by] = P(rm - rad * 0.15, a1);
            v.moveTo(ax, ay).quadTo(x - (y - ay) * 0.3, y + (x - ax) * 0.3, bx, by);
          }
        }
      }
      // La cuenta es una celda que se colorea: contorno principal, no de detalle
      emit(ring, mainWFor(b), "#fff"); emit(m, mainWFor(b), "#fff"); emit(d, detailWFor(b)); emit(v, vestWFor(b));
    },

    // ---------- Motivos nuevos ----------
    voluta(b) {
      // Espiral logarítmica con celdas cerradas (fiddlehead)
      const step = TAU / b.n, h = b.r1 - b.r0, w = fitW(step, 0.85);
      const m = mainPB(), d = detailPB(), v = detailPB();
      for (let i = 0; i < b.n; i++) {
        const a = b.off + i * step;
        // Cuerpo: forma de espiral cerrada
        const r0 = b.r0 + h * 0.05, r1 = b.r1 - h * 0.05;
        const spiralH = r1 - r0;
        M(m, r0, a - w * 0.6);
        // Curva exterior de la espiral
        C(m, r0 + spiralH * 0.3, a - w * 0.9, r0 + spiralH * 0.7, a - w * 0.7, r1, a - w * 0.15);
        // Punta curvada hacia dentro
        C(m, r1 + spiralH * 0.05, a + w * 0.05, r1 - spiralH * 0.1, a + w * 0.35, r0 + spiralH * 0.5, a + w * 0.4);
        // Curva interior de retorno
        C(m, r0 + spiralH * 0.3, a + w * 0.35, r0 + spiralH * 0.1, a + w * 0.15, r0, a - w * 0.6);
        m.close();
        if (detail) {
          // Línea espiral interna
          const ir0 = r0 + spiralH * 0.15, ir1 = r1 - spiralH * 0.15;
          M(d, ir0, a - w * 0.3);
          C(d, ir0 + (ir1 - ir0) * 0.4, a - w * 0.5, ir0 + (ir1 - ir0) * 0.7, a - w * 0.3, ir1, a);
          // Punteado a lo largo de la espiral
          stipple(v, r0 + spiralH * 0.2, r1 - spiralH * 0.2, a - w * 0.1, 3, Math.min(h * 0.03, 0.5));
        }
      }
      emit(m, mainWFor(b), "#fff"); emit(d, detailWFor(b)); emit(v, vestWFor(b));
    },
    antemia(b) {
      // Abanico con divisiones radiales (arte griego/egipcio)
      const step = TAU / b.n, h = b.r1 - b.r0, w = fitW(step, 0.92);
      const m = mainPB(), d = detailPB(), v = detailPB();
      for (let i = 0; i < b.n; i++) {
        const a = b.off + i * step;
        // Cuerpo de abanico: trapecio curvo
        M(m, b.r0 + h * 0.05, a - w * 0.7);
        C(m, b.r0 + h * 0.3, a - w * 0.95, b.r1 - h * 0.1, a - w * 0.85, b.r1 - h * 0.05, a - w * 0.5);
        L(m, b.r1 - h * 0.05, a + w * 0.5);
        C(m, b.r1 - h * 0.1, a + w * 0.85, b.r0 + h * 0.3, a + w * 0.95, b.r0 + h * 0.05, a + w * 0.7);
        m.close();
        if (detail) {
          // Divisiones radiales (3-5 líneas desde la base)
          const divs = richDetail ? 5 : 3;
          for (let di = 1; di < divs; di++) {
            const da = a - w * 0.5 + (w / divs) * di;
            capsuleVein(d, b.r0 + h * 0.12, b.r1 - h * 0.15, da, w * 0.05);
          }
          // Línea horizontal de separación
          const midR = (b.r0 + b.r1) / 2;
          const [lx, ly] = P(midR, a - w * 0.6);
          const [rx, ry] = P(midR, a + w * 0.6);
          d.moveTo(lx, ly).quadTo(...P(midR + h * 0.05, a), rx, ry);
        }
      }
      emit(m, mainWFor(b), "#fff"); emit(d, detailWFor(b)); emit(v, vestWFor(b));
    },
    roseta(b) {
      // Círculo con pétalos internos que no llegan al borde (flor vista desde arriba)
      const step = TAU / b.n, h = b.r1 - b.r0, w = fitW(step, 0.9);
      const m = mainPB(), d = detailPB(), v = detailPB();
      for (let i = 0; i < b.n; i++) {
        const a = b.off + i * step;
        const rm = (b.r0 + b.r1) / 2;
        // Círculo exterior de la roseta
        circle(m, ...P(rm, a), h * 0.42);
        if (detail) {
          // Pétalos internos (5-7) que no llegan al borde del círculo
          const nPet = 5 + (richDetail ? 2 : 0);
          const petR = h * 0.42;
          const petStep = TAU / nPet;
          for (let pi = 0; pi < nPet; pi++) {
            const pa = a + pi * petStep;
            const [pcx, pcy] = P(rm, a);
            const pr0 = petR * 0.15, pr1 = petR * 0.75;
            const pw = petStep * 0.35;
            // Mini-pétalo en coordenadas absolutas
            const p0x = pcx + pr0 * Math.cos(pa), p0y = pcy + pr0 * Math.sin(pa);
            const p1x = pcx + pr1 * Math.cos(pa), p1y = pcy + pr1 * Math.sin(pa);
            const midR2 = (pr0 + pr1) / 2;
            const cp1x = pcx + midR2 * Math.cos(pa - pw), cp1y = pcy + midR2 * Math.sin(pa - pw);
            const cp2x = pcx + midR2 * Math.cos(pa + pw), cp2y = pcy + midR2 * Math.sin(pa + pw);
            d.moveTo(p0x, p0y).quadTo(cp1x, cp1y, p1x, p1y).quadTo(cp2x, cp2y, p0x, p0y).close();
          }
          // Punto central
          if (richDetail) circle(v, ...P(rm, a), petR * 0.12);
        }
      }
      emit(m, mainWFor(b), "#fff"); emit(d, detailWFor(b)); emit(v, vestWFor(b));
    },
    flame(b) {
      // Forma de llama simétrica con ondulaciones laterales
      const step = TAU / b.n, h = b.r1 - b.r0, w = fitW(step, 0.7);
      const m = mainPB(), d = detailPB(), v = detailPB();
      for (let i = 0; i < b.n; i++) {
        const a = b.off + i * step;
        // Cuerpo de la llama simétrico
        M(m, b.r0 + h * 0.05, a);
        // Lado izquierdo con ondulación
        C(m, b.r0 + h * 0.25, a - w * 0.6, b.r0 + h * 0.55, a - w * 0.7, b.r0 + h * 0.75, a - w * 0.35);
        C(m, b.r0 + h * 0.9, a - w * 0.1, b.r1 - h * 0.02, a - w * 0.05, b.r1, a);
        // Lado derecho (espejo)
        C(m, b.r1 - h * 0.02, a + w * 0.05, b.r0 + h * 0.9, a + w * 0.1, b.r0 + h * 0.75, a + w * 0.35);
        C(m, b.r0 + h * 0.55, a + w * 0.7, b.r0 + h * 0.25, a + w * 0.6, b.r0 + h * 0.05, a);
        m.close();
        if (detail) {
          // Línea interior de la llama
          const ir0 = b.r0 + h * 0.2, ir1 = b.r1 - h * 0.15;
          M(d, ir0, a);
          C(d, ir0 + (ir1 - ir0) * 0.4, a - w * 0.25, ir0 + (ir1 - ir0) * 0.7, a - w * 0.15, ir1, a);
          C(d, ir0 + (ir1 - ir0) * 0.7, a + w * 0.15, ir0 + (ir1 - ir0) * 0.4, a + w * 0.25, ir0, a);
          d.close();
        }
      }
      emit(m, mainWFor(b), "#fff"); emit(d, detailWFor(b));
    },
  };

  // Cuentas necesitan su propio conteo
  for (const b of bands) if (b.motif === "beads") {
    const h = b.r1 - b.r0, rm = (b.r0 + b.r1) / 2;
    b.n = harmonics.reduce((best, n) => Math.abs(TAU * rm / n - h) < Math.abs(TAU * rm / best - h) ? n : best, harmonics[0]);
  }

  // ---------- Pintado: de afuera hacia adentro ----------
  if (pageBorder) {
    const pb = mainPB(), m = marginMm, rr = 4;
    const rect = (pb, x0, y0, x1, y1, rc) => {
      pb.moveTo(x0 + rc, y0).lineTo(x1 - rc, y0).quadTo(x1, y0, x1, y0 + rc).lineTo(x1, y1 - rc).quadTo(x1, y1, x1 - rc, y1)
        .lineTo(x0 + rc, y1).quadTo(x0, y1, x0, y1 - rc).lineTo(x0, y0 + rc).quadTo(x0, y0, x0 + rc, y0).close();
    };
    rect(pb, m, m, page.wMm - m, page.hMm - m, rr);
    emit(pb, mainW);
    if (includeFrames) { const p2 = mainPB(); rect(p2, m + 2.5, m + 2.5, page.wMm - m - 2.5, page.hMm - m - 2.5, rr * 0.6); emit(p2, detailW); }
  }

  let kDraw = B;
  if (Number.isFinite(opts.growth)) {
    let kMin = 2;
    while (kMin < B && bands[kMin - 1].r1 < R * 0.5) kMin++;
    kMin = Math.max(2, Math.min(kMin, B - 3));
    kDraw = Math.min(B, kMin + Math.round((B - kMin) * Math.max(0, Math.min(1, opts.growth))));
  }
  for (let k = B - 1; k >= 0; k--) {
    const b = bands[k];
    const extraRing = includeFrames && detail && k > 0 && b.motif !== "beads" && bands[k - 1].motif !== "beads" && (b.r1 - b.r0) > 9 && rng() < 0.35;
    if (k >= kDraw) continue;
    MOTIFS[b.motif](b);
    const disc = mainPB(); circle(disc, cx, cy, b.r0); emit(disc, mainW, "#fff");
    // Silueta decorada: doble contorno en la banda exterior
    if (k === B - 1 && includeFrames && detail) {
      const innerRing = mainPB();
      circle(innerRing, cx, cy, b.r0 + (b.r1 - b.r0) * 0.12);
      emit(innerRing, vestW);
      // Punteado entre los dos contornos de la silueta (conteo múltiplo de N para simetría)
      if (richDetail && (b.r1 - b.r0) > 10) {
        const dotRing = detailPB();
        const dotR = b.r0 + (b.r1 - b.r0) * 0.06;
        // Múltiplo de N para mantener la simetría radial
        const dotN = N * Math.max(1, Math.round(TAU * dotR / (3 * N)));
        const dotRad = Math.min((b.r1 - b.r0) * 0.025, 0.6);
        if (Math.PI * dotRad * dotRad >= minCell * 1.5) {
          for (let di = 0; di < dotN; di++) circle(dotRing, ...P(dotR, di * TAU / dotN), dotRad);
        }
        emit(dotRing, vestW);
      }
    }
    if (extraRing) {
      const inner = mainPB(); circle(inner, cx, cy, b.r0 - Math.max(2.4, (b.r1 - b.r0) * 0.16)); emit(inner, detailW);
    }
  }
  if (doc?.meta) {
    doc.meta.bands = { total: B, drawn: kDraw };
    (doc.meta.discs ??= []).push({ cx, cy, R, N, structure: opts.structure || "corona", motifs: bands.map(b => b.motif), counts: bands.map(b => b.n), radii: bands.map(b => +(b.r1 / R).toFixed(3)) });
  }

  // ---------- Núcleo: medallón con la imagen ----------
  if (art) {
    const rIn = rCore - Math.max(1.8, rCore * 0.05);
    const ring = mainPB(); circle(ring, cx, cy, rIn); emit(ring, detailW, "#fff");
    const id = `art-${(seed >>> 0).toString(36)}-${doc.defs.length}`;
    doc.defs.push(`<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${rIn - detailW / 2}" /></clipPath>`);
    const s = rIn * 2 * (art.zoom ?? 1);
    // Con fit (círculo que encierra la silueta, en píxeles de la imagen) la figura entra entera en
    // el medallón: sin él, una figura ancha llegaba al borde del cuadrado y el círculo le cortaba las puntas
    const fit = art.fit && art.fit.r > 0 && art.imgW > 0 && art.imgH > 0 ? art.fit : null;
    const k = fit ? ((art.cls ? 0.7 : 0.95) * (rIn - detailW) * (art.zoom ?? 1)) / fit.r : 0;
    const inner = fit
      ? [`<image href="${art.href}" x="${(cx - fit.x * k).toFixed(2)}" y="${(cy - fit.y * k).toFixed(2)}" width="${(art.imgW * k).toFixed(2)}" height="${(art.imgH * k).toFixed(2)}" preserveAspectRatio="none" />`]
      : [`<image href="${art.href}" x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" preserveAspectRatio="xMidYMid meet" />`];
    // Una figura sola en un círculo blanco se lee como una ilustración pegada: con silueta (cls) se
    // reduce un poco y se rodea de una trama polar (rayos, anillos, pétalos), encima de la imagen
    // porque su fondo blanco es opaco; sin silueta, el medallón queda como antes
    const gaps = fit && art.cls
      ? drawMedallionWeb({ cx, cy, r: rIn - detailW / 2 - 0.3, cls: art.cls, fw: art.imgW, fh: art.imgH,
          ix: cx - fit.x * k, iy: cy - fit.y * k, iw: art.imgW * k, ih: art.imgH * k, stroke, detailW, outlineMode })
      : [];
    out.push(`<g clip-path="url(#${id})">`, ...inner, ...gaps, `</g>`);
    doc.body.push(...out);
    return doc;
  }

  // ---------- Núcleo: 4 variantes ----------
  {
    // Espiral áurea excluida: una espiral nunca tiene simetría rotacional N
    const allowedCores = CORE_VARIANTS.filter(v => v !== "espiral_aurea");
    const coreVariant = allowedCores[Math.floor(rng() * allowedCores.length)];
    const coreFragments = drawCore(cx, cy, rCore, N, rng, { coreVariant, detail, richDetail, textures, mainW, detailW, vestW, minCell, stroke });
    out.push(...coreFragments);
  }

  doc.body.push(...out);
  return doc;
}

// ---------- Variantes de núcleo ----------
// Devuelve un array de fragmentos SVG (como out.push).
function drawCore(cx, cy, rCore, N, rng, opts) {
  const { coreVariant, detail, richDetail, mainW, detailW, vestW, minCell, stroke } = opts;
  const TAU = Math.PI * 2;
  const frags = [];
  const emit = (pb, w, fill = "none") => {
    const p = pb.toPath({ stroke, strokeWidthMm: w, fill });
    if (p) frags.push(p);
  };
  const mainPB = () => new PathBuilder();
  const detailPB = () => new PathBuilder({ minClosedArea: minCell });
  const circle = (pb, x, y, rad) => {
    const n = rad > 15 ? 12 : 8;
    const k = (4 / 3) * Math.tan(Math.PI / (2 * n)) * rad;
    pb.moveTo(x + rad, y);
    for (let i = 0; i < n; i++) {
      const a0 = (i * TAU) / n, a1 = ((i + 1) * TAU) / n;
      pb.cubicTo(x + rad * Math.cos(a0) - k * Math.sin(a0), y + rad * Math.sin(a0) + k * Math.cos(a0),
        x + rad * Math.cos(a1) + k * Math.sin(a1), y + rad * Math.sin(a1) - k * Math.cos(a1),
        x + rad * Math.cos(a1), y + rad * Math.sin(a1));
    }
    pb.close();
  };
  const P = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const Mf = (pb, rr, a) => pb.moveTo(...P(rr, a));
  const Lf = (pb, rr, a) => pb.lineTo(...P(rr, a));
  // Número de pétalos del núcleo: el mayor divisor armónico de N (N, N/2, N/3… ≥ 4) cuya
  // celda se pueda colorear. areaPerStep · paso ≈ área de una celda (aprox. medida sobre
  // la forma de cada variante). Antes el conteo no dependía del tamaño del núcleo y los
  // mandalas pequeños (núcleo de ~5 mm) salían con 41 % de celdas < 6 mm².
  const coreCount = (areaPerStep, maxN = N) => {
    const cands = [];
    for (let k = 1; N / k >= 4; k++) if (N % k === 0 && N / k <= maxN) cands.push(N / k);
    return cands.find(n => areaPerStep * (TAU / n) >= minCell * 1.3) ?? 0;
  };
  // Núcleo mínimo: un disco coloreable (y un anillo, si cabe)
  const plainCore = () => {
    const c = mainPB(); circle(c, cx, cy, rCore * 0.55); emit(c, mainW, "#fff");
    return frags;
  };

  // La flor de la vida crea lentes entre círculos: con un núcleo chico son diminutas
  const variant = coreVariant === "flor_vida" && rCore < 12 ? "flor_radiante" : coreVariant;

  if (variant === "flor_radiante") {
    // Flor radiante: 2 filas de pétalos + estambres centrales
    const nC = coreCount(0.12 * rCore * rCore, N >= 12 && N % 2 === 0 ? N / 2 : N);
    if (!nC) return plainCore();
    const step = TAU / nC, w = (step / 2) * 0.9;
    const roundCore = rng() < 0.5;
    // Fila trasera
    const back = mainPB();
    for (let i = 0; i < nC; i++) {
      const a = -Math.PI / 2 + i * step + step / 2;
      petalShapeCore(back, cx, cy, rCore * 0.25, rCore * 0.92, a, w * 0.85, 1.05, roundCore);
    }
    emit(back, mainW, "#fff");
    // Fila delantera (más corta)
    const front = mainPB(), det = detailPB();
    for (let i = 0; i < nC; i++) {
      const a = -Math.PI / 2 + i * step;
      petalShapeCore(front, cx, cy, rCore * 0.28, rCore * 0.72, a, w * 0.95, 1.1, roundCore);
      if (detail && rCore > 9) petalShapeCore(det, cx, cy, rCore * 0.38, rCore * 0.58, a, w * 0.45, 1.05, roundCore);
    }
    emit(front, mainW, "#fff"); emit(det, detailW);
    // Estambres centrales como cápsulas radiales (solo en núcleos grandes)
    if (detail && rCore > 10) {
      const v = detailPB();
      const nStam = nC;
      for (let i = 0; i < nStam; i++) {
        const a = -Math.PI / 2 + (i * TAU) / nStam;
        const [x0, y0] = P(rCore * 0.12, a);
        const [x1, y1] = P(rCore * 0.3, a);
        const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
        if (len > 1.5) {
          const nw = Math.max(0.2, rCore * 0.018);
          const nx = -dy / len * nw, ny = dx / len * nw;
          const [mx, my] = [(x0 + x1) / 2, (y0 + y1) / 2];
          v.moveTo(x0, y0).quadTo(mx + nx, my + ny, x1, y1).quadTo(mx - nx, my - ny, x0, y0).close();
          circle(v, x1, y1, Math.max(rCore * 0.025, 0.7));
        }
      }
      emit(v, vestW);
    }
    // Disco central: radio mínimo para que sea coloreable
    const coreDiskR = Math.max(rCore * 0.28, 1.2);
    const c = mainPB(); circle(c, cx, cy, coreDiskR); emit(c, mainW, "#fff");
    if (detail && rCore > 9) { const c2 = detailPB(); circle(c2, cx, cy, coreDiskR * 0.5); emit(c2, detailW); }

  } else if (variant === "flor_vida") {
    // Flor de la vida: N círculos entrelazados (respeta la simetría del mandala)
    const nPetals = N >= 6 ? (N % 2 === 0 ? N / 2 : N) : N;
    const rPet = rCore * (nPetals <= 6 ? 0.42 : 0.38);
    const m = mainPB(), d = detailPB(), v = detailPB();
    for (let i = 0; i < nPetals; i++) {
      const a = (i * TAU) / nPetals;
      const [px, py] = P(rPet * 0.52, a);
      circle(m, px, py, rPet);
      if (detail && rPet > 3) circle(d, px, py, rPet * 0.6);
      if (richDetail && rPet > 5) circle(v, px, py, rPet * 0.3);
    }
    emit(m, mainW, "#fff"); emit(d, detailW); emit(v, vestW);
    const rim = mainPB(); circle(rim, cx, cy, rCore * 0.92); emit(rim, mainW, "#fff");
    const coreDiskR = Math.max(rPet * 0.52, 1.2);
    const c = mainPB(); circle(c, cx, cy, coreDiskR); emit(c, mainW, "#fff");
    if (detail && coreDiskR > 2) { const c2 = detailPB(); circle(c2, cx, cy, coreDiskR * 0.5); emit(c2, detailW); }

  } else if (variant === "espiral_aurea") {
    // Espiral áurea con celdas cerradas entre las vueltas
    const turns = 2.5 + rng() * 1.5;
    const m = mainPB(), d = detailPB();
    const steps = 200;
    const maxR = rCore * 0.85;
    const minR = Math.max(rCore * 0.08, 1.0);
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = t * turns * TAU - Math.PI / 2;
      const rr = minR + (maxR - minR) * Math.pow(t, 0.7);
      pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
    }
    m.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) m.lineTo(pts[i][0], pts[i][1]);
    for (let i = pts.length - 1; i >= 0; i--) {
      const t = i / steps;
      const a = t * turns * TAU - Math.PI / 2;
      const rr = (minR + (maxR - minR) * Math.pow(t, 0.7)) * 0.7;
      m.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
    }
    m.close();
    emit(m, mainW, "#fff");
    if (detail) {
      const nDiv = Math.round(turns * N);
      for (let i = 0; i < nDiv; i++) {
        const t = i / nDiv;
        const a = t * turns * TAU - Math.PI / 2;
        const rIn = (minR + (maxR - minR) * Math.pow(t, 0.7)) * 0.72;
        const rOut = minR + (maxR - minR) * Math.pow(t, 0.7);
        d.moveTo(...P(rIn, a)).lineTo(...P(rOut, a));
      }
      emit(d, detailW);
    }
    const coreDiskR = Math.max(minR * 1.2, 1.0);
    const c = mainPB(); circle(c, cx, cy, coreDiskR); emit(c, mainW, "#fff");

  } else {
    // estrella_compuesta: estrella de N puntas con estrella interna + líneas radiales
    const nC = coreCount(0.09 * rCore * rCore, N >= 8 && N % 2 === 0 ? N / 2 : N);
    if (!nC) return plainCore();
    const step = TAU / nC;
    const m = mainPB(), d = detailPB(), v = detailPB();
    const rOuter = rCore * 0.88, rInner = rCore * 0.45;
    const rOuter2 = rCore * 0.55, rInner2 = rCore * 0.28;
    // Estrella exterior
    for (let i = 0; i <= 2 * nC; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / nC;
      const rr = i % 2 ? rInner : rOuter;
      (i === 0 ? Mf : Lf)(m, rr, a);
    }
    m.close();
    // Estrella interior
    if (detail) {
      for (let i = 0; i <= 2 * nC; i++) {
        const a = -Math.PI / 2 + step / 2 + (i * Math.PI) / nC;
        const rr = i % 2 ? rInner2 : rOuter2;
        (i === 0 ? Mf : Lf)(d, rr, a);
      }
      d.close();
    }
    if (richDetail) {
      for (let i = 0; i < nC; i++) {
        const a = -Math.PI / 2 + i * step;
        v.moveTo(...P(rInner * 0.9, a)).lineTo(...P(rInner2 * 1.1, a + step / 2));
      }
    }
    emit(m, mainW, "#fff"); emit(d, detailW); emit(v, vestW);
    const coreDiskR = Math.max(rInner2 * 0.6, 1.0);
    const c = mainPB(); circle(c, cx, cy, coreDiskR); emit(c, mainW, "#fff");
    if (detail && coreDiskR > 1.5) { const c2 = detailPB(); circle(c2, cx, cy, coreDiskR * 0.5); emit(c2, detailW); }
  }
  return frags;
}

// Helper para el núcleo: pétalo en coordenadas absolutas
function petalShapeCore(pb, cx, cy, r0, r1, a, w, belly = 1.05, round = false) {
  const P = (r, ang) => [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
  const h = r1 - r0;
  pb.moveTo(...P(r0, a - w));
  if (round) {
    pb.cubicTo(...P(r0 + h * 0.45, a - w * belly), ...P(r1, a - w * 0.85), ...P(r1, a));
    pb.cubicTo(...P(r1, a + w * 0.85), ...P(r0 + h * 0.45, a + w * belly), ...P(r0, a + w));
  } else {
    pb.cubicTo(...P(r0 + h * 0.45, a - w * belly), ...P(r0 + h * 0.85, a - w * 0.3), ...P(r1, a));
    pb.cubicTo(...P(r0 + h * 0.85, a + w * 0.3), ...P(r0 + h * 0.45, a + w * belly), ...P(r0, a + w));
  }
  pb.close();
}
