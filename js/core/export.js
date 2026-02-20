// js/core/export.js
export function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  saveBlob(blob, filename);
}

export async function downloadPng(filename, svgString, widthMm, heightMm, dpi = 300) {
  const { Resvg, initWasm } = await import("https://cdn.jsdelivr.net/npm/@resvg/resvg-js@2.6.2/wasm.js");

  try {
    await initWasm("https://cdn.jsdelivr.net/npm/@resvg/resvg-js@2.6.2/index_bg.wasm");
  } catch (e) {
    // Already initialized or failed
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
}

/**
 * PDF Export (Professional / Vector)
 * Uses jsPDF. For complex SVG, we flatten it and then render.
 */
export async function downloadPdf(filename, svgEl, widthMm, heightMm) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: widthMm > heightMm ? "landscape" : "portrait",
    unit: "mm",
    format: [widthMm, heightMm]
  });

  // Flatten SVG to remove <use> references for simpler PDF rendering
  const flatSvg = flattenSvgElement(svgEl.cloneNode(true));

  // High-fidelity vector export
  // We use a simplified approach for now: render SVG to canvas at high scale, then put to PDF
  // OR use svg2pdf if available. Since we only have jsPDF, we'll use a high-res raster fallback 
  // embedded in a vector container, until we add svg2pdf.

  // EXPERIMENT: Let's try to add svg2pdf.js dynamically
  const svg2pdfUrl = "https://cdnjs.cloudflare.com/ajax/libs/svg2pdf.js/2.2.3/svg2pdf.min.js";
  if (!window.svg2pdf) {
    await new Promise(resolve => {
      const s = document.createElement("script");
      s.src = svg2pdfUrl;
      s.onload = resolve;
      document.head.appendChild(s);
    });
  }

  await doc.svg(flatSvg, {
    x: 0,
    y: 0,
    width: widthMm,
    height: heightMm
  });

  doc.save(filename);
}

/**
 * Batch PDF Export (Coloring Book)
 */
export async function downloadBatchPdf(filename, states, generateFn, widthMm, heightMm) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({
    orientation: widthMm > heightMm ? "landscape" : "portrait",
    unit: "mm",
    format: [widthMm, heightMm]
  });

  const svg2pdfUrl = "https://cdnjs.cloudflare.com/ajax/libs/svg2pdf.js/2.2.3/svg2pdf.min.js";
  if (!window.svg2pdf) {
    await new Promise(resolve => {
      const s = document.createElement("script");
      s.src = svg2pdfUrl;
      s.onload = resolve;
      document.head.appendChild(s);
    });
  }

  for (let i = 0; i < states.length; i++) {
    if (i > 0) doc.addPage([widthMm, heightMm], widthMm > heightMm ? "landscape" : "portrait");

    const state = states[i];
    // Create a temporary SVG container for the generator
    const tempSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const docData = {
      page: { wMm: widthMm, hMm: heightMm, marginMm: 10 },
      defs: [],
      body: []
    };

    generateFn(docData, state);

    // We need a real SVG element to pass to svg2pdf
    // Instead of full render, we can just use the body/defs
    const finalSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    finalSvg.setAttribute("width", widthMm);
    finalSvg.setAttribute("height", heightMm);
    finalSvg.setAttribute("viewBox", `0 0 ${widthMm} ${heightMm}`);

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    docData.defs.forEach(d => defs.innerHTML += d);
    finalSvg.appendChild(defs);

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    docData.body.forEach(b => g.innerHTML += b);
    finalSvg.appendChild(g);

    // Flatten it
    const flatSvg = flattenSvgElement(finalSvg);

    await doc.svg(flatSvg, {
      x: 0,
      y: 0,
      width: widthMm,
      height: heightMm
    });
  }

  doc.save(filename);
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
