// js/core/figureChecks.js
// Lista de verificación de una figura antes de usarla en el libro. Mide la figura ya
// procesada (cls: 0 tinta, 1 interior rellenable, 2 fondo, 3 interior pequeño) y la
// compara con lo que exige cada uso. Si un requisito falla, sugiere la herramienta
// (de la app o externa) que lo arregla. Funciones puras: sin DOM.

// Herramientas alternativas, por problema. Gratuitas o con uso gratuito.
export const TOOLS = {
  upscale: [
    { name: "Upscayl", url: "https://upscayl.org", note: "amplía imágenes pequeñas con IA, gratis y sin conexión" },
  ],
  background: [
    { name: "rembg", url: "https://github.com/danielgatis/rembg", note: "quita fondos en tu computadora (línea de comandos)" },
    { name: "Photopea", url: "https://www.photopea.com", note: "editor en línea: varita mágica y goma" },
  ],
  text: [
    { name: "Photopea", url: "https://www.photopea.com", note: "borra textos y firmas con la goma o el pincel blanco" },
    { name: "GIMP", url: "https://www.gimp.org", note: "editor gratuito de escritorio" },
  ],
  detail: [
    { name: "sketch2lineart", url: "https://huggingface.co/spaces/tori29umai/sketch2lineart", note: "limpia el dibujo a líneas (IA)" },
    { name: "Anime2Sketch", url: "https://github.com/Mukosame/Anime2Sketch", note: "extrae líneas de ilustraciones (IA)" },
    { name: "Fotor", url: "https://www.fotor.com/features/photo-to-coloring-page/", note: "foto → página para colorear (uso gratuito limitado)" },
  ],
  closed: [
    { name: "Inkscape", url: "https://inkscape.org", note: "Trazar mapa de bits y cerrar contornos a mano" },
  ],
  rights: [
    { name: "Smithsonian Open Access", url: "https://www.si.edu/openaccess", note: "imágenes CC0" },
    { name: "Rawpixel (dominio público)", url: "https://www.rawpixel.com/public-domain", note: "ilustraciones CC0" },
  ],
};

/** Métricas de la figura (se calculan una vez y se guardan en fig.metrics). */
export function figureMetrics(fig) {
  if (fig.metrics) return fig.metrics;
  const { cls, w, h } = fig;
  let ink = 0, inside = 0, small = 0, outside = 0;
  for (const c of cls) { if (c === 0) ink++; else if (c === 1) inside++; else if (c === 2) outside++; else small++; }
  const figureArea = Math.max(1, ink + inside + small);
  // ¿Queda un rectángulo de fondo o un marco? Una silueta real (animal, persona) llena
  // ~40–75 % de su caja; un rectángulo de fondo la llena casi entera
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (cls[y * w + x] === 2) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const boxFill = x1 < 0 ? 1 : figureArea / ((x1 - x0 + 1) * (y1 - y0 + 1));
  // Trazos sueltos (letras, motas): componentes de tinta pequeños
  const seen = new Uint8Array(w * h), stack = new Int32Array(w * h);
  const sizes = [];
  for (let s = 0; s < cls.length; s++) {
    if (cls[s] !== 0 || seen[s]) continue;
    let top = 0, n = 0;
    stack[top++] = s; seen[s] = 1;
    while (top) {
      const i = stack[--top]; n++;
      const x = i % w, y = (i / w) | 0;
      // 8 vecinos: una línea diagonal de 1 px sigue siendo UN trazo
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (cls[j] === 0 && !seen[j]) { seen[j] = 1; stack[top++] = j; }
      }
    }
    sizes.push(n);
  }
  const fragments = sizes.filter(n => n < ink * 0.004).length;
  fig.metrics = {
    srcLong: fig.srcLong ?? Math.max(w, h),
    inkFrac: ink / figureArea,           // cuánto de la figura es línea (detalle)
    insideFrac: inside / figureArea,     // cuánto se puede rellenar con mandalas
    boxFill,
    fragments,
    aspect: w / h,
  };
  return fig.metrics;
}

