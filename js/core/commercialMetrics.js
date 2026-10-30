// js/core/commercialMetrics.js
// Métricas de legibilidad para colorear, medidas sobre el SVG ya generado. Funciones puras:
// sin DOM ni getBBox (el áreas se calculan con la fórmula del polígono), así que corren
// igual en el navegador y en Node (scripts/bench-metrics.mjs).
//  - regiones: celdas cerradas (subtrayectos con Z o de punto final coincidente)
//  - pequenas: % de celdas con área < 6 mm²                  (objetivo < 5 %)
//  - aspecto:  % de celdas con w/h fuera de [0,4; 2,5]       (objetivo 0)
//  - huecos:   % de vértices con un trazo ajeno a < 1,2 mm   (proxy; ver nota)
//  - finas:    % de trazos con grosor < 0,7 mm
//  - asimetria: fracción de vértices sin copia por rotación 2π/petals (sólo clásico)
// Nota: «huecos» también cuenta dos trazos paralelos separados por el propio grosor de
// línea, así que sobrestima la estrechez en trazos gruesos. Sirve para comparar cambios.

// --- Geometría: subtrayectos aplanados (M/L/Q/C/Z absolutos, como los emite PathBuilder) ---
export function flattenSubpaths(d) {
  const tok = d.trim().split(/\s+/);
  const subs = [];
  let cur = null, i = 0, cx = 0, cy = 0, sx = 0, sy = 0;
  const num = () => parseFloat(tok[i++]);
  const push = (x, y) => { cur.pts.push([x, y]); cx = x; cy = y; };
  while (i < tok.length) {
    const c = tok[i++];
    if (c === "M") { cur = { pts: [], closed: false }; subs.push(cur); cx = num(); cy = num(); sx = cx; sy = cy; cur.pts.push([cx, cy]); }
    else if (c === "L") push(num(), num());
    else if (c === "Z") { cur.closed = true; cx = sx; cy = sy; }
    else if (c === "Q" || c === "C") {
      const n = c === "Q" ? 2 : 3;
      const ctrl = []; for (let k = 0; k < n; k++) ctrl.push([num(), num()]);
      const pts = [[cx, cy], ...ctrl];
      for (let k = 1; k <= 12; k++) {
        const t = k / 12;
        let p = pts.map(q => q.slice());
        while (p.length > 1) p = p.slice(1).map((q, j) => [p[j][0] + (q[0] - p[j][0]) * t, p[j][1] + (q[1] - p[j][1]) * t]);
        push(p[0][0], p[0][1]);
      }
    } else throw new Error(`Comando SVG inesperado: ${c}`);
  }
  return subs;
}

// Elementos <path>: cada uno con sus subtrayectos y su grosor de trazo
function elementsOf(svg) {
  const els = [];
  for (const m of svg.matchAll(/<path\b([^>]*)>/g)) {
    const attrs = m[1];
    const d = /\sd="([^"]+)"/.exec(attrs);
    if (!d) continue;
    const sw = /stroke-width="([\d.]+)"/.exec(attrs);
    els.push({ subs: flattenSubpaths(d[1]), width: sw ? parseFloat(sw[1]) : 0 });
  }
  return els;
}

