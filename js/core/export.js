// js/core/export.js

const RENDER_PX_PER_MM = 6; // ~152 DPI — good quality for fine mandala lines

export function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  saveBlob(blob, filename);
}

export async function downloadPng(filename, svgString, widthMm, heightMm, dpi = 300) {
  try {
    const { Resvg, initWasm } = await import("https://cdn.jsdelivr.net/npm/@resvg/resvg-js@2.6.2/wasm.js");

    try {
      await initWasm("https://cdn.jsdelivr.net/npm/@resvg/resvg-js@2.6.2/index_bg.wasm");
    } catch (e) {
      console.warn("WASM initialization failed, but continuing", e);
    }

    const pixelDensity = dpi / 25.4;
    const wPx = Math.ceil(widthMm * pixelDensity);
    const hPx = Math.ceil(heightMm * pixelDensity);

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
    alert("❌ Error: No se pudo descargar PNG.\n\nIntenta de nuevo o usa SVG como alternativa.\n\nDetalles: " + (error.message || String(error)));
    throw error;
  }
}

/**
 * Renders an SVG element to a PNG data URL using Canvas.
 * @param {SVGElement} svgEl - The SVG element (must have width/height/viewBox set)
 * @param {number} widthMm - Width in mm (for sizing the canvas)
 * @param {number} heightMm - Height in mm
 */
async function svgElToDataUrl(svgEl, widthMm, heightMm) {
  const wPx = Math.ceil(widthMm * RENDER_PX_PER_MM);
  const hPx = Math.ceil(heightMm * RENDER_PX_PER_MM);

  // Set pixel dimensions while keeping the viewBox in document units
  const clone = svgEl.cloneNode(true);
  clone.setAttribute("width", wPx);
  clone.setAttribute("height", hPx);
  // Ensure xmlns is set for serialization
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

  const svgString = new XMLSerializer().serializeToString(clone);

  return new Promise((resolve, reject) => {
    const img = new Image();
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = wPx;
      canvas.height = hPx;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, wPx, hPx);
      ctx.drawImage(img, 0, 0, wPx, hPx);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Error al renderizar SVG en canvas"));
    };

    img.src = url;
  });
}

/**
 * PDF Export (Professional / Raster via Canvas)
 * Renders SVG to canvas and embeds as PNG in jsPDF — no svg2pdf required.
 */
export async function downloadPdf(filename, svgEl, widthMm, heightMm) {
  try {
    if (!window.jspdf) {
      throw new Error("jsPDF no está disponible. Verifica tu conexión.");
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: widthMm > heightMm ? "landscape" : "portrait",
      unit: "mm",
      format: [widthMm, heightMm]
    });

    const flatSvg = flattenSvgElement(svgEl.cloneNode(true));
    const dataUrl = await svgElToDataUrl(flatSvg, widthMm, heightMm);
    doc.addImage(dataUrl, "PNG", 0, 0, widthMm, heightMm);
    doc.save(filename);
  } catch (error) {
    console.error("PDF download failed:", error);
    alert("❌ Error: No se pudo descargar PDF.\n\n" + (error.message || "Intenta de nuevo más tarde."));
    throw error;
  }
}

/**
 * Batch PDF Export (Coloring Book) with multi-layout support.
 * Renders each mandala SVG to canvas and embeds as PNG — no svg2pdf required.
 */
export async function downloadBatchPdf(filename, states, generateFn, widthMm, heightMm, layout = "classic", quotes = []) {
  try {
    if (!window.jspdf) {
      throw new Error("jsPDF no está disponible. Verifica tu conexión.");
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: widthMm > heightMm ? "landscape" : "portrait",
      unit: "mm",
      format: [widthMm, heightMm]
    });

    const margin = 12;

    const makeSvgEl = (state, w, h, mirrorX = false) => {
      const docData = {
        page: { wMm: w, hMm: h, marginMm: 5 },
        defs: [],
        body: []
      };
      generateFn(docData, state);

      const finalSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      finalSvg.setAttribute("width", w);
      finalSvg.setAttribute("height", h);
      finalSvg.setAttribute("viewBox", `0 0 ${w} ${h}`);

      const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      docData.defs.forEach(d => defs.innerHTML += d);
      finalSvg.appendChild(defs);

      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      if (mirrorX) {
        g.setAttribute("transform", `scale(-1, 1) translate(-${w}, 0)`);
      }
      docData.body.forEach(b => g.innerHTML += b);
      finalSvg.appendChild(g);

      return flattenSvgElement(finalSvg);
    };

    const drawMandala = async (state, x, y, w, h, quote = null, mirrorX = false) => {
      const svgEl = makeSvgEl(state, w, h, mirrorX);
      const dataUrl = await svgElToDataUrl(svgEl, w, h);
      doc.addImage(dataUrl, "PNG", x, y, w, h);

      if (quote) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "italic");
        const splitText = doc.splitTextToSize(quote.frase, w * 0.8);
        doc.text(splitText, x + w / 2, y + h - 15, { align: "center" });

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(quote.id || "", x + w / 2, y + h - 5, { align: "center" });
      }
    };

    if (layout === "classic" || layout === "inspirational") {
      for (let i = 0; i < states.length; i++) {
        if (i > 0) doc.addPage();
        const quote = layout === "inspirational" ? (quotes[i % quotes.length] || null) : null;
        const size = Math.min(widthMm, heightMm) - margin * 3.5;
        const x = (widthMm - size) / 2;
        const y = (heightMm - size) / 2 - (quote ? 12 : 0);
        await drawMandala(states[i], x, y, size, size, quote);
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
        }
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
        }
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
        }
      }
    }

    doc.save(filename);
  } catch (error) {
    console.error("Batch PDF download failed:", error);
    alert("❌ Error: No se pudo descargar PDF de lote.\n\n" + (error.message || "Intenta de nuevo más tarde."));
    throw error;
  }
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
