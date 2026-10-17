// js/generators/muralPage.js
// «Mural para armar»: un mandala gigante repartido en cols × filas hojas. Cada hoja
// muestra exactamente su rectángulo del diseño dentro de los márgenes de KDP (sin
// sangrado no se puede imprimir hasta el corte). La línea que rodea ese rectángulo es
// la línea de corte: recortadas por ahí, las hojas se tocan borde con borde y el
// dibujo continúa sin saltos. Una hoja guía muestra el mapa para armarlo.
import { generateMandalaClassic } from "./mandalaClassic.js";
import { PathBuilder } from "../core/pathBuilder.js";
import { svgText, wrapLines, FOOTER_BASELINE_MM } from "../core/svgText.js";

const COLS = "ABCDEFGH";
const cache = new Map();

/** Medidas del mural: hoja útil (tw × th) y mural completo (W × H), en mm. */
export function muralGeometry(page, cols, rows) {
  const m = Number.isFinite(page.marginMm) ? page.marginMm : 10;
  const tw = page.wMm - 2 * m, th = page.hMm - 2 * m;
  return { m, tw, th, W: cols * tw, H: rows * th };
}

export const tileName = (col, row) => `${COLS[col]}${row + 1}`;

// El mandala completo se dibuja una sola vez por libro (todas las hojas lo comparten)
function muralBody(opts, W, H) {
  // La clave incluye TODAS las opciones de dibujo: con una clave parcial, cambiar p. ej. el
  // espaciado entre la revisión y la descarga devolvía el mural viejo
  const { mural: _m, special: _s, ...drawOpts } = opts;
  const key = JSON.stringify([drawOpts, W.toFixed(2), H.toFixed(2)]);
  if (cache.has(key)) return cache.get(key);
  const v = { page: { wMm: W, hMm: H, marginMm: 0 }, seed: opts.seed >>> 0, meta: {}, defs: [], body: [] };
  const cells = Math.max(W, H) / 280; // ≈ número de hojas a lo largo del lado mayor
  generateMandalaClassic(v, {
    ...opts, special: undefined, composition: "constelacion", mainScale: 0.97, frameStyle: "ninguno", pageBorder: false,
    includeFrames: true, centerArt: null, figure: null, figureRing: null,
    // Más anillos que un mandala de una hoja: si no, el mural es una página ampliada
    minBands: Math.round(6 + cells * 3),
  });
  const res = { defs: v.defs, body: v.body };
  if (cache.size > 4) cache.clear();
  cache.set(key, res);
  return res;
}

