// Exporta las figuras del motor de Zentangle (dinosaurios, críptidos, animales…) como un
// paquete de figuras de Mandala Studio (.json). En la app: Figuras → Importar paquete.
//
//   node scripts/exportZenFigures.mjs [--zen ../zentangle_app_solo_fixed] [--out figuras-zentangle.json]
//                                     [--sets dino,dinoOrigamiMix,cryptids,cryptidsOrigami,kids] [--only trex,yeti] [--size 1000]
//                                     [--use anillos|figura|medallon] [--detail 0.3] [--echo 56] [--scales 100]
//
// Cada figura se dibuja como contorno (silueta + piezas internas + detalles) sobre blanco.
// --detail (0 = pocas, 1 = muchas): cuerdas que subdividen cada pieza en celdas coloreables,
// las mismas que usa Zentangle (makeSections), recortadas al interior de la pieza.
// --scales (px): escamas (arcos en rejilla hexagonal) en las regiones amplias de dinosaurios y criaturas
// escamosas; sustituyen a los ecos en esas figuras.
// --echo (px): líneas paralelas al contorno por dentro (ecos), que siguen la anatomía de cada región.
// Uso por defecto «anillos»: copias de la figura en corona alrededor de un mandala (pageComposer).
// Con --use figura, las regiones cerradas (cls = 1) las rellena figureFill.js con mandalas.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { withStamp } from "../js/core/figureImport.js";
import { encodeGrayPng, bytesToDataUrl } from "../js/core/grayPng.js";
import { packFigures } from "../js/core/figurePack.js";
import { distanceTransform } from "../js/core/lineArt.js";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith("--") ? [...a, [v.slice(2), all[i + 1]]] : a), []));
const here = path.dirname(fileURLToPath(import.meta.url));
const zenDir = args.zen ? path.resolve(args.zen) : path.resolve(here, "../../zentangle_app_solo_fixed");
const outFile = path.resolve(args.out || "figuras-zentangle.json");
const SIZE = Math.max(400, parseInt(args.size, 10) || 1000); // lado largo en px
const USE = ["anillos", "figura", "medallon"].includes(args.use) ? args.use : "anillos";
const DETAIL = Number.isFinite(parseFloat(args.detail)) ? Math.min(1, Math.max(0, parseFloat(args.detail))) : 0.3;
const ECHO_PX = Number.isFinite(parseFloat(args.echo)) ? Math.max(0, parseFloat(args.echo)) : 56; // ancho de banda de los ecos (0 = sin ecos)
const SCALE_PX = Number.isFinite(parseFloat(args.scales)) ? Math.max(0, parseFloat(args.scales)) : 100; // ancho de cada escama (0 = sin escamas)
const SCALY = new Set(["nessie", "fish", "kraken"]);    // además de los de science: "dino" (menos ammonite)
const MIN_CELL_PX = 30;                                      // radio mínimo de una celda coloreable (≈1.7 mm a 55 mm de alto)
const U = 100;                                               // unidades de figura → «mm» que espera makeSections
const INK_R = 2;                                             // radio de la línea (px)
const MIN_REGION = 0.0006;                                   // regiones menores (fracción del interior) → cls 3

