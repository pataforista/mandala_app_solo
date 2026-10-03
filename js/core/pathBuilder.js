// Batching: construye un único d=... grande (muy eficiente).
// minClosedArea (mm²): los subpaths cerrados con área menor se descartan al
// cerrarse. En libros para colorear, una celda más pequeña que la punta de un
// lápiz no se puede colorear y solo ensucia la página.
export class PathBuilder {
  constructor({ minClosedArea = 0 } = {}) {
    this._d = "";
    this._minClosedArea = minClosedArea;
    this._subStart = 0;
    this._pts = [];
  }

  moveTo(x, y) {
    this._subStart = this._d.length;
    this._pts = [[x, y]];
    this._d += `M ${fmt(x)} ${fmt(y)} `;
    return this;
  }
  lineTo(x, y) { this._pts.push([x, y]); this._d += `L ${fmt(x)} ${fmt(y)} `; return this; }
  quadTo(cx, cy, x, y) {
    // Punto medio de la curva (no el de control) para estimar el área
    const [px, py] = this._pts[this._pts.length - 1] ?? [x, y];
    this._pts.push([0.25 * px + 0.5 * cx + 0.25 * x, 0.25 * py + 0.5 * cy + 0.25 * y], [x, y]);
    this._d += `Q ${fmt(cx)} ${fmt(cy)} ${fmt(x)} ${fmt(y)} `;
    return this;
  }
  cubicTo(cx1, cy1, cx2, cy2, x, y) {
    const [px, py] = this._pts[this._pts.length - 1] ?? [x, y];
    const b = (t, a, c1, c2, e) => (1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * c1 + 3 * (1 - t) * t * t * c2 + t ** 3 * e;
    this._pts.push(
      [b(1 / 3, px, cx1, cx2, x), b(1 / 3, py, cy1, cy2, y)],
      [b(2 / 3, px, cx1, cx2, x), b(2 / 3, py, cy1, cy2, y)],
      [x, y]
    );
    this._d += `C ${fmt(cx1)} ${fmt(cy1)} ${fmt(cx2)} ${fmt(cy2)} ${fmt(x)} ${fmt(y)} `;
    return this;
  }
  close() {
    if (this._minClosedArea > 0 && this._pts.length > 0 && polygonArea(this._pts) < this._minClosedArea) {
      this._d = this._d.slice(0, this._subStart);
      this._pts = [];
      return this;
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

function polygonArea(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1]);
  }
  return Math.abs(a / 2);
}

function fmt(n) {
  // SVG con mm; 2 decimales es suficiente para 300dpi print (0.01mm = 0.12px)
  return (Math.round(n * 100) / 100).toString();
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
