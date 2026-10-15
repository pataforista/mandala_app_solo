// js/core/bookPlan.js
// Planificador de libro: decide estilo, composición, pétalos, marco e imagen de cada
// página ANTES de dibujar. Sortear cada página por separado produce rachas (tres
// "geométricos" seguidos, el mismo encuadre cuatro veces); aquí cada dimensión sale de
// una "bolsa barajada": se agotan todas las opciones antes de repetir y nunca se repite
// la misma opción en páginas consecutivas. Mismo semilla ⇒ mismo libro.
import { mulberry32 } from "./prng.js";

export const BOOK_STYLES = ["sashiko", "floral", "geometric", "islamico", "azteca", "yantra", "celtico"];
export const BOOK_COMPOSITIONS = ["centro", "fondo", "constelacion", "esquinas", "gigante", "medio"];
export const BOOK_FRAMES = ["redondeado", "doble", "feston", "ninguno"];
export const BOOK_PETALS = [8, 10, 12, 14, 16, 18, 20, 24];

function shuffled(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Bolsa barajada: reparte todas las opciones antes de repetir; evita repetir la anterior. */
export function shuffleBag(rng, options, weights = null) {
  // Los pesos se traducen en copias: peso 2 ⇒ aparece el doble de veces por ronda
  const pool = weights ? options.flatMap((o, i) => Array(Math.max(0, Math.round(weights[i]))).fill(o)) : options.slice();
  let bag = [];
  let last;
  return () => {
    if (!bag.length) {
      bag = shuffled(rng, pool);
      // Evita la repetición en la costura entre rondas
      if (bag.length > 1 && bag[bag.length - 1] === last) [bag[0], bag[bag.length - 1]] = [bag[bag.length - 1], bag[0]];
    }
    let v = bag.pop();
    if (v === last && bag.length) {
      const k = bag.findIndex(x => x !== last);
      if (k >= 0) { const t = bag[k]; bag[k] = v; v = t; }
    }
    last = v;
    return v;
  };
}

/**
 * opts: {
 *   count, seed,
 *   styles?, compositions?, frames?   (listas permitidas; por defecto todas)
 *   compositionWeights?               (mismo orden que compositions)
 *   difficulty: "mixta" | "progresiva" | "fija",
 *   baseComplexity,
 *   images?: number (nº de imágenes del usuario que rotan), imageEvery?: n (1 = todas las páginas)
 * }
 * Devuelve [{ seed, styleMode, composition, frameStyle, petals, complexity, centerArt }]
 */
export function planBook(opts) {
  const {
    count, seed = 1,
    styles = BOOK_STYLES, compositions = BOOK_COMPOSITIONS, frames = BOOK_FRAMES,
    compositionWeights = null, difficulty = "mixta", baseComplexity = 130,
    images = 0, imageEvery = 1,
  } = opts;
  const rng = mulberry32(((seed >>> 0) ^ 0xB00C5EED) >>> 0);
  const nextStyle = shuffleBag(rng, styles);
  const nextComp = shuffleBag(rng, compositions, compositionWeights);
  const nextFrame = shuffleBag(rng, frames);
  const nextPetals = shuffleBag(rng, BOOK_PETALS);

  const pages = [];
  for (let i = 0; i < count; i++) {
    let complexity;
    if (difficulty === "progresiva") {
      // De relajado a desafiante: el lector siente que avanza
      const t = count > 1 ? i / (count - 1) : 0;
      complexity = Math.round(40 + t * (Math.max(baseComplexity, 200) - 40));
    } else if (difficulty === "fija") {
      complexity = baseComplexity;
    } else {
      complexity = Math.max(20, Math.round(baseComplexity * (0.7 + rng() * 0.6)));
    }
    let centerArt = null;
    if (images && i % Math.max(1, imageEvery) === 0) {
      // Las imágenes se reparten en orden: cada una aparece antes de repetir ninguna
      centerArt = { type: "image", imageIndex: pages.filter(p => p.centerArt).length % images };
    }
    let composition = nextComp();
    // Un medio mandala cortaría al personaje por la mitad
    if (centerArt && composition === "medio") composition = "fondo";
    pages.push({
      seed: ((seed >>> 0) + i) >>> 0,
      styleMode: nextStyle(),
      composition,
      frameStyle: nextFrame(),
      petals: nextPetals(),
      complexity,
      centerArt,
    });
  }
  return pages;
}
