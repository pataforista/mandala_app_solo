// Exporta las figuras del motor de Zentangle (dinosaurios, críptidos, animales…) como un
// paquete de figuras de Mandala Studio (.json). En la app: Figuras → Importar paquete.
//
//   node scripts/exportZenFigures.mjs [--zen ../zentangle_app_solo_fixed] [--out figuras-zentangle.json]
//                                     [--sets dino,dinoOrigamiMix,cryptids,cryptidsOrigami,kids] [--only trex,yeti] [--size 1000]
//
// Cada figura se dibuja como contorno (silueta + piezas internas + detalles) sobre blanco.
// Las regiones cerradas del interior quedan como cls = 1 y las rellena figureFill.js con mandalas.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { withStamp } from "../js/core/figureImport.js";
import { encodeGrayPng, bytesToDataUrl } from "../js/core/grayPng.js";
import { packFigures } from "../js/core/figurePack.js";

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, all) => (v.startsWith("--") ? [...a, [v.slice(2), all[i + 1]]] : a), []));
const here = path.dirname(fileURLToPath(import.meta.url));
const zenDir = args.zen ? path.resolve(args.zen) : path.resolve(here, "../../zentangle_app_solo_fixed");
const outFile = path.resolve(args.out || "figuras-zentangle.json");
const SIZE = Math.max(400, parseInt(args.size, 10) || 1000); // lado largo en px
const INK_R = 2;                                             // radio de la línea (px)
const MIN_REGION = 0.0006;                                   // regiones menores (fracción del interior) → cls 3

// ---------- Cargar FIGURES del motor de Zentangle sin tocar su repositorio ----------
async function loadZen() {
  const gen = path.join(zenDir, "js/generators");
  const src = fs.readFileSync(path.join(gen, "figure.js"), "utf8");
  const tmp = path.join(gen, `_figure_export_${process.pid}.mjs`);
  fs.writeFileSync(tmp, `${src}\nexport { FIGURES };\n`);
  try {
    const mod = await import(pathToFileURL(tmp).href);
    const prng = await import(pathToFileURL(path.join(zenDir, "js/core/prng.js")).href);
    return { ...mod, createRNG: prng.createRNG };
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

// ---------- Silueta y líneas de una figura ----------
function figureRings(def, createRNG) {
  const d = { ...def, ...(def.build ? def.build(createRNG(12345)) : {}) };
  const parts = d.parts || [], back = d.back || [], front = d.front || [];
  const sil = (d.silhouetteFromParts ? [...parts, ...back].map((p) => p.cmds) : d.silhouette) || [];
  let deco = [];
  try { deco = typeof d.deco === "function" ? d.deco() : (d.deco || []); } catch { deco = []; }
  const lines = [...parts, ...back, ...front, ...deco].filter((p) => p && p.cmds).map((p) => p.cmds);
  return { sil: sil.flatMap(flatten), lines: [...sil, ...lines].flatMap(flatten) };
}

// ---------- Rasterizado ----------
function rasterize(rings) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rings) for (const [x, y] of r) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  if (!(x1 > x0 && y1 > y0)) return null;
  const pad = 10 + INK_R;
  const k = (SIZE - 2 * pad) / Math.max(x1 - x0, y1 - y0);
  const w = Math.round((x1 - x0) * k) + 2 * pad, h = Math.round((y1 - y0) * k) + 2 * pad;
  const ink = new Uint8Array(w * h);
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
  return { ink, w, h };
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

async function figureToEntry(name, def, createRNG) {
  const { lines } = figureRings(def, createRNG);
  const ras = rasterize(lines);
  if (!ras) return null;
  const { ink, w, h } = ras;
  const cls = classify(ink, w, h);
  const gray = new Uint8Array(w * h);
  for (let i = 0; i < gray.length; i++) gray[i] = ink[i] ? 0 : 255;
  const href = bytesToDataUrl(await encodeGrayPng(gray, w, h));
  const fig = await withStamp({ href, cls, w, h, srcLong: Math.max(w, h) });
  let inside = 0;
  for (const c of cls) if (c === 1) inside++;
  if (inside < w * h * 0.03) return { name, skipped: "sin regiones cerradas rellenables" };
  return { ...fig, name: `zentangle-${name}`, use: "figura", source: "Zentangle (motor propio)", rightsConfirmed: true };
}

const zen = await loadZen();
const sets = (args.sets || "dino,dinoOrigamiMix,cryptids,cryptidsOrigami,kids").split(",");
const wanted = args.only ? args.only.split(",") : [...new Set(sets.flatMap((s) => zen.FIGURE_SETS[s] || []))];
const figures = [], skipped = [];
for (const name of wanted) {
  const def = zen.FIGURES[name];
  if (!def) { skipped.push(`${name}: no existe`); continue; }
  const e = await figureToEntry(name, def, zen.createRNG);
  if (!e || e.skipped) skipped.push(`${name}: ${e?.skipped || "sin geometría"}`);
  else figures.push(e);
}
fs.writeFileSync(outFile, JSON.stringify(packFigures(figures)));
console.log(`${figures.length} figuras → ${outFile} (${(fs.statSync(outFile).size / 1024).toFixed(0)} KB)`);
if (skipped.length) console.log("Omitidas:\n  " + skipped.join("\n  "));
