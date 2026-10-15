// js/core/export.js
import { createDoc } from "./svgDoc.js";
import { renderDocToSvgString } from "./svgRender.js";
import { bookLayout } from "./kdp.js";
import { encodeGrayPng, rgbaToGray } from "./grayPng.js";

const RENDER_PX_PER_MM = 300 / 25.4; // 300 DPI: estándar de imprenta para libros

export function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  saveBlob(blob, filename);
}

/**
 * Convert SVG string to canvas image data URL
 */
export function svgStringToImageData(svgString, widthPx, heightPx) {
  return new Promise((resolve, reject) => {
    try {
      const img = new Image();
      const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = widthPx;
          canvas.height = heightPx;
          const ctx = canvas.getContext("2d");

          // White background
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, widthPx, heightPx);

          // Draw image
          ctx.drawImage(img, 0, 0, widthPx, heightPx);
          URL.revokeObjectURL(url);

          resolve(canvas.toDataURL("image/png"));
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("No se pudo cargar la imagen SVG"));
      };

      img.src = url;
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * Download PNG from SVG
 */
export async function downloadPng(filename, svgString, widthMm, heightMm, dpi = 300) {
  try {
    const pixelDensity = dpi / 25.4;
    const wPx = Math.ceil(widthMm * pixelDensity);
    const hPx = Math.ceil(heightMm * pixelDensity);

    const { Resvg, initWasm } = await import("https://cdn.jsdelivr.net/npm/@resvg/resvg-js@2.6.2/wasm.js");

    try {
      await initWasm("https://cdn.jsdelivr.net/npm/@resvg/resvg-js@2.6.2/index_bg.wasm");
    } catch (e) {
      console.warn("WASM initialization failed, but continuing", e);
    }

    const resvg = new Resvg(svgString, {
      fitTo: {
        mode: 'width',
        value: wPx,
      },
      background: '#ffffff'
    });

    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();
    const blob = new Blob([pngBuffer], { type: "image/png" });
    saveBlob(blob, filename);
  } catch (error) {
    console.error("PNG download failed:", error);
    alert("❌ Error: No se pudo descargar PNG.\n\nIntenta de nuevo o usa SVG como alternativa.");
    throw error;
  }
}

/**
 * Simple PDF export - convert SVG to image and embed in PDF
 */
export async function downloadPdf(filename, svgString, widthMm, heightMm) {
  try {
    // Check if jsPDF is loaded
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error("jsPDF no está cargado correctamente");
    }

    const wPx = Math.ceil(widthMm * RENDER_PX_PER_MM);
    const hPx = Math.ceil(heightMm * RENDER_PX_PER_MM);

    // Convert SVG to image data
    const imageData = await svgStringToImageData(svgString, wPx, hPx);

    // Create PDF
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: widthMm > heightMm ? "landscape" : "portrait",
      unit: "mm",
      format: [widthMm, heightMm]
    });

    doc.addImage(imageData, "PNG", 0, 0, widthMm, heightMm);
    doc.save(filename);
  } catch (error) {
    console.error("PDF download failed:", error);
    throw error;
  }
}

/**
 * Batch PDF Export (multiple mandalas per PDF)
 * options: { dpi, coverPage: { title, coverState } | null, pageNumbers, onProgress }
 */
