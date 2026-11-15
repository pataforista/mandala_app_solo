// js/generators/styles/islamico.js
// Gramática del estilo «islamico»: estrellas de rectas, arcos lobulados y roseta de polígonos.
// Construcciones geométricas tradicionales y genéricas (estrella de ocho por dos cuadrados
// girados, arco polilobulado); no se copia ninguna pieza concreta.
// Etapa E3 de docs/ROADMAP_ESTILOS.md. La lacería (cinta entrelazada) llega en E4.
import { DEFAULT_CORES } from "./common.js";

// Vetos: motivos que este estilo nunca dibuja. Ningún peso de `motifs` puede estar aquí.
const banned = ["heart", "round", "leaf", "flame"];

/** Estrella de `pts` puntas centrada en (x, y); `rot` orienta una punta. */
function star(pb, x, y, rOut, rIn, pts, rot) {
  for (let i = 0; i < 2 * pts; i++) {
    const a = rot + (i * Math.PI) / pts, r = i % 2 ? rIn : rOut;
    (i ? pb.lineTo : pb.moveTo).call(pb, x + r * Math.cos(a), y + r * Math.sin(a));
  }
  pb.close();
}
/** Polígono regular de `s` lados centrado en (x, y). */
function polygon(pb, x, y, r, s, rot) {
  for (let i = 0; i < s; i++) {
    const a = rot + (i * 2 * Math.PI) / s;
    (i ? pb.lineTo : pb.moveTo).call(pb, x + r * Math.cos(a), y + r * Math.sin(a));
  }
  pb.close();
}

const exclusive = {
  // Cadena de estrellas de ocho puntas: cada una toca a sus vecinas por las puntas laterales.
  estrella: {
    aspect: 1.0, minH: 8,
    draw(ctx, b) {
      const { TAU, P, circle, cx, cy, mainPB, detailPB, emit, mainWFor, detailWFor, detail, richDetail } = ctx;
      const step = TAU / b.n, h = b.r1 - b.r0, rm = (b.r0 + b.r1) / 2;
      const rho = Math.min(rm * Math.sin(step / 2), h * 0.46);
      const m = mainPB(), d = detailPB();
      for (let i = 0; i < b.n; i++) {
        const a = b.off + i * step, [x, y] = P(rm, a);
        star(m, x, y, rho, rho * 0.56, 8, a);
        if (detail) polygon(d, x, y, rho * 0.44, 8, a + Math.PI / 8);
        if (richDetail) circle(d, x, y, rho * 0.18);
      }
      const ring = mainPB(); circle(ring, cx, cy, b.r1);
      emit(ring, mainWFor(b), "#fff"); emit(m, mainWFor(b), "#fff"); emit(d, detailWFor(b));
    },
  },
  // Arquería polilobulada: arcos de jambas rectas que comparten pilar, con cúspides hacia dentro.
  arco: {
    aspect: 0.7, minH: 9, silhouette: true,
    draw(ctx, b) {
      const { TAU, M, L, C, circle, cx, cy, mainPB, detailPB, emit, mainWFor, detailWFor, detail, B } = ctx;
      const step = TAU / b.n, h = b.r1 - b.r0, w = step / 2, sil = b.k === B - 1;
      const m = mainPB(), d = detailPB();
      // Media arquería de un lado (s = −1 izquierda, +1 derecha), de la jamba al ápice o al revés
      const cusps = [[0.44, 1], [0.66, 0.62], [0.84, 0.3], [1, 0]]; // [altura, ancho] de cada cúspide
      const arch = (pb, r0, hh, a, ww) => {
        M(pb, r0, a - ww);
        L(pb, r0 + hh * cusps[0][0], a - ww);
        for (let i = 1; i < cusps.length; i++) {
          const [h0, w0] = cusps[i - 1], [h1, w1] = cusps[i];
          C(pb, r0 + hh * (h0 + (h1 - h0) * 0.75), a - ww * w0, r0 + hh * h1, a - ww * (w1 + (w0 - w1) * 0.55), r0 + hh * h1, a - ww * w1);
        }
        for (let i = cusps.length - 1; i >= 1; i--) {
          const [h0, w0] = cusps[i - 1], [h1, w1] = cusps[i];
          C(pb, r0 + hh * h1, a + ww * (w1 + (w0 - w1) * 0.55), r0 + hh * (h0 + (h1 - h0) * 0.75), a + ww * w0, r0 + hh * h0, a + ww * w0);
        }
        L(pb, r0, a + ww);
        pb.close();
      };
      for (let i = 0; i < b.n; i++) {
        const a = b.off + i * step;
        arch(m, b.r0, h, a, w);
        // Vano interior: un arco apuntado sencillo, para colorear la puerta aparte del marco
        if (detail) {
          const r0 = b.r0 + h * 0.1, hh = h * 0.56, ww = w * 0.5;
          M(d, r0, a - ww); L(d, r0 + hh * 0.5, a - ww);
          C(d, r0 + hh * 0.85, a - ww, r0 + hh, a - ww * 0.4, r0 + hh, a);
          C(d, r0 + hh, a + ww * 0.4, r0 + hh * 0.85, a + ww, r0 + hh * 0.5, a + ww);
          L(d, r0, a + ww); d.close();
        }
      }
      // En una banda intermedia las enjutas quedan cerradas por el anillo; en la silueta, el
      // perfil de la arquería es el borde del mandala
      if (!sil) { const ring = mainPB(); circle(ring, cx, cy, b.r1); emit(ring, mainWFor(b), "#fff"); }
      emit(m, mainWFor(b), "#fff"); emit(d, detailWFor(b));
    },
  },
};

