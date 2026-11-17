// js/generators/styles/celtico.js
// Gramática del estilo «celtico»: cintas entrelazadas. Trenza de dos cabos, cadena de eslabones
// y núcleo de trenza anular; construcciones genéricas de nudo, sin copiar ninguna pieza concreta.
// Etapa E5 de docs/ROADMAP_ESTILOS.md.
import { DEFAULT_SILHOUETTES, braid, ringChain } from "./common.js";

// Vetos: motivos que este estilo nunca dibuja. Ningún peso de `motifs` puede estar aquí.
const banned = ["triangle", "diamond", "chevron", "flame"];

const ribbonW = (h) => Math.max(2.5, Math.min(4.5, h * 0.2));

const exclusive = {
  // Trenza de dos cabos que se cruzan arriba y abajo, con una cuenta en cada ojo de la trenza.
  trenza: {
    aspect: 1.5, minH: 10.5,
    draw(ctx, b) {
      const { TAU, P, circle, cx, cy, mainPB, detailPB, emit, mainWFor, detailWFor, detail } = ctx;
      const h = b.r1 - b.r0, rm = (b.r0 + b.r1) / 2;
      const w = ribbonW(h), amp = h / 2 - w / 2 - 1.2;
      // El «ojo» entre dos cruces de la trenza debe poder colorearse: si no, se usa la mitad de
      // periodos (sigue siendo múltiplo de la simetría de N). Largo ≈ medio periodo menos la cinta;
      // ancho ≈ el hueco entre los dos cabos.
      const sym = ctx.N % 2 === 0 ? ctx.N / 2 : ctx.N;
      let n = b.n;
      const eyeArea = (k) => 0.5 * ((TAU * rm) / k / 2 - w) * (2 * amp - w);
      while (eyeArea(n) < ctx.minCoreCell && n % 2 === 0 && (n / 2) % sym === 0) n /= 2;
      const ring = mainPB(); circle(ring, cx, cy, b.r1); emit(ring, mainWFor(b), "#fff");
      const m = mainPB(); braid(m, P, { rm, amp, w, periods: n, off: b.off }); emit(m, mainWFor(b));
      const eye = amp - w / 2 - 1; // medio alto del ojo entre los dos cabos
      // Punto en cada ojo, sólo si su área supera el umbral de celda (un círculo de 1,4 mm de
      // radio mide 6,2 mm², y aplanado en curvas 5,9: la métrica lo cuenta como celda pequeña)
      const rDot = Math.min(eye * 0.6, 2.6);
      if (detail && Math.PI * rDot * rDot >= ctx.minCoreCell) {
        const d = detailPB();
        for (let i = 0; i < 2 * n; i++) circle(d, ...P(rm, b.off + (i * TAU) / (2 * n)), rDot);
        emit(d, detailWFor(b));
      }
    },
  },
  // Cadena de eslabones: anillos de cinta enlazados con sus vecinos. Como silueta, su perfil
  // festoneado es el borde del mandala.
  eslabones: {
    aspect: 0.72, minH: 18, silhouette: true,
    draw(ctx, b) {
      const { TAU, P, circle, cx, cy, mainPB, detailPB, emit, mainWFor, detailWFor, detail, B } = ctx;
      const h = b.r1 - b.r0, rm = (b.r0 + b.r1) / 2, sil = b.k === B - 1;
      const w = ribbonW(h * 0.7);
      // Los conteos son armónicos de N; si los eslabones quedan tan juntos que no dejan ojo
      // (cuerda < 2·cinta + 4 mm), se usa la mitad, que conserva la simetría de N/2
      const sym = ctx.N % 2 === 0 ? ctx.N / 2 : ctx.N;
      let n = b.n;
      while (2 * rm * Math.sin(Math.PI / n) < 2 * w + 4 && n % 2 === 0 && (n / 2) % sym === 0) n /= 2;
      const arc = 2 * rm * Math.sin(Math.PI / n);
      // Si ni así cabe un eslabón con ojo, la banda se dibuja como trenza (misma familia de cinta)
      if (arc < 2 * w + 4 && !sil) return exclusive.trenza.draw(ctx, { ...b, n });
      // Radio del eslabón: se cruza con el vecino (deja un ojo coloreable) sin tocar al siguiente,
      // y cabe en la banda
      // El tope «sin tocar al vecino alterno» usa la distancia real entre centros alternos en un
      // anillo, 2·arc·cos(π/n) (comprobada con Wolfram|Alpha), no 2·arc: con 10 eslabones o
      // menos, la cinta de un eslabón montaba sobre la del alterno.
      const rho = Math.min(h / 2 - w / 2 - (sil ? 0.2 : 1.2), arc * Math.cos(Math.PI / n) - w / 2 - 0.6, Math.max(arc * 0.75, (arc + w) / 2 + 1.4));
      if (!sil) { const ring = mainPB(); circle(ring, cx, cy, b.r1); emit(ring, mainWFor(b), "#fff"); }
      const m = mainPB(); ringChain(m, P, { cx, cy, rc: rm, count: n, rho, w, off: b.off }); emit(m, mainWFor(b));
      // Radio libre en el centro del eslabón: lo que dejan su propia cinta y las de los vecinos
      const free = Math.min(rho - w / 2, arc - rho - w / 2) - 1.2;
      if (detail && free > 1.6) {
        const d = detailPB();
        for (let i = 0; i < n; i++) circle(d, ...P(rm, b.off + (i * TAU) / n), Math.min(free, 3));
        emit(d, detailWFor(b));
      }
    },
  },
};

