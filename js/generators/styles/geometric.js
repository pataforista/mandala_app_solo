// js/generators/styles/geometric.js
// Gramática del estilo «geometric»: sólo rectas. Teselados de triángulos, rombos facetados como
// gemas y un polígono subdividido en el centro. Ninguna curva salvo los aros de las bandas.
// Etapa E10 de docs/ROADMAP_ESTILOS.md.
import { DEFAULT_CORES, cellPoly } from "./common.js";

// Vetos: motivos que este estilo nunca dibuja. Ningún peso de `motifs` puede estar aquí.
const banned = ["heart", "round", "leaf", "flame", "scallop", "petal", "lotus", "ogee", "beads"];

const exclusive = {
  // Teselado: triángulos que suben y bajan; cada uno lleva dentro otro invertido que lo parte
  // en cuatro.
  teselado: {
    aspect: 1.1, minH: 9,
    draw(ctx, b) {
      const { TAU, circle, cx, cy, mainPB, detailPB, emit, mainWFor, detailWFor, detail, minCell } = ctx;
      const step = TAU / b.n, h = b.r1 - b.r0, rm = (b.r0 + b.r1) / 2;
      const m = mainPB(), d = detailPB();
      const split = detail && (rm * step * h) / 8 >= minCell * 1.4; // cada cuarto debe poder colorearse
      for (let i = 0; i < b.n; i++) {
        const a0 = b.off + (i - 0.5) * step;
        cellPoly(ctx, m, b, a0, [[0, 0], [0.5, 1], [1, 0]], true); // el zigzag: sube y baja
        if (split) {
          cellPoly(ctx, d, b, a0, [[0.25, 0.5], [0.75, 0.5], [0.5, 0]]);               // invertido dentro del que sube
          cellPoly(ctx, d, b, a0 + step / 2, [[0.25, 0.5], [0.75, 0.5], [0.5, 1]]);    // y dentro del que baja
        }
      }
      const ring = mainPB(); circle(ring, cx, cy, b.r1);
      emit(ring, mainWFor(b), "#fff"); emit(m, mainWFor(b)); emit(d, detailWFor(b));
    },
  },
  // Facetas: rombos tallados como gemas (una mesa central y cuatro facetas). Como silueta, las
  // puntas de los rombos son el borde del mandala.
  facetas: {
    aspect: 0.9, minH: 10, silhouette: true,
    draw(ctx, b) {
      const { TAU, circle, cx, cy, mainPB, detailPB, emit, mainWFor, detailWFor, detail, minCell, B } = ctx;
      const step = TAU / b.n, h = b.r1 - b.r0, rm = (b.r0 + b.r1) / 2, sil = b.k === B - 1;
      const m = mainPB(), d = detailPB();
      const cut = detail && (rm * step * h) / 10 >= minCell * 1.3;
      for (let i = 0; i < b.n; i++) {
        const a0 = b.off + (i - 0.5) * step;
        cellPoly(ctx, m, b, a0, [[0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]]);
        if (cut) {
          cellPoly(ctx, d, b, a0, [[0.5, 0.3], [0.7, 0.5], [0.5, 0.7], [0.3, 0.5]]); // la mesa
          for (const [u, v, u2, v2] of [[0.5, 0, 0.5, 0.3], [1, 0.5, 0.7, 0.5], [0.5, 1, 0.5, 0.7], [0, 0.5, 0.3, 0.5]])
            cellPoly(ctx, d, b, a0, [[u, v], [u2, v2]], true);                         // aristas de la talla
        }
      }
      if (!sil) { const ring = mainPB(); circle(ring, cx, cy, b.r1); emit(ring, mainWFor(b), "#fff"); }
      emit(m, mainWFor(b), "#fff"); emit(d, detailWFor(b));
    },
  },
};

// Núcleo: polígono regular subdividido. Un polígono, otro girado dentro y radios a los vértices.
function poligono(ctx, rCore) {
  const { N, P, cx, cy, circle, mainPB, detailPB, emit, mainW, detailW, detail, minCell } = ctx;
  const sym = N % 2 === 0 ? N / 2 : N;
  const n = [sym, N].find(k => k >= 5 && k <= 12) ?? (sym === 4 || sym === 3 ? N : 0);
  if (!n) return false;
  const step = (2 * Math.PI) / n, a0 = -Math.PI / 2, Ro = rCore * 0.94, Ri = Ro * Math.cos(step / 2) * 0.62;
  // Celda entre los dos polígonos (un trapecio por lado)
  if (((Ro + Ri) / 2) * step * (Ro - Ri) * 0.5 < minCell * 1.2) return false;
  const rim = mainPB(); circle(rim, cx, cy, rCore); emit(rim, mainW, "#fff");
  const outer = mainPB();
  for (let i = 0; i < n; i++) (i ? outer.lineTo : outer.moveTo).call(outer, ...P(Ro, a0 + i * step));
  outer.close(); emit(outer, mainW, "#fff");
  const spokes = mainPB();
  for (let i = 0; i < n; i++) spokes.moveTo(...P(Ro, a0 + i * step)).lineTo(...P(Ri, a0 + (i + 0.5) * step)).lineTo(...P(Ro, a0 + (i + 1) * step));
  emit(spokes, mainW);
  const inner = mainPB();
  for (let i = 0; i < n; i++) (i ? inner.lineTo : inner.moveTo).call(inner, ...P(Ri, a0 + (i + 0.5) * step));
  inner.close(); emit(inner, mainW, "#fff");
  if (detail && Ri > 6) {
    const d = detailPB();
    for (let i = 0; i < n; i++) (i ? d.lineTo : d.moveTo).call(d, ...P(Ri * 0.5, a0 + i * step));
    d.close(); emit(d, detailW);
  }
}

export const geometric = {
  id: "geometric",
  // Peso de cada motivo en una banda intermedia. El orden de las claves importa: el sorteo recorre
  // la tabla en ese orden y un cambio altera todas las páginas.
  motifs: { triangle: 2, diamond: 2, chevron: 1.5, teselado: 4, facetas: 4 },
  banned,
  exclusive,
  quota: 1,
  silhouettes: ["facetas", "facetas", "triangle", "diamond"],
  cores: ["poligono", "poligono", ...DEFAULT_CORES.filter(c => c === "estrella_compuesta")],
  coreDraw: { poligono },
};
