// js/core/lineArt.js
// Convierte una imagen (caricatura antigua, grabado, pintura de dominio público) en
// un dibujo de líneas negras sobre blanco, listo para colorear dentro del medallón.
//  - "lineas": la imagen ya tiene contornos (cómic, grabado). Umbral + limpieza.
//  - "bordes": pintura o foto. Diferencia de gaussianas → percentil → limpieza.
// En ambos casos se eliminan las motas sueltas y se engruesa el trazo hasta ~0.3 mm,
// el mínimo que la imprenta reproduce en negro sólido. Funciones puras (sin DOM).

export function toGray(rgba, w, h) {
  const g = new Float32Array(w * h);
  for (let i = 0, j = 0; j < g.length; i += 4, j++) {
    const a = rgba[i + 3] / 255; // lo transparente cuenta como papel blanco
    g[j] = (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]) * a + 255 * (1 - a);
  }
  return g;
}

function boxBlur(src, w, h, r) {
  if (r < 1) return src;
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[y * w + x] = acc / n;
      acc += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / n;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

function percentile(arr, p) {
  // Histograma: evita ordenar un millón de valores
  let max = 0;
  for (const v of arr) if (v > max) max = v;
  if (max === 0) return Infinity;
  const bins = new Uint32Array(1024);
  for (const v of arr) bins[Math.min(1023, Math.floor((v / max) * 1023))]++;
  let target = arr.length * p, acc = 0;
  for (let b = 0; b < 1024; b++) { acc += bins[b]; if (acc >= target) return (b / 1023) * max; }
  return max;
}

/** Borra componentes conexos de tinta con menos de minPx píxeles (motas, ruido). */
export function removeSpecks(ink, w, h, minPx) {
  const seen = new Uint8Array(w * h), stack = new Int32Array(w * h);
  for (let s = 0; s < ink.length; s++) {
    if (!ink[s] || seen[s]) continue;
    let top = 0, size = 0;
    stack[top++] = s; seen[s] = 1;
    const comp = [];
    while (top) {
      const i = stack[--top]; comp.push(i); size++;
      const x = i % w, y = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (ink[j] && !seen[j]) { seen[j] = 1; stack[top++] = j; }
      }
    }
    if (size < minPx) for (const i of comp) ink[i] = 0;
  }
  return ink;
}

function dilate(ink, w, h, r) {
  if (r < 1) return ink;
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!ink[y * w + x]) continue;
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy > r * r + r) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) out[ny * w + nx] = 1;
    }
  }
  return out;
}

/**
 * rgba: Uint8ClampedArray de ImageData. Devuelve Uint8Array gris (0 = tinta, 255 = papel).
 * opts: { mode: "lineas"|"bordes", threshold (0-255, modo líneas), detail (0-1, modo bordes),
 *         thickenPx, minSpeckPx }
 */
export function imageToLineArt(rgba, w, h, opts = {}) {
  const { mode = "lineas", threshold = 110, detail = 0.5, thickenPx = 1, minSpeckPx = Math.round((w * h) / 20000), simplify = 0 } = opts;
  const g = toGray(rgba, w, h);
  let ink = new Uint8Array(w * h);
  if (mode === "bordes") {
    // Diferencia de gaussianas (DoG): marca donde el píxel es más oscuro que su entorno.
    // A diferencia de Sobel, da UNA línea por contorno (no dos) y respeta el sombreado.
    // Simplificar = mirar la imagen "con los ojos entrecerrados": se pierden pelo y
    // textura y quedan las formas grandes (ojos, nariz, contorno del sombrero)
    const k = 1 + simplify * 3;
    const fine = boxBlur(boxBlur(g, w, h, Math.round(k)), w, h, Math.round(k));
    const wide = boxBlur(boxBlur(g, w, h, Math.round(3 * k)), w, h, Math.round(3 * k));
    const d = new Float32Array(w * h);
    for (let i = 0; i < d.length; i++) d[i] = Math.max(0, wide[i] - fine[i]);
    // detail 0 ⇒ sólo el 5% más marcado; detail 1 ⇒ el 20%
    const t = Math.max(2, percentile(d, 1 - (0.05 + detail * 0.15) * (1 - 0.6 * simplify)));
    for (let i = 0; i < ink.length; i++) ink[i] = d[i] >= t ? 1 : 0;
  } else {
    for (let i = 0; i < ink.length; i++) ink[i] = g[i] < threshold ? 1 : 0;
  }
  ink = removeSpecks(ink, w, h, Math.max(4, minSpeckPx));
  ink = dilate(ink, w, h, thickenPx);
  const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = ink[i] ? 0 : 255;
  return out;
}

