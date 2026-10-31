// js/core/bookCurator.js
// Control de calidad automático de un libro completo. Antes, las páginas flojas y las
// gemelas sólo se rehacían si quien armaba el libro abría la revisión y pulsaba el botón:
// un libro creado directamente salía con ~1 de cada 8 páginas por debajo de 60. Ahora la
// misma búsqueda corre sola antes de crear el PDF (y al abrir la revisión).
//
// El módulo no dibuja: recibe la puntuación y la huella de cada página y una función que
// prueba el diseño alternativo n.º k de una página. Así corre igual en la app, en las
// pruebas y en los bancos de medición (scripts/bench-book.mjs).
import { fingerprintSimilarity, TWIN_THRESHOLD } from "./variety.js";

export const WEAK_SCORE = 60;   // por debajo, la página es floja (rojo en la revisión)
export const GOOD_SCORE = 75;   // la búsqueda se detiene al llegar aquí
export const CURATE_TRIES = 8;  // diseños alternativos por página, como máximo
// Pulido: las páginas «naranja» (60–69) prueban unos pocos diseños más, sólo cambiando el
// dibujo (no el encuadre). Cuesta poco: tras las correcciones de los motores son ~3 %.
export const POLISH_SCORE = 70;
export const POLISH_TRIES = 3;

/** ¿La huella fp sería gemela de otra página (distinta de i)? */
export function twinOfAny(fps, fp, i, threshold = TWIN_THRESHOLD) {
  if (!fp) return false;
  return fps.some((g, k) => k !== i && g && fingerprintSimilarity(fp, g) >= threshold);
}

/** Pares gemelos [{ i, j, sim }] entre todas las páginas con huella. */
function twinPairsOf(fps, threshold) {
  const out = [];
  for (let i = 0; i < fps.length; i++) {
    if (!fps[i]) continue;
    for (let j = i + 1; j < fps.length; j++) {
      if (!fps[j]) continue;
      const sim = fingerprintSimilarity(fps[i], fps[j]);
      if (sim >= threshold) out.push({ i, j, sim });
    }
  }
  return out;
}

/**
 * De cada par gemelo se rehace una sola página: la posterior, salvo que no se pueda
 * (página de un grupo); entonces la anterior.
 */
export function twinTargets(twins, fixable) {
  const out = new Set();
  for (const { i, j } of twins) {
    if (out.has(i) || out.has(j)) continue;
    if (fixable(j)) out.add(j); else if (fixable(i)) out.add(i);
  }
  return [...out];
}

/** Índices de las páginas del mismo grupo que i (secuencia que crece, mural); [i] si no tiene. */
function membersOf(pages, i) {
  const g = pages[i]?.group;
  return g == null ? [i] : pages.map((p, k) => (p.group === g ? k : -1)).filter(k => k >= 0);
}

/**
 * Páginas a rehacer: flojas que se puedan cambiar y una de cada par gemelo. Una página
 * floja de un grupo (group ≠ null, groupFixable) se rehace con todo su grupo: el objetivo
 * es la primera página del grupo.
 */
export function curationTargets(pages, { weak = WEAK_SCORE, threshold = TWIN_THRESHOLD } = {}) {
  const fixable = (i) => !!pages[i]?.fixable;
  const out = new Set();
  pages.forEach((p, i) => {
    if (p.score == null || p.score >= weak) return;
    if (p.fixable) out.add(i);
    else if (p.group != null && p.groupFixable) out.add(membersOf(pages, i)[0]);
  });
  const twins = twinPairsOf(pages.map(p => p.fp || null), threshold);
  for (const i of twinTargets(twins, fixable)) out.add(i);
  return [...out].sort((a, b) => a - b);
}

/**
 * Rehace las páginas flojas y gemelas.
 *  pages:   [{ score: número|null, fp: huella|null, fixable: bool }]  (se actualiza en el sitio)
 *  attempt: (i, k) => { score, fp, choice } | Promise<…>  — diseño alternativo k (1…tries) de la página i.
 *           Para un grupo, i es su primera página y attempt devuelve { members: [{ i, score, fp }], choice }:
 *           el valor del grupo es la peor puntuación de sus páginas.
 * Valor de un diseño: su puntuación (70 si no se mide), y descartado si es gemelo de otra
 * página. Se queda con el mejor; si ninguno mejora, la página se deja como estaba.
 * Las páginas «naranja» (weak ≤ puntuación < polish) reciben además polishTries intentos.
 * Devuelve { changes: Map(i → choice), targets, before, after } (before/after: resumen).
 */
