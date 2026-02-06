// Batching: construye un único d=... grande (muy eficiente).
export class PathBuilder {
  constructor() {
    this._d = "";
  }

  moveTo(x, y) { this._d += `M ${fmt(x)} ${fmt(y)} `; return this; }
  lineTo(x, y) { this._d += `L ${fmt(x)} ${fmt(y)} `; return this; }
  quadTo(cx, cy, x, y) { this._d += `Q ${fmt(cx)} ${fmt(cy)} ${fmt(x)} ${fmt(y)} `; return this; }
  cubicTo(cx1, cy1, cx2, cy2, x, y) {
    this._d += `C ${fmt(cx1)} ${fmt(cy1)} ${fmt(cx2)} ${fmt(cy2)} ${fmt(x)} ${fmt(y)} `;
    return this;
  }
  close() { this._d += "Z "; return this; }

  get d() { return this._d.trim(); }

  toPath({ stroke = "#000", strokeWidthMm = 0.6, fill = "none", linecap = "round", linejoin = "round" } = {}) {
    const d = this.d;
    if (!d || d.includes("[object Object]")) return "";
    return `<path d="${esc(d)}" fill="${fill}" stroke="${stroke}" stroke-width="${fmt(strokeWidthMm)}" stroke-linecap="${linecap}" stroke-linejoin="${linejoin}" />`;
  }
}

function fmt(n) {
  // SVG con mm; 2-3 decimales es suficiente para impresión sin inflar el archivo
  return (Math.round(n * 1000) / 1000).toString();
}

function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
