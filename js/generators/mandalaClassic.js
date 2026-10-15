// js/generators/mandalaClassic.js
// Motor "Clásico": la gramática de los mandalas que se venden en libros para colorear.
//  - Bandas concéntricas; cada banda se llena por completo con UN motivo repetido.
//  - Conteos armónicos del número base de pétalos (N/2, N, 2N, 3N, 4N): simetría exacta.
//  - Pintor de afuera hacia adentro con relleno blanco: los pétalos de cada banda nacen
//    "detrás" de la banda interior y las capas se ocultan entre sí, sin cruces de línea.
//  - Celdas cerradas de tamaño coloreable; los detalles finos respetan minCellArea.
import { mulberry32 } from "../core/prng.js";
import { PathBuilder, coloringCullArea } from "../core/pathBuilder.js";
import { wantsComposition, composePage } from "./pageComposer.js";

const TAU = Math.PI * 2;
const MIN_LINE_MM = 0.3; // por debajo, la imprenta lo reproduce gris o lo pierde

// Pesos de motivos por estilo: el estilo cambia el "acento" sin romper la gramática
const STYLE_WEIGHTS = {
  floral:    { petal: 3, round: 3, lotus: 3, leaf: 3, scallop: 2, heart: 2, beads: 1, triangle: 0.5, diamond: 0.5, ogee: 1, chevron: 0.3 },
  geometric: { petal: 2, round: 0.5, lotus: 1, leaf: 0.5, scallop: 1, heart: 0.3, beads: 2, triangle: 3, diamond: 3, ogee: 1, chevron: 2 },
  islamico:  { petal: 2, round: 1, lotus: 2, leaf: 1, scallop: 2, heart: 0.5, beads: 1.5, triangle: 1, diamond: 2, ogee: 3, chevron: 1 },
  sashiko:   { petal: 2, round: 2, lotus: 2, leaf: 1, scallop: 3, heart: 1, beads: 2, triangle: 1, diamond: 1.5, ogee: 1, chevron: 1 },
  azteca:    { petal: 2, round: 0.5, lotus: 1, leaf: 0.5, scallop: 1, heart: 0.5, beads: 1.5, triangle: 3, diamond: 2, ogee: 1, chevron: 3 },
  yantra:    { petal: 3, round: 1, lotus: 3, leaf: 1, scallop: 1, heart: 0.5, beads: 1.5, triangle: 2.5, diamond: 1.5, ogee: 1.5, chevron: 1 },
  celtico:   { petal: 1.5, round: 2, lotus: 2, leaf: 2, scallop: 2.5, heart: 2, beads: 1.5, triangle: 0.5, diamond: 1, ogee: 2, chevron: 0.5 },
};

// Proporción ancho-de-celda / alto-de-banda que mejor luce cada motivo
const ASPECT = { petal: 0.75, round: 0.85, lotus: 0.8, leaf: 0.6, scallop: 1.5, heart: 1.0, beads: 1.0, triangle: 0.9, diamond: 1.2, ogee: 0.8, chevron: 1.4 };
const SILHOUETTE = ["lotus", "lotus", "round", "petal", "scallop", "ogee"];