/** Hoja (col, row) del mural, u hoja guía si opts.mural.guide. */
export function generateMuralPage(doc, opts) {
  const { cols = 3, rows = 3, col = 0, row = 0, guide = false } = opts.mural || {};
  const page = doc.page;
  const { m, tw, th, W, H } = muralGeometry(page, cols, rows);
  const mural = muralBody(opts, W, H);
  const stroke = opts.stroke || "#000";
  const mainW = Math.max(0.3, opts.strokeWidthMm ?? 0.55);
  const uid = `${(opts.seed >>> 0).toString(36)}-${doc.defs.length}`;
  // Ids del mural renombrados por hoja: varias hojas no comparten documento, pero la guía
  // y una hoja podrían convivir en una misma vista previa
  const defs = mural.defs.map(d => d.replace(/id="([^"]+)"/g, `id="$1-${uid}"`));
  const body = mural.body.map(b => b.replace(/url\(#([^)]+)\)/g, `url(#$1-${uid})`));
  doc.defs.push(...defs);

  if (guide) return muralGuide(doc, { cols, rows, m, tw, th, W, H, body, uid, stroke });

  const id = `mural-clip-${uid}`;
  doc.defs.push(`<clipPath id="${id}"><rect x="${m}" y="${m}" width="${tw}" height="${th}" /></clipPath>`);
  doc.body.push(`<g clip-path="url(#${id})"><g transform="translate(${(m - col * tw).toFixed(3)} ${(m - row * th).toFixed(3)})">`, ...body, `</g></g>`);
  // Línea de corte: cierra las celdas del borde y marca por dónde recortar
  const cut = new PathBuilder();
  cut.moveTo(m, m).lineTo(m + tw, m).lineTo(m + tw, m + th).lineTo(m, m + th).close();
  doc.body.push(cut.toPath({ stroke, strokeWidthMm: mainW, linejoin: "miter", linecap: "butt" }));
  // Rótulo en el margen inferior izquierdo (el número de página va al centro)
  const y = page.hMm - FOOTER_BASELINE_MM;
  doc.body.push(svgText(m, y, `Mural · hoja ${tileName(col, row)} (columna ${COLS[col]}, fila ${row + 1})`, { size: 2.8, anchor: "start", fill: "#444" }));
  // Vecinas: flechas discretas que ayudan a orientar la hoja al armar
  const hint = [];
  if (row > 0) hint.push(`arriba: ${tileName(col, row - 1)}`);
  if (col < cols - 1) hint.push(`derecha: ${tileName(col + 1, row)}`);
  if (hint.length) doc.body.push(svgText(page.wMm - m, y, hint.join(" · "), { size: 2.8, anchor: "end", fill: "#444" }));
  if (doc.meta) doc.meta.mural = { col, row, cols, rows };
  return doc;
}

function muralGuide(doc, { cols, rows, m, tw, th, W, H, body, uid, stroke }) {
  const page = doc.page;
  doc.body.push(svgText(page.wMm / 2, m + 12, "Arma tu mural", { size: 7, weight: "bold" }));
  const steps = [
    `1. Colorea las ${cols * rows} hojas del mural, en orden o al azar.`,
    "2. Recorta cada hoja por su línea exterior.",
    "3. Únelas por detrás con cinta según este mapa: la letra es la columna y el número la fila.",
    `Tamaño final: ${Math.round(W / 10)} × ${Math.round(H / 10)} cm.`,
  ];
  let y = m + 21;
  for (const s of steps) for (const l of wrapLines(s, page.wMm - 2 * m - 10, 3.6)) { doc.body.push(svgText(page.wMm / 2, y, l, { size: 3.6 })); y += 5; }
  // Miniatura del mural con la cuadrícula de hojas
  const top = y + 4, aw = page.wMm - 2 * m - 6, ah = page.hMm - top - m - 4;
  const s = Math.min(aw / W, ah / H);
  const ox = (page.wMm - W * s) / 2, oy = top + (ah - H * s) / 2;
  const id = `mural-guide-${uid}`;
  doc.defs.push(`<clipPath id="${id}"><rect x="0" y="0" width="${W}" height="${H}" /></clipPath>`);
  doc.body.push(`<g transform="translate(${ox.toFixed(3)} ${oy.toFixed(3)}) scale(${s.toFixed(5)})"><g clip-path="url(#${id})">`, ...body, `</g></g>`);
  const grid = new PathBuilder();
  for (let c = 0; c <= cols; c++) grid.moveTo(ox + c * tw * s, oy).lineTo(ox + c * tw * s, oy + H * s);
  for (let r = 0; r <= rows; r++) grid.moveTo(ox, oy + r * th * s).lineTo(ox + W * s, oy + r * th * s);
  doc.body.push(grid.toPath({ stroke, strokeWidthMm: 0.6, linecap: "butt" }));
  const fs = Math.min(tw, th) * s * 0.28;
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const x = ox + (c + 0.5) * tw * s, yy = oy + (r + 0.5) * th * s + fs * 0.35;
    // Rótulo con halo blanco para leerse sobre el dibujo
    doc.body.push(`<text x="${x.toFixed(2)}" y="${yy.toFixed(2)}" font-family="Georgia, serif" font-size="${fs.toFixed(2)}" font-weight="bold" text-anchor="middle" fill="#000" stroke="#fff" stroke-width="${(fs * 0.18).toFixed(2)}" paint-order="stroke">${tileName(c, r)}</text>`);
  }
  if (doc.meta) doc.meta.mural = { guide: true, cols, rows };
  return doc;
}
