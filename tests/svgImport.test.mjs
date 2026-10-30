// Importador de SVG para figuras: `npm test`
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSvgPath, parseSvg } from "../scripts/svgPath.mjs";

const finite = (cmds) => cmds.every((c) => c.slice(1).every(Number.isFinite));

test("SVG: comandos relativos, H/V, S/T y arcos se convierten a M/L/Q/C/Z absolutos", () => {
  const rel = parseSvgPath("m10 10 h20 v20 h-20 z");
  assert.deepEqual(rel, [["M", 10, 10], ["L", 30, 10], ["L", 30, 30], ["L", 10, 30], ["Z"]]);
  const all = parseSvgPath("M0 0 a10 10 0 0 1 20 0 s5 5 10 0 q5 5 10 0 t10 0 c1 1 2 2 3 3 z");
  assert.ok(finite(all) && all.every((c) => "MLQCZ".includes(c[0])), "sólo comandos absolutos");
  // Un semicírculo por arco termina donde se pidió
  const arc = parseSvgPath("M0 0 A10 10 0 0 1 20 0");
  assert.ok(Math.abs(arc.at(-1)[5] - 20) < 1e-9 && Math.abs(arc.at(-1)[6]) < 1e-9);
  // Pares de banderas pegadas («a1 1 0 01.5 2») y números sin ceros iniciales
  assert.ok(finite(parseSvgPath("M0 0a1 1 0 01.5 2")));
  assert.throws(() => parseSvgPath("M0 0 X5 5"), /no reconocido/);
});

test("SVG: formas básicas, relleno/trazo y aviso de transform", () => {
  const { shapes, warnings } = parseSvg(`<svg><path id="a" d="M0 0 L10 0 L10 10 Z"/><path d="M1 1L5 5" fill="none" stroke="#000"/>
    <circle cx="5" cy="5" r="2"/><rect x="0" y="0" width="4" height="3" style="fill:none"/><polygon points="0,0 4,0 4,4"/></svg>`);
  assert.equal(shapes.length, 5);
  assert.deepEqual(shapes.map((s) => s.filled), [true, false, true, false, true]);
  assert.equal(shapes[0].id, "a");
  assert.equal(warnings.length, 0);
  assert.equal(parseSvg(`<svg><g transform="scale(2)"><path d="M0 0L1 1"/></g></svg>`).warnings.length, 1);
});