export async function downloadBatchPdf(filename, states, generateFn, widthMm, heightMm, layout = "classic", quotes = [], options = {}) {
  try {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error("jsPDF no está cargado correctamente");
    }

    const { onProgress = null, coverPage = null, pageNumbers = false } = options;
    const dpi = options.dpi ?? 300; // 150 DPI deja bordes dentados en impresión

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: widthMm > heightMm ? "landscape" : "portrait",
      unit: "mm",
      format: [widthMm, heightMm]
    });

    const margin = 12;

    const makeSvgEl = (state, w, h, mirrorX = false) => {
      const docData = { page: { wMm: w, hMm: h, marginMm: 5 }, defs: [], body: [] };
      generateFn(docData, state);

      const finalSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      finalSvg.setAttribute("width", w);
      finalSvg.setAttribute("height", h);
      finalSvg.setAttribute("viewBox", `0 0 ${w} ${h}`);

      const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      docData.defs.forEach(d => defs.innerHTML += d);
      finalSvg.appendChild(defs);

      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      if (mirrorX) g.setAttribute("transform", `scale(-1, 1) translate(-${w}, 0)`);
      docData.body.forEach(b => g.innerHTML += b);
      finalSvg.appendChild(g);

      return finalSvg;
    };

    // Load custom font when needed for text rendering
    if (layout === "inspirational" || coverPage) {
      try {
        const response = await fetch("assets/sekaiwo/SekaiwoRegular.ttf");
        const fontArrayBuffer = await response.arrayBuffer();
        const fontBase64 = arrayBufferToBase64(fontArrayBuffer);
        doc.addFileToVFS("SekaiwoRegular.ttf", fontBase64);
        doc.addFont("SekaiwoRegular.ttf", "Sekaiwo", "normal");
      } catch (e) {
        console.warn("Could not load custom font, falling back to Times", e);
      }
    }

    const drawMandala = async (state, x, y, w, h, quote = null, mirrorX = false) => {
      const svgEl = makeSvgEl(state, w, h, mirrorX);
      const svgString = new XMLSerializer().serializeToString(svgEl);

      const pixelDensity = dpi / 25.4;
      const wPx = Math.ceil(w * pixelDensity);
      const hPx = Math.ceil(h * pixelDensity);

      const imageData = await svgStringToImageData(svgString, wPx, hPx);
      doc.addImage(imageData, "PNG", x, y, w, h);

      if (quote) {
        const textWidth = w * 0.8;
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.15);
        doc.line(x + w * 0.15, y + h + 5, x + w * 0.85, y + h + 5);

        const hasSekaiwo = doc.getFontList()["Sekaiwo"];
        doc.setFont(hasSekaiwo ? "Sekaiwo" : "times", hasSekaiwo ? "normal" : "italic");
        doc.setFontSize(hasSekaiwo ? 15 : 13);
        doc.setTextColor(30, 30, 30);

        const splitText = doc.splitTextToSize(quote.frase, textWidth);
        const lineHeight = hasSekaiwo ? 7 : 5.5;
        const textHeight = splitText.length * lineHeight;
        let textY = y + h + 13;

        doc.text(splitText, x + w / 2, textY, { align: "center", lineHeightFactor: 1.2 });
        textY += textHeight + 4;

        doc.setFontSize(10);
        doc.setFont("times", "normal");
        doc.setTextColor(110, 110, 110);

        let attribution = quote.autor || "Centro de Salud Integral Taoísta";
        if (!quote.autor && quote.linaje) {
          const linaje = quote.linaje.charAt(0).toUpperCase() + quote.linaje.slice(1);
          const categoria = quote.categoria
            ? " • " + quote.categoria.charAt(0).toUpperCase() + quote.categoria.slice(1)
            : "";
          attribution = linaje + categoria;
        }

        doc.text("— " + attribution + " —", x + w / 2, textY + 2, { align: "center" });
        doc.setTextColor(0, 0, 0);
      }
    };

    const yieldUI = () => new Promise(r => setTimeout(r, 0));

    const addPageNum = (num) => {
      if (!pageNumbers) return;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(160, 160, 160);
      doc.text(String(num), widthMm / 2, heightMm - 4, { align: "center" });
      doc.setTextColor(0, 0, 0);
    };

    let rendered = 0;
    let contentPage = 0;

    const report = async (label) => {
      if (!onProgress) return;
      onProgress(rendered, states.length, label);
      await yieldUI();
    };

    // === Cover page ===
    if (coverPage) {
      const { title = "Mandalas para Colorear", coverState } = coverPage;
      const cs = coverState || states[0];
      const ms = Math.min(widthMm, heightMm) * 0.68;
      const mx = (widthMm - ms) / 2;
      const my = margin + 10;

      await drawMandala(cs, mx, my, ms, ms);

      const hasSekaiwo = doc.getFontList()["Sekaiwo"];
      doc.setFont(hasSekaiwo ? "Sekaiwo" : "times", "normal");
      doc.setFontSize(hasSekaiwo ? 22 : 20);
      doc.setTextColor(30, 30, 30);

      const ty = my + ms + 14;
      doc.setDrawColor(170, 170, 170);
      doc.setLineWidth(0.25);
      doc.line(widthMm * 0.2, ty - 7, widthMm * 0.8, ty - 7);
      doc.text(title, widthMm / 2, ty, { align: "center" });
      doc.setTextColor(0, 0, 0);

      doc.addPage();
      if (onProgress) { onProgress(0, states.length, "Portada lista..."); await yieldUI(); }
    }

    // === Content pages ===
    if (layout === "classic" || layout === "inspirational") {
      for (let i = 0; i < states.length; i++) {
        if (i > 0) doc.addPage();
        const quote = layout === "inspirational" ? (quotes[i % quotes.length] || null) : null;
        const size = Math.min(widthMm, heightMm) - margin * 3.5;
        const x = (widthMm - size) / 2;
        const y = (heightMm - size) / 2 - (quote ? 12 : 0);
        await drawMandala(states[i], x, y, size, size, quote);
        rendered++;
        contentPage++;
        addPageNum(contentPage);
        await report(`Página ${contentPage}`);
      }
    } else if (layout === "duo" || layout === "mirror") {
      const itemsPerPage = 2;
      for (let i = 0; i < states.length; i += itemsPerPage) {
        if (i > 0) doc.addPage();
        const size = (heightMm - margin * 3) / 2.2;
        for (let j = 0; j < itemsPerPage && (i + j) < states.length; j++) {
          const x = (widthMm - size) / 2;
          const y = margin + j * (size + margin * 2);
          const mirrorX = layout === "mirror" && j === 1;
          await drawMandala(states[i + j], x, y, size, size, null, mirrorX);
          rendered++;
          await report(`Mandala ${rendered} de ${states.length}`);
        }
        contentPage++;
        addPageNum(contentPage);
      }
    } else if (layout === "trio") {
      const itemsPerPage = 3;
      for (let i = 0; i < states.length; i += itemsPerPage) {
        if (i > 0) doc.addPage();
        const size = (heightMm - margin * 4) / 3.2;
        for (let j = 0; j < itemsPerPage && (i + j) < states.length; j++) {
          const x = (widthMm - size) / 2;
          const y = margin + j * (size + margin);
          await drawMandala(states[i + j], x, y, size, size);
          rendered++;
          await report(`Mandala ${rendered} de ${states.length}`);
        }
        contentPage++;
        addPageNum(contentPage);
      }
    } else if (layout === "collage") {
      const itemsPerPage = 4;
      for (let i = 0; i < states.length; i += itemsPerPage) {
        if (i > 0) doc.addPage();
        const size = (Math.min(widthMm, heightMm) - margin * 3) / 2;
        const startX = (widthMm - size * 2 - margin) / 2;
        const startY = (heightMm - size * 2 - margin) / 2;
        for (let j = 0; j < itemsPerPage && (i + j) < states.length; j++) {
          const col = j % 2;
          const row = Math.floor(j / 2);
          const x = startX + col * (size + margin);
          const y = startY + row * (size + margin);
          await drawMandala(states[i + j], x, y, size, size);
          rendered++;
          await report(`Mandala ${rendered} de ${states.length}`);
        }
        contentPage++;
        addPageNum(contentPage);
      }
    }

    doc.save(filename);
  } catch (error) {
    console.error("Batch PDF download failed:", error);
    throw error;
  }
}

