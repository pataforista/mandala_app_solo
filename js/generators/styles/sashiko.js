// js/generators/styles/sashiko.js
// Gramática del estilo «sashiko»: tramas de la costura japonesa llevadas a una banda circular.
// Seigaiha (olas), asanoha (hoja de cáñamo), shippo (círculos enlazados) y kikko (panal), con
// un crisantemo en el centro. Son tramas tradicionales de dominio común.
// Regla de trazo del estilo: una sola línea de grosor uniforme, sin detalle fino.
// Etapa E7 de docs/ROADMAP_ESTILOS.md.
import { DEFAULT_CORES, cellPoly } from "./common.js";

// Vetos: motivos que este estilo nunca dibuja. Ningún peso de `motifs` puede estar aquí.
const banned = ["flame", "heart", "chevron"];

const exclusive = {
  // Olas: abanicos de arcos concéntricos en dos filas solapadas. Como silueta, las crestas de
  // la fila de fuera son el borde del mandala.
  seigaiha: {
    aspect: 1.0, minH: 10, silhouette: true,
    draw(ctx, b) {
      const { TAU, N, P, circle, cx, cy, mainPB, emit, mainWFor, minCell, B } = ctx;
      const h = b.r1 - b.r0, sil = b.k === B - 1, top = b.r1 - (sil ? 0 : 0.4);
      // El radio de un abanico lo fija la separación entre vecinos (se tocan cuando
      // radio = r·sen(π/n)); nunca la altura de la banda. Antes el radio se recortaba a la
      // altura y en una de cada tres bandas los abanicos quedaban sueltos, con huecos de
      // hasta 9 mm. Si con el conteo de la banda el abanico no cabe en alto, se dobla el
      // conteo (sigue siendo múltiplo de N: la simetría no cambia).
      let n = b.n;
      while (b.r0 * Math.sin(Math.PI / n) > h * 0.98 && n < 8 * N) n *= 2;
      const step = TAU / n;
      // Filas de dentro afuera: cada una a medio paso de la anterior, con el radio que la hace
      // tocarse a su propia distancia del centro. Se apilan mientras quepan en la banda.
      const rows = [];
      for (let r = b.r0, k = 0; k < 6; k++) {
        const rho = r * Math.sin(step / 2) * (k ? 1.03 : 1);
        if (k && r + rho > top) break;
        rows.push({ r, rho, off: b.off + (k % 2 ? step / 2 : 0) });
        r += rho * 0.95;
      }
      if (!sil) { const ring = mainPB(); circle(ring, cx, cy, b.r1); emit(ring, mainWFor(b), "#fff"); }
      // De fuera adentro: cada fila tapa la mitad inferior de la que tiene detrás
      for (const row of rows.reverse()) {
        // Arcos interiores sólo si la franja entre dos arcos se puede colorear
        const rings = [1, 0.66, 0.33].filter((q, i) => !i || (row.rho / 3) * row.rho * q * 1.5 >= minCell);
        const pb = mainPB();
        for (let i = 0; i < n; i++) { const [x, y] = P(row.r, row.off + i * step); for (const q of rings) circle(pb, x, y, row.rho * q); }
        emit(pb, mainWFor(b), "#fff");
      }
    },
  },
  // Hoja de cáñamo: triángulos alternos, cada uno partido en tres desde su centro.
  asanoha: {
    aspect: 1.15, minH: 9,
    draw(ctx, b) {
      const { TAU, P, circle, cx, cy, mainPB, emit, mainWFor, detail, minCell } = ctx;
      const step = TAU / b.n, h = b.r1 - b.r0, rm = (b.r0 + b.r1) / 2;
      const m = mainPB(), d = mainPB();
      const split = detail && (rm * step * h) / 6 >= minCell * 1.8; // cada tercio debe poder colorearse con holgura
      for (let i = 0; i < b.n; i++) {
        const a = b.off + i * step;
        m.moveTo(...P(b.r0, a - step / 2)).lineTo(...P(b.r1, a)).lineTo(...P(b.r0, a + step / 2));
        if (split) {
          const up = P(b.r0 + h / 3, a), dn = P(b.r0 + (2 * h) / 3, a + step / 2);
          for (const v of [P(b.r0, a - step / 2), P(b.r1, a), P(b.r0, a + step / 2)]) d.moveTo(...up).lineTo(...v);
          for (const v of [P(b.r1, a), P(b.r1, a + step), P(b.r0, a + step / 2)]) d.moveTo(...dn).lineTo(...v);
        }
      }
      const ring = mainPB(); circle(ring, cx, cy, b.r1);
      emit(ring, mainWFor(b), "#fff"); emit(m, mainWFor(b)); emit(d, mainWFor(b));
    },
  },
  // Círculos enlazados: cada círculo se cruza con sus vecinos y deja lentes entre ellos.
  shippo: {
    aspect: 0.62, minH: 12, outline: false,
    draw(ctx, b) {
      const { TAU, P, circle, cx, cy, mainPB, emit, mainWFor, detail, minCell } = ctx;
      const step = TAU / b.n, h = b.r1 - b.r0, rm = (b.r0 + b.r1) / 2, arc = 2 * rm * Math.sin(step / 2);
      // Cada círculo pasa cerca del centro de sus vecinos y, como mucho, roza al vecino alterno.
      // En un anillo los centros alternos distan 2·arc·cos(π/n), no 2·arc (identidad comprobada
      // con Wolfram|Alpha): con 12 círculos o menos, un radio de 0,98·arc invadía al alterno y
      // dejaba astillas entre tres círculos.
      const rho = Math.min(h * 0.5 - 0.2, arc * Math.cos(Math.PI / b.n) * 0.98);
      const m = mainPB(), d = mainPB();
      for (let i = 0; i < b.n; i++) {
        circle(m, ...P(rm, b.off + i * step), rho);
        // Un punto en el centro de cada lente, si la lente es amplia
        const lens = 2 * rho - arc;
        if (detail && lens > 5 && Math.PI * (lens * 0.22) ** 2 >= minCell) circle(d, ...P(rm, b.off + (i + 0.5) * step), lens * 0.22);
      }
      const ring = mainPB(); circle(ring, cx, cy, b.r1);
      emit(ring, mainWFor(b), "#fff"); emit(m, mainWFor(b)); emit(d, mainWFor(b));
    },
  },
  // Panal: hexágonos que comparten sus lados verticales.
  kikko: {
    aspect: 0.95, minH: 9,
    draw(ctx, b) {
      const { TAU, circle, cx, cy, mainPB, emit, mainWFor, detail, minCell } = ctx;
      const step = TAU / b.n, h = b.r1 - b.r0, rm = (b.r0 + b.r1) / 2;
      const m = mainPB(), d = mainPB();
      const inner = detail && rm * step * h * 0.22 >= minCell * 1.5;
      for (let i = 0; i < b.n; i++) {
        const a0 = b.off + (i - 0.5) * step;
        cellPoly(ctx, m, b, a0, [[0, 0.27], [0.5, 0.02], [1, 0.27], [1, 0.73], [0.5, 0.98], [0, 0.73]]);
        if (inner) cellPoly(ctx, d, b, a0, [[0.25, 0.38], [0.5, 0.26], [0.75, 0.38], [0.75, 0.62], [0.5, 0.74], [0.25, 0.62]]);
      }
      const ring = mainPB(); circle(ring, cx, cy, b.r1);
      emit(ring, mainWFor(b), "#fff"); emit(m, mainWFor(b), "#fff"); emit(d, mainWFor(b));
    },
  },
};

