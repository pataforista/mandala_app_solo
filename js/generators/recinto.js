// js/generators/recinto.js
// Recinto cuadrado con cuatro puertas en T: el marco del yantra. Un solo dibujo para el motor
// (mandalaClassic, cuando el estilo lo pide) y para el compositor (marco «recinto» elegible),
// para que ambos sean idénticos.
import { PathBuilder } from "../core/pathBuilder.js";

/**
 * Trazos del recinto dentro de la hoja. m: distancia del borde exterior de la línea al corte
 * (ya incluye medio trazo, como en el resto de marcos). Devuelve tres trazados:
 *   outline: el cuadrado con un hueco centrado en cada lado (las puertas)
 *   tabs:    las jambas y el umbral de cada puerta, hacia dentro
 *   inner:   línea interior fina (sólo con includeFrames)
 */
export function recintoPaths(page, m, { includeFrames = true } = {}) {
  const x0 = m, y0 = m, x1 = page.wMm - m, y1 = page.hMm - m;
  const gx = (x1 - x0) * 0.09, gy = (y1 - y0) * 0.09;
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, door = 4.5;
  const outline = new PathBuilder();
  outline.moveTo(x0, y0).lineTo(mx - gx, y0).moveTo(mx + gx, y0).lineTo(x1, y0).lineTo(x1, my - gy).moveTo(x1, my + gy).lineTo(x1, y1)
    .lineTo(mx + gx, y1).moveTo(mx - gx, y1).lineTo(x0, y1).lineTo(x0, my + gy).moveTo(x0, my - gy).lineTo(x0, y0);
  // Puerta en T: el hueco del lado queda abierto y, hacia dentro, dos jambas que cierran un umbral
  const tabs = new PathBuilder();
  const jamb = (xa, ya, xb, yb) => tabs.moveTo(xa, ya).lineTo(xb, yb);
  for (const [yE, dir] of [[y0, 1], [y1, -1]]) {
    const yIn = yE + dir * door, jw = gx * 0.55;
    jamb(mx - jw, yE, mx - jw, yIn); jamb(mx + jw, yE, mx + jw, yIn);
    jamb(mx - jw, yIn, mx + jw, yIn);
  }
  for (const [xE, dir] of [[x0, 1], [x1, -1]]) {
    const xIn = xE + dir * door, jh = gy * 0.55;
    jamb(xE, my - jh, xIn, my - jh); jamb(xE, my + jh, xIn, my + jh);
    jamb(xIn, my - jh, xIn, my + jh);
  }
  const inner = new PathBuilder();
  if (includeFrames) inner.moveTo(x0 + 2.5, y0 + 2.5).lineTo(x1 - 2.5, y0 + 2.5).lineTo(x1 - 2.5, y1 - 2.5).lineTo(x0 + 2.5, y1 - 2.5).close();
  return { outline, tabs, inner };
}
