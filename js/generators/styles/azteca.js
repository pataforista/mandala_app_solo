// js/generators/styles/azteca.js
// Gramática del estilo «azteca»: todo anguloso. Greca escalonada, sierra doble, casillas, rayos
// que alternan grande y pequeño, y un disco solar en el centro. Son construcciones genéricas de
// la ornamentación mesoamericana (escalón, diente, cartucho); no se copia ninguna pieza concreta.
// Etapa E6 de docs/ROADMAP_ESTILOS.md.
import { DEFAULT_CORES, cellPoly } from "./common.js";

// Vetos: motivos que este estilo nunca dibuja. Ningún peso de `motifs` puede estar aquí.
const banned = ["heart", "leaf", "round", "scallop", "ogee", "flame"];

const exclusive = {
  // Greca escalonada: una pirámide de tres escalones por celda; entre dos pirámides queda su
  // negativo, también coloreable. Como silueta, las almenas son el borde del mandala.
  greca: {
    aspect: 1.25, minH: 9, silhouette: true,
    draw(ctx, b) {
      const { TAU, circle, cx, cy, mainPB, detailPB, emit, mainWFor, detailWFor, detail, B } = ctx;
      const step = TAU / b.n, sil = b.k === B - 1, top = sil ? 1 : 0.88;
      const m = mainPB(), d = detailPB();
      const s1 = top / 3, s2 = (2 * top) / 3;
      for (let i = 0; i < b.n; i++) {
        const a0 = b.off + (i - 0.5) * step;
        cellPoly(ctx, m, b, a0, [[0, 0], [0, s1], [0.17, s1], [0.17, s2], [0.34, s2], [0.34, top], [0.66, top], [0.66, s2], [0.83, s2], [0.83, s1], [1, s1], [1, 0]], true);
        // Ventana en el cuerpo de la pirámide
        if (detail) cellPoly(ctx, d, b, a0, [[0.38, s1 * 0.45], [0.38, s2 * 0.92], [0.62, s2 * 0.92], [0.62, s1 * 0.45]]);
      }
      if (!sil) { const ring = mainPB(); circle(ring, cx, cy, b.r1); emit(ring, mainWFor(b), "#fff"); }
      emit(m, mainWFor(b), "#fff"); emit(d, detailWFor(b));
    },
  },
  // Sierra doble: dientes que suben desde dentro y dientes que bajan desde fuera, encajados.
  dentado: {
    aspect: 0.9, minH: 8,
    draw(ctx, b) {
      const { TAU, circle, cx, cy, mainPB, detailPB, emit, mainWFor, detailWFor, detail } = ctx;
      const step = TAU / b.n;
      const m = mainPB(), d = detailPB();
      for (let i = 0; i < b.n; i++) {
        const a0 = b.off + (i - 0.5) * step;
        cellPoly(ctx, m, b, a0, [[0, 0], [0.5, 0.62], [1, 0]], true);             // diente de dentro
        cellPoly(ctx, m, b, a0 + step / 2, [[0, 1], [0.5, 0.38], [1, 1]], true); // diente de fuera, a medio paso
        if (detail) {
          cellPoly(ctx, d, b, a0, [[0.24, 0.1], [0.5, 0.42], [0.76, 0.1]]);
          cellPoly(ctx, d, b, a0 + step / 2, [[0.24, 0.9], [0.5, 0.58], [0.76, 0.9]]);
        }
      }
      const ring = mainPB(); circle(ring, cx, cy, b.r1);
      emit(ring, mainWFor(b), "#fff"); emit(m, mainWFor(b)); emit(d, detailWFor(b));
    },
  },
  // Casillas: la banda partida en cartuchos por tabiques radiales, cada uno con un recuadro y
  // un punto dentro. Los cartuchos comparten pared: dos marcos separados dejaban un pasillo de
  // menos de 1,2 mm entre ellos que no se puede colorear.
  casillas: {
    aspect: 1.0, minH: 9,
    draw(ctx, b) {
      const { TAU, P, circle, cx, cy, mainPB, detailPB, emit, mainWFor, detailWFor, detail, richDetail } = ctx;
      const step = TAU / b.n, h = b.r1 - b.r0, rm = (b.r0 + b.r1) / 2, arc = rm * step;
      const m = mainPB(), d = detailPB();
      // Margen del recuadro en mm (nunca menos de 1,6), pasado a fracciones de celda
      const inset = Math.max(1.6, Math.min(h, arc) * 0.2), du = inset / arc, dv = inset / h;
      for (let i = 0; i < b.n; i++) {
        const a0 = b.off + (i - 0.5) * step;
        m.moveTo(...P(b.r0, a0)).lineTo(...P(b.r1, a0)); // tabique
        if (detail && du < 0.32 && dv < 0.32) cellPoly(ctx, d, b, a0, [[du, dv], [du, 1 - dv], [1 - du, 1 - dv], [1 - du, dv]]);
        if (richDetail) circle(d, ...P(rm, a0 + step / 2), Math.min(h, arc) * 0.1);
      }
      const ring = mainPB(); circle(ring, cx, cy, b.r1);
      emit(ring, mainWFor(b), "#fff"); emit(m, mainWFor(b)); emit(d, detailWFor(b));
    },
  },
  // Rayos: dientes triangulares que alternan grande y pequeño, como una corona solar. Sólo
  // silueta. Todos comparten la base con sus vecinos y ninguno tapa a otro: cada diente es un
  // triángulo limpio. La versión anterior apilaba un rayo pequeño detrás de dos grandes y
  // asomaba entre ellos como una cuña fina; con trazo grueso esas cuñas son celdas de menos de
  // 6 mm² (azteca para niños llegó a puntuar 0 con 3 bandas).
  rayos: {
    aspect: 1.3, minH: 9, silhouette: true, band: false,
    draw(ctx, b) {
      const { TAU, mainPB, detailPB, emit, mainWFor, detailWFor, detail, minCell } = ctx;
      const step = TAU / b.n, h = b.r1 - b.r0;
      const m = mainPB(), d = detailPB();
      // El triángulo interior de un rayo grande sólo si cabe una celda coloreable
      const inner = detail && 0.5 * (0.26 * step * b.r0) * (0.5 * h) >= minCell * 1.5;
      for (let i = 0; i < b.n; i++) {
        const a0 = b.off + (i - 0.5) * step;
        cellPoly(ctx, m, b, a0, [[0, 0], [0.25, 1], [0.5, 0]], true);    // rayo grande
        cellPoly(ctx, m, b, a0, [[0.5, 0], [0.75, 0.55], [1, 0]], true); // rayo pequeño
        if (inner) cellPoly(ctx, d, b, a0, [[0.12, 0.1], [0.25, 0.62], [0.38, 0.1]]);
      }
      emit(m, mainWFor(b), "#fff"); emit(d, detailWFor(b));
    },
  },
};

