// Semáforo de coloreabilidad de un paquete de figuras: `npm test`
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { packFigures } from "../js/core/figurePack.js";

// Figura sintética: marco cuadrado de tinta (0) con interior (1), más una ranura fina si `slit`
function fig(name, slit) {
  const w = 400, h = 400, cls = new Uint8Array(w * h).fill(2);
  for (let y = 40; y < 360; y++) for (let x = 40; x < 360; x++) cls[y * w + x] = y < 46 || y >= 354 || x < 46 || x >= 354 ? 0 : 1;
  if (slit) for (let y = 46; y < 354; y++) for (let x = 120; x < 126; x++) cls[y * w + x] = 0; // pared que deja una franja fina
  if (slit) for (let y = 46; y < 354; y++) for (let x = 134; x < 140; x++) cls[y * w + x] = 0;
  return { name, href: "x", cls, w, h, use: "anillos" };
}

test("checkFigures: una zona grande es verde; una franja fina entre dos paredes es amarilla o roja", () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "chk-")), "pack.json");
  fs.writeFileSync(f, JSON.stringify(packFigures([fig("grande", false), fig("franja", true)])));
  const r = spawnSync("node", ["scripts/checkFigures.mjs", f, "--json"], { encoding: "utf8" });
  const rows = JSON.parse(r.stdout);
  assert.equal(rows.find((x) => x.name === "grande").estado, "verde");
  assert.notEqual(rows.find((x) => x.name === "franja").estado, "verde");
  assert.ok(rows.find((x) => x.name === "franja").minDiam < rows.find((x) => x.name === "grande").minDiam);
});

test("checkFigure: una figura con negro macizo no entra al libro; un contorno fino sí", async () => {
  const { checkFigure } = await import("../js/core/figureChecks.js");
  const w = 400, h = 400;
  const disk = (solid) => {
    const cls = new Uint8Array(w * h).fill(2);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const r = Math.hypot(x - 200, y - 200);
      if (r < 160) cls[y * w + x] = r > 154 || (solid && r < 90) ? 0 : 1; // contorno de 6 px; disco negro opcional
    }
    return { name: "d", href: "x", cls, w, h };
  };
  const meta = { rightsConfirmed: true };
  const fine = checkFigure(disk(false), "figura", meta);
  const blob = checkFigure(disk(true), "figura", meta);
  assert.equal(fine.ready, true, JSON.stringify(fine.checks.filter(c => !c.ok)));
  assert.equal(blob.ready, false);
  assert.ok(blob.checks.some(c => c.level === "error" && /negras macizas/.test(c.msg)));
});

test("afinado: un trazo fino no cambia; uno grueso queda en dos líneas con hueco; el negro macizo sigue fuera", async () => {
  const { thickInkMask, checkFigure } = await import("../js/core/figureChecks.js");
  const w = 400, h = 400;
  const ring = (thick) => {
    const cls = new Uint8Array(w * h).fill(2);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const r = Math.hypot(x - 200, y - 200);
      if (r < 160) cls[y * w + x] = r > 160 - thick ? 0 : 1;
    }
    return cls;
  };
  assert.equal(thickInkMask(ring(4), w, h).count, 0, "un contorno de 4 px (≈1,9 mm a página completa) no se toca");
  const thick = ring(30);
  const { mask, count } = thickInkMask(thick, w, h);
  assert.ok(count > 0);
  // Por el radio: tinta, hueco blanco, tinta
  const row = Array.from({ length: 30 }, (_, k) => mask[200 * w + (200 + 131 + k)]);
  assert.equal(row[0], 0, "borde interior conservado");
  assert.equal(row[29], 0, "borde exterior conservado");
  assert.ok(row.includes(1), "el centro del trazo se vacía");
  const fig = { name: "t", href: "x", cls: thick, w, h };
  assert.equal(checkFigure({ ...fig }, "figura", { rightsConfirmed: true }).ready, false);
  // El afinado no rescata figuras con negro macizo: siguen fuera del libro
  assert.equal(checkFigure({ ...fig }, "figura", { rightsConfirmed: true, thin: true }).ready, false);
});
