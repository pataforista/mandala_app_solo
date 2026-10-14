export const presets = {
  A4:     { wMm: 210, hMm: 297 },
  LETTER: { wMm: 216, hMm: 279 },
  // Tamaños de corte (trim) habituales de Amazon KDP
  KDP_8_5x8_5: { wMm: 215.9, hMm: 215.9 },
  KDP_8_5x11:  { wMm: 215.9, hMm: 279.4 },
  KDP_8x10:    { wMm: 203.2, hMm: 254 },
  KDP_6x9:     { wMm: 152.4, hMm: 228.6 },
};

export function createDoc({ preset = "A4", seed = 0, marginMm = 10 }){
  const p = presets[preset] ?? presets.A4;

  return {
    page: { wMm: p.wMm, hMm: p.hMm, marginMm },
    seed: seed >>> 0,
    meta: { generator: "VectorMandalaCore", version: "0.1" },
    defs: [],
    body: [],
  };
}