const shoelace = pts => {
  let a = 0;
  for (let k = 0; k < pts.length; k++) { const [x0, y0] = pts[k], [x1, y1] = pts[(k + 1) % pts.length]; a += x0 * y1 - x1 * y0; }
  return Math.abs(a) / 2;
};
const bbox = pts => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { w: x1 - x0, h: y1 - y0 };
};
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// % de vértices cuyo trazo ajeno más cercano está a menos de 1,2 mm.
// Distancias < 0,05 mm son paredes compartidas entre celdas vecinas, no huecos.
function tightGapPct(els) {
  const cell = 2, grid = new Map();
  const key = (gx, gy) => `${gx},${gy}`;
  els.forEach((el, e) => el.subs.forEach(s => {
    for (let k = 0; k + 1 < s.pts.length; k++) {
      const [ax, ay] = s.pts[k], [bx, by] = s.pts[k + 1];
      const x0 = Math.floor(Math.min(ax, bx) / cell), x1 = Math.floor(Math.max(ax, bx) / cell);
      const y0 = Math.floor(Math.min(ay, by) / cell), y1 = Math.floor(Math.max(ay, by) / cell);
      for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
        const kk = key(gx, gy);
        if (!grid.has(kk)) grid.set(kk, []);
        grid.get(kk).push({ e, ax, ay, bx, by });
      }
    }
  }));
  let total = 0, tight = 0;
  els.forEach((el, e) => el.subs.forEach(s => s.pts.forEach(([x, y]) => {
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
    let near = Infinity;
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++)
      for (const seg of grid.get(key(gx + dx, gy + dy)) || []) {
        if (seg.e === e) continue;
        const d = distToSeg(x, y, seg.ax, seg.ay, seg.bx, seg.by);
        if (d >= 0.05 && d < near) near = d;
      }
    total++;
    if (near < 1.2) tight++;
  })));
  return 100 * tight / Math.max(1, total);
}

// Fracción de vértices sin copia rotada 2π/n sobre un trazo (0 = simetría exacta de orden n)
function asymmetry(els, n, center, tol = 0.15) {
  const verts = [];
  for (const el of els) for (const s of el.subs) for (const p of s.pts) verts.push(p);
  const cell = 2, grid = new Map();
  const key = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  for (const el of els) for (const s of el.subs) for (let k = 0; k + 1 < s.pts.length; k++) {
    const [ax, ay] = s.pts[k], [bx, by] = s.pts[k + 1];
    const x0 = Math.min(ax, bx) - tol, x1 = Math.max(ax, bx) + tol, y0 = Math.min(ay, by) - tol, y1 = Math.max(ay, by) + tol;
    for (let gx = Math.floor(x0 / cell); gx <= Math.floor(x1 / cell); gx++)
      for (let gy = Math.floor(y0 / cell); gy <= Math.floor(y1 / cell); gy++) {
        const kk = `${gx},${gy}`;
        if (!grid.has(kk)) grid.set(kk, []);
        grid.get(kk).push([ax, ay, bx, by]);
      }
  }
  const a = (2 * Math.PI) / n, cos = Math.cos(a), sin = Math.sin(a);
  let miss = 0;
  for (const [x, y] of verts) {
    const rx = center.x + (x - center.x) * cos - (y - center.y) * sin;
    const ry = center.y + (x - center.x) * sin + (y - center.y) * cos;
    const cand = grid.get(key(rx, ry)) || [];
    if (!cand.some(s => distToSeg(rx, ry, ...s) <= tol)) miss++;
  }
  return miss / Math.max(1, verts.length);
}

/**
 * Mide un SVG (cadena). opts: { petals, center: {x, y} } — petals sólo para el clásico,
 * center es el centro del dibujo en mm (por defecto, el centro de la hoja no se conoce aquí).
 */
