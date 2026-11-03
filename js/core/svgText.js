// js/core/svgText.js
// Texto dentro del SVG de una página (notas, rótulos del mural, etapas). El libro se
// rasteriza antes de entrar al PDF, así que no hace falta incrustar fuentes para KDP.
// Sin DOM: el ancho de línea se estima con el ancho medio de un carácter serif.
const FONT = "Georgia, 'Times New Roman', serif";
// Ancho medio de un carácter, en em. 0,5 cubre la serif más ancha medida (DejaVu Serif, la
// sustituta de Georgia en Linux; Georgia ≈ 0,46, Times ≈ 0,40)
export const CHAR_EM = 0.5;

// Línea base de los rótulos del margen inferior. KDP sin sangrado exige que todo quede a
// ≥ 6,35 mm del corte; con letra de 2,8 mm las descendentes bajan ~0,7 mm más.
export const FOOTER_BASELINE_MM = 7.4;

export function escapeXml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Corta el texto en líneas que caben en maxW (mm) con letra de sizeMm. */
export function wrapLines(text, maxW, sizeMm) {
  const perLine = Math.max(8, Math.floor(maxW / (sizeMm * CHAR_EM)));
  const lines = [];
  for (const para of String(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const t = line ? `${line} ${word}` : word;
      if (t.length > perLine && line) { lines.push(line); line = word; } else line = t;
    }
    lines.push(line);
  }
  return lines;
}

/** Una línea de texto. anchor: start | middle | end. */
export function svgText(x, y, text, { size = 3.5, weight = "normal", anchor = "middle", fill = "#000", italic = false } = {}) {
  return `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-family="${FONT}" font-size="${size.toFixed(2)}" font-weight="${weight}"${italic ? ' font-style="italic"' : ""} text-anchor="${anchor}" fill="${fill}">${escapeXml(text)}</text>`;
}

