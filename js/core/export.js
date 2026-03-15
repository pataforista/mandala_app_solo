// js/core/export.js

const RENDER_PX_PER_MM = 6; // ~152 DPI — good quality for fine mandala lines

export function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  saveBlob(blob, filename);
}

/**
 * Convert SVG string to canvas image data URL
 */
function svgStringToImageData(svgString, widthPx, heightPx) {
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
 */
export async function downloadBatchPdf(filename, states, generateFn, widthMm, heightMm, layout = "classic", quotes = []) {
  try {
    // Check if jsPDF is loaded
    if (!window.jspdf || !window.jspdf.jsPDF) {
      throw new Error("jsPDF no está cargado correctamente");
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: widthMm > heightMm ? "landscape" : "portrait",
      unit: "mm",
      format: [widthMm, heightMm]
    });

    const margin = 12;
    const dpi = 150; // Lower DPI for batch PDFs to reduce file size

    /**
     * Create SVG element for a given state
     */
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

      return finalSvg;
    };

    /**
     * Draw a mandala on the PDF at specified position
     */
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
        const spacing = 3;

        // Decorative separator line (optional but elegant)
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.2);
        doc.line(x + w * 0.1, y + h + 4, x + w * 0.9, y + h + 4);

        // Main quote text - larger and elegant
        doc.setFontSize(13);
        doc.setFont("times", "italic");
        doc.setTextColor(40, 40, 40);
        const splitText = doc.splitTextToSize(quote.frase, textWidth);
        const lineHeight = 5.5;
        const textHeight = splitText.length * lineHeight;
        let textY = y + h + 10;

        doc.text(splitText, x + w / 2, textY, { align: "center", lineHeightFactor: 1.3 });
        textY += textHeight + 3;

        // Attribution line - elegant and smaller
        doc.setFontSize(10);
        doc.setFont("times", "normal");
        doc.setTextColor(100, 100, 100);

        // Build attribution: use linaje (tradition) and categoria (theme)
        let attribution = "Centro de Salud Integral Taoísta";
        if (quote.linaje) {
          const linaje = quote.linaje.charAt(0).toUpperCase() + quote.linaje.slice(1);
          const categoria = quote.categoria
            ? " • " + quote.categoria.charAt(0).toUpperCase() + quote.categoria.slice(1)
            : "";
          attribution = linaje + categoria;
        }

        doc.text("— " + attribution + " —", x + w / 2, textY + 2, { align: "center" });

        // Reset text color
        doc.setTextColor(0, 0, 0);
      }
    };

    // Handle different layouts
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
