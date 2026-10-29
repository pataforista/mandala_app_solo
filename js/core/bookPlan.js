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

// Silueta: la banda exterior del mandala, lo primero que se reconoce al hojear. Antes la
// sorteaba el motor entre 3 formas (loto, festón, ojiva) y la mitad del libro salía con
// loto: páginas distintas por dentro parecían el mismo dibujo. Ahora la reparte el plan.
// Dos familias: flor abierta y medallón cerrado (rombo, triángulo: contorno circular).
// El zigzag (chevron) queda fuera: como silueta deja una corona casi vacía.
export const BOOK_SILHOUETTES = ["lotus", "scallop", "ogee", "petal", "leaf", "round", "heart", "diamond", "triangle"];
const SILHOUETTES_BY_STYLE = {
  floral:    ["lotus", "petal", "round", "heart", "leaf", "scallop", "ogee"],
  geometric: ["diamond", "triangle", "petal", "lotus", "ogee", "scallop"],
  azteca:    ["triangle", "diamond", "petal", "lotus", "scallop"],
  islamico:  ["ogee", "scallop", "diamond", "lotus", "petal", "round"],
  yantra:    ["lotus", "petal", "triangle", "diamond", "ogee"],
  sashiko:   ["scallop", "round", "diamond", "lotus", "ogee", "petal"],
  celtico:   ["round", "heart", "leaf", "scallop", "ogee", "lotus"],
};

// Familias visuales: lo que el ojo distingue al hojear. Loto, pétalo y ojiva tienen
// nombres distintos pero se ven como la misma corona de puntas.
export const SILHOUETTE_FAMILY = {
  lotus: "puntas", petal: "puntas", ogee: "puntas",
  scallop: "lobulos", round: "lobulos",
  heart: "corazones", leaf: "rayos",
  diamond: "medallon", triangle: "medallon",
};

/**
 * Silueta de reemplazo n.º k (k ≥ 1) para una página rehecha: acorde a su estilo y de otra
 * familia visual que la original, para que el reemplazo no se parezca al dibujo descartado.
 */
export function alternateSilhouette(style, current, k) {
  const allowed = SILHOUETTES_BY_STYLE[style] || BOOK_SILHOUETTES;
  const other = allowed.filter(s => SILHOUETTE_FAMILY[s] !== SILHOUETTE_FAMILY[current]);
  const list = other.length ? other : allowed;
  return list[(Math.max(1, k) - 1) % list.length];
}

/**
 * Elige siluetas compatibles con cada estilo, equilibradas en el libro: evita la familia
 * visual de las 2 páginas anteriores y, entre las que quedan, toma la familia y la silueta
 * menos usadas hasta ahora. Con `composition`, además evita repetir familia con una de las
 * 4 páginas anteriores que tenga el mismo encuadre y estilo (se verían gemelas al hojear).
 */
export function silhouettePicker(rng) {
  const used = new Map(BOOK_SILHOUETTES.map(s => [s, 0]));
  const famUsed = new Map();
  const recent = [];
  const window = []; // { key: encuadre|estilo, fam } de las 4 páginas anteriores
  return (style, composition = null) => {
    const allowed = SILHOUETTES_BY_STYLE[style] || BOOK_SILHOUETTES;
    const key = `${composition}|${style}`;
    const twinFams = composition ? window.filter(w => w.key === key).map(w => w.fam) : [];
    let pool = allowed.filter(s => !recent.includes(SILHOUETTE_FAMILY[s]) && !twinFams.includes(SILHOUETTE_FAMILY[s]));
    if (!pool.length) pool = allowed.filter(s => !recent.includes(SILHOUETTE_FAMILY[s]));
    if (!pool.length) pool = allowed.filter(s => SILHOUETTE_FAMILY[s] !== recent.at(-1));
    if (!pool.length) pool = allowed;
    const cost = (s) => (famUsed.get(SILHOUETTE_FAMILY[s]) || 0) * 10 + used.get(s);
    const min = Math.min(...pool.map(cost));
    const least = pool.filter(s => cost(s) === min);
    const pick = least[Math.floor(rng() * least.length)];
    used.set(pick, used.get(pick) + 1);
    const fam = SILHOUETTE_FAMILY[pick];
    famUsed.set(fam, (famUsed.get(fam) || 0) + 1);
    recent.push(fam); if (recent.length > 2) recent.shift();
    window.push({ key, fam }); if (window.length > 4) window.shift();
    return pick;
  };
}

