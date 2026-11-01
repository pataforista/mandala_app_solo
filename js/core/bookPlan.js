// js/core/bookPlan.js
// Planificador de libro: decide estilo, composición, pétalos, marco e imagen de cada
// página ANTES de dibujar. Sortear cada página por separado produce rachas (tres
// "geométricos" seguidos, el mismo encuadre cuatro veces); aquí cada dimensión sale de
// una "bolsa barajada": se agotan todas las opciones antes de repetir y nunca se repite
// la misma opción en páginas consecutivas. Mismo semilla ⇒ mismo libro.
import { mulberry32 } from "./prng.js";

export const BOOK_STYLES = ["sashiko", "floral", "geometric", "islamico", "azteca", "yantra", "celtico"];
export const BOOK_COMPOSITIONS = ["centro", "fondo", "constelacion", "esquinas", "gigante", "medio", "trama"];
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

// Estructura del disco (ver STRUCTURES en mandalaClassic.js) y tema de fondo (ver
// BACKGROUNDS en pageComposer.js). Se reparten igual que la silueta: sin repetir en
// páginas seguidas y equilibrados en el libro.
export const BOOK_STRUCTURES = ["corona", "heroe", "equilibrio", "nucleo", "aurea", "doble"];
const STRUCTURE_WEIGHTS = [1.2, 1.1, 1.1, 1, 1, 0.9]; // muy equilibrado para evitar repeticiones
export const SCATTER_BACKGROUNDS = ["jardin", "cielo", "hojas", "dulce", "estrellas", "vinas"];
export const PATTERN_BACKGROUNDS = ["escamas", "flor_vida", "sol", "ondas", "mosaico"];

// Pesos de estilos para el perfil "best seller": floral y geométrico dominan, el resto
// aparece como variación ocasional. Unificado para que el libro y los capítulos usen
// el mismo reparto (antes había dos versiones con pesos diferentes).
export const BESTSELLER_STYLE_W = { floral: 3, geometric: 2, islamico: 0.3, sashiko: 0.5, celtico: 0.3, azteca: 0.2, yantra: 0.2 };

// Temas de libro: un tema dirige figuras, fondos y motivos para crear coherencia visual.
// Cada tema define estilos permitidos, fondos, temas de relleno (scatter) y motivos especiales.
export const BOOK_THEMES = {
  // Tema por defecto: sin tema, usa los valores del perfil o del usuario
  none: {
    name: "Sin tema",
    description: "Mezcla libre de estilos y fondos",
    styles: null, // usa los del perfil
    backgrounds: null, // usa los del perfil
    scatterTheme: null, // usa el del perfil
  },
  // Tema océano: olas, peces, conchas, estrellas de mar
  oceano: {
    name: "Océano",
    description: "Mandalas marinos: olas, peces, conchas, estrellas de mar, anclas",
    styles: ["floral", "geometric"],
    backgrounds: ["ondas", "escamas"],
    scatterTheme: "oceano",
    motifs: ["wave", "shell", "fish", "starfish", "anchor"],
  },
  // Tema navidad: estrellas, copos de nieve, árboles, regalos
  navidad: {
    name: "Navidad",
    description: "Mandalas navideños: estrellas, copos de nieve, árboles, regalos, campanas",
    styles: ["floral", "geometric", "celtico"],
    backgrounds: ["estrellas", "sol"],
    scatterTheme: "navidad",
    motifs: ["star", "snowflake", "tree", "gift", "bell"],
  },
  // Tema bosque: hojas, hongos, árboles, animales del bosque
  bosque: {
    name: "Bosque",
    description: "Mandalas del bosque: hojas, hongos, árboles, ardillas, búhos",
    styles: ["floral", "celtico", "sashiko"],
    backgrounds: ["hojas", "vinas"],
    scatterTheme: "bosque",
    motifs: ["leaf", "mushroom", "tree", "acorn", "fern"],
  },
};

