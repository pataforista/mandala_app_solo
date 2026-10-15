// js/core/geometry.js

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function fmt(n) {
  return (Math.round(n * 1000) / 1000).toString();
}

export function polar(r, theta, cx = 0, cy = 0) {
  return { x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) };
}

/**
 * Calculates phase offsets for wobble based on seed
 * @param {number} seed 
 * @returns {Object} { wPhase1, wPhase2 }
 */
export function getWobblePhases(seed) {
  const wPhase1 = ((seed ^ (seed >>> 16)) & 0xFFFF) * 9.587e-5;
  const wPhase2 = (((seed >>> 8) ^ (seed >>> 24)) & 0xFFFF) * 9.587e-5;
  return { wPhase1, wPhase2 };
}

/**
 * Adds wobble noise to a value (angular or radial)
 */
export function wobble(val, intensity = 1.0, organicLevel = 0.0, wPhase1 = 0, wPhase2 = 0) {
  if (organicLevel < 0.05) return val;
  const noise = Math.sin(val * 17.3 + wPhase1) * 0.5 + Math.cos(val * 11.7 + wPhase2) * 0.3;
  return val + noise * organicLevel * intensity * 0.8;
}

/**
 * Polar coordinate translation with optional organic wobble
 */
export function polarW(r, theta, intensity = 0.5, organicLevel = 0.0, wPhase1 = 0, wPhase2 = 0) {
  if (organicLevel < 0.05) {
    return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
  }
  const tw = wobble(theta, intensity, organicLevel, wPhase1, wPhase2);
  const rw = wobble(r, intensity * 0.2, organicLevel, wPhase1, wPhase2);
  return {
    x: rw * Math.cos(tw),
    y: rw * Math.sin(tw)
  };
}

/**
 * Vueltas del círculo guía tras las que un hipo/epitrocoide se cierra.
 * La curva vuelve a su inicio cuando t = 2πk y (R∓r)/r·t es múltiplo de 2π,
 * es decir, k = denominador de R/r en su forma irreducible (R=60, r=25 → 12/5 → 5).
 * Para razones irracionales (o de denominador enorme) devuelve el denominador
 * de la mejor aproximación por fracciones continuas con denominador ≤ maxTurns.
 */
export function trochoidTurns(R, r, maxTurns = 20) {
  const x = Math.abs(R / r);
  if (!Number.isFinite(x) || x === 0) return 1;
  let [h0, h1, k0, k1] = [0, 1, 1, 0];
  let v = x;
  for (let i = 0; i < 32; i++) {
    const a = Math.floor(v);
    const k2 = a * k1 + k0;
    if (k2 > maxTurns) break;
    [h0, h1, k0, k1] = [h1, a * h1 + h0, k1, k2];
    if (Math.abs(h1 / k1 - x) < 1e-9) break;
    v = 1 / (v - a);
  }
  return Math.max(1, k1);
}