// ---------------------------------------------------------------------------
// Figuras para rellenar con mandalas (estilo "zentangle": tortuga, mono…)
// ---------------------------------------------------------------------------

/**
 * Transformada de distancia (chaflán 3-4): distancia en píxeles de cada celda libre
 * a la celda bloqueada más cercana. blocked: Uint8Array (1 = bloqueada).
 * edgeBlocked: el borde de la rejilla cuenta como obstáculo.
 */
export function distanceTransform(blocked, w, h, edgeBlocked = false) {
  const INF = 1e9, d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = blocked[i] ? 0 : INF;
  const edge = (x, y) => (edgeBlocked ? Math.min(x + 1, y + 1, w - x, h - y) * 3 : INF);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!d[i]) continue;
    let v = Math.min(d[i], edge(x, y));
    if (x > 0) v = Math.min(v, d[i - 1] + 3);
    if (y > 0) {
      v = Math.min(v, d[i - w] + 3);
      if (x > 0) v = Math.min(v, d[i - w - 1] + 4);
      if (x < w - 1) v = Math.min(v, d[i - w + 1] + 4);
    }
    d[i] = v;
  }
  for (let y = h - 1; y >= 0; y--) for (let x = w - 1; x >= 0; x--) {
    const i = y * w + x;
    if (!d[i]) continue;
    let v = d[i];
    if (x < w - 1) v = Math.min(v, d[i + 1] + 3);
    if (y < h - 1) {
      v = Math.min(v, d[i + w] + 3);
      if (x < w - 1) v = Math.min(v, d[i + w + 1] + 4);
      if (x > 0) v = Math.min(v, d[i + w - 1] + 4);
    }
    d[i] = v;
  }
  for (let i = 0; i < d.length; i++) d[i] /= 3;
  return d;
}

/**
 * Vacía las manchas sólidas (el cuerpo negro de un gato de caricatura, un sombrero
 * oscuro): sólo conserva la tinta a menos de keepPx del papel. Así la mancha se vuelve
 * un contorno cerrado que se puede rellenar con mandalas.
 */
export function hollowSolids(ink, w, h, keepPx) {
  const paper = new Uint8Array(w * h);
  for (let i = 0; i < paper.length; i++) paper[i] = ink[i] ? 0 : 1;
  const d = distanceTransform(paper, w, h, true);
  const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = ink[i] && d[i] <= keepPx ? 1 : 0;
  return out;
}

/** Bordes entre zonas de color plano (caricaturas, carteles antiguos). */
function colorEdges(rgba, w, h, tol) {
  const ink = new Uint8Array(w * h);
  const t2 = tol * tol;
  const diff = (i, j) => {
    const a = i * 4, b = j * 4;
    const dr = rgba[a] - rgba[b], dg = rgba[a + 1] - rgba[b + 1], db = rgba[a + 2] - rgba[b + 2];
    return dr * dr + dg * dg + db * db;
  };
  for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) {
    const i = y * w + x;
    if (diff(i, i + 1) > t2 || diff(i, i + w) > t2) ink[i] = 1;
  }
  return ink;
}

/**
 * Fondo por crecimiento de región: parte de los bordes superior, izquierdo y derecho
 * (el inferior suele cortar el cuerpo del personaje) y avanza mientras el color cambie
 * suavemente. Un degradado se cruza; el contorno del personaje, no.
 */
