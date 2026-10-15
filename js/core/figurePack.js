// js/core/figurePack.js
// Paquete de figuras preprocesadas (.json) para pasar imágenes ya convertidas de la
// página de preprocesamiento (preprocesar.html) a la app, o guardarlas para otro libro.
// cls (clase por píxel) se guarda con codificación por tramos (RLE): las regiones son
// grandes y uniformes, así que 2 millones de píxeles caben en unos pocos KB.

export const PACK_FORMAT = "mandala-figuras";
export const PACK_VERSION = 1;

/** Uint8Array de valores pequeños (0-3) → base64 de pares [valor, longitud] (longitud ≤ 65535). */
export function encodeCls(cls) {
  const out = [];
  for (let i = 0; i < cls.length;) {
    const v = cls[i];
    let n = 1;
    while (i + n < cls.length && cls[i + n] === v && n < 65535) n++;
    out.push(v, n & 0xFF, n >> 8);
    i += n;
  }
  return bytesToBase64(Uint8Array.from(out));
}

export function decodeCls(b64, length) {
  const bytes = base64ToBytes(b64);
  const cls = new Uint8Array(length);
  let p = 0;
  for (let i = 0; i + 2 < bytes.length; i += 3) {
    const n = bytes[i + 1] | (bytes[i + 2] << 8);
    cls.fill(bytes[i], p, p + n);
    p += n;
  }
  if (p !== length) throw new Error("paquete dañado: tamaño de regiones no coincide");
  return cls;
}

export function bytesToBase64(bytes) {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function base64ToBytes(b64) {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** figures: [{ name, href, cls, w, h }] → objeto JSON serializable */
export function packFigures(figures) {
  return {
    format: PACK_FORMAT, version: PACK_VERSION,
    figures: figures.map(f => ({ name: f.name, use: f.use || "ninguno", source: f.source || "", rightsConfirmed: !!f.rightsConfirmed, srcLong: f.srcLong, w: f.w, h: f.h, href: f.href, stampHref: f.stampHref, cls: encodeCls(f.cls) })),
  };
}

export function unpackFigures(json) {
  const data = typeof json === "string" ? JSON.parse(json) : json;
  if (data?.format !== PACK_FORMAT) throw new Error("no es un paquete de figuras de Mandala Studio");
  return data.figures.map(f => ({ name: f.name, use: f.use || "ninguno", source: f.source || "", rightsConfirmed: !!f.rightsConfirmed, srcLong: f.srcLong, w: f.w, h: f.h, href: f.href, stampHref: f.stampHref, cls: decodeCls(f.cls, f.w * f.h) }));
}
