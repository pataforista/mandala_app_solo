// js/core/urlState.js
// URL state: reproducibilidad por seed + parámetros compartibles
// Soporta: preset, petals, complexity, seed, mode, zPreset

export function randomSeed32() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return (a[0] >>> 0);
}

export function getStateFromURL(defaults) {
  try {
    const u = new URL(location.href);

    const preset = u.searchParams.get("preset") ?? defaults.preset;
    const mode = u.searchParams.get("mode") ?? (defaults.mode ?? "mandala");

    const petals = parseInt(u.searchParams.get("petals") ?? String(defaults.petals), 10);
    const complexity = parseInt(u.searchParams.get("complexity") ?? String(defaults.complexity), 10);
    const seed = parseInt(u.searchParams.get("seed") ?? String(defaults.seed), 10);

    const zPreset = u.searchParams.get("zPreset") ?? (defaults.zPreset ?? "editorial_premium");
    const cellCount = parseInt(u.searchParams.get("cellCount") ?? String(defaults.cellCount), 10);
    const minCellSizeMm = parseInt(u.searchParams.get("minCellSizeMm") ?? String(defaults.minCellSizeMm), 10);

    return {
      preset: String(preset),
      mode: normalizeMode(mode),
      petals: safeInt(petals, defaults.petals),
      complexity: safeInt(complexity, defaults.complexity),
      seed: Number.isFinite(seed) ? (seed >>> 0) : (defaults.seed >>> 0),
      zPreset: String(zPreset),
      cellCount: safeInt(cellCount, defaults.cellCount),
      minCellSizeMm: safeInt(minCellSizeMm, defaults.minCellSizeMm),
    };
  } catch {
    return { ...defaults, mode: defaults.mode ?? "mandala" };
  }
}

export function setStateToURL(state) {
  try {
    const u = new URL(location.href);

    u.searchParams.set("preset", String(state.preset));
    u.searchParams.set("mode", normalizeMode(state.mode));

    u.searchParams.set("petals", String(((state.petals ?? 12) | 0)));
    u.searchParams.set("complexity", String(((state.complexity ?? 110) | 0)));
    u.searchParams.set("seed", String(((state.seed ?? 0) >>> 0)));

    u.searchParams.set("zPreset", String(state.zPreset ?? "editorial_premium"));
    u.searchParams.set("cellCount", String(((state.cellCount ?? 30) | 0)));
    u.searchParams.set("minCellSizeMm", String(((state.minCellSizeMm ?? 14) | 0)));

    history.replaceState({}, "", u.toString());
  } catch {
    // noop
  }
}

function safeInt(v, fallback) {
  if (!Number.isFinite(v)) return fallback;
  return v | 0;
}

function normalizeMode(mode) {
  const m = String(mode || "").toLowerCase();
  if (m === "zentangle") return "zentangle";
  return "mandala";
}
