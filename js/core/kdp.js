// js/core/kdp.js
// Reglas de Amazon KDP para el interior de un libro de tapa blanda (paperback),
// según la guía "Set trim size, bleed, and margins" de KDP. Funciones puras: sin DOM,
// para poder probarlas en Node y reutilizarlas en la interfaz.
const IN = 25.4;

export const KDP_MIN_PAGES = 24;   // mínimo para tapa blanda
export const KDP_MAX_PAGES = 828;  // máximo en blanco y negro sobre papel blanco
export const KDP_MIN_DPI = 300;
export const KDP_OUTSIDE_MARGIN_MM = 0.25 * IN; // superior, inferior y exterior (sin sangrado)

// Margen interior (medianil) mínimo según el número de páginas
const GUTTER_TABLE = [
  [150, 0.375], [300, 0.5], [500, 0.625], [700, 0.75], [828, 0.875],
];

export function kdpGutterMm(pages) {
  for (const [max, inches] of GUTTER_TABLE) if (pages <= max) return inches * IN;
  return GUTTER_TABLE[GUTTER_TABLE.length - 1][1] * IN;
}

/**
 * Margen uniforme que cumple a la vez el medianil y el margen exterior.
 * Uniforme porque el mandala va centrado: si el margen alternara entre páginas
 * pares e impares, el diseño "bailaría" al pasar la hoja.
 * base: el margen que el usuario ya usa (nunca lo reducimos).
 */
export function kdpSafeMarginMm(pages, base = 10) {
  return Math.max(base, kdpGutterMm(pages), KDP_OUTSIDE_MARGIN_MM);
}

/** KDP imprime pliegos: un número impar de páginas se completa con una en blanco. */
export function evenPageCount(pages) {
  return pages + (pages % 2);
}

/**
 * Páginas del libro en orden. Cada entrada: { kind: "title"|"copyright"|"mandala"|"blank", index? }
 * Con reverso en blanco, cada mandala queda en página impar (derecha) y su reverso vacío,
 * para que el marcador que traspasa el papel no arruine el siguiente dibujo.
 */
export function bookLayout({ mandalas, blankBack = true, titlePage = true, copyrightPage = false, belongsPage = false, welcomePage = false, reviewPage = false, keepBack = [], pad = true }) {
  // keepBack: mandalas que conservan el reverso en blanco aunque el libro sea a doble cara
  // (las hojas del mural se recortan: un dibujo al reverso se destruiría)
  const keep = new Set(keepBack);
  const pages = [];
  if (titlePage) pages.push({ kind: "title" });
  if (copyrightPage) pages.push({ kind: "copyright" });
  else if (titlePage && blankBack) pages.push({ kind: "blank" });
  // Si sólo hay copyright (sin título), el primer mandala debe caer en página impar
  if (!titlePage && copyrightPage && blankBack) pages.push({ kind: "blank" });
  // Página "Este libro pertenece a" (después de título/derechos, antes del contenido)
  if (belongsPage) pages.push({ kind: "belongs" });
  // Página de bienvenida/introducción (antes del primer mandala)
  if (welcomePage) pages.push({ kind: "welcome" });
  for (let i = 0; i < mandalas; i++) {
    pages.push({ kind: "mandala", index: i });
    if (blankBack || keep.has(i)) pages.push({ kind: "blank" });
  }
  // Página de reseña/invitación al final (antes de la página de relleno)
  if (reviewPage) pages.push({ kind: "review" });
  // pad = false: sin la página de relleno, para saber si el total natural es impar
  if (pad && pages.length % 2) pages.push({ kind: "blank" });
  return pages;
}

/**
 * Lista de comprobación previa a la subida. Devuelve [{ ok, level, msg }].
 * level: "error" (KDP rechazará el archivo), "warn" (recomendación), "info".
 */
export function kdpChecklist({ pages, marginMm, dpi = 300, consecutiveBlanks = 1 }) {
  const out = [];
  const add = (ok, level, msg) => out.push({ ok, level: ok ? "info" : level, msg });
  add(pages >= KDP_MIN_PAGES, "error", `Páginas: ${pages} (mínimo ${KDP_MIN_PAGES}).`);
  add(pages <= KDP_MAX_PAGES, "error", `Páginas: ${pages} (máximo ${KDP_MAX_PAGES} en B/N).`);
  add(pages % 2 === 0, "warn", "Número de páginas par.");
  const gutter = kdpGutterMm(pages);
  add(marginMm + 1e-6 >= gutter, "error", `Margen ${marginMm.toFixed(1)} mm ≥ medianil exigido ${gutter.toFixed(1)} mm.`);
  add(dpi >= KDP_MIN_DPI, "error", `Resolución ${dpi} DPI (mínimo ${KDP_MIN_DPI}).`);
  add(consecutiveBlanks <= 2, "warn", "Como máximo 2 páginas en blanco seguidas en el cuerpo del libro.");
  return out;
}