export function backgroundMask(rgba, w, h, tol = 26, fromBottom = false, extraSeeds = [], fromBorders = true) {
  // Gradiente con salto de 2 px: una rampa suavizada (JPEG, reescalado) sigue contando
  // como borde aunque cada píxel difiera poco del vecino
  const grad = new Float32Array(w * h);
  const d2 = (a, b) => { a *= 4; b *= 4; const r = rgba[a] - rgba[b], g = rgba[a + 1] - rgba[b + 1], bl = rgba[a + 2] - rgba[b + 2]; return r * r + g * g + bl * bl; };
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    grad[i] = Math.sqrt(Math.max(d2(i - 1, i + 1), d2(i - w, i + w)));
  }
  const bg = new Uint8Array(w * h), stack = [];
  // Color de referencia que viaja con el frente y se adapta despacio: sigue un degradado
  // amplio del cielo, pero no una rampa corta de verde a negro (el borde del personaje)
  const ref = new Float32Array(w * h * 3);
  const seed = (x, y) => {
    const i = y * w + x;
    if (bg[i] || grad[i] >= tol * 1.5) return;
    bg[i] = 1; stack.push(i);
    ref[i * 3] = rgba[i * 4]; ref[i * 3 + 1] = rgba[i * 4 + 1]; ref[i * 3 + 2] = rgba[i * 4 + 2];
  };
  if (fromBorders) {
    for (let x = 0; x < w; x++) { seed(x, 0); seed(x, 1); if (fromBottom) { seed(x, h - 1); seed(x, h - 2); } }
    for (let y = 0; y < h; y++) { seed(0, y); seed(1, y); seed(w - 1, y); seed(w - 2, y); }
  }
  // Clics del usuario sobre el fondo ("varita mágica"): un parche de 5×5 por clic
  for (const [fx, fy] of extraSeeds) {
    const cx = Math.round(fx * (w - 1)), cy = Math.round(fy * (h - 1));
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = y * w + x;
      if (bg[i]) continue;
      bg[i] = 1; stack.push(i);
      ref[i * 3] = rgba[i * 4]; ref[i * 3 + 1] = rgba[i * 4 + 1]; ref[i * 3 + 2] = rgba[i * 4 + 2];
    }
  }
  const t2 = tol * tol;
  while (stack.length) {
    const i = stack.pop(), x = i % w, y = (i / w) | 0;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (bg[j] || grad[j] >= tol * 1.5) continue;
      if (d2(i, j) > t2) continue;
      const r = rgba[j * 4] - ref[i * 3], g = rgba[j * 4 + 1] - ref[i * 3 + 1], b = rgba[j * 4 + 2] - ref[i * 3 + 2];
      if (r * r + g * g + b * b > 4 * t2) continue;
      bg[j] = 1; stack.push(j);
      for (let c = 0; c < 3; c++) ref[j * 3 + c] = ref[i * 3 + c] * 0.92 + rgba[j * 4 + c] * 0.08;
    }
  }
  // Los bordes finos (donde el gradiente frenó el avance) entre dos zonas de fondo
  // también son fondo: se absorben si casi todos sus vecinos lo son
  const out = bg.slice();
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    if (bg[i]) continue;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) n += bg[i + dy * w + dx];
    if (n >= 6) out[i] = 1;
  }
  return out;
}

/**
 * Trozos de "figura" pegados al borde de la imagen y pequeños (franja de compresión,
 * una nube cortada, un trozo de otro personaje) pasan a ser fondo.
 */
function absorbEdgeScraps(bg, w, h, maxFrac = 0.03) {
  const seen = new Uint8Array(w * h), stack = new Int32Array(w * h);
  for (let s = 0; s < bg.length; s++) {
    if (bg[s] || seen[s]) continue;
    let top = 0, edge = false;
    const comp = [];
    stack[top++] = s; seen[s] = 1;
    while (top) {
      const i = stack[--top]; comp.push(i);
      const x = i % w, y = (i / w) | 0;
      if (x < 3 || y < 3 || x >= w - 3 || y >= h - 3) edge = true;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && !bg[j] && !seen[j]) { seen[j] = 1; stack[top++] = j; }
      }
    }
    if (edge && comp.length < w * h * maxFrac) for (const i of comp) bg[i] = 1;
  }
  return bg;
}

