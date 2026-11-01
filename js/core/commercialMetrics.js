// js/core/commercialMetrics.js
// Métricas de legibilidad para colorear, medidas sobre el SVG ya generado. Funciones puras:
// sin DOM ni getBBox (el áreas se calculan con la fórmula del polígono), así que corren
// igual en el navegador y en Node (scripts/bench-metrics.mjs).
//  - regiones: celdas cerradas (subtrayectos con Z o de punto final coincidente); las
//    formas de relleno sólido (puntos negros) no son celdas y no cuentan
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

// Elementos <path>: cada uno con sus subtrayectos, su grosor de trazo, su relleno y el
// rectángulo que lo recorta (clip-path de un <g> o la hoja misma, según el viewBox)
function elementsOf(svg) {
  const els = [];
  const vb = /viewBox="([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)"/.exec(svg);
  const page = vb ? { x0: +vb[1], y0: +vb[2], x1: +vb[1] + +vb[3], y1: +vb[2] + +vb[4] } : null;
  const clipRects = new Map();
  for (const m of svg.matchAll(/<clipPath\s+id="([^"]+)"\s*>\s*<rect\s+x="([-\d.]+)"\s+y="([-\d.]+)"\s+width="([\d.]+)"\s+height="([\d.]+)"/g)) {
    clipRects.set(m[1], { x0: +m[2], y0: +m[3], x1: +m[2] + +m[4], y1: +m[3] + +m[5] });
  }
  const stack = []; // recortes de los <g> abiertos
  for (const m of svg.matchAll(/<g\b([^>]*)>|<\/g>|<path\b([^>]*)>/g)) {
    if (m[0].startsWith("</g")) { stack.pop(); continue; }
    if (m[0].startsWith("<g")) {
      const id = /clip-path="url\(#([^)]+)\)"/.exec(m[1])?.[1];
      stack.push(id ? clipRects.get(id) || null : null);
      continue;
    }
    const attrs = m[2];
    const d = /\sd="([^"]+)"/.exec(attrs);
    if (!d) continue;
    const sw = /stroke-width="([\d.]+)"/.exec(attrs);
    // Relleno sólido (ni blanco ni vacío): puntos y adornos de tinta llena. No son celdas
    // que se coloreen; antes contaban como «celdas diminutas» y hundían la puntuación de
    // las páginas con fondo decorado (un punto de 1 mm² no es un defecto para colorear).
    const fill = /\sfill="([^"]+)"/.exec(attrs)?.[1] ?? "none";
    const solid = !/^(none|transparent)$/i.test(fill) && !/^(#fff|#ffffff|white)$/i.test(fill);
    const white = /^(#fff|#ffffff|white)$/i.test(fill);
    let clip = page;
    for (const r of stack) if (r) clip = clip ? { x0: Math.max(clip.x0, r.x0), y0: Math.max(clip.y0, r.y0), x1: Math.min(clip.x1, r.x1), y1: Math.min(clip.y1, r.y1) } : r;
    els.push({ subs: flattenSubpaths(d[1]), width: sw ? parseFloat(sw[1]) : 0, solid, white, clip });
  }
  return els;
}

// ---------- Lo que de verdad se imprime ----------
// El motor clásico pinta de afuera hacia adentro: cada disco o pétalo con relleno blanco
// tapa la base de lo dibujado antes. Además, «gigante» y las tramas se recortan al marco.
// Las partes tapadas o recortadas no salen en papel: no cuentan como huecos ni celdas.
function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const OCC_MARGIN = 0.3; // un punto sobre el borde de quien lo tapa (pared compartida) sigue visible

