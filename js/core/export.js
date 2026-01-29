// js/core/export.js
export function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  saveBlob(blob, filename);
}

export function downloadPng(filename, svgString, widthMm, heightMm, dpi = 300) {
  const pixelDensity = dpi / 25.4;
  const wPx = Math.ceil(widthMm * pixelDensity);
  const hPx = Math.ceil(heightMm * pixelDensity);

  const img = new Image();
  // Blob URL to avoid encoding issues
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = wPx;
    canvas.height = hPx;
    const ctx = canvas.getContext("2d");
    
    // White background for print
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, wPx, hPx);
    
    ctx.drawImage(img, 0, 0, wPx, hPx);
    
    canvas.toBlob((pngBlob) => {
      saveBlob(pngBlob, filename);
      URL.revokeObjectURL(url);
    }, "image/png");
  };
  
  img.src = url;
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
  svg.querySelectorAll("[id]").forEach((el) => idMap.set(el.getAttribute("id"), el));

  const uses = Array.from(svg.querySelectorAll("use"));
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

  return svg;
}

function stripIdsDeep(node) {
  if (node.nodeType !== 1) return;
  if (node.hasAttribute("id")) node.removeAttribute("id");
  const all = node.querySelectorAll?.("[id]");
  if (all && all.length) all.forEach(el => el.removeAttribute("id"));
}