/**
 * Sólo la figura principal: de las zonas que no son fondo se quedan la mayor y las que
 * miden al menos un 25 % de ella (dos personajes juntos sobreviven). Textos, pies de
 * foto, firmas y restos de marco pasan a ser fondo.
 */
function keepMainFigure(bg, w, h, frac = 0.25) {
  const seen = new Uint8Array(w * h), stack = new Int32Array(w * h), comps = [];
  for (let s = 0; s < bg.length; s++) {
    if (bg[s] || seen[s]) continue;
    let top = 0;
    const comp = [];
    stack[top++] = s; seen[s] = 1;
    while (top) {
      const i = stack[--top]; comp.push(i);
      const x = i % w, y = (i / w) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && !bg[j] && !seen[j]) { seen[j] = 1; stack[top++] = j; }
      }
    }
    comps.push(comp);
  }
  if (!comps.length) return bg;
  const big = Math.max(...comps.map(c => c.length));
  for (const c of comps) if (c.length < big * frac) for (const i of c) bg[i] = 1;
  return bg;
}

/** Apertura de la figura (fondo = 1): erosiona r y vuelve a dilatar r. */
function openFigure(bg, w, h, r) {
  const dBg = distanceTransform(bg, w, h, false);          // distancia de la figura al fondo
  const core = new Uint8Array(w * h);
  for (let i = 0; i < core.length; i++) core[i] = !bg[i] && dBg[i] > r ? 1 : 0;
  const dCore = distanceTransform(core, w, h, false);      // distancia al núcleo erosionado
  const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = core[i] || dCore[i] <= r ? 0 : 1;
  return out;
}

function smoothMask(mask, w, h, r) {
  const f = new Float32Array(w * h);
  for (let i = 0; i < f.length; i++) f[i] = mask[i];
  const b = boxBlur(boxBlur(f, w, h, r), w, h, r);
  const out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = b[i] >= 0.5 ? 1 : 0;
  return out;
}

function blurRgba(rgba, w, h, r) {
  const out = new Uint8ClampedArray(rgba.length);
  for (let c = 0; c < 4; c++) {
    const ch = new Float32Array(w * h);
    for (let i = 0; i < ch.length; i++) ch[i] = rgba[i * 4 + c];
    const b = boxBlur(boxBlur(ch, w, h, r), w, h, r);
    for (let i = 0; i < ch.length; i++) out[i * 4 + c] = b[i];
  }
  return out;
}

/**
 * Prepara una imagen para la composición "figura".
 * Devuelve { gray, cls, w, h }, recortado al contenido:
 *   gray: dibujo de líneas (0 tinta, 255 papel)
 *   cls:  0 = tinta, 1 = región cerrada DENTRO de la figura (se rellena con mandalas),
 *         2 = espacio exterior (fondo; opcionalmente se decora),
 *         3 = región interior pequeña (ojos, brillos): se deja en blanco
 * opts: { mode: "lineas"|"bordes"|"colores", threshold, detail, colorTol,
 *         removeBackground, bgTol, bgFromBottom, hollow,
 *         simplify (0-1: menos detalle), keepMain (sólo la figura principal),
 *         bgSeeds: [[x, y], …] clics sobre el fondo en fracciones 0-1 de la imagen }
 */
