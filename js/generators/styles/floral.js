// js/generators/styles/floral.js
// Gramática del estilo «floral»: el estilo por defecto y el de mayor peso en el libro. Pétalos,
// hojas y lotos, más dos piezas propias: la corola de pétalos con muesca (como una flor de
// cerezo) y un centro de estambres.
// Etapa E10 de docs/ROADMAP_ESTILOS.md.
import { DEFAULT_SILHOUETTES, DEFAULT_CORES } from "./common.js";

// Vetos: motivos que este estilo nunca dibuja. Ningún peso de `motifs` puede estar aquí.
const banned = ["triangle", "diamond", "chevron", "flame"];

const exclusive = {
  // Corola: pétalos anchos con una muesca en la punta. Como silueta, son el borde del mandala.
  corola: {
    aspect: 0.95, minH: 10, silhouette: true,
    draw(ctx, b) {
      const { TAU, M, C, circle, cx, cy, mainPB, detailPB, emit, mainWFor, detailWFor, detail, B } = ctx;
      const step = TAU / b.n, sil = b.k === B - 1;
      const m = mainPB(), d = detailPB();
      // Pétalo con muesca entre r0 y r1, de semiancho w (en radianes)
      const petal = (pb, r0, r1, a, w) => {
        const h = r1 - r0;
        M(pb, r0, a - w * 0.3);
        C(pb, r0 + h * 0.3, a - w * 1.05, r0 + h * 0.85, a - w * 1.0, r1, a - w * 0.42);
        C(pb, r1 + h * 0.02, a - w * 0.2, r1 - h * 0.06, a - w * 0.08, r1 - h * 0.14, a); // muesca
        C(pb, r1 - h * 0.06, a + w * 0.08, r1 + h * 0.02, a + w * 0.2, r1, a + w * 0.42);
        C(pb, r0 + h * 0.85, a + w * 1.0, r0 + h * 0.3, a + w * 1.05, r0, a + w * 0.3);
        pb.close();
      };
      for (let i = 0; i < b.n; i++) {
        const a = b.off + i * step, h = b.r1 - b.r0;
        petal(m, b.r0 - h * 0.04, b.r1 - (sil ? 0 : h * 0.05), a, step / 2);
        if (detail) petal(d, b.r0 + h * 0.14, b.r1 - h * 0.32, a, step * 0.26);
      }
      if (!sil) { const ring = mainPB(); circle(ring, cx, cy, b.r1); emit(ring, mainWFor(b), "#fff"); }
      emit(m, mainWFor(b), "#fff"); emit(d, detailWFor(b));
    },
  },
};

// Núcleo: estambres. Un botón central y una corona de anteras unidas a él por filamentos.
function estambres(ctx, rCore) {
  const { N, TAU, P, cx, cy, circle, mainPB, emit, mainW, minCoreCell } = ctx;
  const sym = N % 2 === 0 ? N / 2 : N;
  const rA = rCore * 0.68; // radio de la corona de anteras
  const size = (k) => Math.min(rCore * 0.2, rA * Math.sin(Math.PI / k) * 0.8);
  const n = [N, sym].find(k => k >= 5 && Math.PI * size(k) ** 2 >= minCoreCell);
  if (!n) return false;
  const rho = size(n), r0 = rCore * 0.3;
  const rim = mainPB(); circle(rim, cx, cy, rCore); emit(rim, mainW, "#fff");
  const fil = mainPB(), ant = mainPB();
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * TAU) / n;
    fil.moveTo(...P(r0, a)).lineTo(...P(rA - rho, a));
    circle(ant, ...P(rA, a), rho);
  }
  emit(fil, mainW); emit(ant, mainW, "#fff");
  const c = mainPB(); circle(c, cx, cy, r0); emit(c, mainW, "#fff");
}

export const floral = {
  id: "floral",
  // Peso de cada motivo en una banda intermedia. El orden de las claves importa: el sorteo recorre
  // la tabla en ese orden y un cambio altera todas las páginas.
  motifs: { petal: 2.5, round: 2.5, lotus: 3, leaf: 3, scallop: 1.5, heart: 1.5, ogee: 1, corola: 4 },
  banned,
  exclusive,
  quota: 2,
  // La silueta exterior también respeta los vetos.
  silhouettes: ["corola", "corola", ...DEFAULT_SILHOUETTES.filter(s => !banned.includes(s))],
  cores: ["estambres", ...DEFAULT_CORES.filter(c => c === "flor_radiante")],
  coreDraw: { estambres },
};
