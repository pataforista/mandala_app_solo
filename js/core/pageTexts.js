// js/core/pageTexts.js
// Textos que se imprimen DENTRO de las páginas del libro (rótulos, instrucciones, notas).
// Un solo diccionario por idioma: si un generador escribe texto, lo toma de aquí con
// pageTexts(opts.lang). tests/pageTexts.test.mjs comprueba que un libro en inglés no
// imprime nada en español y que los dos idiomas tienen las mismas claves.
// Los textos de las páginas de venta (título, derechos, bienvenida…) están en BOOK_TEXTS
// de export.js porque se dibujan en el lienzo, no en el SVG.

const ES = {
  growStage: (stage, of, done) => `Mandala que crece · etapa ${stage} de ${of}${done ? ": completo" : ""}`,
  mysteryFooter: (n, of) => `Misterioso ${n} de ${of} · solución al final`,
  mysteryHint: "Punto (●): color oscuro · Raya (–): color claro. Aparecerá una figura escondida.",
  solutionsTitle: "Soluciones de los mandalas misteriosos",
  solutionLabel: (n, page, shape) => `Misterioso ${n} (pág. ${page}) · ${shape}`,
  shapes: { corazon: "corazón", estrella: "estrella", gato: "gato", mariposa: "mariposa", luna: "luna", pez: "pez", casa: "casa" },
  chapter: (n) => `Capítulo ${n}`,
  chapterTitles: { floral: "Jardín de mandalas", arabesco: "Arabescos y vitrales", geometrico: "Geometría sagrada", solar: "Soles y piedras" },
  muralTile: (name, col, row) => `Mural · hoja ${name} (columna ${col}, fila ${row})`,
  muralUp: (name) => `arriba: ${name}`,
  muralRight: (name) => `derecha: ${name}`,
  muralGuideTitle: "Arma tu mural",
  muralSteps: (n, wCm, hCm) => [
    `1. Colorea las ${n} hojas del mural, en orden o al azar.`,
    "2. Recorta cada hoja por su línea exterior.",
    "3. Únelas por detrás con cinta según este mapa: la letra es la columna y el número la fila.",
    `Tamaño final: ${wCm} × ${hCm} cm.`,
  ],
  nature: {
    girasol: {
      title: "Girasol · el ángulo áureo",
      // @a y @b: las espirales que tiene ESTE dibujo, contadas al dibujarlo (21 y 34, o 34 y 55,
      // según el número de flósculos); @c y @d: el par de Fibonacci siguiente, frecuente en
      // girasoles reales, para no repetir la misma cifra. Dos caracteres, igual que los
      // números: el corte de líneas no cambia al sustituirlos.
      body: "En el modelo clásico del girasol, cada flósculo queda girado unos 137,5° respecto al anterior: el ángulo áureo. Como ese giro nunca se repite exactamente, las semillas se empaquetan casi sin huecos. Busca las espirales que corren en los dos sentidos: en este dibujo hay @a y @b. En los girasoles reales suelen contarse números consecutivos de Fibonacci, como @c y @d, aunque no siempre.",
    },
    estrella: {
      title: "Estrella de mar · simetría de cinco",
      body: "Los equinodermos adultos tienen simetría pentarradial: cinco partes iguales alrededor de un eje. Sus larvas, en cambio, nadan con simetría bilateral, como la nuestra, y se reorganizan durante la metamorfosis. El pequeño círculo fuera del centro, la placa madrepórica, rompe la simetría: comunica con el mar el sistema hidráulico que mueve sus pies, el sistema vascular acuífero.",
    },
    copo: {
      title: "Copo de nieve · simetría de seis",
      body: "El hielo cristaliza en una red hexagonal; por eso los copos estrellados tienen seis brazos. Los brazos crecen casi igual porque viven, al mismo tiempo, los mismos cambios de temperatura y humedad durante la caída: ninguno copia a los otros. Como cada copo atraviesa nubes distintas, es muy improbable encontrar dos iguales.",
    },
    diatomea: {
      title: "Diatomea · un vidrio vivo",
      body: "Las diatomeas son algas de una sola célula que construyen su pared con sílice, el mismo compuesto del vidrio. En las diatomeas céntricas, como esta, los poros forman filas radiales. Ernst Haeckel las dibujó en «Kunstformen der Natur» (1899-1904). Se estima que producen entre una quinta y una cuarta parte del oxígeno de la Tierra.",
    },
  },
};

