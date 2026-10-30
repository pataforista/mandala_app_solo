#!/usr/bin/env node
// Semáforo de coloreabilidad de un paquete de figuras (.json), en milímetros reales: ¿qué zonas cerradas de cada
// figura caben un lápiz? Mide sobre el sello (la versión que se repite en la corona) con la figura a 45 mm de alto.
//
//   node scripts/checkFigures.mjs assets/figuras-dinosaurios.json [--mm 45] [--min 4] [--json]
//
// verde: todas las zonas ≥ --min mm de diámetro inscrito · amarillo: hasta 3 zonas menores · rojo: más.
// Los puntos (zonas de < 1.5 mm² a esa escala: ojos, pupilas) no cuentan: no se colorean.
import fs from "node:fs";
import { unpackFigures } from "../js/core/figurePack.js";
import { stampRaster, distanceTransform } from "../js/core/lineArt.js";

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith("--"));
const opt = (k, d) => { const i = argv.indexOf("--" + k); return i >= 0 ? parseFloat(argv[i + 1]) : d; };
if (!file) { console.error("uso: node scripts/checkFigures.mjs paquete.json [--mm 45] [--min 4] [--stamp 0.002]"); process.exit(2); }
const MM = opt("mm", 45), MIN = opt("min", 4), STAMP = opt("stamp", 0.002), DOT_MM2 = 1.5;

function zonesOf(fig) {
  const st = stampRaster(fig.cls, fig.w, fig.h, 720, STAMP), { w, h } = st, free = new Uint8Array(w * h);
  for (let i = 0; i < free.length; i++) free[i] = st.gray[i] > 128 ? 0 : 1; // distanceTransform: 1 = bloqueado (tinta)
  const ink = free, dt = distanceTransform(ink, w, h, false);
  const lab = new Int32Array(w * h), stack = new Int32Array(w * h), zones = [];
  for (let s = 0; s < ink.length; s++) {
    if (ink[s] || lab[s]) continue;
    let top = 0, n = 0, best = 0, edge = false;
    stack[top++] = s; lab[s] = 1;
    while (top) {
      const i = stack[--top], x = i % w, y = (i / w) | 0; n++;
      if (dt[i] > best) best = dt[i];
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true;
      if (x > 0 && !ink[i - 1] && !lab[i - 1]) { lab[i - 1] = 1; stack[top++] = i - 1; }
      if (x < w - 1 && !ink[i + 1] && !lab[i + 1]) { lab[i + 1] = 1; stack[top++] = i + 1; }
      if (y > 0 && !ink[i - w] && !lab[i - w]) { lab[i - w] = 1; stack[top++] = i - w; }
      if (y < h - 1 && !ink[i + w] && !lab[i + w]) { lab[i + w] = 1; stack[top++] = i + w; }
    }
    if (edge) continue; // fondo
    const mmPerPx = MM / h, areaMm2 = n * mmPerPx * mmPerPx;
    if (areaMm2 >= DOT_MM2) zones.push({ diam: 2 * best * mmPerPx, area: areaMm2 });
  }
  return zones.sort((a, b) => a.diam - b.diam);
}

const rows = unpackFigures(fs.readFileSync(file, "utf8")).map((f) => {
  const z = zonesOf(f), small = z.filter((q) => q.diam < MIN);
  return { name: f.name, zonas: z.length, pequenas: small.length, minDiam: z[0]?.diam ?? null, estado: small.length === 0 ? "verde" : small.length <= 3 ? "amarillo" : "rojo" };
});
if (argv.includes("--json")) console.log(JSON.stringify(rows, null, 2));
else {
  const mark = { verde: "🟢", amarillo: "🟡", rojo: "🔴" };
  for (const r of rows) console.log(`${mark[r.estado]} ${r.name.padEnd(20)} ${String(r.zonas).padStart(3)} zonas, ${String(r.pequenas).padStart(2)} < ${MIN} mm (la menor: ${r.minDiam == null ? "-" : r.minDiam.toFixed(1) + " mm"})`);
  const c = (e) => rows.filter((r) => r.estado === e).length;
  console.log(`\n${c("verde")} verdes, ${c("amarillo")} amarillas, ${c("rojo")} rojas de ${rows.length} (figura a ${MM} mm de alto, zona mínima ${MIN} mm)`);
}
process.exit(rows.some((r) => r.estado === "rojo") ? 1 : 0);