/**
 * Perfil «lo que más se vende» para un formato. NO sale de datos de ventas (no los
 * tenemos): resume las convenciones de los libros de mandalas mejor posicionados en
 * Amazon. Un mandala grande y centrado por página, una sola cara, simetría alta
 * (12–24 pétalos), estilos florales y geométricos por delante y sin marcos pesados.
 * Los encuadres que dejan el mandala a medias (medio mandala) desaparecen; los
 * decorativos aparecen sólo como variación ocasional.
 */
export function bestSellerProfile(preset = "KDP_8_5x8_5") {
  const square = /8_5x8_5/.test(preset);
  // Hoja cuadrada: el disco ocupa toda la página y el centrado domina aún más
  const comps = square
    ? { centro: 6, fondo: 2, gigante: 1, constelacion: 1 }
    : { centro: 5, fondo: 2, constelacion: 2, esquinas: 1, gigante: 1 };
  const styles = { floral: 3, geometric: 2, islamico: 2, yantra: 2, sashiko: 1, celtico: 1, azteca: 1 };
  return {
    compositions: Object.keys(comps), compositionWeights: Object.values(comps),
    styles: Object.keys(styles), styleWeights: Object.values(styles),
    frames: ["ninguno", "redondeado"], frameWeights: [3, 1],
    petals: [12, 16, 18, 20, 24],
  };
}

/**
 * Grosor de línea según la dificultad de la página. Los libros de mayor calidad no usan
 * el mismo trazo en una página relajada que en una desafiante: una página sencilla con
 * línea fina se ve pobre y una muy detallada con línea gruesa se empasta. Página más
 * sencilla que la base ⇒ línea más gruesa (hasta +60 %); más compleja ⇒ algo más fina
 * (hasta −15 %, nunca por debajo del mínimo de impresión que aplica quien la use).
 */
export function strokeScaleFor(complexity, baseComplexity) {
  const r = Math.pow(Math.max(1, baseComplexity) / Math.max(1, complexity), 0.4);
  return Math.round(Math.min(1.6, Math.max(0.85, r)) * 100) / 100;
}

/** Trazo final de una página: nunca por debajo de 0,35 mm (las líneas finas se pierden al imprimir). */
export const MIN_PRINT_STROKE_MM = 0.35;
export const MAX_AUTO_STROKE_MM = 1.2;
// Grosor mínimo comercial: el mismo umbral que penaliza la puntuación (commercialMetrics.js).
// El adelgazamiento automático de las páginas difíciles no cruza este umbral si el trazo
// elegido ya lo cumplía: antes, una página difícil con trazo de 0,8 mm salía a 0,68 mm y
// perdía 15 puntos por una decisión del propio planificador.
export const COMMERCIAL_MIN_STROKE_MM = 0.8;
export function pageStrokeMm(baseMm, scale = 1) {
  let mm = baseMm * scale;
  if (scale < 1) mm = Math.max(mm, Math.min(baseMm, COMMERCIAL_MIN_STROKE_MM));
  // El aumento automático no pasa de 1,2 mm: más grueso empasta las celdas pequeñas.
  // Si el usuario eligió un trazo mayor, se respeta (nunca se adelgaza por este tope).
  if (scale > 1) mm = Math.min(mm, Math.max(baseMm, MAX_AUTO_STROKE_MM));
  return Math.round(Math.max(MIN_PRINT_STROKE_MM, mm) * 100) / 100;
}

