// Banco de pruebas visual: genera lotes de páginas con cada motor y mide su legibilidad
// para colorear. Sólo lee; no cambia ningún generador.
//   node scripts/bench-metrics.mjs [semillas=24]
// Métricas por página:
//  - celdas: regiones cerradas (subtrayectos Z o de punto final coincidente)
//  - pequeñas: % de celdas con área < 6 mm²            (objetivo < 5 %)
//  - aspecto: % de celdas con w/h fuera de [0.4, 2.5]  (objetivo 0)
//  - huecos: % de vértices con un trazo de otro elemento a < 1,2 mm (objetivo ≤ 5 %)
//  - asimetría: fracción de vértices clásicos sin copia por rotación 2π/petals (objetivo 0)
//  - regiones: nº de celdas cerradas por página (objetivo 80–200 adulto, 25–60 niños)
import { createDoc } from "../js/core/svgDoc.js";
import { renderDocToSvgString } from "../js/core/svgRender.js";
import { generateMandalaClassic } from "../js/generators/mandalaClassic.js";
import { generateMandalaRadial } from "../js/generators/mandalaRadial.js";
import { generateMandalaLayers } from "../js/generators/mandalaLayers.js";

const SEEDS = Number(process.argv[2]) || 24;
const FORMATS = ["KDP_6x9", "KDP_8_5x11"];
const STYLES = ["sashiko", "floral", "geometric", "islamico", "azteca", "yantra", "celtico"];
const BASE = {
  complexity: 130, organicLevel: 0.25, strokeWidthMm: 0.55,
  includeFrames: true, pageBorder: true, kaleidoscope: true, textures: true,
  layer1Intensity: 0.85, layer2Intensity: 0.75, layer3Intensity: 0.8, layer4Intensity: 0.7,
  layer5Intensity: 0.55, layer6Intensity: 0.8, layer7Intensity: 0.65, layer8Intensity: 0.35,
};
const ENGINES = { classic: generateMandalaClassic, radial: generateMandalaRadial, layers: generateMandalaLayers };

// --- Geometría: subtrayectos aplanados (M/L/Q/C/Z absolutos, como los emite PathBuilder) ---
function flattenSubpaths(d) {
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
      const p0 = [cx, cy], pts = [p0, ...ctrl];
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

// Elementos (un <path> = un elemento) con sus subtrayectos
function elementsOf(svgFragments) {
  const els = [];
  for (const f of svgFragments) for (const m of f.matchAll(/ d="([^"]+)"/g)) els.push(flattenSubpaths(m[1]));
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

// Distancia mínima entre trazos de elementos distintos (rejilla de 2 mm para no comparar todo con todo)
function minGap(els) {
  const cell = 2, grid = new Map();
  const key = (gx, gy) => `${gx},${gy}`;
  els.forEach((subs, e) => subs.forEach(s => {
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
  // Devuelve % de vértices cuyo trazo ajeno más cercano está a menos de 1,2 mm.
  // Distancias < 0,05 mm son paredes compartidas entre celdas vecinas, no huecos.
  let total = 0, tight = 0;
  els.forEach((subs, e) => subs.forEach(s => s.pts.forEach(([x, y]) => {
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

// Fracción de vértices (clásico) que no tienen copia rotada 2π/n sobre un trazo
function asymmetry(els, n, center, tol = 0.15) {
  const verts = [];
  for (const subs of els) for (const s of subs) for (const p of s.pts) verts.push(p);
  const cell = 2, grid = new Map();
  const key = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  for (const subs of els) for (const s of subs) for (let k = 0; k + 1 < s.pts.length; k++) {
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

function measure(svg, { petals, center }) {
  const els = elementsOf([svg]);
  const cells = [];
  for (const subs of els) for (const s of subs) if (s.closed && s.pts.length >= 3) {
    const area = shoelace(s.pts);
    const { w, h } = bbox(s.pts);
    cells.push({ area, aspect: h > 0 ? w / h : Infinity });
  }
  const pct = (arr, f) => (arr.length ? (100 * arr.filter(f).length) / arr.length : 0);
  const out = {
    regiones: cells.length,
    pequenas: pct(cells, c => c.area < 6),
    aspecto: pct(cells, c => c.aspect < 0.4 || c.aspect > 2.5),
    huecos: minGap(els),
  };
  // Igual que las pruebas: en pétalos pares vale el orden N o N/2 (armónico)
  if (petals) out.asimetria = Math.min(...(petals % 2 === 0 ? [petals, petals / 2] : [petals]).map(n => asymmetry(els, n, center)));
  return out;
}

function run(engine, seed, format) {
  const petals = 6 + (seed % 10) * 2;
  const opts = { ...BASE, seed, petals, styleMode: STYLES[seed % STYLES.length], pageBorder: false };
  const doc = createDoc({ preset: format, seed, marginMm: 10 });
  ENGINES[engine](doc, opts);
  const svg = renderDocToSvgString(doc);
  const center = { x: doc.page.wMm / 2, y: doc.page.hMm / 2 };
  return measure(svg, { petals: engine === "classic" ? petals : null, center });
}

const avg = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const rows = [];
for (const engine of Object.keys(ENGINES)) for (const format of FORMATS) {
  const res = [];
  for (let seed = 1; seed <= SEEDS; seed++) res.push(run(engine, seed, format));
  const row = {
    motor: engine, formato: format,
    regiones: avg(res.map(r => r.regiones)).toFixed(0),
    "pequeñas%": avg(res.map(r => r.pequenas)).toFixed(1),
    "aspecto%": avg(res.map(r => r.aspecto)).toFixed(1),
    "huecos%": avg(res.map(r => r.huecos)).toFixed(1),
    "asimetría (peor)": res.some(r => r.asimetria !== undefined) ? Math.max(...res.map(r => r.asimetria ?? 0)).toFixed(3) : "n/a",
  };
  rows.push(row);
}
console.table(rows);