export async function curateBook(pages, attempt, opts = {}) {
  const { tries = CURATE_TRIES, weak = WEAK_SCORE, good = GOOD_SCORE, threshold = TWIN_THRESHOLD, onStep = null,
    polish = POLISH_SCORE, polishTries = POLISH_TRIES } = opts;
  const before = summarize(pages, { weak, threshold });
  const urgent = new Set(curationTargets(pages, { weak, threshold }));
  // Pulido: páginas sueltas (no de un grupo) entre «floja» y «buena»
  const polishing = polish > weak && polishTries > 0
    ? pages.map((p, i) => (p.fixable && p.score != null && p.score >= weak && p.score < polish && !urgent.has(i) ? i : -1)).filter(i => i >= 0)
    : [];
  const targets = [...urgent, ...polishing].sort((a, b) => a - b);
  const changes = new Map();
  const fps = () => pages.map(p => p.fp || null);
  const value = (score, fp, i) => (twinOfAny(fps(), fp, i, threshold) ? -1000 : 0) + (score ?? 70);
  // Un diseño (de una página o de un grupo entero): [{ i, score, fp }]
  const worst = (ms) => Math.min(...ms.map(m => value(m.score, m.fp, m.i)));
  for (let n = 0; n < targets.length; n++) {
    const i = targets[n];
    const group = pages[i].group != null && !pages[i].fixable;
    const current = membersOf(pages, i).map(k => ({ i: k, score: pages[k].score, fp: pages[k].fp }));
    let best = { v: worst(current), k: 0 };
    const maxK = urgent.has(i) ? tries : polishTries;
    for (let k = 1; k <= maxK && best.v < good; k++) {
      const r = await attempt(i, k);
      if (!r) continue;
      const ms = group ? r.members : [{ i, score: r.score, fp: r.fp }];
      if (!ms?.length) continue;
      const v = worst(ms);
      if (v > best.v) best = { v, k, r, ms };
    }
    if (best.r) {
      for (const m of best.ms) pages[m.i] = { ...pages[m.i], score: m.score, fp: m.fp };
      changes.set(i, best.r.choice);
    }
    if (onStep) await onStep(n + 1, targets.length, i);
  }
  return { changes, targets, before, after: summarize(pages, { weak, threshold }) };
}

/** Resumen de calidad: media, mínimo, páginas flojas y pares gemelos. */
export function summarize(pages, { weak = WEAK_SCORE, threshold = TWIN_THRESHOLD } = {}) {
  const vals = pages.map(p => p.score).filter(v => v != null);
  return {
    measured: vals.length,
    mean: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
    min: vals.length ? Math.min(...vals) : null,
    weak: pages.map((p, i) => (p.score != null && p.score < weak ? i : -1)).filter(i => i >= 0),
    twins: twinPairsOf(pages.map(p => p.fp || null), threshold),
  };
}

// Encuadres de reemplazo, del preferido al menos limpio (medias de scripts/bench-book.mjs:
// centrado ≈ 73, fondo ≈ 73, gigante ≈ 84, esquinas ≈ 65, constelación ≈ 61). El gigante
// puntúa más, pero es un acercamiento recortado: si fuera el primero, un libro llegaba a
// tener el doble de gigantes de lo planeado. Centrado y fondo son la base de los libros
// mejor vendidos; el gigante queda como tercera opción.
export const SAFE_COMPOSITIONS = ["centro", "fondo", "gigante", "esquinas", "constelacion", "medio"];

/**
 * Plan del intento k para una página: los primeros intentos sólo cambian el diseño (otra
 * semilla, silueta y estructura); los últimos además cambian el encuadre por uno más
 * limpio de los permitidos. Devuelve { bump, composition? }.
 */
export function attemptChoice(k, { tries = CURATE_TRIES, current = null, allowed = [], startBump = 0, canReframe = true } = {}) {
  const choice = { bump: startBump + k };
  const half = Math.ceil(tries / 2);
  if (!canReframe || k <= half) return choice;
  const better = SAFE_COMPOSITIONS.filter(c => allowed.includes(c) && c !== current);
  // Sólo encuadres más limpios que el actual
  const rank = (c) => { const r = SAFE_COMPOSITIONS.indexOf(c); return r < 0 ? SAFE_COMPOSITIONS.length : r; };
  const cleaner = better.filter(c => rank(c) < rank(current));
  if (!cleaner.length) return choice;
  return { ...choice, composition: cleaner[(k - half - 1) % cleaner.length] };
}