export function processFigure(rgba, w, h, opts = {}) {
  const {
    mode = "lineas", threshold = 110, detail = 0.5, colorTol = 60,
    removeBackground = true, bgTol = 26, bgFromBottom = false, hollow = true, minRegionFrac = 0.025,
    outLong = 3000, simplify = 0.3, keepMain = true, bgSeeds = [],
  } = opts;
  const S = Math.max(0, Math.min(1, simplify));
  // Salida de 3000 px: ≈300 DPI para una figura de 25 cm (lo que exige KDP).
  // Grosor de línea pensado en la SALIDA: ~0.35 % del lado largo (≈0.7 mm en una página
  // de 20 cm), sea cual sea el tamaño de la imagen original
  const outScale = Math.max(1, outLong / Math.max(w, h));
  const lineNative = (outLong * 0.0035) / outScale;
  const lineW = lineNative >= 3 ? Math.round(lineNative / 3) : 0;
  // Un desenfoque suave borra la trama de impresión (semitonos) y el ruido JPEG;
  // simplificar lo agranda para que sólo sobrevivan las formas grandes
  const soft = blurRgba(rgba, w, h, Math.max(1, Math.round(Math.max(w, h) / 500)));

  // ---------- 1. Líneas interiores ----------
  let ink;
  if (mode === "colores") {
    ink = colorEdges(soft, w, h, colorTol * (1 + 0.5 * S));
    const g = toGray(soft, w, h);
    for (let i = 0; i < ink.length; i++) if (g[i] < threshold * 0.6) ink[i] = 1;
  } else {
    const gray = imageToLineArt(mode === "bordes" ? rgba : soft, w, h, { mode, threshold, detail, thickenPx: 0, simplify: S });
    ink = new Uint8Array(w * h);
    for (let i = 0; i < ink.length; i++) ink[i] = gray[i] === 0 ? 1 : 0;
  }
  if (hollow && mode !== "bordes") ink = hollowSolids(ink, w, h, Math.max(1, lineNative));
  // El filo de la imagen suele traer una franja oscura de compresión: no es dibujo
  const edge = Math.max(2, lineW);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x < edge || y < edge || x >= w - edge || y >= h - edge) ink[y * w + x] = 0;
  }
  // Trazos cortos fuera: pelo, grano, letras. Simplificar sube el mínimo hasta ×9
  ink = removeSpecks(ink, w, h, Math.max(6, Math.round((w * h) / 4000 * (1 + 8 * S))));

  // ---------- 2. Fondo, figura principal y silueta ----------
  let bg = null;
  if (removeBackground || bgSeeds.length) {
    // Siempre sobre la imagen sin desenfocar: el desenfoque abre rampas por donde el
    // fondo se cuela dentro de la figura (pasaba con el pelaje oscuro del gato)
    bg = removeBackground ? backgroundMask(rgba, w, h, bgTol, bgFromBottom) : new Uint8Array(w * h);
    if (removeBackground) {
      // Segunda pasada para fondos con textura (marcos grabados, papel, trama): muy
      // suavizada para que la textura se vuelva un tono liso, pero con tolerancia
      // estricta para no colarse por las rampas del contorno del personaje
      const flat = blurRgba(rgba, w, h, Math.max(2, Math.round(Math.max(w, h) / 160)));
      const textured = backgroundMask(flat, w, h, bgTol * 0.5, bgFromBottom);
      for (let i = 0; i < bg.length; i++) bg[i] |= textured[i];
    }
    if (bgSeeds.length) {
      const fromClicks = backgroundMask(rgba, w, h, bgTol, false, bgSeeds, false);
      for (let i = 0; i < bg.length; i++) bg[i] |= fromClicks[i];
    }
    bg = absorbEdgeScraps(bg, w, h);
    // Apertura morfológica: franjas delgadas pegadas a la figura (el filo de una foto,
    // un trozo de marco) desaparecen; las formas gruesas sobreviven intactas
    const open = Math.round((Math.max(w, h) / 100) * S);
    if (open >= 1) bg = openFigure(bg, w, h, open);
    if (keepMain) bg = keepMainFigure(bg, w, h);
    // Silueta suave: sin bigotes, grano ni dientes de sierra en el contorno
    const r = Math.round((Math.max(w, h) / 200) * S);
    if (r >= 1) bg = smoothMask(bg, w, h, r);
    if (keepMain) bg = keepMainFigure(bg, w, h);
    // Nada de tinta en el fondo; la silueta se traza siempre, con el grosor de línea
    // final (si no, en imágenes pequeñas el contorno exterior sale tenue)
    const dBg = distanceTransform(bg, w, h, false);
    const sil = Math.max(1, lineNative * 0.9);
    for (let i = 0; i < bg.length; i++) {
      if (bg[i]) ink[i] = 0;
      else if (dBg[i] <= sil) ink[i] = 1;
    }
  }
  ink = removeSpecks(ink, w, h, 6);
  ink = dilate(ink, w, h, lineW);

  // Regiones de papel: cerradas (dentro) o conectadas con el borde / el fondo (fuera)
  const cls = new Uint8Array(w * h);
  const regions = [];
  const seen = new Uint8Array(w * h), stack = new Int32Array(w * h);
  for (let s = 0; s < ink.length; s++) {
    if (ink[s] || seen[s]) continue;
    let top = 0, outside = false;
    const comp = [];
    stack[top++] = s; seen[s] = 1;
    while (top) {
      const i = stack[--top]; comp.push(i);
      const x = i % w, y = (i / w) | 0;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || (bg && bg[i])) outside = true;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && !ink[j] && !seen[j]) { seen[j] = 1; stack[top++] = j; }
      }
    }
    // Regiones interiores diminutas (ojos, brillos) se quedan en blanco: 3 = no rellenar
    for (const i of comp) cls[i] = outside ? 2 : 1;
    if (!outside) regions.push(comp);
  }
  const insideArea = regions.reduce((a, c) => a + c.length, 0);
  for (const comp of regions) if (comp.length < insideArea * minRegionFrac) for (const i of comp) cls[i] = 3;

  // Recorte al contenido (tinta o interior) con un pequeño margen
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (cls[y * w + x] === 2) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  if (x1 < 0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
  const pad = Math.round(Math.max(w, h) * 0.01);
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  // Salida ampliada para imprenta: la imagen se procesa a su tamaño real (ampliarla antes
  // crea rampas suaves por donde el fondo se cuela) y sólo el resultado se agranda.
  // Interpolación bilineal de la tinta + umbral suave: bordes limpios, sin escalones.
  const sc = Math.max(1, outLong / Math.max(cw, ch));
  const ow = Math.round(cw * sc), oh = Math.round(ch * sc);
  const gray = new Uint8Array(ow * oh), cc = new Uint8Array(ow * oh);
  // Suavizar la máscara antes de ampliar redondea los escalones de los píxeles
  const inkF = new Float32Array(w * h);
  for (let i = 0; i < inkF.length; i++) inkF[i] = ink[i];
  const smooth = sc > 1.5 ? boxBlur(boxBlur(inkF, w, h, 1), w, h, 1) : inkF;
  // La rampa se estrecha con la ampliación: ~1 px de antialias en la salida, no un halo gris
  const lo = sc > 1.5 ? 0.22 : 0.35, span = sc > 1.5 ? 0.05 : 0.3;
  const inkAt = (x, y) => smooth[(Math.min(ch - 1, Math.max(0, y)) + y0) * w + Math.min(cw - 1, Math.max(0, x)) + x0];
  for (let y = 0; y < oh; y++) {
    const sy = (y + 0.5) / sc - 0.5, iy = Math.floor(sy), fy = sy - iy;
    for (let x = 0; x < ow; x++) {
      const sx = (x + 0.5) / sc - 0.5, ix = Math.floor(sx), fx = sx - ix;
      const v = (inkAt(ix, iy) * (1 - fx) + inkAt(ix + 1, iy) * fx) * (1 - fy) + (inkAt(ix, iy + 1) * (1 - fx) + inkAt(ix + 1, iy + 1) * fx) * fy;
      // Umbral con rampa corta: antialias de ~1 px
      const t = Math.max(0, Math.min(1, (v - lo) / span));
      gray[y * ow + x] = Math.round(255 * (1 - t));
      const nx = Math.min(cw - 1, Math.round(sx)), ny = Math.min(ch - 1, Math.round(sy));
      cc[y * ow + x] = cls[(Math.max(0, ny) + y0) * w + Math.max(0, nx) + x0];
    }
  }
  return { gray, cls: cc, w: ow, h: oh };
}