// Núcleo: estrella de 2s puntas formada por dos polígonos regulares girados (dos cuadrados dan
// la estrella de ocho), con otra estrella menor dentro.
function rosetaPoligonos(ctx, rCore) {
  const { N, cx, cy, circle, mainPB, detailPB, emit, mainW, detailW, detail, minCell } = ctx;
  // Las puntas respetan la simetría del mandala: un múltiplo de N (o de N/2 si N es par)
  const sym = N % 2 === 0 ? N / 2 : N;
  const pts = [6, 8, 10, 12, 14].find(n => n % sym === 0);
  if (!pts) return false;
  const s = pts / 2, Rp = rCore * 0.92;
  // Área de una punta: triángulo entre los dos polígonos (aprox.). Si no se puede colorear, núcleo común.
  const tip = Rp * Rp * Math.sin(Math.PI / s) * (1 - Math.cos(Math.PI / s) / Math.cos(Math.PI / pts) ** 2 * Math.cos(Math.PI / pts)) * 0.5;
  if (tip < minCell * 1.2) return false;
  const rim = mainPB(); circle(rim, cx, cy, rCore); emit(rim, mainW, "#fff");
  const a0 = -Math.PI / 2;
  // Los dos polígonos van en un mismo trazo: por separado cada uno sólo tendría la mitad de la
  // simetría (un triángulo suelto gira de 3 en 3, la estrella de seis de 6 en 6)
  const pp = mainPB(); polygon(pp, cx, cy, Rp, s, a0); polygon(pp, cx, cy, Rp, s, a0 + Math.PI / s); emit(pp, mainW, "#fff");
  const inner = Rp * Math.cos(Math.PI / s) / Math.cos(Math.PI / pts); // radio de las muescas de la estrella
  if (detail && inner * 0.62 > 4) {
    const d = detailPB();
    star(d, cx, cy, inner * 0.74, inner * 0.74 * 0.56, pts, a0 + Math.PI / pts);
    emit(d, detailW);
  }
  const c = mainPB(); circle(c, cx, cy, Math.max(inner * 0.2, 1.2)); emit(c, mainW, "#fff");
}

export const islamico = {
  id: "islamico",
  // Peso de cada motivo en una banda intermedia. El orden de las claves importa: el sorteo recorre
  // la tabla en ese orden y un cambio altera todas las páginas.
  motifs: { petal: 1, lotus: 1, scallop: 1, triangle: 1, diamond: 2, ogee: 2.5, chevron: 1, estrella: 4, arco: 3 },
  banned,
  exclusive,
  quota: 1,
  silhouettes: ["arco", "arco", "ogee", "ogee", "lotus"],
  cores: ["roseta_poligonos", "roseta_poligonos", ...DEFAULT_CORES.filter(c => c === "estrella_compuesta")],
  coreDraw: { roseta_poligonos: rosetaPoligonos },
};