/**
 * Páginas totales de un libro (incluye el relleno a número par que exige la imprenta).
 */
export function bookPageCount({ mandalas, blankBack = true, titlePage = true, copyrightPage = false, colorTest = false }) {
  return bookLayout({ mandalas: mandalas + (colorTest ? 1 : 0), blankBack, titlePage, copyrightPage }).length;
}

/** Rasteriza un SVG en un canvas con fondo blanco. */
function svgToCanvas(svgString, widthPx, heightPx) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svgString], { type: "image/svg+xml;charset=utf-8" }));
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = widthPx; canvas.height = heightPx;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, widthPx, heightPx);
      ctx.drawImage(img, 0, 0, widthPx, heightPx);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo rasterizar la página")); };
    img.src = url;
  });
}

function blankCanvas(widthPx, heightPx) {
  const canvas = document.createElement("canvas");
  canvas.width = widthPx; canvas.height = heightPx;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, widthPx, heightPx);
  return canvas;
}

/** Canvas → PNG gris de 8 bits sin alfa (sin transparencias en el PDF). */
async function canvasToGrayPng(canvas) {
  const { data, width, height } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
  return encodeGrayPng(rgbaToGray(data, width, height), width, height);
}

// Texto dibujado como imagen: KDP exige fuentes incrustadas y las fuentes estándar
// de jsPDF (Helvetica, Times) no se incrustan. Rasterizado, no hay fuente que incrustar.
function drawTextBlock(ctx, text, { x, y, maxW, sizePx, weight = "normal", font = "Georgia, 'Times New Roman', serif", color = "#000", lineGap = 1.25 }) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${Math.round(sizePx)}px ${font}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const lines = [];
  for (const para of String(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/)) {
      const t = line ? `${line} ${word}` : word;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = word; } else line = t;
    }
    lines.push(line);
  }
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * sizePx * lineGap));
  return y + lines.length * sizePx * lineGap;
}

