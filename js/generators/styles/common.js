// js/generators/styles/common.js
// Primitivas polares compartidas por el motor clásico y por las gramáticas de estilo.
// Todo dibuja sobre un PathBuilder en coordenadas polares (radio mm, ángulo rad) alrededor de (cx, cy).
// Extraído sin cambios de mandalaClassic.js: la prueba dorada (scripts/golden-styles.mjs) exige
// que ninguna página cambie.
export const TAU = Math.PI * 2;

// La silueta es lo que se reconoce al hojear: más peso en lotus, la forma más reconocible.
export const DEFAULT_SILHOUETTES = ["lotus", "lotus", "lotus", "scallop", "scallop", "ogee", "ogee"];
// Núcleos del medallón central. La espiral áurea queda fuera: una espiral nunca tiene simetría
// rotacional N, y el mandala la exige.
export const DEFAULT_CORES = ["flor_radiante", "flor_vida", "estrella_compuesta"];

/** Primitivas ligadas a un centro: P, M, C, L, circle, petalShape, heartShape, ogeeShape. */
export function polarKit(cx, cy) {
  const P = (r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const circle = (pb, x, y, rad) => {
    const n = rad > 30 ? 12 : 8;
    const k = (4 / 3) * Math.tan(Math.PI / (2 * n)) * rad;
    pb.moveTo(x + rad, y);
    for (let i = 0; i < n; i++) {
      const a0 = (i * TAU) / n, a1 = ((i + 1) * TAU) / n;
      pb.cubicTo(
        x + rad * Math.cos(a0) - k * Math.sin(a0), y + rad * Math.sin(a0) + k * Math.cos(a0),
        x + rad * Math.cos(a1) + k * Math.sin(a1), y + rad * Math.sin(a1) - k * Math.cos(a1),
        x + rad * Math.cos(a1), y + rad * Math.sin(a1));
    }
    pb.close();
  };
  const C = (pb, r1, a1, r2, a2, r3, a3) => { const [x1, y1] = P(r1, a1), [x2, y2] = P(r2, a2), [x3, y3] = P(r3, a3); pb.cubicTo(x1, y1, x2, y2, x3, y3); };
  const M = (pb, rr, a) => pb.moveTo(...P(rr, a));
  const L = (pb, rr, a) => pb.lineTo(...P(rr, a));

  const petalShape = (pb, r0, r1, a, w, belly = 1.05, round = false) => {
    const h = r1 - r0;
    M(pb, r0, a - w);
    if (round) {
      C(pb, r0 + h * 0.45, a - w * belly, r1, a - w * 0.85, r1, a);
      C(pb, r1, a + w * 0.85, r0 + h * 0.45, a + w * belly, r0, a + w);
    } else {
      C(pb, r0 + h * 0.45, a - w * belly, r0 + h * 0.85, a - w * 0.3, r1, a);
      C(pb, r0 + h * 0.85, a + w * 0.3, r0 + h * 0.45, a + w * belly, r0, a + w);
    }
    pb.close();
  };
  const heartShape = (pb, r0, r1, a, w) => {
    const h = r1 - r0;
    M(pb, r0 + h * 0.04, a);
    C(pb, r0 + h * 0.35, a - w * 0.95, r1 + h * 0.06, a - w * 1.0, r1 - h * 0.04, a - w * 0.4);
    C(pb, r1 - h * 0.1, a - w * 0.12, r1 - h * 0.22, a - w * 0.05, r1 - h * 0.2, a);
    C(pb, r1 - h * 0.22, a + w * 0.05, r1 - h * 0.1, a + w * 0.12, r1 - h * 0.04, a + w * 0.4);
    C(pb, r1 + h * 0.06, a + w * 1.0, r0 + h * 0.35, a + w * 0.95, r0 + h * 0.04, a);
    pb.close();
  };
  const ogeeShape = (pb, r0, r1, a, w) => {
    const h = r1 - r0;
    M(pb, r0, a - w * 0.8);
    C(pb, r0 + h * 0.2, a - w * 1.15, r0 + h * 0.5, a - w * 1.05, r0 + h * 0.62, a - w * 0.55);
    C(pb, r0 + h * 0.75, a - w * 0.2, r1 - h * 0.12, a - w * 0.08, r1, a);
    C(pb, r1 - h * 0.12, a + w * 0.08, r0 + h * 0.75, a + w * 0.2, r0 + h * 0.62, a + w * 0.55);
    C(pb, r0 + h * 0.5, a + w * 1.05, r0 + h * 0.2, a + w * 1.15, r0, a + w * 0.8);
    pb.close();
  };
  return { P, circle, C, M, L, petalShape, heartShape, ogeeShape };
}