// Perfiles de producto: fijan estilo, fondo, trazo y extras para un público concreto.
// Cada perfil define qué fondos usar (patternOnly = solo tramas continuas, no confeti).
export const PRODUCT_PROFILES = {
  // Adulto general: tramas continuas (teselados), sin confeti infantil
  mindful_patterns: {
    name: "Mindful Patterns",
    description: "Adulto general — tramas continuas, jerarquía de trazo, floral + geométrico",
    styles: ["floral", "geometric", "islamico", "yantra"],
    styleWeights: [3, 2, 1, 1],
    patternOnly: true, // Solo tramas continuas, no confeti
    strokeBase: 0.7, // mm
    complexity: 130,
  },
  // Seniors/principiantes: trazo grueso, celdas grandes, sin fondo
  large_print_easy: {
    name: "Large Print Easy",
    description: "Seniors y principiantes — trazo 1.1 mm, celdas ≥ 7 mm², centrado, sin fondo",
    styles: ["floral", "geometric"],
    styleWeights: [2, 1],
    patternOnly: false,
    useBackground: false, // Sin fondo decorado
    strokeBase: 1.1,
    complexity: 80,
  },
  // Adulto experto: geometría sagrada intrincada, tramas
  intricate_sacred: {
    name: "Intricate Sacred Geometry",
    description: "Adulto experto — geométrico, yantra, islámico; detalle alto; tramas",
    styles: ["geometric", "yantra", "islamico"],
    styleWeights: [3, 2, 2],
    patternOnly: true,
    strokeBase: 0.6,
    complexity: 180,
  },
  // Infantil: trazo grueso, figuras amables, fondo de juego (confeti permitido)
  kids_mandalas: {
    name: "Kids Mandalas",
    description: "Niños 6-10 — trazo grueso, figuras amables, fondo de juego",
    styles: ["floral", "sashiko", "celtico"],
    styleWeights: [2, 1, 1],
    patternOnly: false, // Confeti permitido (infantil)
    useBackground: true,
    strokeBase: 1.0,
    complexity: 60,
  },
};
// Temas sueltos que no combinan con todos los estilos (corazones alrededor de un mandala
// geométrico se ven fuera de lugar). Cielo, jardín (figuras del propio estilo) y las
// tramas van con todos.
const BACKGROUND_STYLES = {
  dulce: ["floral", "celtico", "sashiko"],
  hojas: ["floral", "celtico", "sashiko", "yantra", "islamico"],
};
// Composiciones con espacio libre que se decora (el resto no usa tema de fondo)
const FILLED = new Set(["fondo", "constelacion", "esquinas", "medio"]);

/** Tema de fondo equilibrado: el menos usado entre los posibles, distinto del anterior.
 *  Con patternOnly=true, usa solo tramas continuas (PATTERN_BACKGROUNDS), no confeti. */
export function backgroundPicker(rng, { fillCentro = false, patternOnly = false } = {}) {
  const used = new Map();
  let last = null;
  return (composition, style = null) => {
    const centro = composition === "centro" && fillCentro;
    if (!FILLED.has(composition) && !centro) return null;
    // Con patternOnly, usar solo tramas continuas (para perfiles de adulto)
    const basePool = patternOnly ? PATTERN_BACKGROUNDS :
      (composition === "fondo" || centro ? [...SCATTER_BACKGROUNDS, ...PATTERN_BACKGROUNDS] : SCATTER_BACKGROUNDS);
    const allowed = basePool.filter(b => !style || !BACKGROUND_STYLES[b] || BACKGROUND_STYLES[b].includes(style));
    // Cuenta por encuadre: si no, los temas sueltos (que también usan constelación y
    // esquinas) parecían «muy usados» y el fondo decorado repetía siempre las tramas.
    // Primero el menos usado; entre empatados, distinto del de la página anterior
    const n = (b) => used.get(`${composition}|${b}`) || 0;
    const min = Math.min(...allowed.map(n));
    let least = allowed.filter(b => n(b) === min && b !== last);
    if (!least.length) {
      const pool = allowed.filter(b => b !== last);
      const m2 = Math.min(...pool.map(n));
      least = pool.length ? pool.filter(b => n(b) === m2) : allowed;
    }
    const pick = least[Math.floor(rng() * least.length)];
    used.set(`${composition}|${pick}`, n(pick) + 1);
    last = pick;
    return pick;
  };
}

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
  // Hoja vertical: el centrado completa la hoja con un fondo (fillCentro) y ganan peso los
  // encuadres que cubren la hoja. Los líderes de la categoría venden diseños «sin el espacio
  // en blanco típico de los libros de mandalas» (ficha de 100 Amazing Patterns)
  const comps = square
    ? { centro: 6, fondo: 2, gigante: 1, constelacion: 1 }
    : { centro: 4, fondo: 2, constelacion: 2, esquinas: 2, gigante: 1 };
  return {
    compositions: Object.keys(comps), compositionWeights: Object.values(comps),
    styles: Object.keys(BESTSELLER_STYLE_W), styleWeights: Object.values(BESTSELLER_STYLE_W),
    frames: ["ninguno", "redondeado"], frameWeights: [3, 1],
    petals: [12, 16, 18, 20, 24],
    fillCentro: !square,
    patternOnly: true, // Adulto: solo tramas continuas, no confeti
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
      // Evita la repetición en la costura entre rondas de forma más estricta
      if (bag.length > 1 && bag[bag.length - 1] === last) {
        // Busca el primer elemento diferente al último y lo intercambia
        for (let i = 0; i < bag.length - 1; i++) {
          if (bag[i] !== last) {
            [bag[bag.length - 1], bag[i]] = [bag[i], bag[bag.length - 1]];
            break;
          }
        }
      }
    }
    let v = bag.pop();
    // Si el valor extraído es igual al último, busca uno diferente en el bag
    if (v === last && bag.length) {
      const k = bag.findIndex(x => x !== last);
      if (k >= 0) { const t = bag[k]; bag[k] = v; v = t; }
    }
    last = v;
    return v;
  };
}

