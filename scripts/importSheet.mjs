// Importa una LÁMINA de dibujos de línea (varios animales en una imagen) como paquete de figuras de Mandala Studio.
// Separa cada animal por componentes conectados (la tinta se engorda para que las partes de un mismo animal se
// junten), lo recorta y lo pasa por processFigure, la misma función que usa la app al subir una imagen.
//
//   node scripts/importSheet.mjs lamina.jpg --names trex,triceratops,... --out lamina.json
//        [--theme prehistorico] [--use anillos|medallon|figura|extra] [--source "Gemini (generada por el usuario)"]
//        [--rights 1] [--grow 14] [--min 120] [--outlong 1500] [--hollow 1] [--stamp 0.002]
//        [--extras nido-huevo,volcan,...]  figuras de «ilustración extra» (decorado de fondo): sello grueso, uso «extra»
//        (--use extra marca así la lámina entera: adornos) [--debug carpeta]
//        [--skip 3,9,10]  descarta piezas por su número de lectura (el que imprime el script); [--prefix adorno]
//        nombra las que quedan adorno-01, adorno-02…
//
// Los nombres se asignan en orden de lectura (filas de arriba abajo, cada fila de izquierda a derecha). Sin --names se
// usan fig-01, fig-02… Requiere Playwright (ya instalado en este entorno) sólo para decodificar la imagen.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { processFigure, stampRaster } from "../js/core/lineArt.js";
import { encodeGrayPng, bytesToDataUrl } from "../js/core/grayPng.js";
import { withStamp } from "../js/core/figureImport.js";
import { packFigures } from "../js/core/figurePack.js";

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith("--"));
const args = Object.fromEntries(argv.reduce((a, v, i) => (v.startsWith("--") ? [...a, [v.slice(2), argv[i + 1]]] : a), []));
if (!file) { console.error("uso: node scripts/importSheet.mjs lamina.jpg --names a,b,c --out paquete.json"); process.exit(2); }
const GROW = parseInt(args.grow, 10) || 14, MIN_BOX = parseInt(args.min, 10) || 120, OUT_LONG = parseInt(args.outlong, 10) || 1500;
const STAMP = Number.isFinite(parseFloat(args.stamp)) ? parseFloat(args.stamp) : 0.002;
const EXTRAS = new Set((args.extras || "").split(",").filter(Boolean));
const EXTRA_STAMP = 0.025; // a ~20 mm de alto, 0.025 × alto = 0.5 mm de línea (el mínimo imprimible es ~0.26 mm)
const USE = ["anillos", "medallon", "figura", "extra"].includes(args.use) ? args.use : "anillos";
const outFile = path.resolve(args.out || "figuras-lamina.json");

// ---------- Decodificar la imagen a RGBA (el navegador sabe leer JPG/PNG/WebP) ----------
async function decode(imgPath) {
  const { chromium } = createRequire(import.meta.url)("playwright");
  const b = await chromium.launch(), p = await b.newPage();
  const b64 = fs.readFileSync(imgPath).toString("base64"), ext = path.extname(imgPath).slice(1).toLowerCase().replace("jpg", "jpeg");
  const r = await p.evaluate(async ([data, type]) => {
    const img = new Image(); img.src = `data:image/${type};base64,${data}`; await img.decode();
    const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; let s = "";
    for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000));
    return { w: c.width, h: c.height, b64: btoa(s) };
  }, [b64, ext]);
  await b.close();
  return { w: r.w, h: r.h, rgba: new Uint8ClampedArray(Buffer.from(r.b64, "base64")) };
}