/**
 * Comprueba la figura para un uso ("figura" | "anillos" | "medallon").
 * meta: { rightsConfirmed, source }
 * Devuelve { ready, checks: [{ ok, level: "ok"|"warn"|"error", msg, fix, tools }] }
 */
export function checkFigure(fig, use, meta = {}) {
  const m = figureMetrics(fig);
  const checks = [];
  const add = (level, msg, fix = "", tools = []) => checks.push({ ok: level === "ok", level, msg, fix, tools });

  // 1. Resolución del original
  if (m.srcLong >= 800) add("ok", `Resolución suficiente (${m.srcLong} px).`);
  else if (m.srcLong >= 350) add("warn", `Resolución baja (${m.srcLong} px): las líneas pueden verse irregulares.`, "Busca una versión más grande o amplíala.", TOOLS.upscale);
  else add("error", `Resolución muy baja (${m.srcLong} px; mínimo 350, ideal 800+).`, "Amplíala antes de procesar.", TOOLS.upscale);

  // 2. Sin fondo
  if (m.boxFill <= 0.78) add("ok", "Fondo eliminado.");
  else if (m.boxFill <= 0.9) add("warn", "Parte del fondo o del marco sigue pegada a la figura.", "Haz clic sobre el fondo (puntos rojos) o recorta el marco.", TOOLS.background);
  else add("error", "Queda fondo o un marco alrededor de la figura.", "Haz clic sobre el fondo, recorta los bordes o quítalo con otra herramienta.", TOOLS.background);

  // 3. Sin texto ni restos sueltos
  if (m.fragments <= 3) add("ok", "Sin textos ni restos sueltos.");
  else if (m.fragments <= 10) add("warn", `${m.fragments} trazos sueltos (¿letras, firmas, motas?).`, "Activa «Sólo la figura principal», sube «Simplificar» o recorta el texto.", TOOLS.text);
  else add("error", `${m.fragments} trazos sueltos: probablemente hay texto o ruido.`, "Recorta el texto y sube «Simplificar».", TOOLS.text);

  // 4. Pocos detalles (cuánto de la figura es línea)
  const inkMax = use === "figura" ? 0.3 : 0.4;
  if (m.inkFrac <= inkMax * 0.7) add("ok", "Nivel de detalle adecuado para colorear.");
  else if (m.inkFrac <= inkMax) add("warn", `Bastante detalle (${Math.round(m.inkFrac * 100)} % de la figura es línea).`, "Sube «Simplificar».", TOOLS.detail);
  else add("error", `Demasiado detalle (${Math.round(m.inkFrac * 100)} % de la figura es línea).`, "Sube «Simplificar» o usa el tipo «Dibujo / grabado».", TOOLS.detail);

  // 5. Requisitos propios de cada uso
  if (use === "figura") {
    if (m.insideFrac >= 0.3) add("ok", `Interior rellenable: ${Math.round(m.insideFrac * 100)} %.`);
    else if (m.insideFrac >= 0.15) add("warn", `Poco interior cerrado (${Math.round(m.insideFrac * 100)} %): el relleno quedará escaso.`, "Prueba otro tipo de imagen, o úsala en «Anillos».", TOOLS.closed);
    else add("error", `Casi sin regiones cerradas (${Math.round(m.insideFrac * 100)} %): no se puede rellenar.`, "Úsala en «Anillos» o «Medallón», o cierra los contornos.", TOOLS.closed);
  } else if (use === "anillos") {
    if (m.aspect >= 0.4 && m.aspect <= 1.6) add("ok", "Proporción adecuada para repetir en anillo.");
    else add("warn", `Figura muy ${m.aspect < 0.4 ? "alta" : "ancha"}: las copias saldrán pequeñas.`, "Recórtala más cerca de la figura.");
  } else if (use === "medallon") {
    if (m.aspect >= 0.6 && m.aspect <= 1.4) add("ok", "Proporción adecuada para el medallón.");
    else add("warn", "Figura alargada: dentro del círculo quedará pequeña.", "Recórtala para que sea más cuadrada (p. ej. sólo la cabeza).");
  }

  // 6. Derechos de uso
  if (meta.rightsConfirmed && (meta.source || "").trim()) add("ok", "Derechos confirmados y fuente registrada.");
  else add("error", "Falta confirmar que es de dominio público o propia, y anotar su fuente.", "Marca la casilla y escribe la fuente (URL o libro).", TOOLS.rights);

  const ready = use !== "ninguno" && !checks.some(c => c.level === "error");
  return { ready, checks };
}