// Núcleo: disco solar. Botón central, corona de dientes y anillo de cuentas cuadradas.
function discoSolar(ctx, rCore) {
  const { N, TAU, P, cx, cy, circle, mainPB, detailPB, emit, mainW, detailW, detail, minCoreCell } = ctx;
  const sym = N % 2 === 0 ? N / 2 : N;
  // Dientes: los que quepan con celda coloreable, respetando la simetría del mandala
  // Área exacta de un diente: triángulo con base en r0 = 0,42·rCore (a ±π/k) y punta en r1 = 0,74·rCore
  const tooth = (k) => 0.42 * rCore * Math.sin(Math.PI / k) * (0.74 - 0.42 * Math.cos(Math.PI / k)) * rCore;
  const n = [N, sym].find(k => k >= 4 && tooth(k) >= minCoreCell);
  if (!n) return false;
  const rim = mainPB(); circle(rim, cx, cy, rCore); emit(rim, mainW, "#fff");
  const step = TAU / n, r0 = rCore * 0.42, r1 = rCore * 0.74;
  const m = mainPB(), d = detailPB();
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + i * step;
    m.moveTo(...P(r0, a - step / 2)).lineTo(...P(r1, a)).lineTo(...P(r0, a + step / 2)).close();
    // Cuenta cuadrada entre dos dientes, junto al borde
    const q = Math.min((rCore - r1) * 0.5, rCore * 0.82 * step * 0.3);
    if (detail && q * q * 2 >= minCoreCell) {
      const [x, y] = P(rCore * 0.84, a + step / 2), c = Math.cos(a + step / 2), s = Math.sin(a + step / 2);
      d.moveTo(x + c * q, y + s * q).lineTo(x - s * q, y + c * q).lineTo(x - c * q, y - s * q).lineTo(x + s * q, y - c * q).close();
    }
  }
  emit(m, mainW, "#fff"); emit(d, detailW);
  const c = mainPB(); circle(c, cx, cy, r0); emit(c, mainW, "#fff");
  if (detail && r0 > 4) { const c2 = detailPB(); circle(c2, cx, cy, r0 * 0.5); emit(c2, detailW); }
}

export const azteca = {
  id: "azteca",
  // Peso de cada motivo en una banda intermedia. El orden de las claves importa: el sorteo recorre
  // la tabla en ese orden y un cambio altera todas las páginas.
  motifs: { petal: 0.8, lotus: 0.5, triangle: 2, diamond: 1.5, chevron: 0.2, greca: 4, dentado: 3, casillas: 3, pluma: 0.5, gota: 0.5 },
  banned,
  exclusive,
  quota: 2,
  silhouettes: ["rayos", "rayos", "greca", "lotus"],
  cores: ["disco_solar", "disco_solar", ...DEFAULT_CORES.filter(c => c === "estrella_compuesta")],
  coreDraw: { disco_solar: discoSolar },
};