export function measureSvg(svg, { petals = null, center = null } = {}) {
  const els = elementsOf(svg);
  const cells = [];
  for (const el of els) for (const s of el.subs) if (s.closed && s.pts.length >= 3) {
    const { w, h } = bbox(s.pts);
    cells.push({ area: shoelace(s.pts), aspect: h > 0 ? w / h : Infinity });
  }
  const pct = (arr, f) => (arr.length ? (100 * arr.filter(f).length) / arr.length : 0);
  const out = {
    regiones: cells.length,
    pequenas: pct(cells, c => c.area < 6),
    aspecto: pct(cells, c => c.aspect < 0.4 || c.aspect > 2.5),
    huecos: tightGapPct(els),
    finas: pct(els, e => e.width > 0 && e.width < 0.7),
  };
  // Igual que las pruebas: en pétalos pares vale el orden N o N/2 (armónico)
  if (petals && center) out.asimetria = Math.min(...(petals % 2 === 0 ? [petals, petals / 2] : [petals]).map(n => asymmetry(els, n, center)));
  
  // FASE 8: Métricas nuevas
  // Cobertura de tinta: % del área total que tiene tinta (trazos)
  if (center) {
    // Calcular radio máximo real desde los vértices
    let maxR = 0;
    for (const el of els) for (const s of el.subs) for (const [x, y] of s.pts) {
      const r = Math.hypot(x - center.x, y - center.y);
      if (r > maxR) maxR = r;
    }
    const totalArea = Math.PI * maxR * maxR;
    const inkArea = cells.reduce((sum, c) => sum + c.area, 0);
    out.cobertura = totalArea > 0 ? Math.min(100, (inkArea / totalArea) * 100) : 0;

    // Balance radial: distribución de tinta por anillos concéntricos
    const rings = 5;
    const ringAreas = Array(rings).fill(0);
    for (const el of els) for (const s of el.subs) if (s.closed && s.pts.length >= 3) {
      const cx = s.pts.reduce((sum, p) => sum + p[0], 0) / s.pts.length;
      const cy = s.pts.reduce((sum, p) => sum + p[1], 0) / s.pts.length;
      const r = Math.hypot(cx - center.x, cy - center.y);
      const ringIdx = maxR > 0 ? Math.min(rings - 1, Math.floor((r / maxR) * rings)) : 0;
      ringAreas[ringIdx] += shoelace(s.pts);
    }
    const totalInk = ringAreas.reduce((a, b) => a + b, 0);
    if (totalInk > 0) {
      const avgPerRing = totalInk / rings;
      const deviation = ringAreas.reduce((sum, a) => sum + Math.abs(a - avgPerRing), 0) / (rings * avgPerRing);
      out.balanceRadial = Math.max(0, Math.min(100, (1 - deviation) * 100));
    } else {
      out.balanceRadial = 0;
    }

    // Riqueza de detalle: número de subtrayectos por mm²
    const totalSubpaths = els.reduce((sum, el) => sum + el.subs.length, 0);
    out.riquezaDetalle = totalArea > 0 ? totalSubpaths / (totalArea / 100) : 0;
  }
  
  return out;
}

/**
 * Puntuación comercial 0–100 a partir de measureSvg. Penaliza celdas pequeñas, huecos,
 * trazos finos, asimetría y opciones fuera de lo comercial (grosor < 0,8 mm, celda mínima < 5 mm²).
 */
export function commercialScore(m, opts = {}) {
  let score = 100;
  const issues = [];
  if (m.pequenas > 5) { score -= (m.pequenas - 5) * 1.5; issues.push(`${m.pequenas.toFixed(1)} % de celdas < 6 mm²`); }
  if (m.aspecto > 0) { score -= Math.min(15, m.aspecto); issues.push(`${m.aspecto.toFixed(1)} % de celdas con proporción extrema`); }
  if (m.huecos > 5) { score -= (m.huecos - 5) * 0.5; issues.push(`${m.huecos.toFixed(1)} % de vértices con hueco < 1,2 mm`); }
  if (m.finas > 20) { score -= (m.finas - 20) * 0.5; issues.push(`${m.finas.toFixed(1)} % de trazos < 0,7 mm`); }
  if (m.asimetria > 0) { score -= 20; issues.push("simetría radial incompleta"); }
  if (opts.strokeWidthMm !== undefined && opts.strokeWidthMm < 0.8) { score -= 15; issues.push(`grosor ${opts.strokeWidthMm} mm < 0,8 mm`); }
  if (opts.minCellAreaMm2 !== undefined && opts.minCellAreaMm2 < 5) { score -= 10; issues.push(`celda mínima ${opts.minCellAreaMm2} mm² < 5 mm²`); }
  return { score: Math.max(0, Math.round(score)), issues };
}