// ---------- Capítulos temáticos ----------
// Los libros más vendidos agrupan los diseños por tema (p. ej. 125 Mandalas: vitral,
// étnico, gemas). Cada capítulo reúne estilos afines y abre con una portadilla.
export const CHAPTERS = [
  { key: "floral", title: "Jardín de mandalas", styles: ["floral", "celtico"], near: "arabesco" },
  { key: "arabesco", title: "Arabescos y vitrales", styles: ["islamico", "sashiko"], near: "geometrico" },
  { key: "geometrico", title: "Geometría sagrada", styles: ["geometric", "yantra"], near: "solar" },
  { key: "solar", title: "Soles y piedras", styles: ["azteca"], near: "geometrico" },
];

/**
 * Capítulos de un libro de `count` páginas: tamaño proporcional al peso de sus estilos.
 * Un capítulo de menos de `minSize` páginas se une al más afín (con sus estilos).
 * Devuelve [{ key, title, styles, weights, size }] (vacío si queda un solo capítulo).
 */
export function chapterLayout(count, styles = BOOK_STYLES, weights = null, minSize = 4) {
  const wOf = (st) => {
    const i = styles.indexOf(st);
    if (i < 0) return 0;
    if (!weights) return 1;
    const w = Array.isArray(weights) ? weights[i] : weights[st];
    return Number.isFinite(w) && w > 0 ? w : 0;
  };
  let chs = CHAPTERS.map(c => {
    const st = c.styles.filter(x => wOf(x) > 0);
    return { key: c.key, title: c.title, near: c.near, styles: st, w: st.reduce((a, x) => a + wOf(x), 0) };
  }).filter(c => c.styles.length);
  for (;;) {
    if (chs.length < 2) return [];
    const total = chs.reduce((a, c) => a + c.w, 0);
    const small = chs.filter(c => (count * c.w) / total < minSize).sort((a, b) => a.w - b.w)[0];
    if (!small) break;
    const rest = chs.filter(c => c !== small);
    // Se une al capítulo más afín (soles → geometría); si no está, al mayor
    const big = rest.find(c => c.key === small.near) || rest.reduce((a, b) => (b.w > a.w ? b : a));
    big.styles = [...big.styles, ...small.styles];
    big.w += small.w;
    chs = rest;
  }
  if (chs.length < 2) return [];
  // Reparto por mayor resto: los tamaños suman exactamente count
  const total = chs.reduce((a, c) => a + c.w, 0);
  const raw = chs.map(c => (count * c.w) / total);
  const size = raw.map(Math.floor);
  let left = count - size.reduce((a, b) => a + b, 0);
  raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { size[i]++; left--; } });
  return chs.map((c, i) => ({ key: c.key, title: c.title, styles: c.styles, weights: c.styles.map(wOf), size: size[i] }));
}