/**
 * Libro completo para imprimir en Amazon KDP (tapa blanda, interior B/N, sin sangrado).
 * Orden: [título][copyright|blanco][prueba de color][blanco][m1][blanco][m2]…, siempre par.
 * opts: { preset, genOpts(i) -> opciones del generador, title, subtitle, author,
 *         titlePage, copyrightPage, copyrightText, colorTest, blankBack, pageNumbers,
 *         dpi, marginMm, onProgress }
 */
export async function downloadBookPdf(filename, generateFn, count, opts) {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    throw new Error("jsPDF no está cargado correctamente");
  }
  const {
    preset, genOpts, title = "Mandalas para Colorear", subtitle = "", author = "",
    titlePage = true, copyrightPage = false, copyrightText = "", colorTest = false,
    blankBack = true, pageNumbers = false, dpi = 300, onProgress = null, marginMm = 10,
  } = opts;

  const { wMm, hMm } = createDoc({ preset }).page;
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: wMm > hMm ? "landscape" : "portrait",
    unit: "mm",
    format: [wMm, hMm],
    compress: true,
    // Sin esto jsPDF declara las 14 fuentes estándar (no incrustadas) aunque no se usen,
    // y el revisor de KDP las marca como "fuentes no incrustadas".
    putOnlyUsedFonts: true,
  });
  pdf.setProperties({ title, author, creator: "Mandala Studio" });

  const pxPerMm = dpi / 25.4;
  const wPx = Math.ceil(wMm * pxPerMm);
  const hPx = Math.ceil(hMm * pxPerMm);
  // La prueba de color ocupa el lugar de un mandala más (con su reverso)
  const layout = bookLayout({ mandalas: count + (colorTest ? 1 : 0), blankBack, titlePage, copyrightPage });
  const total = layout.length;
  const yieldUI = () => new Promise(r => setTimeout(r, 0));

  const numberCanvas = (canvas, n) => {
    if (!pageNumbers) return;
    const ctx = canvas.getContext("2d");
    // Dentro del margen inferior, que KDP considera zona segura (≥ 6.4 mm del corte)
    const y = hPx - Math.max(6.4, marginMm * 0.55) * pxPerMm;
    drawTextBlock(ctx, String(n), { x: wPx / 2, y, maxW: wPx, sizePx: 3 * pxPerMm, color: "#555" });
  };

  for (let p = 0; p < layout.length; p++) {
    const page = layout[p];
    const pageNo = p + 1;
    let canvas;
    let label;
    if (page.kind === "title") {
      canvas = blankCanvas(wPx, hPx);
      const ctx = canvas.getContext("2d");
      const maxW = (wMm - 2 * marginMm - 10) * pxPerMm;
      let y = drawTextBlock(ctx, title, { x: wPx / 2, y: hPx * 0.4, maxW, sizePx: Math.min(wMm, hMm) / 11 * pxPerMm, weight: "bold" });
      if (subtitle) y = drawTextBlock(ctx, subtitle, { x: wPx / 2, y: y + 4 * pxPerMm, maxW, sizePx: 6 * pxPerMm });
      if (author) drawTextBlock(ctx, author, { x: wPx / 2, y: hPx * 0.8, maxW, sizePx: 5 * pxPerMm });
      label = "Hoja de título";
    } else if (page.kind === "copyright") {
      canvas = blankCanvas(wPx, hPx);
      const ctx = canvas.getContext("2d");
      const year = new Date().getFullYear();
      const text = copyrightText ||
        `© ${year} ${author || title}. Todos los derechos reservados.\n` +
        "Ninguna parte de este libro puede reproducirse ni distribuirse sin permiso del autor, " +
        "salvo para colorear las páginas en uso personal.";
      drawTextBlock(ctx, text, { x: wPx / 2, y: hPx * 0.7, maxW: (wMm - 2 * marginMm - 20) * pxPerMm, sizePx: 3.4 * pxPerMm, lineGap: 1.45 });
      label = "Página de derechos";
    } else if (page.kind === "mandala" && colorTest && page.index === 0) {
      // Página para probar colores: 24 círculos en rejilla
      canvas = blankCanvas(wPx, hPx);
      const ctx = canvas.getContext("2d");
      const usableW = wMm - 2 * marginMm - 10, cols = 4, rows = 6;
      const cell = Math.min(usableW / cols, (hMm - 2 * marginMm - 40) / rows);
      const x0 = (wMm - cell * cols) / 2, y0 = marginMm + 30;
      drawTextBlock(ctx, "Prueba tus colores", { x: wPx / 2, y: (marginMm + 18) * pxPerMm, maxW: usableW * pxPerMm, sizePx: 7 * pxPerMm, weight: "bold" });
      ctx.strokeStyle = "#000"; ctx.lineWidth = 0.5 * pxPerMm;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        ctx.beginPath();
        ctx.arc((x0 + (c + 0.5) * cell) * pxPerMm, (y0 + (r + 0.5) * cell) * pxPerMm, cell * 0.38 * pxPerMm, 0, Math.PI * 2);
        ctx.stroke();
      }
      label = "Prueba de color";
    } else if (page.kind === "mandala") {
      const i = page.index - (colorTest ? 1 : 0);
      const doc = createDoc({ preset, seed: i, marginMm });
      const o = genOpts(i);
      doc.seed = o.seed >>> 0;
      generateFn(doc, o);
      canvas = await svgToCanvas(renderDocToSvgString(doc), wPx, hPx);
      numberCanvas(canvas, pageNo);
      label = `Mandala ${i + 1} de ${count}`;
    } else {
      label = "Página en blanco";
    }

    if (p > 0) pdf.addPage([wMm, hMm]);
    if (canvas) pdf.addImage(await canvasToGrayPng(canvas), "PNG", 0, 0, wMm, hMm, undefined, "NONE");
    if (onProgress) { onProgress(pageNo, total, label); await yieldUI(); }
  }

  pdf.save(filename);
  return { pages: total, wMm, hMm };
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export function flattenSvgElement(svgEl) {
  const idMap = new Map();
  svgEl.querySelectorAll("[id]").forEach((el) => idMap.set(el.getAttribute("id"), el));

  const uses = Array.from(svgEl.querySelectorAll("use"));
  for (const use of uses) {
    const href = use.getAttribute("href") || use.getAttribute("xlink:href");
    if (!href || !href.startsWith("#")) continue;

    const ref = idMap.get(href.slice(1));
    if (!ref) continue;

    const clone = ref.cloneNode(true);

    // Evita IDs duplicados (MUY importante para impresión/conversión)
    stripIdsDeep(clone);

    // Aplica transform del <use>
    const tUse = use.getAttribute("transform");
    const tClone = clone.getAttribute("transform");
    if (tUse && tClone) clone.setAttribute("transform", `${tUse} ${tClone}`);
    else if (tUse) clone.setAttribute("transform", tUse);

    use.replaceWith(clone);
  }

  return svgEl;
}

function stripIdsDeep(node) {
  if (node.nodeType !== 1) return;
  if (node.hasAttribute("id")) node.removeAttribute("id");
  const all = node.querySelectorAll?.("[id]");
  if (all && all.length) all.forEach(el => el.removeAttribute("id"));
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}
