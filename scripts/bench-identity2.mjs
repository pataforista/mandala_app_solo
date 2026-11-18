// Identificabilidad de estilo, segunda versión (rasgos de forma ampliados + LDA).
//   node scripts/bench-identity2.mjs [páginas por estilo=80] [nivel=adulto]
// El banco original (bench-identity.mjs: 7 rasgos, centroide más cercano) NO se toca, para que el antes
// y el después del roadmap sigan siendo comparables. Éste añade 17 rasgos (histograma de giros,
// orientación de los trazos respecto al radio, solidez y elongación de las celdas, distribución de
// áreas) y un análisis discriminante lineal. Imprime:
//   1. validación cruzada de 5 pliegues sobre un lote (semilla 4242), con el banco antiguo como referencia;
//   2. prueba con un lote NUEVO (semilla 9137) que el clasificador no vio al entrenar.
// Sigue siendo un proxy: mide si el dibujo es separable por máquina, no si una persona lo reconoce.
import { createDoc } from "../js/core/svgDoc.js";
import { renderDocToSvgString } from "../js/core/svgRender.js";
import { generateMandalaClassic } from "../js/generators/mandalaClassic.js";
import { flattenSubpaths } from "../js/core/commercialMetrics.js";
import { levelToGeneratorOpts } from "../js/core/levels.js";
import { planBook, bestSellerProfile, pageStrokeMm, BOOK_STYLES } from "../js/core/bookPlan.js";

const PER = Number(process.argv[2]) || 80, LEVEL = process.argv[3] || "adulto";
const PRESET = "KDP_8_5x11";
const base = { ...levelToGeneratorOpts(LEVEL), organicLevel: 0.2, textures: false, pageBorder: false };
const STY = BOOK_STYLES;
function pages(seed) {
  const out = {};
  for (const st of STY) {
    const plan = planBook({ count: PER, seed, ...bestSellerProfile(PRESET), styles: [st], styleWeights: [1], compositions: ["centro"], compositionWeights: [1],
      frames: ["ninguno"], frameWeights: [1], difficulty: "mixta", baseComplexity: base.complexity, fillCentro: false, useBackground: false });
    out[st] = plan.map(pg => {
      const doc = createDoc({ preset: PRESET, seed: pg.seed, marginMm: 12 });
      generateMandalaClassic(doc, { ...base, seed: pg.seed, complexity: pg.complexity, petals: pg.petals, styleMode: st, structure: pg.structure,
        silhouette: pg.silhouette, strokeWidthMm: pageStrokeMm(base.strokeWidthMm, pg.strokeScale ?? 1), center: { x: doc.page.wMm / 2, y: doc.page.hMm / 2 }, radius: 80 });
      return renderDocToSvgString(doc);
    });
  }
  return out;
}

// ---- rasgos v1 (copia congelada del banco) ----
function v1(svg) {
  let nL = 0, nC = 0, len = 0, sharp = 0, right = 0, closed = 0, circ = 0, tiny = 0, open = 0;
  for (const m of svg.matchAll(/<path\b[^>]*\sd="([^"]+)"/g)) {
    nL += (m[1].match(/[Ll]/g) || []).length; nC += (m[1].match(/[CcQqAa]/g) || []).length;
    for (const sub of flattenSubpaths(m[1])) {
      const p = sub.pts, n = p.length; if (n < 3) continue;
      let per = 0, area = 0;
      for (let i = 0; i < n; i++) { const a = p[i], b = p[(i + 1) % n]; if (!sub.closed && i === n - 1) break; per += Math.hypot(b[0] - a[0], b[1] - a[1]); area += a[0] * b[1] - b[0] * a[1]; }
      for (let i = sub.closed ? 0 : 1; i < (sub.closed ? n : n - 1); i++) {
        const a = p[(i - 1 + n) % n], b = p[i], c = p[(i + 1) % n];
        const u = [b[0] - a[0], b[1] - a[1]], w = [c[0] - b[0], c[1] - b[1]];
        const lu = Math.hypot(...u), lv = Math.hypot(...w); if (lu < 0.3 || lv < 0.3) continue;
        const t = Math.abs(Math.atan2(u[0] * w[1] - u[1] * w[0], u[0] * w[0] + u[1] * w[1])) * 180 / Math.PI;
        if (t > 40) sharp++; if (t > 75 && t < 105) right++;
      }
      len += per;
      if (sub.closed) { area = Math.abs(area) / 2; closed++; if (per > 0) circ += (4 * Math.PI * area) / (per * per); if (area < 12) tiny++; } else open++;
    }
  }
  const tot = Math.max(1, closed + open);
  return [nL / Math.max(1, nL + nC), sharp / Math.max(1, len) * 100, right / Math.max(1, sharp), circ / Math.max(1, closed), tiny / Math.max(1, closed), open / tot, Math.log(1 + closed)];
}

