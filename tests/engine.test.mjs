// Pruebas del motor generativo (sin DOM): `npm test`
import { test } from "node:test";
import assert from "node:assert/strict";
import { createDoc } from "../js/core/svgDoc.js";
import { renderDocToSvgString } from "../js/core/svgRender.js";
import { generateMandalaLayers } from "../js/generators/mandalaLayers.js";
import { generateMandalaRadial } from "../js/generators/mandalaRadial.js";

const STYLES = ["sashiko", "floral", "geometric", "islamico", "azteca", "yantra", "celtico"];
const BASE = {
  complexity: 130, organicLevel: 0.25, strokeWidthMm: 0.55,
  includeFrames: true, pageBorder: true, kaleidoscope: true, textures: true,
  layer1Intensity: 0.85, layer2Intensity: 0.75, layer3Intensity: 0.8, layer4Intensity: 0.7,
  layer5Intensity: 0.55, layer6Intensity: 0.8, layer7Intensity: 0.65, layer8Intensity: 0.35,
};
const CENTER = { x: 105, y: 148.5 };

function render(gen, opts) {
  const doc = createDoc({ preset: "A4", seed: opts.seed });
  gen(doc, opts);
  return { doc, svg: renderDocToSvgString(doc) };
}

// --- Geometría: aplanar paths SVG (M/L/Q/C/Z absolutos) en segmentos ---
function flattenPath(d) {
  const tok = d.trim().split(/\s+/);
  const segs = [];
  let i = 0, cx = 0, cy = 0, sx = 0, sy = 0;
  const num = () => parseFloat(tok[i++]);
  while (i < tok.length) {
    const c = tok[i++];
    if (c === "M") { cx = num(); cy = num(); sx = cx; sy = cy; }
    else if (c === "L") { const x = num(), y = num(); segs.push([cx, cy, x, y]); cx = x; cy = y; }
    else if (c === "Z") { segs.push([cx, cy, sx, sy]); cx = sx; cy = sy; }
    else if (c === "Q" || c === "C") {
      const pts = c === "Q" ? [[cx, cy], [num(), num()], [num(), num()]]
                            : [[cx, cy], [num(), num()], [num(), num()], [num(), num()]];
      let px = cx, py = cy;
      for (let k = 1; k <= 12; k++) {
        const t = k / 12;
        let p = pts.map(q => q.slice());
        while (p.length > 1) p = p.slice(1).map((q, j) => [p[j][0] + (q[0] - p[j][0]) * t, p[j][1] + (q[1] - p[j][1]) * t]);
        segs.push([px, py, p[0][0], p[0][1]]); px = p[0][0]; py = p[0][1];
      }
      cx = px; cy = py;
    } else throw new Error(`Comando SVG inesperado: ${c}`);
  }
  return segs;
}

function segmentsOf(svgFragments) {
  const segs = [];
  for (const f of svgFragments) for (const m of f.matchAll(/ d="([^"]+)"/g)) segs.push(...flattenPath(m[1]));
  return segs;
}

