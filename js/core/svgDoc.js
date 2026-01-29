export const presets = {
  A4:     { wMm: 210, hMm: 297 },
  LETTER: { wMm: 216, hMm: 279 }
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