const esc = (t) => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const ICON = { ok: "✅", warn: "⚠️", error: "❌" };
export const USE_LABELS = { ninguno: "No usar", figura: "Figura rellena", anillos: "Anillos", medallon: "Medallón" };

/** Resultado de checkFigure → HTML (lista con arreglos y herramientas alternativas). */
export function checklistHtml(result, use) {
  if (use === "ninguno") return `<p class="chk-head">Elige un uso para ver si la imagen está lista.</p>`;
  const head = result.ready
    ? (result.checks.some(c => c.level === "warn") ? `⚠️ Lista para «${USE_LABELS[use]}», con avisos` : `✅ Lista para «${USE_LABELS[use]}»`)
    : `❌ No está lista para «${USE_LABELS[use]}»: no entrará al libro hasta corregir lo marcado`;
  const items = result.checks.map(c => {
    let extra = "";
    if (!c.ok) {
      const tools = c.tools.map(t => `<a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.name)}</a> <span>(${esc(t.note)})</span>`).join(" · ");
      extra = `<div class="chk-fix">${esc(c.fix)}${tools ? `<br>Alternativas: ${tools}` : ""}</div>`;
    }
    return `<li class="chk-${c.level}">${ICON[c.level]} ${esc(c.msg)}${extra}</li>`;
  }).join("");
  return `<p class="chk-head">${head}</p><ul class="chk">${items}</ul>`;
}

/** Guía de requisitos (misma en la app y en preprocesar.html). */
export const REQUIREMENTS_HTML = `
<ul class="req">
  <li><b>Sin fondo:</b> sólo la figura. Haz clic sobre el fondo o recórtalo.</li>
  <li><b>Sin texto:</b> nada de títulos, pies de foto ni firmas (recorta o usa «Sólo la figura principal»).</li>
  <li><b>Pocos detalles:</b> silueta y rasgos grandes; el pelo, el grano y la trama se quitan con «Simplificar».</li>
  <li><b>Resolución:</b> 800 px o más en el lado largo (mínimo 350).</li>
  <li><b>Figura rellena:</b> al menos 30 % de su interior en regiones cerradas.</li>
  <li><b>Derechos:</b> dominio público o tuya, con la fuente anotada (va al registro CSV del libro).</li>
</ul>
<p class="req-tools">Herramientas alternativas si algo no sale bien aquí:
  ${[...TOOLS.background, ...TOOLS.upscale, ...TOOLS.detail.slice(0, 2), TOOLS.closed[0]]
    .filter((t, i, a) => a.findIndex(x => x.name === t.name) === i)
    .map(t => `<a href="${t.url}" target="_blank" rel="noopener">${t.name}</a> (${t.note})`).join(" · ")}.
  Imágenes de dominio público: ${TOOLS.rights.map(t => `<a href="${t.url}" target="_blank" rel="noopener">${t.name}</a>`).join(" · ")}.
</p>`;

export const CHECKLIST_CSS = `
.chk-head { margin: 4px 0; font-size: .82rem; font-weight: 600; }
.chk { list-style: none; padding: 0; margin: 0; font-size: .78rem; display: grid; gap: 3px; }
.chk-fix { margin: 2px 0 0 1.4em; opacity: .85; }
.chk-fix span { opacity: .75; }
.req { margin: 6px 0; padding-left: 1.2em; font-size: .85rem; display: grid; gap: 2px; }
.req-tools { font-size: .8rem; margin: 6px 0 0; }`;