// Núcleo: crisantemo. Dos coronas de pétalos largos y redondeados alrededor de un botón.
function crisantemo(ctx, rCore) {
  const { N, TAU, cx, cy, circle, petalShape, mainPB, emit, mainW, minCoreCell, outlineMode } = ctx;
  const sym = N % 2 === 0 ? N / 2 : N;
  // Un pétalo largo y estrecho no se puede colorear: se pide que su ancho medio sea al menos
  // un tercio de su largo. Con contornos gruesos (niveles infantiles) se prefiere la mitad de pétalos.
  const fits = (k) => k >= 5 && (TAU / k) * rCore * 0.6 >= rCore * 0.65 * 0.34 && (TAU / k) * rCore * 0.6 * rCore * 0.5 * 0.45 >= minCoreCell;
  const n = (outlineMode ? [sym, N] : [N, sym]).find(fits);
  if (!n) return false;
  const step = TAU / n, w = (step / 2) * 0.92;
  const rim = mainPB(); circle(rim, cx, cy, rCore); emit(rim, mainW, "#fff");
  const back = mainPB(), front = mainPB();
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + i * step;
    petalShape(back, rCore * 0.3, rCore * 0.95, a + step / 2, w, 1.0, true);
    petalShape(front, rCore * 0.24, rCore * 0.74, a, w, 1.0, true);
  }
  emit(back, mainW, "#fff"); emit(front, mainW, "#fff");
  const c = mainPB(); circle(c, cx, cy, Math.max(rCore * 0.26, 1.4)); emit(c, mainW, "#fff");
}

export const sashiko = {
  id: "sashiko",
  // Peso de cada motivo en una banda intermedia. El orden de las claves importa: el sorteo recorre
  // la tabla en ese orden y un cambio altera todas las páginas.
  motifs: { petal: 0.8, round: 1.5, lotus: 0.8, leaf: 0.6, scallop: 2, diamond: 0.8, ogee: 0.6, seigaiha: 4, asanoha: 3.5, shippo: 3, kikko: 3 },
  banned,
  exclusive,
  quota: 1,
  silhouettes: ["seigaiha", "seigaiha", "scallop", "lotus"],
  cores: ["crisantemo", "crisantemo", ...DEFAULT_CORES.filter(c => c === "flor_radiante")],
  coreDraw: { crisantemo },
};
