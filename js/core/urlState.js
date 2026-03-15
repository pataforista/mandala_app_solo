// js/core/urlState.js
// URL state: reproducibilidad por seed + TODOS los parámetros compartibles

export function randomSeed32() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return (a[0] >>> 0);
}

// All params that should be persisted in URL
const INT_PARAMS = ["petals", "complexity", "seed"];
const FLOAT_PARAMS = ["organic", "strokeWidth",
  "layer1Intensity", "layer2Intensity", "layer3Intensity", "layer4Intensity",
  "layer5Intensity", "layer6Intensity", "layer7Intensity", "layer8Intensity"];
const STRING_PARAMS = ["preset", "styleMode", "structurePreset"];
const BOOL_PARAMS = ["frames", "pageBorder", "kaleidoscope", "textures"];

export function getStateFromURL(defaults) {
  try {
    const u = new URL(location.href);
    const result = { ...defaults };

    for (const k of STRING_PARAMS) {
      const v = u.searchParams.get(k);
      if (v != null) result[k] = String(v);
    }

    for (const k of INT_PARAMS) {
      const v = u.searchParams.get(k);
      if (v != null) {
        const n = parseInt(v, 10);
        if (k === "seed") result[k] = Number.isFinite(n) ? (n >>> 0) : defaults[k];
        else result[k] = Number.isFinite(n) ? n : defaults[k];
      }
    }

    for (const k of FLOAT_PARAMS) {
      const v = u.searchParams.get(k);
      if (v != null) {
        const n = parseFloat(v);
        if (Number.isFinite(n)) result[k] = n;
      }
    }

    for (const k of BOOL_PARAMS) {
      const v = u.searchParams.get(k);
      if (v != null) result[k] = v === "true" || v === "1";
    }

    return result;
  } catch {
    return { ...defaults };
  }
}

export function setStateToURL(state) {
  try {
    const u = new URL(location.href);

    for (const k of STRING_PARAMS) {
      if (state[k] != null) u.searchParams.set(k, String(state[k]));
    }

    for (const k of INT_PARAMS) {
      if (state[k] != null) {
        u.searchParams.set(k, String(k === "seed" ? (state[k] >>> 0) : (state[k] | 0)));
      }
    }

    for (const k of FLOAT_PARAMS) {
      if (state[k] != null) u.searchParams.set(k, String(Math.round(state[k] * 1000) / 1000));
    }

    for (const k of BOOL_PARAMS) {
      if (state[k] != null) u.searchParams.set(k, state[k] ? "true" : "false");
    }

    history.replaceState({}, "", u.toString());
  } catch {
    // noop
  }
}
