// js/core/svgText.js
// Texto dentro del SVG de una página (notas, rótulos del mural, etapas). El libro se
// rasteriza antes de entrar al PDF, así que no hace falta incrustar fuentes para KDP.
// Sin DOM: el ancho de línea se estima con el ancho medio de un carácter serif.
const FONT = "Georgia, 'Times New Roman', serif";
const CHAR_EM = 0.5; // ancho medio de un carácter en una serif, en em

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

/** Bloque centrado de varias líneas; devuelve { parts, bottom }. */
export function textBlock(cx, y, text, maxW, { size = 3.5, weight = "normal", lineGap = 1.38, italic = false } = {}) {
  const lines = wrapLines(text, maxW, size);
  const parts = lines.map((l, i) => svgText(cx, y + i * size * lineGap, l, { size, weight, italic }));
  return { parts, bottom: y + (lines.length - 1) * size * lineGap, lines: lines.length };
}