// ---------- Segmentación ----------
function maxFilter(src, w, h, r) { // dilatación cuadrada separable
  const tmp = new Uint8Array(w * h), out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const row = y * w; let nextOn = 1e9;
    const on = new Int32Array(w).fill(1e9); for (let x = w - 1; x >= 0; x--) { if (src[row + x]) nextOn = x; on[x] = nextOn; }
    let prevOn = -1e9;
    for (let x = 0; x < w; x++) { if (src[row + x]) prevOn = x; tmp[row + x] = x - prevOn <= r || on[x] - x <= r ? 1 : 0; }
  }
  for (let x = 0; x < w; x++) {
    let prevOn = -1e9; const on = new Int32Array(h).fill(1e9); let nextOn = 1e9;
    for (let y = h - 1; y >= 0; y--) { if (tmp[y * w + x]) nextOn = y; on[y] = nextOn; }
    for (let y = 0; y < h; y++) { if (tmp[y * w + x]) prevOn = y; out[y * w + x] = y - prevOn <= r || on[y] - y <= r ? 1 : 0; }
  }
  return out;
}

function components(mask, w, h) {
  const lab = new Int32Array(w * h), st = new Int32Array(w * h), comps = [];
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || lab[s]) continue;
    const id = comps.length + 1; let top = 0, x0 = w, y0 = h, x1 = 0, y1 = 0, n = 0;
    st[top++] = s; lab[s] = id;
    while (top) {
      const i = st[--top], x = i % w, y = (i / w) | 0; n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx; if (mask[j] && !lab[j]) { lab[j] = id; st[top++] = j; }
      }
    }
    comps.push({ id, x0, y0, x1, y1, n });
  }
  return { lab, comps };
}

const { w, h, rgba } = await decode(path.resolve(file));
const ink = new Uint8Array(w * h);
for (let i = 0; i < ink.length; i++) ink[i] = 0.299 * rgba[i * 4] + 0.587 * rgba[i * 4 + 1] + 0.114 * rgba[i * 4 + 2] < 150 ? 1 : 0;
const { lab, comps } = components(maxFilter(ink, w, h, GROW), w, h);
// Fuera polvo y marcas: componentes con caja pequeña. Orden de lectura: por filas (cada fila = banda de ~alto/6).
const found = comps.filter((c) => c.x1 - c.x0 >= MIN_BOX && c.y1 - c.y0 >= MIN_BOX);
const rowH = Math.max(...found.map((c) => c.y1 - c.y0)) * 0.7;
found.sort((a, b) => Math.round((a.y0 + a.y1) / 2 / rowH) - Math.round((b.y0 + b.y1) / 2 / rowH) || (a.x0 + a.x1) - (b.x0 + b.x1));
const names = (args.names || "").split(",").filter(Boolean);
console.log(`${w}×${h}: ${found.length} figuras detectadas${names.length && names.length !== found.length ? ` (¡${names.length} nombres!)` : ""}`);
if (args.debug) fs.mkdirSync(args.debug, { recursive: true });

// Píxeles encerrados por el contorno de cada figura (ojos, bocas, puntos de un dado): con poco engorde quedan
// como componentes sueltos; se devuelven a su figura y dejan de contarse como figuras propias.
function enclosedBy(c, x0, y0, cw, ch) {
  const out = new Uint8Array(cw * ch), st = new Int32Array(cw * ch); let top = 0;
  const own = (i) => lab[(y0 + ((i / cw) | 0)) * w + x0 + (i % cw)] === c.id;
  for (let x = 0; x < cw; x++) for (const y of [0, ch - 1]) { const i = y * cw + x; if (!own(i) && !out[i]) { out[i] = 1; st[top++] = i; } }
  for (let y = 0; y < ch; y++) for (const x of [0, cw - 1]) { const i = y * cw + x; if (!own(i) && !out[i]) { out[i] = 1; st[top++] = i; } }
  while (top) {
    const i = st[--top], x = i % cw, y = (i / cw) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < cw - 1 ? i + 1 : -1, y > 0 ? i - cw : -1, y < ch - 1 ? i + cw : -1])
      if (j >= 0 && !out[j] && !own(j)) { out[j] = 1; st[top++] = j; }
  }
  return out; // 0 = de la figura (contorno o interior), 1 = fuera
}
const boxes = found.map((c) => {
  const m = 14, x0 = Math.max(0, c.x0 - m), y0 = Math.max(0, c.y0 - m), cw = Math.min(w, c.x1 + m) - x0, ch = Math.min(h, c.y1 + m) - y0;
  return { c, x0, y0, cw, ch, outside: enclosedBy(c, x0, y0, cw, ch) };
});
const absorbed = new Set();
for (const b of boxes) for (const o of found) {
  if (o === b.c || o.x0 < b.x0 || o.y0 < b.y0 || o.x1 >= b.x0 + b.cw || o.y1 >= b.y0 + b.ch) continue;
  const cx = ((o.x0 + o.x1) >> 1) - b.x0, cy = ((o.y0 + o.y1) >> 1) - b.y0;
  if (!b.outside[cy * b.cw + cx] && lab[(o.y0 + o.y1 >> 1) * w + (o.x0 + o.x1 >> 1)] !== b.c.id) absorbed.add(o);
}
if (absorbed.size) console.log(`  (${absorbed.size} piezas interiores devueltas a su figura)`);