// ---------- Cargar FIGURES del motor de Zentangle sin tocar su repositorio ----------
async function loadZen() {
  const gen = path.join(zenDir, "js/generators");
  const src = fs.readFileSync(path.join(gen, "figure.js"), "utf8");
  const tmp = path.join(gen, `_figure_export_${process.pid}.mjs`);
  fs.writeFileSync(tmp, `${src}\nexport { FIGURES, makeSections, flatten as zenFlatten, inside as zenInside };\n`);
  try {
    const mod = await import(pathToFileURL(tmp).href);
    const prng = await import(pathToFileURL(path.join(zenDir, "js/core/prng.js")).href);
    return { ...mod, createRNG: prng.createRNG, hash: prng.hash };
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}

// ---------- Comandos M/L/Q/C/Z → anillos de puntos ----------
function flatten(cmds) {
  const rings = [];
  let cur = null, px = 0, py = 0, sx = 0, sy = 0;
  const push = (x, y) => { cur.push([x, y]); px = x; py = y; };
  for (const [op, ...a] of cmds) {
    if (op === "M") { cur = []; rings.push(cur); push(a[0], a[1]); sx = a[0]; sy = a[1]; }
    else if (op === "L" && cur) push(a[0], a[1]);
    else if (op === "Q" && cur) {
      const x0 = px, y0 = py;
      for (let s = 1; s <= 16; s++) { const t = s / 16, m = 1 - t; push(m * m * x0 + 2 * m * t * a[0] + t * t * a[2], m * m * y0 + 2 * m * t * a[1] + t * t * a[3]); }
    } else if (op === "C" && cur) {
      const x0 = px, y0 = py;
      for (let s = 1; s <= 24; s++) {
        const t = s / 24, m = 1 - t;
        push(m * m * m * x0 + 3 * m * m * t * a[0] + 3 * m * t * t * a[2] + t * t * t * a[4], m * m * m * y0 + 3 * m * m * t * a[1] + 3 * m * t * t * a[3] + t * t * t * a[5]);
      }
    } else if (op === "Z" && cur) push(sx, sy);
  }
  return rings.filter((r) => r.length > 1);
}

// ---------- Cuerdas de Zentangle recortadas al interior de cada pieza ----------
function stringLines(name, parts, zen) {
  const out = [];
  parts.forEach((p, idx) => {
    if (!p.strings || !p.cmds) return;
    const rings = zen.zenFlatten(p.cmds, (u, v) => [u * U, v * U]);
    if (!rings.length) return;
    const rng = zen.createRNG(zen.hash(0x5eed, idx + name.length * 31));
    const sec = zen.makeSections(rng, rings, p.strings, 1.9, DETAIL);
    for (const line of sec.lines) {
      // Remuestreo fino: el recorte debe terminar pegado al contorno para cerrar la celda
      const pts = [];
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1], b = line[i], n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 0.5));
        for (let k = 0; k < n; k++) pts.push({ x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n });
      }
      const ins = pts.map((q) => zen.zenInside(rings, q.x, q.y));
      let cur = [];
      pts.forEach((q, i) => {
        if (ins[i] || ins[i - 1] || ins[i + 1]) cur.push([q.x / U, q.y / U]);
        else if (cur.length) { out.push(cur); cur = []; }
      });
      if (cur.length) out.push(cur);
    }
  });
  return out.filter((r) => r.length > 1);
}

// ---------- Silueta y líneas de una figura ----------
function figureRings(name, def, zen) {
  const d = { ...def, ...(def.build ? def.build(zen.createRNG(12345)) : {}) };
  const parts = d.parts || [], back = d.back || [], front = d.front || [];
  const sil = (d.silhouetteFromParts ? [...parts, ...back].map((p) => p.cmds) : d.silhouette) || [];
  let deco = [];
  try { deco = typeof d.deco === "function" ? d.deco() : (d.deco || []); } catch { deco = []; }
  const lines = [...parts, ...back, ...front, ...deco].filter((p) => p && p.cmds).map((p) => p.cmds);
  const strings = DETAIL > 0 ? stringLines(name, parts, zen) : [];
  return { lines: [...sil, ...lines].flatMap(flatten), strings };
}

// ---------- Rasterizado ----------
function frameOf(rings) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rings) for (const [x, y] of r) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  if (!(x1 > x0 && y1 > y0)) return null;
  const pad = 10 + INK_R;
  const k = (SIZE - 2 * pad) / Math.max(x1 - x0, y1 - y0);
  return { x0, y0, k, pad, w: Math.round((x1 - x0) * k) + 2 * pad, h: Math.round((y1 - y0) * k) + 2 * pad };
}

function drawRings(ink, fr, rings) {
  const { w, h, x0, y0, k, pad } = fr;
  const disk = (cx, cy) => {
    for (let dy = -INK_R; dy <= INK_R; dy++) for (let dx = -INK_R; dx <= INK_R; dx++) {
      if (dx * dx + dy * dy > INK_R * INK_R + 1) continue;
      const x = cx + dx, y = cy + dy;
      if (x >= 0 && y >= 0 && x < w && y < h) ink[y * w + x] = 1;
    }
  };
  for (const r of rings) {
    for (let i = 1; i < r.length; i++) {
      const ax = (r[i - 1][0] - x0) * k + pad, ay = (r[i - 1][1] - y0) * k + pad;
      const bx = (r[i][0] - x0) * k + pad, by = (r[i][1] - y0) * k + pad;
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay)));
      for (let s = 0; s <= n; s++) disk(Math.round(ax + (bx - ax) * s / n), Math.round(ay + (by - ay) * s / n));
    }
  }
}