/** Devuelve visible(e, x, y): ¿el vértice (x, y) del elemento e se ve en la página impresa? */
function visibilityOf(els) {
  const cell = 6, grid = new Map();
  const occ = [];
  els.forEach((el, e) => {
    if (!el.white) return;
    for (const s of el.subs) {
      if (!s.closed || s.pts.length < 3) continue;
      const b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      for (const [x, y] of s.pts) { if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y; }
      if (b.x1 - b.x0 < 2 * OCC_MARGIN || b.y1 - b.y0 < 2 * OCC_MARGIN) continue;
      const o = { e, pts: s.pts, b, clip: el.clip };
      occ.push(o);
      for (let gx = Math.floor(b.x0 / cell); gx <= Math.floor(b.x1 / cell); gx++)
        for (let gy = Math.floor(b.y0 / cell); gy <= Math.floor(b.y1 / cell); gy++) {
          const k = `${gx},${gy}`;
          if (!grid.has(k)) grid.set(k, []);
          grid.get(k).push(o);
        }
    }
  });
  const inRect = (r, x, y) => !r || (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1);
  return (e, x, y) => {
    if (!inRect(els[e].clip, x, y)) return false;
    for (const o of grid.get(`${Math.floor(x / cell)},${Math.floor(y / cell)}`) || []) {
      if (o.e <= e) continue; // sólo tapa lo que se pintó antes
      const { b } = o;
      if (x <= b.x0 + OCC_MARGIN || x >= b.x1 - OCC_MARGIN || y <= b.y0 + OCC_MARGIN || y >= b.y1 - OCC_MARGIN) continue;
      if (!inRect(o.clip, x, y) || !pointInPoly(x, y, o.pts)) continue;
      // Lejos del borde de quien lo tapa: oculto
      let near = Infinity;
      for (let k = 0; k < o.pts.length && near > OCC_MARGIN; k++) {
        const [ax, ay] = o.pts[k], [bx, by] = o.pts[(k + 1) % o.pts.length];
        near = Math.min(near, distToSeg(x, y, ax, ay, bx, by));
      }
      if (near > OCC_MARGIN) return false;
    }
    return true;
  };
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
function tightGapPct(els, visible = () => true) {
  const cell = 2, grid = new Map();
  const key = (gx, gy) => `${gx},${gy}`;
  els.forEach((el, e) => el.subs.forEach(s => {
    for (let k = 0; k + 1 < s.pts.length; k++) {
      const [ax, ay] = s.pts[k], [bx, by] = s.pts[k + 1];
      if (!visible(e, (ax + bx) / 2, (ay + by) / 2)) continue; // tramo tapado o recortado
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
    if (!visible(e, x, y)) return;
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
  const visible = visibilityOf(els);
  const cells = [];
  els.forEach((el, e) => { if (!el.solid) for (const s of el.subs) if (s.closed && s.pts.length >= 3) {
    // Una celda tapada o recortada por completo no se imprime
    if (!s.pts.some(([x, y]) => visible(e, x, y))) continue;
    const { w, h } = bbox(s.pts);
    cells.push({ area: shoelace(s.pts), aspect: h > 0 ? w / h : Infinity });
  } });
  const pct = (arr, f) => (arr.length ? (100 * arr.filter(f).length) / arr.length : 0);
  const out = {
    regiones: cells.length,
    pequenas: pct(cells, c => c.area < 6),
    aspecto: pct(cells, c => c.aspect < 0.4 || c.aspect > 2.5),
    huecos: tightGapPct(els, visible),
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

    // Balance por cuadrantes: distribución de tinta en 4 cuadrantes (N/S/E/W)
    // Detecta si un lado del mandala tiene más tinta que otro (desequilibrio visual)
    const quadAreas = [0, 0, 0, 0]; // NE, NW, SW, SE
    for (const el of els) for (const s of el.subs) if (s.closed && s.pts.length >= 3) {
      const cx = s.pts.reduce((sum, p) => sum + p[0], 0) / s.pts.length;
      const cy = s.pts.reduce((sum, p) => sum + p[1], 0) / s.pts.length;
      const area = shoelace(s.pts);
      const q = (cx >= center.x ? 0 : 2) + (cy < center.y ? 0 : 1); // NE=0, NW=2, SE=1, SW=3
      quadAreas[q] += area;
    }
    const totalQuad = quadAreas.reduce((a, b) => a + b, 0);
    if (totalQuad > 0) {
      const avgQuad = totalQuad / 4;
      const devQuad = quadAreas.reduce((sum, a) => sum + Math.abs(a - avgQuad), 0) / (4 * avgQuad);
      out.balanceCuadrantes = Math.max(0, Math.min(100, (1 - devQuad) * 100));
    } else {
      out.balanceCuadrantes = 0;
    }

    // Dispersión: uniformidad de la distribución de celdas en una rejilla 5×5
    // Mide qué tan uniforme está el detalle en la página (evita "agujeros" vacíos)
    const gridSize = 5;
    const cellCounts = Array(gridSize * gridSize).fill(0);
    const cellSize = (maxR * 2) / gridSize;
    for (const c of cells) {
      // Usar el centroide de la celda (aproximado por bbox)
      // Como no tenemos el centroide exacto, usamos el centro del bbox
      // Esto es una aproximación; para más precisión habría que calcular el centroide real
    }
    // Simplificación: contar celdas por cuadrante de la rejilla
    for (const el of els) for (const s of el.subs) if (s.closed && s.pts.length >= 3) {
      const cx = s.pts.reduce((sum, p) => sum + p[0], 0) / s.pts.length;
      const cy = s.pts.reduce((sum, p) => sum + p[1], 0) / s.pts.length;
      const gx = Math.floor((cx - (center.x - maxR)) / cellSize);
      const gy = Math.floor((cy - (center.y - maxR)) / cellSize);
      if (gx >= 0 && gx < gridSize && gy >= 0 && gy < gridSize) {
        cellCounts[gy * gridSize + gx]++;
      }
    }
    const totalCells = cellCounts.reduce((a, b) => a + b, 0);
    if (totalCells > 0) {
      const avgCell = totalCells / (gridSize * gridSize);
      const devCell = cellCounts.reduce((sum, c) => sum + Math.abs(c - avgCell), 0) / (gridSize * gridSize * avgCell);
      out.dispersion = Math.max(0, Math.min(100, (1 - devCell) * 100));
    } else {
      out.dispersion = 0;
    }
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