const EN = {
  growStage: (stage, of, done) => `Growing mandala · stage ${stage} of ${of}${done ? ": complete" : ""}`,
  mysteryFooter: (n, of) => `Mystery ${n} of ${of} · solution at the back`,
  mysteryHint: "Dot (●): dark color · Dash (–): light color. A hidden picture will appear.",
  solutionsTitle: "Mystery mandala solutions",
  solutionLabel: (n, page, shape) => `Mystery ${n} (p. ${page}) · ${shape}`,
  shapes: { corazon: "heart", estrella: "star", gato: "cat", mariposa: "butterfly", luna: "moon", pez: "fish", casa: "house" },
  chapter: (n) => `Chapter ${n}`,
  chapterTitles: { floral: "Mandala Garden", arabesco: "Arabesques and Stained Glass", geometrico: "Sacred Geometry", solar: "Suns and Stones" },
  muralTile: (name, col, row) => `Mural · sheet ${name} (column ${col}, row ${row})`,
  muralUp: (name) => `above: ${name}`,
  muralRight: (name) => `right: ${name}`,
  muralGuideTitle: "Build your mural",
  muralSteps: (n, wCm, hCm) => [
    `1. Color the ${n} mural sheets, in order or at random.`,
    "2. Cut out each sheet along its outer line.",
    "3. Tape them together from the back using this map: the letter is the column and the number is the row.",
    `Finished size: ${wCm} × ${hCm} cm (${(wCm / 2.54).toFixed(1)} × ${(hCm / 2.54).toFixed(1)} in).`,
  ],
  nature: {
    girasol: {
      title: "Sunflower · the golden angle",
      body: "In the classic sunflower model, each floret is turned about 137.5° from the one before: the golden angle. Because that turn never repeats exactly, the seeds pack together with almost no gaps. Look for the spirals running in both directions: this drawing has @a and @b. Real sunflowers often show consecutive Fibonacci numbers, such as @c and @d, though not always.",
    },
    estrella: {
      title: "Sea star · fivefold symmetry",
      body: "Adult echinoderms have pentaradial symmetry: five equal parts around a central axis. Their larvae, however, swim with bilateral symmetry, like ours, and reorganize during metamorphosis. The small circle off the center, the madreporite, breaks the symmetry: it connects the sea to the hydraulic system that moves the tube feet, the water vascular system.",
    },
    copo: {
      title: "Snowflake · sixfold symmetry",
      body: "Ice crystallizes in a hexagonal lattice, which is why star-shaped snowflakes have six arms. The arms grow almost alike because they experience the same changes in temperature and humidity at the same time as the flake falls: none copies the others. Since every flake passes through different clouds, finding two identical ones is very unlikely.",
    },
    diatomea: {
      title: "Diatom · living glass",
      body: "Diatoms are single-celled algae that build their walls from silica, the same compound as glass. In centric diatoms, like this one, the pores form radial rows. Ernst Haeckel drew them in “Kunstformen der Natur” (1899-1904). They are estimated to produce between a fifth and a quarter of Earth's oxygen.",
    },
  },
};

export const PAGE_TEXTS = { es: ES, en: EN };
export const PAGE_LANGS = Object.keys(PAGE_TEXTS);

/** Textos del idioma pedido; español si el idioma no existe o no se indicó. */
export function pageTexts(lang) {
  return PAGE_TEXTS[lang] || ES;
}