function distToSeg(px, py, [ax, ay, bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Fracción de vértices que, rotados 2π/n alrededor del centro, NO caen sobre ningún trazo.
function asymmetryRatio(segs, n, tol = 0.15) {
  const cell = 2, grid = new Map();
  const key = (x, y) => `${Math.floor(x / cell)},${Math.floor(y / cell)}`;
  for (const s of segs) {
    const [x0, x1] = [Math.min(s[0], s[2]) - tol, Math.max(s[0], s[2]) + tol];
    const [y0, y1] = [Math.min(s[1], s[3]) - tol, Math.max(s[1], s[3]) + tol];
    for (let gx = Math.floor(x0 / cell); gx <= Math.floor(x1 / cell); gx++)
      for (let gy = Math.floor(y0 / cell); gy <= Math.floor(y1 / cell); gy++) {
        const k = `${gx},${gy}`;
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(s);
      }
  }
  const a = (2 * Math.PI) / n, cos = Math.cos(a), sin = Math.sin(a);
  let miss = 0;
  for (const [x, y] of segs) {
    const rx = CENTER.x + (x - CENTER.x) * cos - (y - CENTER.y) * sin;
    const ry = CENTER.y + (x - CENTER.x) * sin + (y - CENTER.y) * cos;
    const cand = grid.get(key(rx, ry)) || [];
    if (!cand.some(s => distToSeg(rx, ry, s) <= tol)) miss++;
  }
  return miss / Math.max(1, segs.length);
}

test("ambos generadores son deterministas y no emiten NaN/undefined", () => {
  for (const gen of [generateMandalaLayers, generateMandalaRadial]) {
    for (let s = 1; s <= 40; s++) {
      for (const petals of [3, 5, 6, 7, 10, 12, 16, 24]) {
        const opts = { ...BASE, seed: (s * 2654435761) >>> 0, petals, styleMode: STYLES[s % STYLES.length],
          complexity: 20 + (s * 37) % 300, organicLevel: (s % 5) / 4, spiroEnabled: s % 7 === 0 };
        const a = render(gen, opts).svg;
        assert.doesNotMatch(a, /NaN|Infinity|undefined|\[object/, `${gen.name} seed=${opts.seed} petals=${petals}`);
        assert.equal(render(gen, opts).svg, a, `${gen.name} no determinista seed=${opts.seed}`);
      }
    }
  }
});

test("layers: los anillos L2–L7 y los marcos respetan la simetría de petals", () => {
  // Pétalos primos: cualquier conteo armónico (divisor o múltiplo) conserva la
  // simetría completa. Sin texturas (L8 lleva jitter) ni núcleo (variantes de estilo).
  for (const petals of [5, 7, 11, 13]) {
    for (const styleMode of STYLES) {
      for (const seed of [1, 99, 4242]) {
        for (const complexity of [40, 160, 300]) {
          const { doc } = render(generateMandalaLayers, {
            ...BASE, seed, petals, styleMode, complexity, textures: false, pageBorder: false, layer1Intensity: 0,
          });
          const ratio = asymmetryRatio(segmentsOf(doc.body), petals);
          assert.ok(ratio === 0, `asimetría ${(ratio * 100).toFixed(2)}% petals=${petals} ${styleMode} seed=${seed} c=${complexity}`);
        }
      }
    }
  }
});

test("radial: núcleo y marcos fuera del wedge comparten la simetría de las cuñas", () => {
  for (const petals of [4, 5, 6, 7, 9, 10, 12, 14]) {
    // Acentos cardinales (brújula) pueden tener un orden menor, siempre que divida a petals
    const orders = [petals];
    for (let d = petals - 1; d >= 3; d--) if (petals % d === 0) orders.push(d);
    for (let seed = 1; seed <= 25; seed++) {
      const { doc } = render(generateMandalaRadial, { ...BASE, seed, petals, pageBorder: false });
      doc.body.filter(f => f.startsWith("<path")).forEach((frag, i) => {
        const segs = segmentsOf([frag]);
        const ok = orders.some(n => asymmetryRatio(segs, n) === 0);
        assert.ok(ok, `fragmento ${i} asimétrico petals=${petals} seed=${seed}: ${frag.slice(0, 60)}`);
      });
    }
  }
});

test("radial: cada cuña cae en su eje y el espejado refleja sobre el eje propio", () => {
  for (const petals of [5, 6, 7, 9, 10, 12]) {
    for (let seed = 1; seed <= 20; seed++) {
      const { doc } = render(generateMandalaRadial, { ...BASE, seed, petals });
      const uses = doc.body.filter(f => f.startsWith("<use"));
      assert.equal(uses.length, petals);
      uses.forEach((u, k) => {
        const [, rot] = u.match(/rotate\((-?[\d.]+)\)/);
        const [, sx, sy] = u.match(/scale\((-?[\d.]+) (-?[\d.]+)\)/).map(Number);
        const expected = (k * 360) / petals - 90;
        assert.ok(Math.abs(+rot - expected) < 3, `cuña ${k} rot=${rot} esperado≈${expected}`);
        assert.ok(sx > 0, `cuña ${k}: el espejado no debe invertir X (la desplaza 180°)`);
        if (petals % 2 === 1) assert.ok(sy > 0, `cuña ${k}: sin espejado con pétalos impares`);
      });
    }
  }
});