// ---- rasgos v2: forma de celda, orientación respecto al radio, ángulos ----
function hull(pts) { // casco convexo (monotone chain)
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (p.length < 3) return p;
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = []; for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const up = []; for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const polyArea = (p) => { let a = 0; for (let i = 0; i < p.length; i++) { const u = p[i], v = p[(i + 1) % p.length]; a += u[0] * v[1] - v[0] * u[1]; } return Math.abs(a) / 2; };
function v2(svg) {
  const vb = svg.match(/viewBox="([^"]+)"/)?.[1].split(/[\s,]+/).map(Number) || [0, 0, 215.9, 279.4];
  const cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2;
  const turn = [0, 0, 0, 0, 0]; let sharp = 0; // ~45, ~90, ~135, >150 (puntas), resto
  let segRad = 0, segTan = 0, segDiag = 0, segLen = 0;
  const solid = [], aspect = [], areas = [], radAl = [];
  let closed = 0, concave = 0, sym4 = 0;
  for (const m of svg.matchAll(/<path\b[^>]*\sd="([^"]+)"/g)) {
    for (const sub of flattenSubpaths(m[1])) {
      const p = sub.pts, n = p.length; if (n < 3) continue;
      for (let i = 0; i < n - (sub.closed ? 0 : 1); i++) {
        const a = p[i], b = p[(i + 1) % n], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
        if (L < 0.4) continue;
        const mx = (a[0] + b[0]) / 2 - cx, my = (a[1] + b[1]) / 2 - cy, rr = Math.hypot(mx, my) || 1;
        const cosr = Math.abs((dx * mx + dy * my) / (L * rr)); // 1 = radial, 0 = tangencial
        segLen += L; if (cosr > 0.92) segRad += L; else if (cosr < 0.38) segTan += L; else segDiag += L;
      }
      for (let i = sub.closed ? 0 : 1; i < (sub.closed ? n : n - 1); i++) {
        const a = p[(i - 1 + n) % n], b = p[i], c = p[(i + 1) % n];
        const u = [b[0] - a[0], b[1] - a[1]], w = [c[0] - b[0], c[1] - b[1]], lu = Math.hypot(...u), lv = Math.hypot(...w);
        if (lu < 0.4 || lv < 0.4) continue;
        const t = Math.abs(Math.atan2(u[0] * w[1] - u[1] * w[0], u[0] * w[0] + u[1] * w[1])) * 180 / Math.PI;
        if (t < 40) continue; sharp++;
        if (t < 65) turn[0]++; else if (t < 80) turn[1]++; else if (t < 100) turn[2]++; else if (t < 125) turn[3]++; else turn[4]++;
      }
      if (!sub.closed) continue;
      const A = polyArea(p); if (A < 3) continue; closed++;
      areas.push(Math.log(A));
      const H = hull(p), HA = polyArea(H); solid.push(HA > 0 ? A / HA : 1); if (HA > 0 && A / HA < 0.9) concave++;
      // elongación por PCA
      let mx = 0, my = 0; for (const q of p) { mx += q[0]; my += q[1]; } mx /= n; my /= n;
      let sxx = 0, syy = 0, sxy = 0; for (const q of p) { const x = q[0] - mx, y = q[1] - my; sxx += x * x; syy += y * y; sxy += x * y; }
      const tr = sxx + syy, det = sxx * syy - sxy * sxy, d = Math.sqrt(Math.max(0, tr * tr / 4 - det)), l1 = tr / 2 + d, l2 = Math.max(1e-6, tr / 2 - d);
      aspect.push(Math.sqrt(l1 / l2));
      // eje mayor vs radio
      const th = 0.5 * Math.atan2(2 * sxy, sxx - syy), rx = mx - cx, ry = my - cy, rl = Math.hypot(rx, ry) || 1;
      radAl.push(Math.abs(Math.cos(th) * rx / rl + Math.sin(th) * ry / rl));
    }
  }
  const mean = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
  const q = (a, f) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(f * s.length))]; };
  const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map(x => (x - m) ** 2))); };
  const S = Math.max(1, sharp);
  return [
    turn[0] / S, turn[1] / S, turn[2] / S, turn[3] / S, turn[4] / S,       // histograma de giros
    segRad / segLen, segTan / segLen, segDiag / segLen,                      // orientación respecto al radio
    mean(solid), concave / Math.max(1, closed),                              // solidez, % cóncavas
    Math.log(mean(aspect) || 1), aspect.filter(a => a > 3).length / Math.max(1, closed), // elongación
    mean(radAl), sd(areas), q(areas, 0.1), q(areas, 0.5), q(areas, 0.9),     // celdas
  ];
}
export const NAMES2 = ["g45", "g70", "g90", "g110", "g150+", "rad", "tan", "diag", "solidez", "cóncavas", "elong", "%largas", "ejeRadial", "sdArea", "A10", "A50", "A90"];