// Celdas interiores donde no cabe un círculo de MIN_CELL_PX: al estampar la figura con trazo
// grueso quedarían rellenas de tinta y no se podrían colorear.
function tinyCells(ink, w, h) {
  const dt = distanceTransform(ink, w, h, false);
  const lab = new Int32Array(w * h), stack = new Int32Array(w * h);
  let tiny = 0;
  for (let s = 0; s < ink.length; s++) {
    if (ink[s] || lab[s]) continue;
    let top = 0, best = 0, outside = false;
    stack[top++] = s; lab[s] = 1;
    while (top) {
      const i = stack[--top], x = i % w, y = (i / w) | 0;
      if (dt[i] > best) best = dt[i];
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) outside = true;
      if (x > 0 && !ink[i - 1] && !lab[i - 1]) { lab[i - 1] = 1; stack[top++] = i - 1; }
      if (x < w - 1 && !ink[i + 1] && !lab[i + 1]) { lab[i + 1] = 1; stack[top++] = i + 1; }
      if (y > 0 && !ink[i - w] && !lab[i - w]) { lab[i - w] = 1; stack[top++] = i - w; }
      if (y < h - 1 && !ink[i + w] && !lab[i + w]) { lab[i + w] = 1; stack[top++] = i + w; }
    }
    if (!outside && best < MIN_CELL_PX) tiny++;
  }
  return tiny;
}

// cls: 0 tinta, 1 interior, 2 fondo (conectado al borde), 3 interior diminuto
function classify(ink, w, h) {
  const cls = new Uint8Array(w * h);
  const lab = new Int32Array(w * h); // 0 sin visitar
  const stack = new Int32Array(w * h);
  const comps = [];
  let n = 0;
  for (let s = 0; s < ink.length; s++) {
    if (ink[s] || lab[s]) continue;
    n++;
    let top = 0, size = 0, outside = false;
    stack[top++] = s; lab[s] = n;
    while (top) {
      const i = stack[--top]; size++;
      const x = i % w, y = (i / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) outside = true;
      if (x > 0 && !ink[i - 1] && !lab[i - 1]) { lab[i - 1] = n; stack[top++] = i - 1; }
      if (x < w - 1 && !ink[i + 1] && !lab[i + 1]) { lab[i + 1] = n; stack[top++] = i + 1; }
      if (y > 0 && !ink[i - w] && !lab[i - w]) { lab[i - w] = n; stack[top++] = i - w; }
      if (y < h - 1 && !ink[i + w] && !lab[i + w]) { lab[i + w] = n; stack[top++] = i + w; }
    }
    comps[n] = { size, outside };
  }
  let insideArea = 0;
  for (let c = 1; c <= n; c++) if (!comps[c].outside) insideArea += comps[c].size;
  for (let i = 0; i < cls.length; i++) {
    if (ink[i]) continue;
    const c = comps[lab[i]];
    cls[i] = c.outside ? 2 : c.size < insideArea * MIN_REGION ? 3 : 1;
  }
  return cls;
}

// Escamas: arcos «de pez» en rejilla hexagonal, sólo donde la escama cabe entera dentro de una
// región interior (sin tocar la tinta). Filas separadas media escama; las vecinas se cierran entre sí.
function addScales(ink, w, h) {
  if (!SCALE_PX) return 0;
  const dt = distanceTransform(ink, w, h, false);
  // Regiones interiores (las conectadas al borde son el fondo)
  const lab = new Int32Array(w * h), stack = new Int32Array(w * h), out = [];
  for (let s0 = 0; s0 < ink.length; s0++) {
    if (ink[s0] || lab[s0]) continue;
    const id = out.length + 1;
    let top = 0, edge = false;
    stack[top++] = s0; lab[s0] = id;
    while (top) {
      const i = stack[--top], x = i % w, y = (i / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
      if (x > 0 && !ink[i - 1] && !lab[i - 1]) { lab[i - 1] = id; stack[top++] = i - 1; }
      if (x < w - 1 && !ink[i + 1] && !lab[i + 1]) { lab[i + 1] = id; stack[top++] = i + 1; }
      if (y > 0 && !ink[i - w] && !lab[i - w]) { lab[i - w] = id; stack[top++] = i - w; }
      if (y < h - 1 && !ink[i + w] && !lab[i + w]) { lab[i + w] = id; stack[top++] = i + w; }
    }
    out.push(edge);
  }
  const R = SCALE_PX / 2, fr = { w, h, x0: 0, y0: 0, k: 1, pad: 0 };
  const arcs = [];
  for (let row = 0, y = R; y < h - R; row++, y += R) {
    for (let x = R + (row % 2 ? R : 0); x < w - R; x += SCALE_PX) {
      const pts = [];
      let ok = true;
      for (let a = 0; a <= 24 && ok; a++) {
        const t = (a / 24) * Math.PI, px = Math.round(x + R * Math.cos(t)), py = Math.round(y + R * Math.sin(t));
        const i = py * w + px;
        // El arco entero dentro de una región interior, a ≥ 9 px de cualquier línea (salvo las puntas)
        if (px < 0 || py < 0 || px >= w || py >= h || ink[i] || out[lab[i] - 1] !== false) { ok = false; break; }
        if (a > 1 && a < 23 && dt[i] < 9) ok = false;
        pts.push([px, py]);
      }
      if (ok) arcs.push(pts);
    }
  }
  drawRings(ink, fr, arcs);
  return arcs.length;
}

// Ecos: en cada región interior grande, una línea paralela al contorno a ECHO_PX de distancia
// (curva de nivel de la transformada de distancia). Sólo si el núcleo que queda sigue siendo coloreable.
function addEchoes(ink, w, h) {
  if (!ECHO_PX) return 0;
  const dt = distanceTransform(ink, w, h, false);
  const lab = new Int32Array(w * h), stack = new Int32Array(w * h), comps = [null];
  for (let s = 0; s < ink.length; s++) {
    if (ink[s] || lab[s]) continue;
    const id = comps.length, c = { best: 0, outside: false };
    comps.push(c);
    let top = 0;
    stack[top++] = s; lab[s] = id;
    while (top) {
      const i = stack[--top], x = i % w, y = (i / w) | 0;
      if (dt[i] > c.best) c.best = dt[i];
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) c.outside = true;
      if (x > 0 && !ink[i - 1] && !lab[i - 1]) { lab[i - 1] = id; stack[top++] = i - 1; }
      if (x < w - 1 && !ink[i + 1] && !lab[i + 1]) { lab[i + 1] = id; stack[top++] = i + 1; }
      if (y > 0 && !ink[i - w] && !lab[i - w]) { lab[i - w] = id; stack[top++] = i - w; }
      if (y < h - 1 && !ink[i + w] && !lab[i + w]) { lab[i + w] = id; stack[top++] = i + w; }
    }
  }
  const lines = new Uint8Array(w * h);
  let n = 0;
  for (let i = 0; i < ink.length; i++) {
    const c = comps[lab[i]];
    if (!c || c.outside) continue;
    for (let k = 1; k <= 2; k++) {
      const level = k * ECHO_PX;
      if (c.best >= level + MIN_CELL_PX + 2 && Math.abs(dt[i] - level) <= 1.5) { lines[i] = 1; n++; }
    }
  }
  for (let i = 0; i < ink.length; i++) if (lines[i]) ink[i] = 1;
  return n;
}