function shuffled(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/**
 * Pesos → número de copias por ronda. Acepta una lista (mismo orden que options) o un
 * objeto { opción: peso }. Los pesos fraccionarios se escalan para que el menor peso
 * positivo valga una copia: { floral: 3, azteca: 0.2 } ⇒ 15 florales por cada azteca
 * (redondear 0,2 a 0 la haría desaparecer). Un peso no numérico cuenta como 0.
 */
export function weightCopies(options, weights) {
  const raw = options.map((o, i) => {
    const w = Array.isArray(weights) ? weights[i] : weights[o];
    return Number.isFinite(w) && w > 0 ? w : 0;
  });
  const pos = raw.filter(w => w > 0);
  if (!pos.length) return options.map(() => 1);
  const scale = Math.min(1 / Math.min(...pos), 200 / pos.reduce((a, b) => a + b, 0));
  return raw.map(w => (w > 0 ? Math.max(1, Math.round(w * Math.max(1, scale))) : 0));
}

/** Bolsa barajada: reparte todas las opciones antes de repetir; evita repetir la anterior. */
export function shuffleBag(rng, options, weights = null) {
  // Los pesos se traducen en copias: peso 2 ⇒ aparece el doble de veces por ronda
  const copies = weights ? weightCopies(options, weights) : null;
  const pool = copies ? options.flatMap((o, i) => Array(copies[i]).fill(o)) : options.slice();
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
 *   images?: number (nº de imágenes elegidas a mano; cada una aparece UNA vez, repartidas
 *            a lo largo del libro para que no queden amontonadas al principio)
 * }
 * Devuelve [{ seed, styleMode, composition, frameStyle, petals, complexity, strokeScale, centerArt }]
 */
export function planBook(opts) {
  const {
    count, seed = 1,
    styles = BOOK_STYLES, compositions = BOOK_COMPOSITIONS, frames = BOOK_FRAMES,
    compositionWeights = null, difficulty = "mixta", baseComplexity = 130,
    images = 0, styleWeights = null, frameWeights = null, petals = BOOK_PETALS,
  } = opts;
  const rng = mulberry32(((seed >>> 0) ^ 0xB00C5EED) >>> 0);
  const nextStyle = shuffleBag(rng, styles, styleWeights);
  const nextComp = shuffleBag(rng, compositions, compositionWeights);
  const nextFrame = shuffleBag(rng, frames, frameWeights);
  const nextPetals = shuffleBag(rng, petals);
  // Generador propio: añadir la silueta no cambia los sorteos de las demás dimensiones
  const nextSilhouette = silhouettePicker(mulberry32(((seed >>> 0) ^ 0x51A0E77E) >>> 0));

  // Páginas con imagen: espaciadas de forma uniforme (k + ½) · count / images
  const imageAt = new Map();
  for (let k = 0; k < Math.min(images, count); k++) imageAt.set(Math.floor(((k + 0.5) * count) / Math.min(images, count)), k);
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
    if (imageAt.has(i)) centerArt = { type: "image", imageIndex: imageAt.get(i) };
    let composition = nextComp();
    // Un medio mandala cortaría al personaje por la mitad
    if (centerArt && composition === "medio") composition = "fondo";
    const styleMode = nextStyle();
    pages.push({
      seed: ((seed >>> 0) + i) >>> 0,
      strokeScale: difficulty === "fija" ? 1 : strokeScaleFor(complexity, baseComplexity),
      styleMode,
      silhouette: nextSilhouette(styleMode, composition),
      composition,
      frameStyle: nextFrame(),
      petals: nextPetals(),
      complexity,
      centerArt,
    });
  }
  return pages;
}

// ---------- Páginas sorprendentes ----------
export const GROWTH_STAGES = 4;
const MYSTERY_ORDER = ["corazon", "estrella", "gato", "mariposa", "luna", "pez", "casa"];
const NATURE_ORDER = ["girasol", "estrella", "copo", "diatomea"];

/** Cuántas páginas añaden las opciones especiales (sin contar los reversos). */
export function specialPageCount({ growth = 0, mystery = 0, nature = false, mural = null } = {}) {
  return growth * GROWTH_STAGES + mystery + (nature ? NATURE_ORDER.length : 0)
    + (mural ? mural.cols * mural.rows + 1 : 0) + (mystery > 0 ? 1 : 0);
}

/**
 * Posiciones (índice en el plan) de las hojas del mural, sin construir el plan.
 * addSpecialPages las pone al final, antes de la página de soluciones; si eso cambia,
 * cambia también aquí (lo comprueba una prueba).
 */
export function muralTilePositions(total, { mystery = 0, mural = null } = {}) {
  if (!mural) return [];
  const tiles = mural.cols * mural.rows, sol = mystery > 0 ? 1 : 0;
  return Array.from({ length: tiles }, (_, k) => total - sol - tiles + k);
}

/**
 * Inserta las páginas especiales en un plan de planBook y, en dificultad progresiva,
 * reparte la complejidad sobre el libro COMPLETO (la última página es la más difícil).
 *  - growth: nº de secuencias «mandala que crece» (GROWTH_STAGES páginas seguidas cada una)
 *  - mystery: nº de mandalas misteriosos (repartidos; las soluciones van al final)
 *  - nature: capítulo de simetrías naturales (bloque de 4 páginas hacia el 60 % del libro)
 *  - mural: { cols, rows } o null (hoja guía + hojas, al final: es el gran cierre)
 * Las páginas de un mismo grupo (secuencia o mural) comparten semilla y complejidad:
 * si no, la etapa 3 no sería «el mismo mandala» que la 2.
 */
