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
