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
