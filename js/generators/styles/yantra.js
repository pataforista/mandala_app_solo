// js/generators/styles/yantra.js
// Gramática del estilo «yantra»: pocas bandas amplias. Coronas de loto encerradas entre anillos
// lisos y, en el centro, triángulos entrelazados alrededor de un punto. Son los elementos
// genéricos del diagrama (loto, anillo, triángulo, punto); no se reproduce ningún yantra concreto.
// Etapa E8 de docs/ROADMAP_ESTILOS.md. El recinto cuadrado de la página es la etapa E9.
import { DEFAULT_CORES } from "./common.js";

// Vetos: motivos que este estilo nunca dibuja. Ningún peso de `motifs` puede estar aquí.
const banned = ["heart", "scallop", "beads", "flame", "chevron", "diamond", "round", "leaf"];

const exclusive = {
  // Corona de loto encerrada: pétalos anchos con su pétalo interior, entre dos anillos lisos.
  // Como silueta, el anillo exterior es el borde del mandala (un medallón cerrado).
  padma: {
    aspect: 0.8, minH: 11, silhouette: true,
    draw(ctx, b) {
      const { TAU, circle, cx, cy, petalShape, mainPB, detailPB, emit, mainWFor, detailWFor, detail } = ctx;
      const step = TAU / b.n, h = b.r1 - b.r0, w = step / 2;
      const gap = Math.max(2.4, Math.min(4, h * 0.14)); // franja lisa entre los dos anillos de fuera
      const top = b.r1 - gap;
      const ring = mainPB(); circle(ring, cx, cy, b.r1); emit(ring, mainWFor(b), "#fff");
      const ring2 = mainPB(); circle(ring2, cx, cy, top); emit(ring2, mainWFor(b), "#fff");
      const back = mainPB(), front = mainPB(), d = detailPB();
      for (let i = 0; i < b.n; i++) {
        const a = b.off + i * step;
        petalShape(back, b.r0, top, a + step / 2, w * 0.98, 1.2);       // pétalos de detrás, a medio paso
        petalShape(front, b.r0, top - (top - b.r0) * 0.14, a, w * 0.98, 1.2);
        if (detail) petalShape(d, b.r0 + (top - b.r0) * 0.12, top - (top - b.r0) * 0.38, a, w * 0.5, 1.15);
      }
      emit(back, mainWFor(b), "#fff"); emit(front, mainWFor(b), "#fff"); emit(d, detailWFor(b));
    },
  },
  // Anillos: tres círculos concéntricos lisos. Dos franjas largas para colorear de un solo tono.
  anillos: {
    aspect: 1.0, minH: 6, maxH: 13,
    draw(ctx, b) {
      const { circle, cx, cy, mainPB, emit, mainWFor } = ctx;
      const h = b.r1 - b.r0;
      const ring = mainPB(); circle(ring, cx, cy, b.r1); emit(ring, mainWFor(b), "#fff");
      const mid = mainPB(); circle(mid, cx, cy, b.r0 + h / 2); emit(mid, mainWFor(b));
    },
  },
};

// Núcleo: dos triángulos entrelazados (uno hacia arriba, otro hacia abajo) con un punto en el
// centro. Sólo cuando su simetría de orden 6 es la del mandala (6 o 12 pétalos); si no, un loto.
function triangulos(ctx, rCore) {
  const { N, P, cx, cy, circle, mainPB, detailPB, emit, mainW, detailW, detail, minCoreCell } = ctx;
  if (N !== 6 && N !== 12) return lotoBindu(ctx, rCore);
  const Rt = rCore * 0.9;
  // Área de una punta de la estrella de seis (triángulo equilátero de lado Rt/√3)
  if ((Math.sqrt(3) / 4) * (Rt / Math.sqrt(3)) ** 2 < minCoreCell) return false;
  const rim = mainPB(); circle(rim, cx, cy, rCore); emit(rim, mainW, "#fff");
  const tri = mainPB();
  for (const a0 of [-Math.PI / 2, Math.PI / 2]) {
    for (let i = 0; i < 3; i++) (i ? tri.lineTo : tri.moveTo).call(tri, ...P(Rt, a0 + (i * 2 * Math.PI) / 3));
    tri.close();
  }
  emit(tri, mainW, "#fff"); // los dos en un mismo trazo: juntos tienen simetría de orden 6
  const rin = Rt / 2; // radio inscrito del hexágono central
  if (detail && rin > 5) { const d = detailPB(); circle(d, cx, cy, rin * 0.72); emit(d, detailW); }
  const c = mainPB(); circle(c, cx, cy, Math.max(rin * 0.26, 1.45)); emit(c, mainW, "#fff");
}

// Núcleo de respaldo: loto pequeño de pétalos anchos alrededor del punto central.
function lotoBindu(ctx, rCore) {
  const { N, TAU, cx, cy, circle, petalShape, mainPB, emit, mainW, minCoreCell } = ctx;
  const sym = N % 2 === 0 ? N / 2 : N;
  const n = [sym, N].find(k => k >= 4 && (TAU / k) * rCore * 0.6 * rCore * 0.55 * 0.5 >= minCoreCell);
  if (!n) return false;
  const step = TAU / n;
  const rim = mainPB(); circle(rim, cx, cy, rCore); emit(rim, mainW, "#fff");
  const m = mainPB();
  for (let i = 0; i < n; i++) petalShape(m, rCore * 0.3, rCore * 0.94, -Math.PI / 2 + i * step, (step / 2) * 0.96, 1.2);
  emit(m, mainW, "#fff");
  const c = mainPB(); circle(c, cx, cy, rCore * 0.32); emit(c, mainW, "#fff");
  const dot = mainPB(); circle(dot, cx, cy, Math.max(rCore * 0.1, 1.45)); emit(dot, mainW);
}

export const yantra = {
  id: "yantra",
  // Recinto cuadrado con cuatro puertas en lugar del marco redondeado (mandalaClassic.js).
  recinto: true,
  // Peso de cada motivo en una banda intermedia. El orden de las claves importa: el sorteo recorre
  // la tabla en ese orden y un cambio altera todas las páginas.
  motifs: { petal: 1, lotus: 2, triangle: 1.2, ogee: 0.8, padma: 5, anillos: 3 },
  banned,
  exclusive,
  quota: 1,
  silhouettes: ["padma", "padma", "lotus"],
  cores: ["triangulos", "triangulos", ...DEFAULT_CORES.filter(c => c === "estrella_compuesta")],
  coreDraw: { triangulos },
};
