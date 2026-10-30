// js/core/variety.js
// Repetición entre páginas, medida sobre el dibujo (no sobre las etiquetas del plan).
// Huella geométrica de cada página, calculada del SVG sin rasterizar (corre en Node y
// en el navegador). La tinta se cuenta por longitud de trazo:
//  - perfil radial: tinta según la distancia al centro → dónde caen los anillos
//  - espectro angular por anillo: magnitud de Fourier del reparto angular → cuántas
//    repeticiones tiene cada banda (12 pétalos, 24 cuentas…), sin importar el giro
//  - mapa de tinta 6×8: cómo se reparte el dibujo en la hoja (encuadre y fondo)
// El parecido es la media ponderada de la correlación de cada parte (−1…1).
import { flattenSubpaths } from "./commercialMetrics.js";

const RADIAL_BINS = 36, RINGS = 8, ANG_BINS = 128, HARMONICS = 48, GX = 6, GY = 8;

/** Huella de una página. page: { wMm, hMm }; center opcional (por defecto el de la hoja). */
export function pageFingerprint(svg, page, center = null) {
  const cx = center?.x ?? page.wMm / 2, cy = center?.y ?? page.hMm / 2;
  const rMax = Math.min(page.wMm, page.hMm) / 2; // radio del disco más grande posible
  const radial = new Float64Array(RADIAL_BINS);
  const ang = Array.from({ length: RINGS }, () => new Float64Array(ANG_BINS));
  const grid = new Float64Array(GX * GY);
  for (const m of svg.matchAll(/<path\b[^>]*\sd="([^"]+)"/g)) {
    for (const sub of flattenSubpaths(m[1])) {
      const pts = sub.closed ? [...sub.pts, sub.pts[0]] : sub.pts;
      for (let k = 0; k + 1 < pts.length; k++) {
        const [x0, y0] = pts[k], [x1, y1] = pts[k + 1];
        const len = Math.hypot(x1 - x0, y1 - y0);
        if (!len) continue;
        const x = (x0 + x1) / 2, y = (y0 + y1) / 2;
        if (x < 0 || y < 0 || x > page.wMm || y > page.hMm) continue; // fuera de la hoja (recortado)
        const r = Math.hypot(x - cx, y - cy) / rMax;
        if (r < 1.2) radial[Math.min(RADIAL_BINS - 1, Math.floor((r / 1.2) * RADIAL_BINS))] += len;
        if (r < 1) {
          const a = (Math.atan2(y - cy, x - cx) + Math.PI) / (2 * Math.PI);
          ang[Math.min(RINGS - 1, Math.floor(r * RINGS))][Math.min(ANG_BINS - 1, Math.floor(a * ANG_BINS))] += len;
        }
        grid[Math.min(GY - 1, Math.floor((y / page.hMm) * GY)) * GX + Math.min(GX - 1, Math.floor((x / page.wMm) * GX))] += len;
      }
    }
  }
  // Espectro: |DFT| de los armónicos 1…48, relativo a la tinta del anillo (invariante al giro)
  const spec = [];
  for (const h of ang) {
    const total = h.reduce((s, v) => s + v, 0) || 1;
    for (let f = 1; f <= HARMONICS; f++) {
      let re = 0, im = 0;
      for (let i = 0; i < ANG_BINS; i++) { const t = (2 * Math.PI * f * i) / ANG_BINS; re += h[i] * Math.cos(t); im -= h[i] * Math.sin(t); }
      spec.push(Math.hypot(re, im) / total);
    }
  }
  return { radial: [...radial], spec, grid: [...grid] };
}

function pearson(a, b) {
  const n = a.length;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/** Parecido entre dos huellas: 1 = idénticas. */
export function fingerprintSimilarity(a, b) {
  return 0.35 * pearson(a.radial, b.radial) + 0.4 * pearson(a.spec, b.spec) + 0.25 * pearson(a.grid, b.grid);
}

/**
 * Pares de páginas demasiado parecidas. fps: huellas (null = no se compara, p. ej. una
 * página especial). window: sólo pares a esa distancia o menos (Infinity = todo el libro).
 * Devuelve [{ i, j, sim }] de mayor a menor parecido.
 */
export function similarPairs(fps, { threshold = TWIN_THRESHOLD, window = Infinity } = {}) {
  const out = [];
  for (let i = 0; i < fps.length; i++) {
    if (!fps[i]) continue;
    for (let j = i + 1; j < fps.length && j - i <= window; j++) {
      if (!fps[j]) continue;
      const sim = fingerprintSimilarity(fps[i], fps[j]);
      if (sim >= threshold) out.push({ i, j, sim });
    }
  }
  return out.sort((x, y) => y.sim - x.sim);
}

// Umbral calibrado con scripts/bench-variety.mjs (ver docs/proceso-calidad.md)
export const TWIN_THRESHOLD = 0.9;
