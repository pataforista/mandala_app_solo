// Batching: construye un único d=... grande (muy eficiente).
// minClosedArea (mm²): los subpaths cerrados con área menor se descartan al
// cerrarse. En libros para colorear, una celda más pequeña que la punta de un
// lápiz no se puede colorear y solo ensucia la página.
export class PathBuilder {
  constructor({ minClosedArea = 0 } = {}) {
    this._d = "";
    this._minClosedArea = minClosedArea;
    this._subStart = 0;
    this._open = false;
    this._sx = 0; this._sy = 0; // inicio del subpath
    this._x = 0; this._y = 0;   // punto actual
    this._area2 = 0;            // 2·área con signo (teorema de Green), exacta para L/Q/C
  }

  moveTo(x, y) {
    this._subStart = this._d.length;
    this._open = true;
    this._sx = this._x = x; this._sy = this._y = y;
    this._area2 = 0;
    this._d += `M ${fmt(x)} ${fmt(y)} `;
    return this;
  }
  lineTo(x, y) {
    this._area2 += this._x * y - x * this._y;
    this._x = x; this._y = y;
    this._d += `L ${fmt(x)} ${fmt(y)} `;
    return this;
  }
  quadTo(cx, cy, x, y) {
    // ∮(x dy − y dx) sobre una Bézier cuadrática, forma cerrada
    const x0 = this._x, y0 = this._y;
    this._area2 += (x0 * (2 * cy + y) - cx * (2 * y0 - 2 * y) - x * (y0 + 2 * cy)) / 3;
    this._x = x; this._y = y;
    this._d += `Q ${fmt(cx)} ${fmt(cy)} ${fmt(x)} ${fmt(y)} `;
    return this;
  }
  cubicTo(cx1, cy1, cx2, cy2, x, y) {
    // ∮(x dy − y dx) sobre una Bézier cúbica, forma cerrada
    const x0 = this._x, y0 = this._y;
    this._area2 += (
      x0 * (6 * cy1 + 3 * cy2 + y) + 3 * cx1 * (-2 * y0 + cy2 + y) - 3 * cx2 * (y0 + cy1 - 2 * y) - x * (y0 + 3 * cy1 + 6 * cy2)
    ) / 10;
    this._x = x; this._y = y;
    this._d += `C ${fmt(cx1)} ${fmt(cy1)} ${fmt(cx2)} ${fmt(cy2)} ${fmt(x)} ${fmt(y)} `;
    return this;
  }
  close() {
    if (this._open) {
      const area = Math.abs(this._area2 + this._x * this._sy - this._sx * this._y) / 2;
      if (this._minClosedArea > 0 && area < this._minClosedArea) {
        this._d = this._d.slice(0, this._subStart);
        this._open = false;
        return this;
      }
      this._x = this._sx; this._y = this._sy;
    }
    this._d += "Z ";
    return this;
  }

  get d() { return this._d.trim(); }

  toPath({ stroke = "#000", strokeWidthMm = 0.6, fill = "none", linecap = "round", linejoin = "round" } = {}) {
    const d = this.d;
    if (!d || d.includes("[object Object]")) return "";
    return `<path d="${esc(d)}" fill="${fill}" stroke="${stroke}" stroke-width="${fmt(strokeWidthMm)}" stroke-linecap="${linecap}" stroke-linejoin="${linejoin}" />`;
  }
}

/**
 * Umbral de área para descartar formas cerradas según el perfil de coloreo.
 * - outlineMode (niños / zen): todo lo que no alcance minCellArea.
 * - detailSimplification > 0.5: escala gradualmente hasta minCellArea.
 * Con los valores por defecto (adulto/experto) devuelve 0 y no altera el diseño.
 */
export function coloringCullArea({ outlineMode = false, minCellAreaMm2 = 0, detailSimplification = 0 } = {}) {
  const minArea = Number.isFinite(minCellAreaMm2) ? Math.max(0, minCellAreaMm2) : 0;
  if (outlineMode) return minArea;
  const s = Number.isFinite(detailSimplification) ? detailSimplification : 0;
  return minArea * Math.max(0, Math.min(1, (s - 0.5) * 2));
}

/**
 * Celda cerrada más pequeña que se dibuja en un libro para colorear: la «celda mínima» del
 * nivel completa (Adulto: 5 mm²). coloringCullArea sólo aplicaba una fracción de ella según
 * la simplificación (1 mm² con Adulto) y quedaban celdas imposibles de colorear con lápiz.
 */
export function coloringMinCell(opts = {}) {
  const promised = Number.isFinite(opts.minCellAreaMm2) ? Math.max(0, opts.minCellAreaMm2) : 0;
  return Math.max(coloringCullArea(opts), promised);
}

function fmt(n) {
  // SVG con mm; 2 decimales es suficiente para 300dpi print (0.01mm = 0.12px)
  return (Math.round(n * 100) / 100).toString();
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
