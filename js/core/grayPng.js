// js/core/grayPng.js
// PNG en escala de grises de 8 bits, sin canal alfa.
// canvas.toDataURL("image/png") siempre produce RGBA, y jsPDF convierte ese alfa en
// una máscara de transparencia (SMask) en cada página. KDP pide PDFs aplanados, sin
// transparencias; además, para un interior en blanco y negro el gris pesa ~4× menos.

/** RGBA (fondo ya blanco) → luminancia de 8 bits. */
export function rgbaToGray(rgba, width, height) {
  const out = new Uint8Array(width * height);
  for (let i = 0, j = 0; j < out.length; i += 4, j++) {
    // Mezcla con blanco por si algún píxel conserva transparencia
    const a = rgba[i + 3] / 255;
    const y = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
    out[j] = Math.round(y * a + 255 * (1 - a));
  }
  return out;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/** Deflate con cabecera zlib (lo que exige IDAT). Navegador: CompressionStream. */
export async function zlibDeflate(bytes) {
  if (typeof CompressionStream === "function") {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  const { deflateSync } = await import("node:zlib");
  return new Uint8Array(deflateSync(bytes));
}

/**
 * Codifica un PNG gris. Filtro "Up" por fila: en dibujo de líneas casi todas las filas
 * se parecen a la anterior y comprime mucho mejor que sin filtro.
 */
export async function encodeGrayPng(gray, width, height, deflate = zlibDeflate) {
  const raw = new Uint8Array((width + 1) * height);
  for (let y = 0; y < height; y++) {
    const o = y * (width + 1), row = y * width;
    raw[o] = y === 0 ? 0 : 2;
    if (y === 0) raw.set(gray.subarray(0, width), o + 1);
    else for (let x = 0; x < width; x++) raw[o + 1 + x] = (gray[row + x] - gray[row - width + x]) & 0xFF;
  }
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width); dv.setUint32(4, height);
  ihdr[8] = 8;  // bits por muestra
  ihdr[9] = 0;  // tipo de color: gris
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", await deflate(raw)),
    chunk("IEND", new Uint8Array(0)),
  ];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

export function bytesToDataUrl(bytes, mime = "image/png") {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return `data:${mime};base64,${btoa(bin)}`;
}