export function addSpecialPages(plan, opts = {}) {
  const {
    seed = 1, growth = 0, mystery = 0, nature = false, mural = null,
    difficulty = "mixta", baseComplexity = 130,
    styles = BOOK_STYLES, styleWeights = null, petals = [12, 16, 18, 20, 24],
  } = opts;
  const rng = mulberry32(((seed >>> 0) ^ 0x5BEC1A15) >>> 0);
  const nextStyle = shuffleBag(rng, styles, styleWeights);
  const nextPetals = shuffleBag(rng, petals);
  const sub = (k) => ((seed >>> 0) * 31 + 0x9E3779B1 * (k + 1)) >>> 0;
  const blank = { composition: "centro", frameStyle: "ninguno", centerArt: null, strokeScale: 1, complexity: baseComplexity };
  const pages = plan.map(p => ({ ...p }));
  // Insertar sin partir un bloque (secuencia que crece) por la mitad
  const insertAt = (idx, block) => {
    let i = Math.max(0, Math.min(pages.length, idx));
    while (i > 0 && i < pages.length && pages[i].special?.group != null && pages[i - 1].special?.group === pages[i].special.group) i++;
    pages.splice(i, 0, ...block);
  };
  let key = 0;

  for (let g = 0; g < growth; g++) {
    const s = sub(key++), styleMode = nextStyle(), pet = nextPetals();
    const block = Array.from({ length: GROWTH_STAGES }, (_, st) => ({
      ...blank, seed: s, styleMode, petals: pet, frameStyle: "redondeado",
      special: { type: "grow", group: `g${g}`, stage: st, of: GROWTH_STAGES },
    }));
    insertAt(Math.round(((g + 0.5) * pages.length) / growth), block);
  }
  const shapes = MYSTERY_ORDER.slice();
  for (let i = shapes.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [shapes[i], shapes[j]] = [shapes[j], shapes[i]]; }
  for (let k = 0; k < mystery; k++) {
    insertAt(Math.round(((k + 0.75) * pages.length) / (mystery + 0.5)), [{
      ...blank, seed: sub(key++), styleMode: nextStyle(), petals: 16,
      special: { type: "mystery", shape: shapes[k % shapes.length], n: 0, of: mystery },
    }]);
  }
  // Numeración en orden de aparición (las inserciones no siguen el orden del libro)
  let mk = 0;
  for (const p of pages) if (p.special?.type === "mystery") p.special.n = ++mk;
  if (nature) {
    insertAt(Math.round(pages.length * 0.6), NATURE_ORDER.map((kind) => ({
      ...blank, seed: sub(key++), styleMode: "floral", petals: 12, special: { type: "nature", kind },
    })));
  }
  if (mural) {
    const s = sub(key++), styleMode = nextStyle(), pet = nextPetals();
    const group = "mural";
    pages.push({ ...blank, seed: s, styleMode, petals: pet, special: { type: "mural", group, guide: true, cols: mural.cols, rows: mural.rows } });
    for (let row = 0; row < mural.rows; row++) for (let col = 0; col < mural.cols; col++) {
      pages.push({ ...blank, seed: s, styleMode, petals: pet, special: { type: "mural", group, cols: mural.cols, rows: mural.rows, col, row } });
    }
  }
  if (mystery > 0) pages.push({ ...blank, seed: sub(key++), styleMode: "floral", petals: 12, special: { type: "solutions" } });

  // Dificultad creciente sobre el libro completo. Los grupos toman la complejidad de su
  // primera página; las soluciones no cuentan (no se colorean).
  if (difficulty === "progresiva") {
    const top = Math.max(baseComplexity, 200);
    const N = pages.length;
    const groupCx = new Map();
    pages.forEach((p, i) => {
      if (p.special?.type === "solutions") return;
      const t = N > 1 ? i / (N - 1) : 0;
      let cx = Math.round(40 + t * (top - 40));
      const g = p.special?.group;
      if (g != null) { if (!groupCx.has(g)) groupCx.set(g, cx); cx = groupCx.get(g); }
      p.complexity = cx;
      p.strokeScale = strokeScaleFor(cx, baseComplexity);
    });
  }
  return pages;
}
