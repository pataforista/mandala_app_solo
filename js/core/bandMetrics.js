// js/core/bandMetrics.js
// Elección del número de motivos de una banda. Sólo se consideran conteos armónicos
// (candidates = N/2, N, 2N…): así la banda conserva la simetría exacta de los pétalos.
// Un conteo fuera de la escalera daría una simetría que la página no tiene.
const TAU = Math.PI * 2;

/**
 * Devuelve el primer candidato cuyas celdas quedan bien proporcionadas, ordenados por
 * cercanía a la proporción ideal. Si ninguno cumple, devuelve el más cercano.
 * r0, r1: radios de la banda (mm). aspect: ancho/alto ideal de la celda.
 * minArea: área útil mínima de una celda (mm²). fill: fracción del paso ocupada por el motivo.
 */
export function fitBandCount({ r0, r1, candidates, aspect = 0.8, minArea = 4, fill = 0.9 }) {
  const h = Math.max(0.8, r1 - r0);
  const rm = (r0 + r1) / 2;
  const pitch = TAU * rm;
  const ideal = pitch / (h * aspect);
  const ranked = [...new Set(candidates)].sort((a, b) => Math.abs(Math.log(a / ideal)) - Math.abs(Math.log(b / ideal)));
  const areaOk = (n) => { const w = (pitch / n) * fill; return w * h * 0.55 >= minArea && pitch / n - w >= 0.8; };
  for (const n of ranked) {
    const w = (pitch / n) * fill;
    const ratio = (w / h) / aspect;
    if (ratio < 0.6 || ratio > 1.5) continue; // ni aguja ni tortuga
    if (!areaOk(n)) continue;                 // área útil de una lente y separación mínima
    return n;
  }
  // Ninguno cumple todo: primero que la celda se pueda colorear (aunque la proporción no
  // sea la ideal); si ni así, el conteo con las celdas más grandes. Antes se devolvía el de
  // mejor proporción aunque sus celdas fueran diminutas (14–23 % de celdas < 6 mm² en los
  // mandalas pequeños de «constelación»).
  const roomy = ranked.find(areaOk);
  if (roomy != null) return roomy;
  return Math.min(...ranked);
}