const SKIP = new Set((args.skip || "").split(",").filter(Boolean).map(Number));
const figures = [];
for (const [k, { c, x0, y0, cw, ch, outside }] of boxes.filter((b) => !absorbed.has(b.c)).entries()) {
  if (SKIP.has(k + 1)) continue;
  // Sólo los píxeles de este animal y lo que encierra (los vecinos que asomen en la caja se borran); tinta original
  const crop = new Uint8ClampedArray(cw * ch * 4).fill(255);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const si = (y0 + y) * w + x0 + x;
    if (outside[y * cw + x] || (lab[si] !== c.id && !lab[si])) continue;
    for (let q = 0; q < 4; q++) crop[(y * cw + x) * 4 + q] = rgba[si * 4 + q];
  }
  const fig = processFigure(crop, cw, ch, { mode: "lineas", threshold: 110, removeBackground: true, keepMain: true, simplify: 0.3, outLong: OUT_LONG, hollow: args.hollow === "1" });
  const href = bytesToDataUrl(await encodeGrayPng(fig.gray, fig.w, fig.h));
  let interior = 0; for (const v of fig.cls) if (v === 1) interior++;
  // Sello (la versión que se repite en la corona): estos dibujos ya traen línea gruesa, así que se engorda poco
  // (la app, por defecto, la engorda un 1.6 % del lado largo y empasta ojos, dientes y dedos)
  const name = names[k] || (args.prefix ? `${args.prefix}-${String(figures.length + 1).padStart(2, "0")}` : `fig-${String(k + 1).padStart(2, "0")}`), extra = USE === "extra" || EXTRAS.has(name);
  const st = stampRaster(fig.cls, fig.w, fig.h, 720, extra ? EXTRA_STAMP : STAMP);
  const stampHref = bytesToDataUrl(await encodeGrayPng(st.gray, st.w, st.h));
  const entry = await withStamp({ href, cls: fig.cls, w: fig.w, h: fig.h, srcLong: Math.max(cw, ch), stampHref });
  figures.push({ ...entry, name, use: extra ? "extra" : USE, source: args.source || "", rightsConfirmed: args.rights === "1", theme: args.theme || "" });
  console.log(`  ${String(k + 1).padStart(2)} ${name.padEnd(18)} ${cw}×${ch} → ${fig.w}×${fig.h}, interior ${(100 * interior / fig.cls.length).toFixed(0)} %`);
  if (args.debug) fs.writeFileSync(path.join(args.debug, `${name}.png`), Buffer.from(href.split(",")[1], "base64"));
}
fs.writeFileSync(outFile, JSON.stringify(packFigures(figures)));
console.log(`${figures.length} figuras → ${outFile} (${(fs.statSync(outFile).size / 1024).toFixed(0)} KB)`);