async function figureToEntry(name, def, zen) {
  const { lines, strings } = figureRings(name, def, zen);
  const fr = frameOf(lines);
  if (!fr) return null;
  const { w, h } = fr;
  const ink = new Uint8Array(w * h);
  drawRings(ink, fr, lines);
  // Cuerdas de Zentangle: las más largas primero; una cuerda se queda sólo si no crea celdas
  // que no se puedan colorear (más pequeñas que MIN_CELL_PX)
  let kept = 0, tiny = tinyCells(ink, w, h);
  for (const line of [...strings].sort((a, b) => b.length - a.length)) {
    const trial = ink.slice();
    drawRings(trial, fr, [line]);
    const t = tinyCells(trial, w, h);
    if (t <= tiny) { ink.set(trial); tiny = t; kept++; }
  }
  const scaly = def.science === "dino" && name !== "ammonite" || SCALY.has(name);
  const scales = scaly ? addScales(ink, w, h) : 0;
  const echoes = scaly && scales ? 0 : addEchoes(ink, w, h);
  const cls = classify(ink, w, h);
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i++) gray[i] = ink[i] ? 0 : 255;
  const href = bytesToDataUrl(await encodeGrayPng(gray, w, h));
  const fig = await withStamp({ href, cls, w, h, srcLong: Math.max(w, h) });
  let inside = 0;
  for (const c of cls) if (c === 1) inside++;
  if (inside < w * h * 0.03) return { name, skipped: "sin regiones cerradas rellenables" };
  console.log(`  ${name}: ${kept}/${strings.length} cuerdas, ${scales ? scales + " escamas" : echoes ? "con ecos" : "sin ecos"}`);
  return { ...fig, name: `zentangle-${name}`, use: USE, source: "Zentangle (motor propio)", rightsConfirmed: true };
}

const zen = await loadZen();
const sets = (args.sets || "dino,dinoOrigamiMix,cryptids,cryptidsOrigami,kids").split(",");
const wanted = args.only ? args.only.split(",") : [...new Set(sets.flatMap((s) => zen.FIGURE_SETS[s] || []))];
const figures = [], skipped = [];
for (const name of wanted) {
  const def = zen.FIGURES[name];
  if (!def) { skipped.push(`${name}: no existe`); continue; }
  const e = await figureToEntry(name, def, zen);
  if (!e || e.skipped) skipped.push(`${name}: ${e?.skipped || "sin geometría"}`);
  else figures.push(e);
}
fs.writeFileSync(outFile, JSON.stringify(packFigures(figures)));
console.log(`${figures.length} figuras → ${outFile} (${(fs.statSync(outFile).size / 1024).toFixed(0)} KB)`);
if (skipped.length) console.log("Omitidas:\n  " + skipped.join("\n  "));