export function generateMandalaClassic(doc, opts) {
  // Encuadres de página (fondo, constelación, esquinas…): dibujan el disco con esta misma función
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

  const mainW = Math.max(MIN_LINE_MM, strokeWidthMm);
  const detailW = Math.max(MIN_LINE_MM, strokeWidthMm * 0.7);
  const cull = coloringCullArea(opts);
  // Escala: el diseño debe verse igual en 6×9 que en 8.5×11
  const minCell = Math.max(cull, 2.5 * (R / 90) ** 2);

  const P = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const out = [];
  const emit = (pb, w, fill = "none") => {
    const p = pb.toPath({ stroke, strokeWidthMm: w, fill });
    if (p) out.push(p);
  };
  const mainPB = () => new PathBuilder();
  const detailPB = () => new PathBuilder({ minClosedArea: minCell });

  // ---------- Reparto de bandas ----------
  // Modo contornos (niños / zen): menos bandas y formas grandes
  // Medallón central con una imagen subida (ya convertida a líneas): núcleo grande, menos bandas
  const art = opts.centerArt && opts.centerArt.href ? opts.centerArt : null;
  const artFrac = art ? Math.max(0.25, Math.min(0.6, art.scale ?? 0.42)) : 0;
  let B = outlineMode ? 4 + Math.round(cF * 2 + rng() * 0.8) : 5 + Math.round(cF * 4 + rng() * 1.2);
  if (art) B = Math.max(3, B - Math.round(artFrac * 6));
  // Mandalas pequeños de relleno: pocas bandas o las celdas se vuelven incoloreables
  if (opts.maxBands) B = Math.max(2, Math.min(B, opts.maxBands));
  const rCore = art ? R * artFrac : R * (0.11 + rng() * 0.05);
  const weights = Array.from({ length: B }, (_, k) => {
    let w = 0.75 + rng() * 0.7;
    if (k === B - 1) w *= 1.9;          // banda exterior: silueta protagonista
    if (k === B - 2) w *= 1.15;
    return w;
  });
  // Bandas estrechas de cuentas ("respiros"): 1–2, nunca adyacentes ni exteriores
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
    // El zigzag deja franjas estrechas: no apto para modo contornos (niños)
    const keys = Object.keys(W).filter(m => m !== exclude && m !== "beads" && !(outlineMode && m === "chevron"));
    let t = rng() * keys.reduce((s, m) => s + W[m], 0);
    for (const m of keys) { t -= W[m]; if (t <= 0) return m; }
    return keys[0];
  };
  const harmonics = (outlineMode ? [0.5, 1, 2] : [0.5, 1, 2, 3, 4, 6]).map(f => N * f).filter(n => Number.isInteger(n) && n >= 4 && n <= 128);
  let prev = null;
  for (const b of bands) {
    const h = b.r1 - b.r0, rm = (b.r0 + b.r1) / 2;
    if (b.k === B - 1) b.motif = SILHOUETTE[Math.floor(rng() * SILHOUETTE.length)];
    else if (beadSlots.has(b.k)) b.motif = "beads";
    else b.motif = pickMotif(prev);
    prev = b.motif;
    // Conteo armónico cuyo ancho de celda se acerca a la proporción ideal del motivo
    const target = ASPECT[b.motif] * h;
    // Celda mínima ~4.5 mm (a escala de página): más estrecha no se colorea bien
    const minArc = 4.5 * (R / 90);
    const ok = harmonics.filter(n => TAU * rm / n >= minArc);
    const pool = ok.length ? ok : [harmonics[0]];
    b.n = pool.reduce((best, n) =>
      Math.abs(Math.log((TAU * rm / n) / target)) < Math.abs(Math.log((TAU * rm / best) / target)) ? n : best, pool[0]);
    b.off = -Math.PI / 2 + ((b.k % 2) ? Math.PI / b.n : 0);
  }

  // ---------- Primitivas ----------
  // Círculo con 8 arcos Bézier (error < 0.001%): los anillos grandes quedan redondos
  const circle = (pb, x, y, rad) => {
    const n = 8, k = (4 / 3) * Math.tan(Math.PI / (2 * n)) * rad;
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
  // Ancho angular disponible que no invade la celda vecina en el radio rr
  const fitW = (step, frac) => (step / 2) * frac;

  // Punto decorativo entre pétalos, sólo si cabe como celda coloreable
  const gapDots = (pb, b, rr, frac = 0.55) => {
    if (!textures || !detail || b.k === B - 1) return; // fuera de la silueta quedan "flotando"
    const step = TAU / b.n;
    const rad = Math.min((b.r1 - b.r0) * 0.11, rr * step * 0.5 * (1 - frac) * 0.8);
    if (Math.PI * rad * rad < minCell * 1.2) return;
    for (let i = 0; i < b.n; i++) circle(pb, ...P(rr, b.off + (i + 0.5) * step), rad);
  };

  // ---------- Motivos (dibujan la banda completa) ----------
  const MOTIFS = {
    petal(b) {
      const step = TAU / b.n, h = b.r1 - b.r0, w = fitW(step, 0.96);
      const m = mainPB(), d = detailPB();
      for (let i = 0; i < b.n; i++) {
        const a = b.off + i * step;
        petalShape(m, b.r0 - h * 0.06, b.r1, a, w);
        if (detail) petalShape(d, b.r0 + h * 0.18, b.r1 - h * 0.2, a, w * 0.55);
        if (richDetail) { M(d, b.r0 + h * 0.28, a); L(d, b.r1 - h * 0.36, a); }
      }
      emit(m, mainW, "#fff"); gapDots(d, b, b.r1 - h * 0.22); emit(d, detailW);
    },
    round(b) {
      const step = TAU / b.n, h = b.r1 - b.r0, w = fitW(step, 0.94);
      const m = mainPB(), d = detailPB();
      for (let i = 0; i < b.n; i++) {
        const a = b.off + i * step;
        petalShape(m, b.r0 - h * 0.06, b.r1, a, w, 1.1, true);
        if (detail) petalShape(d, b.r0 + h * 0.16, b.r1 - h * 0.2, a, w * 0.58, 1.1, true);
        if (richDetail) { const [x, y] = P(b.r1 - h * 0.34, a); const rad = Math.min(h * 0.08, (b.r1 - h * 0.34) * w * 0.25); if (rad > 0.9) circle(d, x, y, rad); }
      }
      emit(m, mainW, "#fff"); gapDots(d, b, b.r1 - h * 0.2); emit(d, detailW);
    },
    lotus(b) {
      // Dos filas: la trasera asoma entre los pétalos delanteros
      const step = TAU / b.n, h = b.r1 - b.r0, w = fitW(step, 0.98);
      const back = mainPB(), front = mainPB(), d = detailPB();
      for (let i = 0; i < b.n; i++) {
        const a = b.off + i * step;
        petalShape(back, b.r0 - h * 0.06, b.r1, a + step / 2, w);
        petalShape(front, b.r0 - h * 0.06, b.r1 - h * 0.22, a, w * 1.02);
        if (detail) {
          petalShape(d, b.r0 + h * 0.14, b.r1 - h * 0.42, a, w * 0.55);
          if (richDetail) { M(d, b.r1 - h * 0.08, a + step / 2); L(d, b.r1 - h * 0.3, a + step / 2); }
        }
      }
      emit(back, mainW, "#fff"); emit(front, mainW, "#fff"); emit(d, detailW);
    },
    leaf(b) {
      const step = TAU / b.n, h = b.r1 - b.r0, w = fitW(step, 0.8);
      const m = mainPB(), d = detailPB();
      for (let i = 0; i < b.n; i++) {
        const a = b.off + i * step;
        petalShape(m, b.r0 + h * 0.04, b.r1 - h * 0.02, a, w, 1.25);
        if (detail) {
          M(d, b.r0 + h * 0.12, a); L(d, b.r1 - h * 0.12, a);
          const veins = richDetail ? 3 : 2;
          for (let v = 1; v <= veins; v++) {
            const t = v / (veins + 1), rr = b.r0 + h * (0.12 + t * 0.6);
            for (const s of [-1, 1]) { M(d, rr, a); L(d, rr + h * 0.14, a + s * w * 0.55 * (1 - t * 0.5)); }
          }
        }
      }
      emit(m, mainW, "#fff"); gapDots(d, b, (b.r0 + b.r1) / 2, 0.8); emit(d, detailW);
    },
    scallop(b) {
      const step = TAU / b.n, h = b.r1 - b.r0;
      const m = mainPB(), d = detailPB();
      // Festón: un arco por celda, de (rIn, a-½) a (rIn, a+½) pasando por rOut
      const bump = (pb, rIn, rOut, a, half) => {
        M(pb, rIn, a - half);
        C(pb, rOut, a - half, rOut, a - half * 0.4, rOut, a);
        C(pb, rOut, a + half * 0.4, rOut, a + half, rIn, a + half);
      };
      for (let i = 0; i < b.n; i++) bump(m, b.r0 + h * 0.15, b.r1, b.off + i * step, step / 2);
      // El cuerpo bajo los festones debe cubrir lo que haya detrás
      if (detail) {
        for (let i = 0; i < b.n; i++) { bump(d, b.r0 + h * 0.18, b.r1 - h * 0.3, b.off + i * step, step * 0.36); d.close(); }
        if (richDetail) for (let i = 0; i < b.n; i++) {
          const rad = Math.min(h * 0.09, (b.r0 + h * 0.4) * step * 0.12);
          if (rad > 0.9) circle(d, ...P(b.r0 + h * 0.42, b.off + i * step), rad);
        }
      }
      const disc = mainPB(); circle(disc, cx, cy, b.r0 + h * 0.15);
      emit(m, mainW, "#fff"); emit(disc, mainW, "#fff"); emit(d, detailW);
    },
    heart(b) {
      const step = TAU / b.n, h = b.r1 - b.r0, w = fitW(step, 0.92);
      const m = mainPB(), d = detailPB();
      for (let i = 0; i < b.n; i++) {
        const a = b.off + i * step;
        heartShape(m, b.r0, b.r1, a, w);
        if (detail) heartShape(d, b.r0 + h * 0.2, b.r1 - h * 0.15, a, w * 0.55);
      }
      emit(m, mainW, "#fff"); emit(d, detailW);
    },
    ogee(b) {
      const step = TAU / b.n, h = b.r1 - b.r0, w = fitW(step, 0.95);
      const m = mainPB(), d = detailPB();
      for (let i = 0; i < b.n; i++) {
        const a = b.off + i * step;
        ogeeShape(m, b.r0 - h * 0.05, b.r1, a, w);
        if (detail) ogeeShape(d, b.r0 + h * 0.15, b.r1 - h * 0.22, a, w * 0.55);
      }
      emit(m, mainW, "#fff"); gapDots(d, b, b.r1 - h * 0.25); emit(d, detailW);
    },
    triangle(b) {
      const step = TAU / b.n, h = b.r1 - b.r0;
      const m = mainPB(), d = detailPB();
      M(m, b.r0, b.off - step / 2);
      for (let i = 0; i < b.n; i++) { const a = b.off + i * step; L(m, b.r1, a); L(m, b.r0, a + step / 2); }
      m.close();
      if (detail) for (let i = 0; i < b.n; i++) {
        const a = b.off + i * step;
        M(d, b.r0 + h * 0.18, a - step * 0.28); L(d, b.r1 - h * 0.3, a); L(d, b.r0 + h * 0.18, a + step * 0.28); d.close();
        if (richDetail) { M(d, b.r1 - h * 0.08, a + step / 2 - step * 0.2); L(d, b.r0 + h * 0.5, a + step / 2); L(d, b.r1 - h * 0.08, a + step / 2 + step * 0.2); }
      }
      const ring = mainPB(); circle(ring, cx, cy, b.r1);
      emit(ring, mainW, "#fff"); emit(m, mainW, "#fff"); emit(d, detailW);
    },
    diamond(b) {
      const step = TAU / b.n, h = b.r1 - b.r0, rm = (b.r0 + b.r1) / 2;
      const m = mainPB(), d = detailPB();
      for (let i = 0; i < b.n; i++) {
        const a = b.off + i * step;
        M(m, b.r0, a); L(m, rm, a - step / 2); L(m, b.r1, a); L(m, rm, a + step / 2); m.close();
        if (detail) { M(d, b.r0 + h * 0.2, a); L(d, rm, a - step * 0.27); L(d, b.r1 - h * 0.2, a); L(d, rm, a + step * 0.27); d.close(); }
      }
      const ring = mainPB(); circle(ring, cx, cy, b.r1);
      emit(ring, mainW, "#fff"); emit(m, mainW, "#fff"); emit(d, detailW);
    },
    chevron(b) {
      const step = TAU / b.n, h = b.r1 - b.r0;
      const m = mainPB();
      const ring = mainPB(); circle(ring, cx, cy, b.r1);
      for (const [lo, hi] of [[b.r0 + h * 0.1, b.r0 + h * 0.5], [b.r0 + h * 0.5, b.r1 - h * 0.1]]) {
        M(m, lo, b.off);
        for (let i = 0; i < b.n; i++) { const a = b.off + i * step; L(m, hi, a + step / 2); L(m, lo, a + step); }
      }
      emit(ring, mainW, "#fff"); emit(m, detailW);
    },
    beads(b) {
      const step = TAU / b.n, h = b.r1 - b.r0, rm = (b.r0 + b.r1) / 2;
      const ring = mainPB(); circle(ring, cx, cy, b.r1);
      const m = mainPB(), d = detailPB();
      const rad = Math.min(h * 0.36, rm * Math.sin(step / 2) * 0.82);
      for (let i = 0; i < b.n; i++) {
        const [x, y] = P(rm, b.off + i * step);
        circle(m, x, y, rad);
        if (detail && rad > 2.2) circle(d, x, y, rad * 0.45);
      }
      emit(ring, mainW, "#fff"); emit(m, detailW, "#fff"); emit(d, detailW);
    },
  };

  // Las cuentas necesitan su propio conteo (celdas ~redondas)
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

  for (let k = B - 1; k >= 0; k--) {
    const b = bands[k];
    MOTIFS[b.motif](b);
    // Disco interior: tapa la base de los pétalos y traza el anillo separador
    const disc = mainPB(); circle(disc, cx, cy, b.r0); emit(disc, mainW, "#fff");
    if (includeFrames && detail && k > 0 && b.motif !== "beads" && bands[k - 1].motif !== "beads" && (b.r1 - b.r0) > 9 && rng() < 0.35) {
      const inner = mainPB(); circle(inner, cx, cy, b.r0 - Math.max(2.4, (b.r1 - b.r0) * 0.16)); emit(inner, detailW);
    }
  }

  // ---------- Núcleo: medallón con la imagen ----------
  if (art) {
    const rIn = rCore - Math.max(1.8, rCore * 0.05);
    const ring = mainPB(); circle(ring, cx, cy, rIn); emit(ring, detailW, "#fff");
    const id = `art-${(seed >>> 0).toString(36)}-${doc.defs.length}`;
    doc.defs.push(`<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${rIn - detailW / 2}" /></clipPath>`);
    // Se encaja sin deformarla
    const s = rIn * 2 * (art.zoom ?? 1);
    const inner = [`<image href="${art.href}" x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" preserveAspectRatio="xMidYMid meet" />`];
    out.push(`<g clip-path="url(#${id})">`, ...inner, `</g>`);
    doc.body.push(...out);
    return doc;
  }

  // ---------- Núcleo: flor central ----------
  {
    const nC = N >= 12 && N % 2 === 0 ? N / 2 : N;
    const step = TAU / nC, w = fitW(step, 0.95);
    const roundCore = rng() < 0.5;
    const m = mainPB(), d = detailPB();
    for (let i = 0; i < nC; i++) {
      const a = -Math.PI / 2 + i * step;
      petalShape(m, rCore * 0.3, rCore * 0.96, a, w, 1.1, roundCore);
      if (detail && rCore > 9) petalShape(d, rCore * 0.42, rCore * 0.75, a, w * 0.5);
    }
    emit(m, mainW, "#fff"); emit(d, detailW);
    const c = mainPB(); circle(c, cx, cy, rCore * 0.32); emit(c, mainW, "#fff");
    if (detail && rCore > 9) { const c2 = detailPB(); circle(c2, cx, cy, rCore * 0.15); emit(c2, detailW); }
  }

  doc.body.push(...out);
  return doc;
}