/** Inserta una portadilla antes del primer mandala de cada capítulo. */
export function insertChapterDividers(pages, seed = 1) {
  const n = new Set(pages.filter(p => p.chapter).map(p => p.chapter.key)).size;
  if (n < 2) return pages;
  const out = [];
  for (const p of pages) {
    if (p.chapter?.first) {
      out.push({
        seed: ((seed >>> 0) * 17 + 0xC4A9 * p.chapter.n) >>> 0, styleMode: p.styleMode, petals: 12,
        composition: "centro", frameStyle: "ninguno", centerArt: null, strokeScale: 1.3, complexity: 60,
        // Cada portadilla con otra silueta: si no, las tres se veían iguales
        silhouette: ["round", "diamond", "heart", "triangle"][(p.chapter.n - 1) % 4],
        special: { type: "chapter", n: p.chapter.n, of: n, title: p.chapter.title, size: p.chapter.size },
      });
    }
    out.push(p);
  }
  return out;
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
  const nextStructure = shuffleBag(mulberry32(((seed >>> 0) ^ 0x57A0C7E5) >>> 0), BOOK_STRUCTURES, STRUCTURE_WEIGHTS);
  const nextBackground = backgroundPicker(mulberry32(((seed >>> 0) ^ 0xBAC6A0D5) >>> 0), { fillCentro: opts.fillCentro, patternOnly: opts.patternOnly });

  // Páginas con imagen: espaciadas de forma uniforme (k + ½) · count / images
  const imageAt = new Map();
  for (let k = 0; k < Math.min(images, count); k++) imageAt.set(Math.floor(((k + 0.5) * count) / Math.min(images, count)), k);
  // Capítulos: los estilos se deciden primero, capítulo por capítulo (cada uno con su bolsa)
  const chapters = Array.isArray(opts.chapters) && opts.chapters.length > 1 ? opts.chapters : null;
  const chapterAt = [];
  if (chapters) {
    chapters.forEach((ch, k) => {
      const bag = shuffleBag(rng, ch.styles, ch.weights);
      for (let j = 0; j < ch.size; j++) chapterAt.push({ ch, k, j, style: bag() });
    });
  }
  const pages = [];
  for (let i = 0; i < count; i++) {
    let complexity;
    const cp = chapters ? chapterAt[i] : null;
    if (difficulty === "progresiva") {
      // De relajado a desafiante: el lector siente que avanza. Con capítulos, cada uno
      // empieza más fácil que donde terminó el anterior y vuelve a subir (diente de sierra
      // que en conjunto sigue creciendo)
      const tg = count > 1 ? i / (count - 1) : 0;
      const t = cp ? 0.35 * tg + 0.65 * (cp.ch.size > 1 ? cp.j / (cp.ch.size - 1) : 0) : tg;
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
    const styleMode = cp ? cp.style : nextStyle();
    pages.push({
      seed: ((seed >>> 0) + i) >>> 0,
      strokeScale: difficulty === "fija" ? 1 : strokeScaleFor(complexity, baseComplexity),
      styleMode,
      silhouette: nextSilhouette(styleMode, composition),
      structure: nextStructure(),
      background: nextBackground(composition, styleMode),
      composition,
      frameStyle: nextFrame(),
      petals: nextPetals(),
      complexity,
      centerArt,
      ...(cp ? { chapter: { key: cp.ch.key, title: cp.ch.title, n: cp.k + 1, size: cp.ch.size, first: cp.j === 0 } } : {}),
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
  if (difficulty === "progresiva" && pages.some(p => p.chapter)) {
    // Con capítulos, las páginas normales ya traen su dificultad; las especiales toman la
    // de la página normal anterior (un grupo, la de su primera página)
    let last = baseComplexity;
    const groupCx = new Map();
    for (const p of pages) {
      if (!p.special) { last = p.complexity; continue; }
      if (p.special.type === "solutions") continue;
      const g = p.special.group;
      let cx = last;
      if (g != null) { if (!groupCx.has(g)) groupCx.set(g, cx); cx = groupCx.get(g); }
      p.complexity = cx;
      p.strokeScale = strokeScaleFor(cx, baseComplexity);
    }
  } else if (difficulty === "progresiva") {
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

/**
 * Página del plan con un cambio aplicado (revisión a mano o curaduría automática).
 * ov: { bump?, composition? }. «Otro diseño» (bump) desplaza la semilla y cambia también
 * la estructura y la silueta: con la misma silueta, el reemplazo se parecería demasiado al
 * dibujo descartado. Devuelve { seed, structure, silhouette, composition }.
 */
export function applyPageOverride(pg, ov = null) {
  const bump = ov?.bump || 0;
  const seed = bump ? ((pg.seed + 0x9E3779B1 * bump) >>> 0) : pg.seed;
  const structure = pg.structure && bump
    ? BOOK_STRUCTURES[(BOOK_STRUCTURES.indexOf(pg.structure) + bump) % BOOK_STRUCTURES.length]
    : pg.structure;
  const silhouette = pg.silhouette && bump ? alternateSilhouette(pg.styleMode, pg.silhouette, bump) : pg.silhouette;
  return { seed, structure, silhouette, composition: ov?.composition || pg.composition };
}