// Núcleo: trenza anular alrededor de un botón central.
function trenzaAnular(ctx, rCore) {
  const { N, P, cx, cy, circle, mainPB, detailPB, emit, mainW, detailW, detail, minCoreCell } = ctx;
  const sym = N % 2 === 0 ? N / 2 : N;
  const rm = rCore * 0.62, h = rCore * 0.68, w = Math.max(2.5, Math.min(3.5, h * 0.22)), amp = h / 2 - w / 2 - 0.9;
  const periods = sym >= 3 && (2 * Math.PI * rm) / sym >= 8 ? sym : 0; // sólo la simetría del mandala
  // El ojo de la trenza debe poder colorearse; si no cabe, núcleo común
  if (!periods || (amp - w / 2) * 2 < 2.2 || (amp - w / 2) * ((Math.PI * rm) / periods - w) < minCoreCell) return false;
  const rim = mainPB(); circle(rim, cx, cy, rCore); emit(rim, mainW, "#fff");
  const m = mainPB(); braid(m, P, { rm, amp, w, periods, off: -Math.PI / 2 }); emit(m, mainW);
  const c = mainPB(); circle(c, cx, cy, Math.max(rm - h / 2 - 0.4, 1.5)); emit(c, mainW, "#fff");
  if (detail && rm - h / 2 > 4) { const d = detailPB(); circle(d, cx, cy, (rm - h / 2) * 0.45); emit(d, detailW); }
}

export const celtico = {
  id: "celtico",
  // Peso de cada motivo en una banda intermedia. El orden de las claves importa: el sorteo recorre
  // la tabla en ese orden y un cambio altera todas las páginas.
  motifs: { petal: 1, round: 2, lotus: 1.5, leaf: 1.5, scallop: 2, heart: 1.5, ogee: 1.5, trenza: 5, eslabones: 3, rizo: 2, pluma: 1 },
  banned,
  exclusive,
  quota: 2,
  silhouettes: ["eslabones", ...DEFAULT_SILHOUETTES.filter(s => !banned.includes(s))],
  // Sin «flor_vida»: en el motor se dibuja como un disco vacío (su aro la tapa) y destapada deja
  // astillas; pendiente de rediseño (docs/ROADMAP_ESTILOS.md, riesgos).
  cores: ["trenza_anular", "trenza_anular", "flor_radiante"],
  coreDraw: { trenza_anular: trenzaAnular },
};
