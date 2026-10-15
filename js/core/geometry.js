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
 * Los lóbulos de la curva son R/gcd(R, r) (el numerador de esa fracción).
 */
export function trochoidTurns(R, r, maxTurns = 64) {
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

/**
 * Radio del círculo móvil para que el trocoide tenga L lóbulos, con L múltiplo
 * de `petals` y cercano al número de lóbulos que darían R y rHint (por defecto 12).
 * R/r = L/q irreducible ⇒ L lóbulos y q vueltas; q es el coprimo de L más próximo
 * a L·rHint/R, así la figura conserva su aspecto. Con 12 pétalos y 60:25 no cambia.
 */
export function harmonicTrochoid(petals, R, rHint) {
  const n = Math.max(1, Math.round(petals));
  const ratio = Math.abs(rHint / R);
  const baseLobes = Math.round(Math.abs(R) / gcd(Math.round(Math.abs(R)), Math.round(Math.abs(rHint)))) || 12;
  const lobes = n * Math.max(1, Math.round(baseLobes / n));
  const target = lobes * ratio;
  let q = 1, best = Infinity;
  for (let c = 1; c < lobes; c++) {
    if (gcd(c, lobes) !== 1) continue;
    const dist = Math.abs(c - target);
    if (dist < best) { best = dist; q = c; }
  }
  return { r: R * q / lobes, lobes, turns: q };
}

function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}