const feats = (D, fn) => Object.fromEntries(STY.map(s => [s, D[s].map(fn)]));
const both = (svg) => v1(svg).concat(v2(svg));
const A = pages(4242), B = pages(9137);
const FA1 = feats(A, v1), FA = feats(A, both), FB = feats(B, both);

const K = 5;
function fit(tr, kind) {
  const d = tr[0].x.length, mean = Array(d).fill(0), sd = Array(d).fill(0);
  for (const r of tr) r.x.forEach((v, j) => mean[j] += v / tr.length);
  for (const r of tr) r.x.forEach((v, j) => sd[j] += (v - mean[j]) ** 2 / tr.length);
  sd.forEach((v, j) => sd[j] = Math.sqrt(v) || 1);
  const z = (x) => x.map((v, j) => (v - mean[j]) / sd[j]);
  const T = tr.map(r => ({ s: r.s, z: z(r.x) }));
  const mu = Object.fromEntries(STY.map(s => { const t = T.filter(r => r.s === s); return [s, Array.from({ length: d }, (_, j) => t.reduce((a, r) => a + r.z[j], 0) / t.length)]; }));
  let inv = null;
  if (kind === "lda") {
    const C = Array.from({ length: d }, () => Array(d).fill(0));
    for (const r of T) for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) C[i][j] += (r.z[i] - mu[r.s][i]) * (r.z[j] - mu[r.s][j]) / T.length;
    for (let i = 0; i < d; i++) C[i][i] += 0.05; // regularización
    inv = invert(C);
  }
  return (x) => {
    const v = z(x);
    return STY.reduce((b, s) => {
      const diff = v.map((q, j) => q - mu[s][j]); let dd = 0;
      if (inv) { for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) dd += diff[i] * inv[i][j] * diff[j]; } else dd = diff.reduce((a, q) => a + q * q, 0);
      return dd < b[1] ? [s, dd] : b;
    }, [null, Infinity])[0];
  };
}
function invert(M) { const n = M.length, A = M.map((r, i) => r.concat(Array.from({ length: n }, (_, j) => +(i === j)))); for (let i = 0; i < n; i++) { let p = i; for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r; [A[i], A[p]] = [A[p], A[i]]; const v = A[i][i]; for (let j = 0; j < 2 * n; j++) A[i][j] /= v; for (let r = 0; r < n; r++) if (r !== i) { const f = A[r][i]; for (let j = 0; j < 2 * n; j++) A[r][j] -= f * A[i][j]; } } return A.map(r => r.slice(n)); }
const blank = () => Object.fromEntries(STY.map(s => [s, Object.fromEntries(STY.map(t => [t, 0]))]));
function cv(F, kind) {
  const conf = blank();
  for (let f = 0; f < K; f++) {
    const tr = [], te = [];
    for (const s of STY) F[s].forEach((x, i) => (i % K === f ? te : tr).push({ s, x }));
    const pred = fit(tr, kind);
    for (const r of te) conf[r.s][pred(r.x)]++;
  }
  return conf;
}
function report(name, conf, table) {
  let h = 0, n = 0; const per = {};
  for (const s of STY) { const t = Object.values(conf[s]).reduce((a, b) => a + b, 0); h += conf[s][s]; n += t; per[s] = Math.round(100 * conf[s][s] / t); }
  console.log(`${name.padEnd(42)} ${(100 * h / n).toFixed(1).padStart(5)} %   mínimo por estilo ${Math.min(...Object.values(per))} %   ` + STY.map(s => `${s.slice(0, 4)} ${per[s]}`).join(" | "));
  if (table) console.table(conf);
}
console.log(`Identificabilidad v2 · nivel ${LEVEL} · ${PER} páginas por estilo · azar ${(100 / STY.length).toFixed(1)} %`);
report("Referencia: 7 rasgos + centroide (CV 5)", cv(FA1, "centroide"));
report("24 rasgos + centroide (CV 5)", cv(FA, "centroide"));
report("24 rasgos + LDA (CV 5)", cv(FA, "lda"));
const pred = fit(STY.flatMap(s => FA[s].map(x => ({ s, x }))), "lda"), conf = blank();
for (const s of STY) for (const x of FB[s]) conf[s][pred(x)]++;
report("24 rasgos + LDA, lote nuevo (semilla 9137)", conf, true);
console.log("Meta del roadmap: ≥ 80 % global y ≥ 70 % en cada estilo.");
