// js/core/figureImport.js
// Del archivo de imagen a una figura lista para la página (navegador).
// Lo comparten la app y preprocesar.html, así ambas dan exactamente el mismo resultado.
import { processFigure } from "./lineArt.js";
import { encodeGrayPng, bytesToDataUrl } from "./grayPng.js";

// Se procesa a tamaño real (sin ampliar): ampliar antes crea rampas suaves en los
// bordes y el detector de fondo se cuela por ellas. Sólo se reduce si es enorme.
const MAX_SIDE = 1400;

export function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`${file.name}: formato de imagen no válido`)); };
    img.src = url;
  });
}

/**
 * img: HTMLImageElement. settings: opciones de processFigure.
 * crop: { left, top, right, bottom } en fracciones 0-0.45 (quita texto, marcos, firmas).
 * seeds: clics sobre el fondo, [[x, y], …] en fracciones de la imagen ORIGINAL.
 * Devuelve { href, cls, w, h }.
 */
export async function figureFromImage(img, settings = {}, crop = {}, seeds = []) {
  const { left = 0, top = 0, right = 0, bottom = 0 } = crop;
  const sx = img.naturalWidth * left, sy = img.naturalHeight * top;
  const sw = img.naturalWidth * (1 - left - right), sh = img.naturalHeight * (1 - top - bottom);
  const k = Math.min(1, MAX_SIDE / Math.max(sw, sh));
  const w = Math.max(8, Math.round(sw * k)), h = Math.max(8, Math.round(sh * k));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  // Clics: de coordenadas de la imagen original a coordenadas del recorte
  const cw = 1 - left - right, ch = 1 - top - bottom;
  const bgSeeds = seeds
    .map(([x, y]) => [(x - left) / cw, (y - top) / ch])
    .filter(([x, y]) => x >= 0 && y >= 0 && x <= 1 && y <= 1);
  const fig = processFigure(data, w, h, { ...settings, bgSeeds });
  const href = bytesToDataUrl(await encodeGrayPng(fig.gray, fig.w, fig.h));
  return { href, cls: fig.cls, w: fig.w, h: fig.h };
}
