import { getStateFromURL, setStateToURL, randomSeed32 } from "./core/urlState.js";
import { createDoc } from "./core/svgDoc.js";
import { renderDocToSvgString } from "./core/svgRender.js";
import { downloadTextFile, downloadPng, downloadPdf, downloadBatchPdf, downloadBookPdf, bookPageCount, flattenSvgElement, svgStringToImageData } from "./core/export.js";
import { mulberry32, pick, rFloat, rInt } from "./core/prng.js";
import { TAOISTA_DATASET } from "../dataset_taoista.js";
import { generateMandalaLayers } from "./generators/mandalaLayers.js";
import { generateMandalaRadial } from "./generators/mandalaRadial.js";
import { generateMandalaClassic } from "./generators/mandalaClassic.js";
import { StateHistory } from "./core/history.js";
import { saveToFavorites, getFavorites, deleteFavorite } from "./core/storage.js";
import { ImageProcessor } from "./core/imageProcessor.js";
import { PathBuilder } from "./core/pathBuilder.js";
import { planBook, bestSellerProfile, pageStrokeMm, addSpecialPages, specialPageCount, muralTilePositions, GROWTH_STAGES, BOOK_STYLES, BESTSELLER_STYLE_W, chapterLayout, insertChapterDividers, applyPageOverride } from "./core/bookPlan.js";
import { curateBook, attemptChoice, twinTargets as curatorTwinTargets, WEAK_SCORE, CURATE_TRIES } from "./core/bookCurator.js";
import { withSpecialPages, specialLabel } from "./generators/specialPages.js";
import { MYSTERY_SHAPES } from "./generators/mysteryMandala.js";
import { escapeXml } from "./core/svgText.js";
import { kdpSafeMarginMm, kdpChecklist, bookLayout } from "./core/kdp.js";
import { loadImageFile, figureFromImage, withStamp } from "./core/figureImport.js";
import { fitOf } from "./generators/pageComposer.js";
import { packFigures, unpackFigures } from "./core/figurePack.js";
import { checkFigure, checklistHtml, REQUIREMENTS_HTML, CHECKLIST_CSS } from "./core/figureChecks.js";
import { measureSvg, commercialScore } from "./core/commercialMetrics.js";
import { pageFingerprint, similarPairs } from "./core/variety.js";

const historyMan = new StateHistory();
const imgProc = new ImageProcessor();
let currentImage = null;
let currentImagePoints = [];
// Imágenes del usuario ya procesadas: [{ name, img (original o null si vino de un paquete),
// fig: { href, cls, w, h } }]. La activa es la que se ve en la vista previa.
let userFigures = [];
let activeFigure = 0;
let listenersBound = false;

const stage = document.getElementById("stage");
const presetEl = document.getElementById("preset");
const petalsEl = document.getElementById("petals");

const complexityEl = document.getElementById("complexity");
const organicEl = document.getElementById("organic");

const seedInputEl = document.getElementById("seed");
const structurePresetEl = document.getElementById("structurePreset");

const strokeWidthEl = document.getElementById("strokeWidth");
const framesEl = document.getElementById("frames");
const pageBorderEl = document.getElementById("pageBorder");

// Phase 5: Coloring Book Controls
const spacingEl = document.getElementById("spacing");
const densityFactorEl = document.getElementById("densityFactor");
const minCellAreaEl = document.getElementById("minCellArea");
const detailSimplificationEl = document.getElementById("detailSimplification");

// New coloring book features
const coloringPresetEl = document.getElementById("coloringPreset");
const outlineModeEl = document.getElementById("outlineMode");

const styleModeEl = document.getElementById("styleMode");
const layer1IntensityEl = document.getElementById("layer1Intensity");
const layer2IntensityEl = document.getElementById("layer2Intensity");
const layer3IntensityEl = document.getElementById("layer3Intensity");
const layer4IntensityEl = document.getElementById("layer4Intensity");
const layer5IntensityEl = document.getElementById("layer5Intensity");
const layer6IntensityEl = document.getElementById("layer6Intensity");
const layer7IntensityEl = document.getElementById("layer7Intensity");
const layer8IntensityEl = document.getElementById("layer8Intensity");

const generatorTypeEl = document.getElementById("generatorType");
const spiroEnabledEl = document.getElementById("spiroEnabled");
const layersAccordionItem = document.getElementById("layersAccordionItem");
const imageAccordionItem = document.getElementById("imageAccordionItem");
const imageSpinner = document.getElementById("imageSpinner");

const progressDialog = document.getElementById("progressDialog");
const progressStatus = document.getElementById("progressStatus");
const progressBar = document.getElementById("progressBar");

const previewQualityEl = document.getElementById("previewQuality");
const layoutModeEl = document.getElementById("layoutMode");
const pngDpiEl = document.getElementById("pngDpi");
const layerPresetEl = document.getElementById("layerPreset");

const regenBtn = document.getElementById("regen");
const downloadBtn = document.getElementById("download");
const downloadPngBtn = document.getElementById("downloadPng");
const downloadPdfBtn = document.getElementById("downloadPdf");
const shareBtn = document.getElementById("share");

const undoBtn = document.getElementById("undo");
const redoBtn = document.getElementById("redo");
const saveFavBtn = document.getElementById("saveFav");
const openGalleryBtn = document.getElementById("openGallery");
const galleryDrawer = document.getElementById("galleryDrawer");
const galleryContainer = document.getElementById("galleryContainer");
const recentContainer = document.getElementById("recentContainer");
const closeGalleryBtn = document.getElementById("closeGallery");

const seedText = document.getElementById("seedText");
const pathsText = document.getElementById("pathsText");
const commercialScoreEl = document.getElementById("commercialScore");

const kaleidoscopeEl = document.getElementById("kaleidoscope");
const texturesEl = document.getElementById("textures");

const imageThresholdEl = document.getElementById("imageThreshold");
const imageZoomEl = document.getElementById("imageZoom");
const imageScaleEl = document.getElementById("imageScale");
const imageOffsetXEl = document.getElementById("imageOffsetX");
const imageOffsetYEl = document.getElementById("imageOffsetY");
const imageIntensityEl = document.getElementById("imageIntensity");
const imageMirrorEl = document.getElementById("imageMirror");
const showGuidesEl = document.getElementById("showGuides");
const imageUploadEl = document.getElementById("imageUpload");
const compositionEl = document.getElementById("composition");
const frameStyleEl = document.getElementById("frameStyle");
const centerArtEl = document.getElementById("centerArt");
const centerArtScaleEl = document.getElementById("centerArtScale");
const centerArtAccordionItem = document.getElementById("centerArtAccordionItem");
const uploadBtn = document.getElementById("uploadBtn");

// Motor "classic": gramática de libro comercial (bandas llenas, pétalos en capas)
function getGeneratorFn(type) {
  if (type === "radial") return generateMandalaRadial;
  if (type === "layers") return generateMandalaLayers;
  return generateMandalaClassic;
}

const DEFAULTS = {
  generatorType: "classic",
  spiroEnabled: false,
  preset: "A4",
  petals: 12,
  complexity: 130,
  organic: 0.25,
  strokeWidth: 0.55,
  frames: true,
  pageBorder: true,
  kaleidoscope: true,
  textures: true,
  styleMode: "sashiko",
  layer1Intensity: 0.85,
  layer2Intensity: 0.75,
  layer3Intensity: 0.8,
  layer4Intensity: 0.7,
  layer5Intensity: 0.55,
  layer6Intensity: 0.8,
  layer7Intensity: 0.65,
  layer8Intensity: 0.35,
  seed: randomSeed32() >>> 0,
  structurePreset: "custom",
  imageThreshold: 128,
  imageZoom: 1.0,
  imageScale: 1.0,
  imageOffsetX: 0,
  imageOffsetY: 0,
  imageIntensity: 1.0,
  imageMirror: true,
  showGuides: false,
  previewQuality: "high",
  layoutMode: "single",
  pngDpi: 300,
  layerPreset: "custom",
  // Phase 5: Coloring Book Controls
  spacing: 0.3,
  densityFactor: 0.7,
  minCellArea: 3.0,
  detailSimplification: 0.5,
  // New coloring book features
  outlineMode: false,
  coloringPreset: "adulto",
  // Composición de página y medallón (motor clásico)
  composition: "centro",
  frameStyle: "redondeado",
  centerArt: "ninguno",
  centerArtScale: 0.42,
  figureDensity: 0.3,
  figureFillInside: true,
  figureFillOutside: true,
};

const STRUCTURE_PRESETS = {
  custom: null,
  simple: {
    petals: 10, complexity: 65, organic: 0.15, strokeWidth: 0.9,
    styleMode: "sashiko", layer1Intensity: 0.65, layer2Intensity: 0.55, layer3Intensity: 0.4,
    layer4Intensity: 0.5, layer5Intensity: 0.25, layer6Intensity: 0.55, layer7Intensity: 0.3, layer8Intensity: 0.08,
    frames: true, pageBorder: true,
  },
  balanced: {
    petals: 14, complexity: 130, organic: 0.25, strokeWidth: 0.55,
    styleMode: "sashiko", layer1Intensity: 0.85, layer2Intensity: 0.75, layer3Intensity: 0.8,
    layer4Intensity: 0.7, layer5Intensity: 0.55, layer6Intensity: 0.8, layer7Intensity: 0.65, layer8Intensity: 0.3,
    frames: true, pageBorder: true,
  },
  detailed: {
    petals: 24, complexity: 240, organic: 0.3, strokeWidth: 0.4,
    styleMode: "sashiko", layer1Intensity: 0.95, layer2Intensity: 0.95, layer3Intensity: 0.95,
    layer4Intensity: 0.9, layer5Intensity: 0.85, layer6Intensity: 0.95, layer7Intensity: 0.85, layer8Intensity: 0.65,
    frames: true, pageBorder: true,
  },
  botanical: {
    petals: 14, complexity: 150, organic: 0.8, strokeWidth: 0.55,
    styleMode: "floral", layer1Intensity: 0.8, layer2Intensity: 0.8, layer3Intensity: 0.9,
    layer4Intensity: 0.6, layer5Intensity: 0.5, layer6Intensity: 0.75, layer7Intensity: 0.95, layer8Intensity: 0.35,
    frames: true, pageBorder: true,
  },
  geometric: {
    petals: 18, complexity: 175, organic: 0.05, strokeWidth: 0.5,
    styleMode: "geometric", layer1Intensity: 0.9, layer2Intensity: 0.85, layer3Intensity: 0.8,
    layer4Intensity: 0.9, layer5Intensity: 0.65, layer6Intensity: 0.85, layer7Intensity: 0.0, layer8Intensity: 0.25,
    frames: true, pageBorder: true,
  },
  islamico: {
    petals: 8, complexity: 160, organic: 0.0, strokeWidth: 0.5,
    styleMode: "islamico", layer1Intensity: 0.9, layer2Intensity: 0.9, layer3Intensity: 0.95,
    layer4Intensity: 0.85, layer5Intensity: 0.6, layer6Intensity: 0.9, layer7Intensity: 0.75, layer8Intensity: 0.5,
    frames: true, pageBorder: true,
  },
  azteca: {
    petals: 20, complexity: 180, organic: 0.05, strokeWidth: 0.55,
    styleMode: "azteca", layer1Intensity: 0.95, layer2Intensity: 0.8, layer3Intensity: 0.9,
    layer4Intensity: 0.9, layer5Intensity: 0.75, layer6Intensity: 0.9, layer7Intensity: 0.8, layer8Intensity: 0.55,
    frames: true, pageBorder: true,
  },
  yantra: {
    petals: 9, complexity: 140, organic: 0.1, strokeWidth: 0.55,
    styleMode: "yantra", layer1Intensity: 0.95, layer2Intensity: 0.9, layer3Intensity: 0.9,
    layer4Intensity: 0.85, layer5Intensity: 0.55, layer6Intensity: 0.8, layer7Intensity: 0.85, layer8Intensity: 0.4,
    frames: true, pageBorder: true,
  },
  celtico: {
    petals: 12, complexity: 135, organic: 0.55, strokeWidth: 0.55,
    styleMode: "celtico", layer1Intensity: 0.8, layer2Intensity: 0.85, layer3Intensity: 0.9,
    layer4Intensity: 0.85, layer5Intensity: 0.55, layer6Intensity: 0.8, layer7Intensity: 0.75, layer8Intensity: 0.4,
    frames: true, pageBorder: true,
  },
};

// Coloring Book Presets - Pre-configured difficulty levels
const COLORING_PRESETS = {
  ninos: {
    // Niños pequeños (5-8 años) - Muy simple
    // Motor clásico en modo contornos: pocas bandas y formas grandes.
    // En "layers" la intensidad controla el TAMAÑO, así que se mantiene alta
    // y solo se apagan las capas de detalle fino (L5 ranuras, L8 texturas).
    generatorType: "classic",
    complexity: 40,
    organic: 0.1,
    strokeWidth: 0.8,
    spacing: 0.6,
    densityFactor: 0.35,
    minCellArea: 6.0,
    detailSimplification: 0.85,
    textures: false,
    frames: false,
    pageBorder: true,
    layer1Intensity: 0.7,
    layer2Intensity: 0.9,
    layer3Intensity: 0.8,
    layer4Intensity: 0.8,
    layer5Intensity: 0,
    layer6Intensity: 0.85,
    layer7Intensity: 0.6,
    layer8Intensity: 0,
    outlineMode: true,
  },
  ninos_grande: {
    // Niños grandes (9-12 años) - Simple
    generatorType: "classic",
    complexity: 70,
    organic: 0.15,
    strokeWidth: 0.7,
    spacing: 0.45,
    densityFactor: 0.5,
    minCellArea: 4.5,
    detailSimplification: 0.7,
    textures: false,
    frames: true,
    pageBorder: true,
    layer1Intensity: 0.8,
    layer2Intensity: 0.85,
    layer3Intensity: 0.85,
    layer4Intensity: 0.8,
    layer5Intensity: 0.35,
    layer6Intensity: 0.85,
    layer7Intensity: 0.7,
    layer8Intensity: 0,
    outlineMode: true,
  },
  adulto: {
    // Adulto - Balanceado (default)
    complexity: 110,
    organic: 0.2,
    strokeWidth: 0.8,
    spacing: 0.4,
    densityFactor: 0.65,
    minCellArea: 5.0,
    detailSimplification: 0.6,
    textures: false,
    frames: true,
    pageBorder: true,
    layer1Intensity: 0.85,
    layer2Intensity: 0.75,
    layer3Intensity: 0.8,
    layer4Intensity: 0.7,
    layer5Intensity: 0.55,
    layer6Intensity: 0.8,
    layer7Intensity: 0.65,
    layer8Intensity: 0.35,
    outlineMode: false,
  },
  bestseller: {
    // Lo que más vende en Amazon KDP: trazo grueso, celdas grandes y sin texturas finas
    generatorType: "classic",
    complexity: 95,
    organic: 0.2,
    strokeWidth: 0.9,
    spacing: 0.45,
    densityFactor: 0.6,
    minCellArea: 6.0,
    detailSimplification: 0.65,
    textures: false,
    frames: true,
    pageBorder: true,
    layer1Intensity: 0.85,
    layer2Intensity: 0.85,
    layer3Intensity: 0.8,
    layer4Intensity: 0.75,
    layer5Intensity: 0.2,
    layer6Intensity: 0.85,
    layer7Intensity: 0.6,
    layer8Intensity: 0,
    outlineMode: false,
  },
  letra_grande: {
    // Adulto · Trazo grueso («large print»): el segmento que más se vende en Amazon.
    // Diseños de detalle moderado con línea de 1 mm, celdas amplias y sin texturas
    // (las texturas finas son justo lo que empasta una página de trazo grueso).
    // Sigue siendo adulto: más bandas y simetría que el nivel infantil.
    generatorType: "classic",
    complexity: 85,
    organic: 0.2,
    strokeWidth: 1.1,
    spacing: 0.5,
    densityFactor: 0.5,
    minCellArea: 7.0,
    detailSimplification: 0.75,
    textures: false,
    frames: true,
    pageBorder: true,
    layer1Intensity: 0.85,
    layer2Intensity: 0.85,
    layer3Intensity: 0.85,
    layer4Intensity: 0.8,
    layer5Intensity: 0.3,
    layer6Intensity: 0.85,
    layer7Intensity: 0.65,
    layer8Intensity: 0,
    outlineMode: false,
  },
  experto: {
    // Experto - Detallado
    complexity: 220,
    organic: 0.3,
    strokeWidth: 0.4,
    spacing: 0.15,
    densityFactor: 1.0,
    minCellArea: 2.0,
    detailSimplification: 0.2,
    textures: true,
    frames: true,
    pageBorder: true,
    layer1Intensity: 0.95,
    layer2Intensity: 0.9,
    layer3Intensity: 0.95,
    layer4Intensity: 0.9,
    layer5Intensity: 0.8,
    layer6Intensity: 0.9,
    layer7Intensity: 0.85,
    layer8Intensity: 0.6,
    outlineMode: false,
  },
  zen: {
    // Zen - Minimalista
    generatorType: "classic",
    complexity: 50,
    organic: 0.2,
    strokeWidth: 0.9,
    spacing: 0.7,
    densityFactor: 0.3,
    minCellArea: 7.0,
    detailSimplification: 0.9,
    textures: false,
    frames: false,
    pageBorder: false,
    layer1Intensity: 0.4,
    layer2Intensity: 0.25,
    layer3Intensity: 0.15,
    layer4Intensity: 0.25,
    layer5Intensity: 0.1,
    layer6Intensity: 0.2,
    layer7Intensity: 0.1,
    layer8Intensity: 0.05,
    outlineMode: true,
  },
};

const recentSeeds = [];

// El selector «Nivel de dificultad» arranca en «Adulto»: los valores iniciales deben ser
// los de ese nivel. Antes se partía de trazo 0,55 mm y celda mínima 3 mm², y el nivel
// sólo se aplicaba al cambiarlo, así que un libro nuevo salía con línea fina sin avisar.
Object.assign(DEFAULTS, COLORING_PRESETS[DEFAULTS.coloringPreset]);
const state = getStateFromURL(DEFAULTS);

if (typeof state.frames === "string") state.frames = state.frames === "true";
if (typeof state.pageBorder === "string") state.pageBorder = state.pageBorder === "true";
if (typeof state.kaleidoscope === "string") state.kaleidoscope = state.kaleidoscope === "true";
if (typeof state.textures === "string") state.textures = state.textures === "true";
if (typeof state.spiroEnabled === "string") state.spiroEnabled = state.spiroEnabled === "true";
if (typeof state.outlineMode === "string") state.outlineMode = state.outlineMode === "true";
if (typeof state.pngDpi === "string") state.pngDpi = parseInt(state.pngDpi, 10);
if (!state.pngDpi) state.pngDpi = 300;
if (!state.previewQuality) state.previewQuality = "high";
if (!state.layoutMode) state.layoutMode = "single";
if (!state.layerPreset) state.layerPreset = "custom";
if (!state.generatorType) state.generatorType = "classic";
if (!state.structurePreset || !STRUCTURE_PRESETS[state.structurePreset]) state.structurePreset = "custom";
if (!state.coloringPreset || !COLORING_PRESETS[state.coloringPreset]) state.coloringPreset = "adulto";

if (state.styleMode === "hashiko") state.styleMode = "sashiko";

if (!stage || !presetEl || !petalsEl || !complexityEl || !organicEl || !seedInputEl || !structurePresetEl) {
  throw new Error("Faltan elementos esenciales de la UI. Verifica que el HTML esté completo.");
}

function clampInt(v, a, b) {
  return Math.max(a, Math.min(b, v | 0));
}

function clampFloat(v, a, b) {
  return Math.max(a, Math.min(b, parseFloat(v) || 0));
}


function applyStructurePreset(presetKey) {
  const preset = STRUCTURE_PRESETS[presetKey];
  if (!preset) return false;

  Object.entries(preset).forEach(([key, value]) => {
    state[key] = value;
  });

  state.structurePreset = presetKey;
  return true;
}

// "Densidad de Patrones" escala la complejidad; 0.7 (valor por defecto) = sin cambio
function densityScale(s) {
  const d = Number.isFinite(s.densityFactor) ? s.densityFactor : 0.7;
  return Math.min(1.6, Math.max(0.3, d / 0.7));
}

function buildOpts(s) {
  return {
    seed: s.seed,
    petals: s.petals,
    complexity: Math.max(20, Math.round(s.complexity * densityScale(s))),
    strokeWidthMm: s.strokeWidth,
    organicLevel: s.organic,
    includeFrames: s.frames,
    pageBorder: s.pageBorder,
    kaleidoscope: s.kaleidoscope,
    textures: s.textures && !s.outlineMode, // Disable textures in outline mode
    styleMode: s.styleMode,
    layer1Intensity: s.layer1Intensity,
    layer2Intensity: s.layer2Intensity,
    layer3Intensity: s.layer3Intensity,
    layer4Intensity: s.layer4Intensity,
    layer5Intensity: s.layer5Intensity,
    layer6Intensity: s.layer6Intensity,
    layer7Intensity: s.layer7Intensity,
    layer8Intensity: s.layer8Intensity,
    imageMirror: s.imageMirror,
    // Phase 5: Coloring Book Controls
    spacing: s.spacing,
    densityFactor: s.densityFactor,
    minCellAreaMm2: s.minCellArea,
    detailSimplification: s.detailSimplification,
    outlineMode: s.outlineMode,
    composition: s.composition,
    frameStyle: s.frameStyle,
    ...resolveUserImage(s),
  };
}

const FIGURE_USES = [
  ["ninguno", "No usar"],
  ["figura", "Figura rellena de mandalas"],
  ["anillos", "Anillos alrededor de un mandala"],
  ["medallon", "Medallón central"],
  ["extra", "Ilustración extra (decorado de fondo)"],
];

// Imagen del usuario según el uso que ELIGIÓ para ella (nada es automático):
// figura rellena, anillos de copias alrededor de un mandala o medallón central.
// La vista previa usa la imagen seleccionada (borde morado) con su uso.
function resolveUserImage(s, entry = userFigures[activeFigure]) {
  // Ilustraciones extra (huevos, huellas, palmeras…): no son la figura de la página sino decorado; van en el
  // relleno de TODAS las páginas, tenga o no la página una figura elegida.
  // Se usa el dibujo original y no el «sello»: el engrosado del sello cierra los huecos de
  // hojas, ventanas y nidos y los deja como manchas negras macizas en el PDF.
  const extraArt = userFigures.filter(m => m.use === "extra" && m.fig).map(m => ({ href: m.fig.href, w: m.fig.w, h: m.fig.h }));
  const out = { figure: null, centerArt: null, figureRing: null, extraArt: extraArt.length ? extraArt : null,
    figureDensity: s.figureDensity, figureFillInside: s.figureFillInside, figureFillOutside: s.figureFillOutside };
  const fig = entry?.fig;
  if (!fig || !entry.use || entry.use === "ninguno" || entry.use === "extra") return out;
  const stamp = fig.stampHref || fig.href;
  if (entry.use === "figura") out.figure = fig;
  else if (entry.use === "anillos") out.figureRing = { href: stamp, centerHref: stamp, w: fig.w, h: fig.h, cls: fig.cls, theme: fig.theme };
  else if (entry.use === "medallon") out.centerArt = { type: "image", href: stamp, scale: s.centerArtScale, ...fitOf(fig) };
  return out;
}

function getCurrentDoc() {
  return createDoc({
    preset: state.preset,
    seed: state.seed,
    marginMm: 10,
  });
}

function updateGeneratorUI() {
  const isRadial = state.generatorType === "radial";
  const isLayers = state.generatorType === "layers";

  if (layersAccordionItem) layersAccordionItem.style.display = isLayers ? "block" : "none";
  
  if (styleModeEl) {
    const styleModeGroup = styleModeEl.closest('.control-group > sl-select') || styleModeEl;
    styleModeGroup.style.display = isRadial ? "none" : "block";
  }

  if (imageAccordionItem) imageAccordionItem.style.display = isLayers ? "block" : "none";
  // Composición, marco y medallón sólo existen en el motor clásico
  const isClassic = state.generatorType === "classic";
  if (centerArtAccordionItem) centerArtAccordionItem.style.display = isClassic ? "flex" : "none";
  const needClassic = document.getElementById("imagesNeedClassic");
  if (needClassic) needClassic.style.display = isClassic ? "none" : "block";
  // Controles que el motor clásico ignora: ocultarlos evita mover sliders sin efecto
  if (organicEl) organicEl.style.display = isClassic ? "none" : "block";
  if (kaleidoscopeEl) kaleidoscopeEl.style.display = isClassic ? "none" : "block";
  const compBox = document.getElementById("bookCompBox");
  if (compBox) compBox.style.display = isClassic && document.getElementById("bookVary")?.checked !== false ? "grid" : "none";
  if (compositionEl) compositionEl.style.display = isClassic ? "block" : "none";
  if (frameStyleEl) frameStyleEl.style.display = isClassic ? "block" : "none";
  
  if (spiroEnabledEl) spiroEnabledEl.style.display = isRadial ? "block" : "none";
}

const LAYER_PRESETS = {
  equilibrado: [0.85, 0.75, 0.8, 0.7, 0.55, 0.8, 0.65, 0.35],
  centro: [1.0, 0.9, 0.75, 0.5, 0.3, 0.15, 0.05, 0.0],
  borde: [0.0, 0.1, 0.3, 0.5, 0.7, 0.85, 0.95, 1.0],
  alterno: [0.9, 0.2, 0.9, 0.2, 0.9, 0.2, 0.9, 0.2],
};

let renderRafId = null;
let debounceTimer = null;

function scheduleRender(immediate = false) {
  if (renderRafId) cancelAnimationFrame(renderRafId);
  if (debounceTimer) clearTimeout(debounceTimer);

  if (immediate) {
    render();
    setStateToURL(state);
    historyMan.push(state);
    updateUndoRedoButtons();
    return;
  }

  renderRafId = requestAnimationFrame(() => {
    render();
    renderRafId = null;
    debounceTimer = setTimeout(() => {
      setStateToURL(state);
      historyMan.push(state);
      updateUndoRedoButtons();
      debounceTimer = null;
    }, 200);
  });
}

function update() {
  scheduleRender(true);
}

function debouncedRender() {
  scheduleRender(false);
}

function updateImmediate() {
  scheduleRender(true);
}

function render() {
  updateGeneratorUI();
  seedText.textContent = String(state.seed >>> 0);

  const doc = getCurrentDoc();
  const { wMm, hMm } = doc.page;

  // Aplicar LOD según previewQuality
  let scaleComplexity = 1.0, scalePetals = 1.0;
  switch (state.previewQuality) {
    case "low":  scaleComplexity = 0.45; scalePetals = 0.6; break;
    case "medium": scaleComplexity = 0.75; scalePetals = 0.8; break;
    default: /* high */ break;
  }

  const effectiveComplexity = Math.max(20, Math.round(state.complexity * densityScale(state) * scaleComplexity));
  const effectivePetals = Math.max(6, Math.round(state.petals * scalePetals / 2) * 2);

  // Modo Collage
  if (state.layoutMode !== "single") {
    const cols = state.layoutMode === "grid2x2" ? 2 : 3;
    const rows = cols;
    const margin = 8;
    const cellW = (wMm - margin * (cols + 1)) / cols;
    const cellH = (hMm - margin * (rows + 1)) / rows;
    const cellR = Math.min(cellW, cellH) / 2 - 4;

    const allDefs = [];
    let bodiesHtml = "";

    const generatorFn = getGeneratorFn(state.generatorType);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const seedOffset = idx;
        const cx = margin + cellW * (c + 0.5);
        const cy = margin + cellH * (r + 0.5);
        const subOpts = {
          ...buildOpts(state),
          seed: state.seed + seedOffset,
          petals: effectivePetals,
          complexity: effectiveComplexity
        };
        // Crear un doc temporal para este mandala
        const subDoc = createDoc({ preset: state.preset, seed: subOpts.seed, marginMm: 4 });
        
        // Generar en el subDoc con centro y radio personalizados
        generatorFn(subDoc, {
          ...subOpts,
          center: { x: cx, y: cy },
          radius: cellR,
          centerMm: { x: cx, y: cy },
          radiusMm: cellR,
          includeFrames: false,
          pageBorder: false
        });
        
        subDoc.defs.forEach(d => {
          if (!allDefs.includes(d)) allDefs.push(d);
        });
        bodiesHtml += subDoc.body.join("\n") + "\n";
      }
    }

    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${wMm}mm" height="${hMm}mm" viewBox="0 0 ${wMm} ${hMm}">`;
    if (allDefs.length > 0) {
      svgContent += `<defs>${allDefs.join("\n")}</defs>`;
    }
    svgContent += bodiesHtml;

    // Borde de página único
    if (state.pageBorder) {
      const pb = new PathBuilder();
      const m = 4;
      pb.moveTo(m, m).lineTo(wMm - m, m).lineTo(wMm - m, hMm - m).lineTo(m, hMm - m).close();
      svgContent += pb.toPath({ stroke: "#000", strokeWidthMm: 0.5, fill: "none" });
    }

    svgContent += `</svg>`;
    stage.innerHTML = svgContent;

    const svgEl = stage.querySelector("svg");
    const pathCount = svgEl ? svgEl.querySelectorAll("path").length : 0;
    pathsText.textContent = String(pathCount);

    // Track recent seeds
    if (!recentSeeds.includes(state.seed)) {
      recentSeeds.unshift(state.seed);
      if (recentSeeds.length > 20) recentSeeds.pop();
    }
    updateUndoRedoButtons();
    return;
  }

  // Modo individual (normal)
  const opts = { ...buildOpts(state), petals: effectivePetals, complexity: effectiveComplexity };
  if (state.generatorType === "radial") {
    generateMandalaRadial(doc, {
      ...opts,
      spiroEnabled: state.spiroEnabled,
      alternation: 0.3,
      harmony: 0.5,
      taper: 0.2,
      spiroR: 60,
      spiror: 25,
      spiroDistance: 30,
      spiroResolution: 500,
      spiroMode: "hypo"
    });
  } else if (state.generatorType === "classic") {
    generateMandalaClassic(doc, opts);
  } else {
    generateMandalaLayers(doc, {
      ...opts,
      imagePoints: currentImagePoints,
      imageScale: state.imageScale,
      imageIntensity: state.imageIntensity,
      imageMirror: state.imageMirror,
    });
  }

  // Draw structural guides if enabled
  if (state.showGuides) {
    const page = doc.page;
    const marginMm = page.marginMm || 10;
    const center = { x: page.wMm / 2, y: page.hMm / 2 };
    const R = Math.min(page.wMm, page.hMm) / 2 - marginMm - 5;
    const petals = effectivePetals;

    const pb = new PathBuilder();
    // Radial axes lines
    const angleStep = (Math.PI * 2) / petals;
    for (let i = 0; i < petals; i++) {
      const a = angleStep * i;
      pb.moveTo(center.x, center.y);
      pb.lineTo(center.x + Math.cos(a) * R, center.y + Math.sin(a) * R);
    }
    // Concentric rings
    for (let r = 15; r <= R; r += 15) {
      const seg = 48;
      const step = (Math.PI * 2) / seg;
      pb.moveTo(center.x + r, center.y);
      for (let j = 1; j < seg; j++) {
        const a = step * j;
        pb.lineTo(center.x + Math.cos(a) * r, center.y + Math.sin(a) * r);
      }
      pb.close();
    }
    // Outer bounding ring
    const seg = 48;
    const step = (Math.PI * 2) / seg;
    pb.moveTo(center.x + R, center.y);
    for (let j = 1; j < seg; j++) {
      const a = step * j;
      pb.lineTo(center.x + Math.cos(a) * R, center.y + Math.sin(a) * R);
    }
    pb.close();

    const pathStr = pb.toPath({ stroke: "#79747E", strokeWidthMm: 0.15, fill: "none" });
    if (pathStr) {
      const guidedPath = pathStr.replace("<path ", '<path id="guides-layer" stroke-dasharray="1,1" style="opacity:0.4; pointer-events:none;" ');
      doc.body.push(guidedPath);
    }
  }

  const svgStr = renderDocToSvgString(doc);
  stage.innerHTML = svgStr;

  const svgEl = stage.querySelector("svg");
  const pathCount = svgEl ? svgEl.querySelectorAll("path").length : 0;
  pathsText.textContent = String(pathCount);
  if (commercialScoreEl) {
    const { score } = commercialScore(measureSvg(svgStr), { strokeWidthMm: state.strokeWidth, minCellAreaMm2: state.minCellArea });
    commercialScoreEl.textContent = String(score);
    commercialScoreEl.style.color = score >= 80 ? "#2e7d32" : score >= 60 ? "#f57c00" : "#c62828";
  }

  // Track recent seeds
  if (!recentSeeds.includes(state.seed)) {
    recentSeeds.unshift(state.seed);
    if (recentSeeds.length > 20) recentSeeds.pop();
  }

  updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
  if (undoBtn) undoBtn.disabled = !historyMan.canUndo();
  if (redoBtn) redoBtn.disabled = !historyMan.canRedo();
}

async function refreshGallery() {
  let favorites = [];
  try { favorites = await getFavorites(); } catch (e) { console.error("No se pudieron leer los favoritos:", e); }
  galleryContainer.innerHTML = "";
  recentContainer.innerHTML = "";

  if (favorites.length === 0) {
    galleryContainer.innerHTML = "<p style='grid-column: 1/-1; text-align: center; color: #666;'>No tienes favoritos aún.</p>";
  } else {
    favorites.forEach(fav => {
      const card = document.createElement("div");
      card.style = "border: 1px solid #ddd; padding: 8px; border-radius: 8px; background: #fff; display: flex; flex-direction: column; gap: 8px;";

      const isOldSvg = fav.thumbnail && fav.thumbnail.trim().startsWith("<svg");
      const thumbHtml = fav.thumbnail
        ? (isOldSvg 
            ? `<div style="width:100%; aspect-ratio:1; overflow:hidden; border-radius:6px; background:#fafafa; display:flex; align-items:center; justify-content:center;">${fav.thumbnail}</div>`
            : `<div style="width:100%; aspect-ratio:1; overflow:hidden; border-radius:6px; background:#fafafa; display:flex; align-items:center; justify-content:center;"><img src="${fav.thumbnail}" style="width:100%; height:auto;" /></div>`)
        : '';

      card.innerHTML = `
        ${thumbHtml}
        <div style="font-size: 0.8rem; color: #666;">Seed: ${fav.state.seed} | ${fav.state.styleMode || '?'}</div>
        <div style="display: flex; gap: 4px;">
          <sl-button size="small" variant="primary" style="flex: 1;" class="load-fav">Cargar</sl-button>
          <sl-button size="small" variant="danger" class="delete-fav"><sl-icon name="trash"></sl-icon></sl-button>
        </div>
      `;

      // Scale thumbnail SVG to fit card
      const thumbSvg = card.querySelector("svg");
      if (thumbSvg) {
        thumbSvg.removeAttribute("width");
        thumbSvg.removeAttribute("height");
        thumbSvg.style.width = "100%";
        thumbSvg.style.height = "auto";
      }

      card.querySelector(".load-fav").onclick = () => {
        Object.assign(state, fav.state);
        bindUI();
        setStateToURL(state);
        render();
        galleryDrawer.hide();
      };

      card.querySelector(".delete-fav").onclick = async () => {
        await deleteFavorite(fav.id);
        refreshGallery();
      };

      galleryContainer.appendChild(card);
    });
  }

  // Recent Seeds
  recentSeeds.forEach(s => {
    const badge = document.createElement("sl-badge");
    badge.innerText = s;
    badge.style.cursor = "pointer";
    badge.variant = (s === state.seed) ? "primary" : "neutral";
    badge.onclick = () => {
      state.seed = s;
      bindUI();
      setStateToURL(state);
      render();
    };
    recentContainer.appendChild(badge);
  });
}

function figureSettings() {
  const val = (id, d) => { const el = document.getElementById(id); return el ? el.value : d; };
  return {
    mode: val("medallionMode", "colores"),
    threshold: parseFloat(val("medallionThreshold", 110)) || 110,
    detail: parseFloat(val("medallionDetail", 0.5)),
    bgTol: parseFloat(val("figureBgTol", 26)) || 26,
    removeBackground: document.getElementById("figureRemoveBg")?.checked ?? true,
    bgFromBottom: document.getElementById("figureBgBottom")?.checked ?? false,
    simplify: parseFloat(val("figureSimplify", 0.3)),
    keepMain: document.getElementById("figureKeepMain")?.checked ?? true,
  };
}

// ¿Lista para el uso elegido? (resolución, fondo, texto, detalle, interior, derechos)
function figureStatus(m) {
  return checkFigure(m.fig, m.use || "ninguno", { rightsConfirmed: m.rightsConfirmed, source: m.source });
}

// Lista de verificación de la imagen seleccionada, con fuente y derechos editables
function renderFigureChecks() {
  const box = document.getElementById("figureChecks");
  if (!box) return;
  const m = userFigures[activeFigure];
  if (!m) { box.innerHTML = ""; return; }
  const esc = (t) => String(t ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  box.innerHTML = `<div style="font-weight:600;margin-top:6px;">Imagen ${userFigures.indexOf(m) + 1}</div>
    <label style="display:block;margin:4px 0;">Fuente (URL, libro u «obra propia»)
      <input id="figSource" type="text" value="${esc(m.source)}" style="width:100%;padding:4px;border-radius:6px;border:1px solid #bbb;"></label>
    <label style="display:flex;gap:6px;align-items:center;"><input id="figRights" type="checkbox" ${m.rightsConfirmed ? "checked" : ""}> Confirmo que es de dominio público o mía</label>
    ${checklistHtml(figureStatus(m), m.use || "ninguno")}`;
  const refresh = () => { renderFigureList(); document.dispatchEvent(new Event("figures-changed")); };
  box.querySelector("#figSource").onchange = (e) => { m.source = e.target.value; refresh(); };
  box.querySelector("#figRights").onchange = (e) => { m.rightsConfirmed = e.target.checked; refresh(); };
}

function renderFigureList() {
  const list = document.getElementById("medallionList");
  if (!list) return;
  const req = document.getElementById("figureRequirements");
  if (req && !req.innerHTML) {
    req.innerHTML = REQUIREMENTS_HTML;
    document.head.insertAdjacentHTML("beforeend", `<style>${CHECKLIST_CSS}</style>`);
  }
  list.innerHTML = "";
  userFigures.forEach((m, i) => {
    const wrap = document.createElement("div");
    wrap.style.cssText = "position:relative;display:flex;flex-direction:column;align-items:center;gap:3px;width:96px;";
    const thumb = document.createElement("img");
    thumb.src = m.fig.href;
    thumb.title = `Imagen ${i + 1} — clic para verla en la vista previa`;
    thumb.style.cssText = `width:52px;height:52px;border-radius:8px;object-fit:contain;background:#fff;cursor:pointer;border:2px solid ${i === activeFigure ? "var(--m3-primary, #6750a4)" : "#ccc"};`;
    thumb.onclick = () => { activeFigure = i; renderFigureList(); update(); };
    const del = document.createElement("button");
    del.textContent = "×";
    del.title = "Quitar";
    del.style.cssText = "position:absolute;top:-6px;right:16px;width:18px;height:18px;border-radius:50%;border:none;background:#b3261e;color:#fff;font-size:12px;line-height:18px;padding:0;cursor:pointer;";
    del.onclick = () => {
      userFigures.splice(i, 1);
      activeFigure = Math.min(activeFigure, Math.max(0, userFigures.length - 1));
      renderFigureList();
      update();
    };
    // Uso elegido a mano para esta imagen (también decide si entra en el libro)
    const sel = document.createElement("select");
    sel.title = "Uso de esta imagen";
    sel.style.cssText = "width:96px;font-size:11px;padding:2px;border-radius:6px;";
    for (const [v, t] of FIGURE_USES) sel.add(new Option(t, v, false, (m.use || "ninguno") === v));
    sel.onchange = () => { m.use = sel.value; activeFigure = i; renderFigureList(); update(); document.dispatchEvent(new Event("figures-changed")); };
    // Semáforo: verde lista, rojo no lista, gris sin uso
    const st = figureStatus(m);
    const dot = document.createElement("span");
    const used = (m.use || "ninguno") !== "ninguno";
    dot.textContent = !used ? "· sin uso" : st.ready ? "✅ lista" : "❌ revisar";
    dot.style.cssText = `font-size:10px;color:${!used ? "#777" : st.ready ? "#2e7d32" : "#c62828"};`;
    wrap.append(thumb, del, sel, dot);
    list.appendChild(wrap);
  });
  renderFigureChecks();
}

async function reprocessImage() {
  if (currentImage) {
    if (imageSpinner) imageSpinner.style.display = "inline-block";
    if (uploadBtn) uploadBtn.loading = true;
    try {
      currentImagePoints = await imgProc.processAsync(currentImage, {
        threshold: state.imageThreshold,
        zoom: state.imageZoom,
        offsetX: state.imageOffsetX,
        offsetY: state.imageOffsetY
      });
      update();
    } catch (err) {
      console.error("Image processing error:", err);
    } finally {
      if (imageSpinner) imageSpinner.style.display = "none";
      if (uploadBtn) uploadBtn.loading = false;
    }
  }
}

let reprocessTimeout;
function debouncedReprocessImage() {
  clearTimeout(reprocessTimeout);
  reprocessTimeout = setTimeout(reprocessImage, 200);
}

function compressAndStoreImage(file, callback) {
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width;
      let h = img.height;
      const maxDim = 512;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      
      try {
        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.7);
        sessionStorage.setItem("mandala_uploaded_image", compressedDataUrl);
      } catch (err) {
        console.error("Failed to save compressed image to sessionStorage:", err);
      }
      callback(img);
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}

function bindUI() {
  presetEl.value = state.preset;
  petalsEl.value = String(state.petals);

  complexityEl.value = String(state.complexity);
  organicEl.value = String(state.organic);

  strokeWidthEl.value = String(state.strokeWidth);
  framesEl.checked = state.frames;
  pageBorderEl.checked = state.pageBorder;
  kaleidoscopeEl.checked = state.kaleidoscope;
  texturesEl.checked = state.textures;
  
  // New coloring book features
  if (coloringPresetEl) coloringPresetEl.value = state.coloringPreset;
  if (outlineModeEl) outlineModeEl.checked = state.outlineMode;

  styleModeEl.value = state.styleMode;
  if (compositionEl) compositionEl.value = state.composition;
  if (frameStyleEl) frameStyleEl.value = state.frameStyle;
  if (centerArtEl) centerArtEl.value = state.centerArt;
  if (centerArtScaleEl) centerArtScaleEl.value = String(state.centerArtScale);
  const fd = document.getElementById("figureDensity");
  if (fd) fd.value = String(state.figureDensity);
  const fi = document.getElementById("figureFillInside");
  if (fi) fi.checked = state.figureFillInside;
  const fo = document.getElementById("figureFillOutside");
  if (fo) fo.checked = state.figureFillOutside;
  if (!["ninguno", "figura", "medallon"].includes(state.centerArt)) state.centerArt = "ninguno";
  layer1IntensityEl.value = String(state.layer1Intensity);
  layer2IntensityEl.value = String(state.layer2Intensity);
  layer3IntensityEl.value = String(state.layer3Intensity);
  layer4IntensityEl.value = String(state.layer4Intensity);
  layer5IntensityEl.value = String(state.layer5Intensity);
  layer6IntensityEl.value = String(state.layer6Intensity);
  layer7IntensityEl.value = String(state.layer7Intensity);
  layer8IntensityEl.value = String(state.layer8Intensity);

  if (generatorTypeEl) generatorTypeEl.value = state.generatorType;
  if (spiroEnabledEl) spiroEnabledEl.checked = state.spiroEnabled;

  if (previewQualityEl) previewQualityEl.value = state.previewQuality;
  if (layoutModeEl) layoutModeEl.value = state.layoutMode;
  if (pngDpiEl) pngDpiEl.value = String(state.pngDpi);
  if (layerPresetEl) layerPresetEl.value = state.layerPreset;

  structurePresetEl.value = state.structurePreset;
  seedInputEl.value = String(state.seed);

  imageThresholdEl.value = String(state.imageThreshold);
  imageZoomEl.value = String(state.imageZoom);
  imageScaleEl.value = String(state.imageScale);
  imageOffsetXEl.value = String(state.imageOffsetX);
  imageOffsetYEl.value = String(state.imageOffsetY);
  imageIntensityEl.value = String(state.imageIntensity);
  if (imageMirrorEl) imageMirrorEl.checked = state.imageMirror;
  if (showGuidesEl) showGuidesEl.checked = state.showGuides;

  if (listenersBound) return;
  listenersBound = true;

  undoBtn.onclick = () => {
    const prev = historyMan.undo();
    if (prev) {
      Object.assign(state, prev);
      bindUI();
      setStateToURL(state);
      render();
    }
  };

  redoBtn.onclick = () => {
    const next = historyMan.redo();
    if (next) {
      Object.assign(state, next);
      bindUI();
      setStateToURL(state);
      render();
    }
  };

  saveFavBtn.onclick = async () => {
    saveFavBtn.loading = true;
    const svgEl = stage.querySelector("svg");
    let thumbnail = null;
    if (svgEl) {
      try {
        thumbnail = await svgStringToImageData(svgEl.outerHTML, 150, 150);
      } catch (e) {
        console.error("Could not create PNG thumbnail:", e);
      }
    }
    try {
      await saveToFavorites(state, thumbnail);
      alert("¡Guardado en favoritos!");
    } catch (e) {
      console.error("No se pudo guardar el favorito:", e);
      alert("No se pudo guardar en favoritos (¿sin conexión?).");
    } finally {
      saveFavBtn.loading = false;
    }
  };

  openGalleryBtn.onclick = () => {
    refreshGallery();
    galleryDrawer.show();
  };

  closeGalleryBtn.onclick = () => galleryDrawer.hide();

  seedInputEl.addEventListener("sl-input", () => {
    state.seed = (parseInt(seedInputEl.value, 10) >>> 0) || 0;
  });
  seedInputEl.addEventListener("sl-change", updateImmediate);

  presetEl.addEventListener("sl-change", () => {
    state.preset = presetEl.value;
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
    updateImmediate();
  });

  if (generatorTypeEl) {
    generatorTypeEl.addEventListener("sl-change", () => {
      state.generatorType = generatorTypeEl.value || "classic";
      updateImmediate();
    });
  }

  if (spiroEnabledEl) {
    spiroEnabledEl.addEventListener("sl-change", () => {
      state.spiroEnabled = spiroEnabledEl.checked;
      updateImmediate();
    });
  }

  if (previewQualityEl) {
    previewQualityEl.addEventListener("sl-change", () => {
      state.previewQuality = previewQualityEl.value;
      updateImmediate();
    });
  }

  if (layoutModeEl) {
    layoutModeEl.addEventListener("sl-change", () => {
      state.layoutMode = layoutModeEl.value;
      updateImmediate();
    });
  }

  if (pngDpiEl) {
    pngDpiEl.addEventListener("sl-change", () => {
      state.pngDpi = parseInt(pngDpiEl.value, 10) || 300;
      updateImmediate();
    });
  }

  if (layerPresetEl) {
    layerPresetEl.addEventListener("sl-change", () => {
      const preset = layerPresetEl.value;
      state.layerPreset = preset;
      if (preset !== "custom" && LAYER_PRESETS[preset]) {
        const intensities = LAYER_PRESETS[preset];
        state.layer1Intensity = intensities[0];
        state.layer2Intensity = intensities[1];
        state.layer3Intensity = intensities[2];
        state.layer4Intensity = intensities[3];
        state.layer5Intensity = intensities[4];
        state.layer6Intensity = intensities[5];
        state.layer7Intensity = intensities[6];
        state.layer8Intensity = intensities[7];
        
        // Visually update the UI sliders
        if (layer1IntensityEl) layer1IntensityEl.value = String(state.layer1Intensity);
        if (layer2IntensityEl) layer2IntensityEl.value = String(state.layer2Intensity);
        if (layer3IntensityEl) layer3IntensityEl.value = String(state.layer3Intensity);
        if (layer4IntensityEl) layer4IntensityEl.value = String(state.layer4Intensity);
        if (layer5IntensityEl) layer5IntensityEl.value = String(state.layer5Intensity);
        if (layer6IntensityEl) layer6IntensityEl.value = String(state.layer6Intensity);
        if (layer7IntensityEl) layer7IntensityEl.value = String(state.layer7Intensity);
        if (layer8IntensityEl) layer8IntensityEl.value = String(state.layer8Intensity);
      }
      updateImmediate();
    });
  }

  petalsEl.addEventListener("sl-input", () => {
    state.petals = clampInt(petalsEl.value, 6, 96);
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
    debouncedRender();
  });
  petalsEl.addEventListener("sl-change", updateImmediate);

  complexityEl.addEventListener("sl-input", () => {
    state.complexity = clampInt(complexityEl.value, 20, 320);
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
    debouncedRender();
  });
  complexityEl.addEventListener("sl-change", updateImmediate);

  organicEl.addEventListener("sl-input", () => {
    state.organic = clampFloat(organicEl.value, 0, 1);
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
    debouncedRender();
  });
  organicEl.addEventListener("sl-change", updateImmediate);

  strokeWidthEl.addEventListener("sl-input", () => {
    state.strokeWidth = clampFloat(strokeWidthEl.value, 0.1, 5.0);
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
    debouncedRender();
  });
  strokeWidthEl.addEventListener("sl-change", updateImmediate);

  framesEl.addEventListener("sl-change", () => {
    state.frames = framesEl.checked;
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
    updateImmediate();
  });

  pageBorderEl.addEventListener("sl-change", () => {
    state.pageBorder = pageBorderEl.checked;
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
    updateImmediate();
  });

  kaleidoscopeEl.addEventListener("sl-change", () => {
    state.kaleidoscope = kaleidoscopeEl.checked;
    updateImmediate();
  });

  showGuidesEl.addEventListener("sl-change", () => {
    state.showGuides = showGuidesEl.checked;
    updateImmediate();
  });

  texturesEl.addEventListener("sl-change", () => {
    state.textures = texturesEl.checked;
    updateImmediate();
  });

  styleModeEl.addEventListener("sl-change", () => {
    state.styleMode = styleModeEl.value;
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
    updateImmediate();
  });

  for (const [el, key] of [[compositionEl, "composition"], [frameStyleEl, "frameStyle"], [centerArtEl, "centerArt"]]) {
    if (el) el.addEventListener("sl-change", () => { state[key] = el.value; updateImmediate(); });
  }
  if (centerArtScaleEl) centerArtScaleEl.addEventListener("sl-input", () => {
    state.centerArtScale = clampFloat(centerArtScaleEl.value, 0.3, 0.55);
    update();
  });

  layer1IntensityEl.addEventListener("sl-input", () => {
    state.layer1Intensity = clampFloat(layer1IntensityEl.value, 0, 1);
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
    debouncedRender();
  });
  layer1IntensityEl.addEventListener("sl-change", updateImmediate);

  layer2IntensityEl.addEventListener("sl-input", () => {
    state.layer2Intensity = clampFloat(layer2IntensityEl.value, 0, 1);
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
    debouncedRender();
  });
  layer2IntensityEl.addEventListener("sl-change", updateImmediate);

  layer3IntensityEl.addEventListener("sl-input", () => {
    state.layer3Intensity = clampFloat(layer3IntensityEl.value, 0, 1);
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
    debouncedRender();
  });
  layer3IntensityEl.addEventListener("sl-change", updateImmediate);

  layer4IntensityEl.addEventListener("sl-input", () => {
    state.layer4Intensity = clampFloat(layer4IntensityEl.value, 0, 1);
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
    debouncedRender();
  });
  layer4IntensityEl.addEventListener("sl-change", updateImmediate);

  layer5IntensityEl.addEventListener("sl-input", () => {
    state.layer5Intensity = clampFloat(layer5IntensityEl.value, 0, 1);
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
    debouncedRender();
  });
  layer5IntensityEl.addEventListener("sl-change", updateImmediate);

  layer6IntensityEl.addEventListener("sl-input", () => {
    state.layer6Intensity = clampFloat(layer6IntensityEl.value, 0, 1);
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
    debouncedRender();
  });
  layer6IntensityEl.addEventListener("sl-change", updateImmediate);

  layer7IntensityEl.addEventListener("sl-input", () => {
    state.layer7Intensity = clampFloat(layer7IntensityEl.value, 0, 1);
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
    debouncedRender();
  });
  layer7IntensityEl.addEventListener("sl-change", updateImmediate);

  layer8IntensityEl.addEventListener("sl-input", () => {
    state.layer8Intensity = clampFloat(layer8IntensityEl.value, 0, 1);
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
    debouncedRender();
  });
  layer8IntensityEl.addEventListener("sl-change", updateImmediate);

  const layerSliders = [
    layer1IntensityEl, layer2IntensityEl, layer3IntensityEl, layer4IntensityEl,
    layer5IntensityEl, layer6IntensityEl, layer7IntensityEl, layer8IntensityEl
  ];
  layerSliders.forEach(slider => {
    if (slider) {
      slider.addEventListener("sl-input", () => {
        if (state.layerPreset !== "custom") {
          state.layerPreset = "custom";
          if (layerPresetEl) layerPresetEl.value = "custom";
        }
      });
    }
  });

  imageThresholdEl.addEventListener("sl-input", () => {
    state.imageThreshold = clampInt(imageThresholdEl.value, 10, 240);
    debouncedReprocessImage();
  });
  imageThresholdEl.addEventListener("sl-change", reprocessImage);

  imageZoomEl.addEventListener("sl-input", () => {
    state.imageZoom = clampFloat(imageZoomEl.value, 0.1, 3.0);
    debouncedReprocessImage();
  });
  imageZoomEl.addEventListener("sl-change", reprocessImage);

  imageScaleEl.addEventListener("sl-input", () => {
    state.imageScale = clampFloat(imageScaleEl.value, 0.5, 2.5);
    debouncedRender();
  });
  imageScaleEl.addEventListener("sl-change", updateImmediate);

  imageOffsetXEl.addEventListener("sl-input", () => {
    state.imageOffsetX = clampFloat(imageOffsetXEl.value, -100, 100);
    debouncedReprocessImage();
  });
  imageOffsetXEl.addEventListener("sl-change", reprocessImage);

  imageOffsetYEl.addEventListener("sl-input", () => {
    state.imageOffsetY = clampFloat(imageOffsetYEl.value, -100, 100);
    debouncedReprocessImage();
  });
  imageOffsetYEl.addEventListener("sl-change", reprocessImage);

  imageIntensityEl.addEventListener("sl-input", () => {
    state.imageIntensity = clampFloat(imageIntensityEl.value, 0, 1);
    debouncedRender();
  });
  imageIntensityEl.addEventListener("sl-change", updateImmediate);

  imageMirrorEl.addEventListener("sl-change", () => {
    state.imageMirror = imageMirrorEl.checked;
    updateImmediate();
  });

  uploadBtn.onclick = () => imageUploadEl.click();

  // Mis imágenes: se convierten a contorno y se rellenan con mandalas
  const figUploadEl = document.getElementById("medallionUpload");
  const figUploadBtn = document.getElementById("medallionUploadBtn");
  const packUploadEl = document.getElementById("figurePackUpload");
  const packBtn = document.getElementById("figurePackBtn");
  // Subir o importar NO cambia la página: cada imagen entra como "No usar" hasta que
  // se elige su uso a mano (un paquete conserva el uso elegido en preprocesar.html)
  const useFigures = () => {
    renderFigureList();
    updateImmediate();
    document.dispatchEvent(new Event("figures-changed"));
  };
  if (figUploadBtn && figUploadEl) {
    figUploadBtn.onclick = () => figUploadEl.click();
    figUploadEl.onchange = async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      figUploadBtn.loading = true;
      try {
        for (const file of files) {
          const img = await loadImageFile(file);
          userFigures.push({ name: file.name, img, use: "ninguno", source: "", rightsConfirmed: false, fig: await figureFromImage(img, figureSettings()) });
        }
        activeFigure = userFigures.length - 1;
        useFigures();
      } catch (err) {
        console.error("Figure image error:", err);
        alert("❌ No se pudo procesar la imagen: " + (err.message || err));
      } finally {
        figUploadBtn.loading = false;
        figUploadEl.value = "";
      }
    };
  }
  if (packBtn && packUploadEl) {
    packBtn.onclick = () => packUploadEl.click();
    packUploadEl.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const figs = unpackFigures(await file.text());
        for (const f of figs) userFigures.push({ name: f.name, img: null, use: f.use || "ninguno", source: f.source, rightsConfirmed: f.rightsConfirmed, fig: await withStamp(f) });
        activeFigure = Math.max(0, userFigures.length - figs.length);
        useFigures();
      } catch (err) {
        alert("❌ Paquete no válido: " + (err.message || err));
      } finally {
        packUploadEl.value = "";
      }
    };
  }
  // Cambiar el tipo de imagen o la tolerancia reprocesa las imágenes subidas aquí
  // (las de un paquete ya vienen ajustadas desde preprocesar.html)
  let figTimer;
  const reprocessFigures = () => {
    clearTimeout(figTimer);
    figTimer = setTimeout(async () => {
      for (const m of userFigures) if (m.img) m.fig = await figureFromImage(m.img, figureSettings());
      document.dispatchEvent(new Event("figures-changed"));
      renderFigureList();
      update();
    }, 300);
  };
  ["medallionMode", "medallionThreshold", "medallionDetail", "figureBgTol", "figureRemoveBg", "figureBgBottom", "figureSimplify", "figureKeepMain"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("sl-change", reprocessFigures);
  });
  const densityEl = document.getElementById("figureDensity");
  if (densityEl) densityEl.addEventListener("sl-change", () => { state.figureDensity = clampFloat(densityEl.value, 0, 1); update(); });
  for (const [id, key] of [["figureFillInside", "figureFillInside"], ["figureFillOutside", "figureFillOutside"]]) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("sl-change", () => { state[key] = el.checked; update(); });
  }
  const exportPackBtn = document.getElementById("figurePackExport");
  if (exportPackBtn) exportPackBtn.onclick = () => {
    if (!userFigures.length) return;
    downloadTextFile("figuras.json", JSON.stringify(packFigures(userFigures.map(m => ({ name: m.name, use: m.use, source: m.source, rightsConfirmed: m.rightsConfirmed, ...m.fig })))));
  };
  imageUploadEl.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      compressAndStoreImage(file, (img) => {
        currentImage = img;
        reprocessImage();
      });
    }
  };

  // Las plantillas y niveles se aplican al elegirlos (antes pedían un segundo clic
  // en «Aplicar», y elegir sin aplicar no cambiaba nada)
  structurePresetEl.addEventListener("sl-change", () => {
    state.structurePreset = structurePresetEl.value || "custom";
    if (applyStructurePreset(state.structurePreset)) {
      bindUI();
      update();
    }
  });

  if (coloringPresetEl) {
    coloringPresetEl.addEventListener("sl-change", () => {
      const presetKey = coloringPresetEl.value;
      if (presetKey === state.coloringPreset) return; // bindUI() también dispara sl-change
      const preset = COLORING_PRESETS[presetKey];
      if (preset) {
        Object.entries(preset).forEach(([key, value]) => {
          state[key] = value;
        });
        state.coloringPreset = presetKey;
        bindUI();
        update();
      }
    });
  }
  
  // Outline mode toggle
  if (outlineModeEl) {
    outlineModeEl.addEventListener("sl-change", () => {
      state.outlineMode = outlineModeEl.checked;
      updateImmediate();
    });
  }

  const prevSeedBtn = document.getElementById("prevSeed");
  const nextSeedBtn = document.getElementById("nextSeed");

  if (prevSeedBtn) {
    prevSeedBtn.addEventListener("click", () => {
      state.seed = ((state.seed >>> 0) - 1) >>> 0;
      seedInputEl.value = String(state.seed);
      update();
    });
  }

  if (nextSeedBtn) {
    nextSeedBtn.addEventListener("click", () => {
      state.seed = ((state.seed >>> 0) + 1) >>> 0;
      seedInputEl.value = String(state.seed);
      update();
    });
  }

  regenBtn.addEventListener("click", () => {
    state.seed = randomSeed32() >>> 0;
    seedInputEl.value = String(state.seed);
    update();
  });

  const magicShuffleBtn = document.getElementById("magicShuffle");
  if (magicShuffleBtn) {
    magicShuffleBtn.addEventListener("click", () => {
      // Magic Shuffle: Randomize EVERYTHING with quality safeguards (Harmonic Shuffle)
      state.seed = randomSeed32() >>> 0;
      seedInputEl.value = String(state.seed);
      const shuffleRng = mulberry32((state.seed ^ 0x9E3779B9) >>> 0);
      
      // Randomize motor
      state.generatorType = pick(shuffleRng, ["classic", "classic", "classic", "radial"]);
      if (state.generatorType === "radial") {
        state.spiroEnabled = pick(shuffleRng, [true, false]);
      }

      const styles = ["sashiko", "floral", "geometric", "islamico", "azteca", "yantra", "celtico"];
      state.styleMode = pick(shuffleRng, styles);
      
      // Harmonic petal counts
      state.petals = pick(shuffleRng, [8, 12, 16, 20, 24, 32, 36, 48]);
      
      // Style-locked complexity/organic settings
      if (["geometric", "islamico", "azteca"].includes(state.styleMode)) {
        state.organic = rFloat(shuffleRng, 0.0, 0.1);
        state.complexity = rInt(shuffleRng, 140, 220);
      } else if (["sashiko", "yantra"].includes(state.styleMode)) {
        state.organic = rFloat(shuffleRng, 0.1, 0.3);
        state.complexity = rInt(shuffleRng, 120, 240);
      } else { // floral, celtico
        state.organic = rFloat(shuffleRng, 0.4, 0.8);
        state.complexity = rInt(shuffleRng, 130, 260);
      }
      
      // Structured layer intensity progressions (Decay, Crest, or Alternating curves)
      const curveType = pick(shuffleRng, ["decay", "crest", "alternating"]);
      const intensities = [];
      for (let i = 0; i < 8; i++) {
        let val = 0.5;
        if (curveType === "decay") {
          val = Math.pow(0.85, i) * rFloat(shuffleRng, 0.85, 1.0);
        } else if (curveType === "crest") {
          val = Math.exp(-Math.pow(i - 3.5, 2) / 6) * rFloat(shuffleRng, 0.85, 1.0);
        } else { // alternating
          val = (i % 2 === 0) ? rFloat(shuffleRng, 0.75, 1.0) : rFloat(shuffleRng, 0.15, 0.45);
        }
        intensities.push(Math.max(0, Math.min(1, val)));
      }

      state.layer1Intensity = intensities[0];
      state.layer2Intensity = intensities[1];
      state.layer3Intensity = intensities[2];
      state.layer4Intensity = intensities[3];
      state.layer5Intensity = intensities[4];
      state.layer6Intensity = intensities[5];
      state.layer7Intensity = intensities[6];
      state.layer8Intensity = intensities[7];
      
      state.imageIntensity = rFloat(shuffleRng, 0.3, 0.8);
      
      // Randomize Image params if active
      if (currentImage) {
        state.imageThreshold = rInt(shuffleRng, 60, 180);
        state.imageZoom = rFloat(shuffleRng, 0.5, 1.5);
        state.imageScale = rFloat(shuffleRng, 0.8, 1.5);
        state.imageOffsetX = rFloat(shuffleRng, -20, 20);
        state.imageOffsetY = rFloat(shuffleRng, -20, 20);
        reprocessImage();
      }

      state.strokeWidth = rFloat(shuffleRng, 0.4, 1.0);
      
      // Randomize coloring book controls with quality safeguards
      const coloringOptions = ["ninos", "ninos_grande", "adulto", "experto", "zen"];
      const randomColoring = pick(shuffleRng, coloringOptions);
      const coloringPreset = COLORING_PRESETS[randomColoring];
      if (coloringPreset) {
        state.coloringPreset = randomColoring;
        Object.entries(coloringPreset).forEach(([key, value]) => {
          // Don't override seed or style-related properties in shuffle
          if (!['complexity', 'organic', 'styleMode', 'generatorType'].includes(key)) {
            state[key] = value;
          }
        });
      }
      
      state.structurePreset = "custom";
      bindUI();
      update();
    });
  }

  // Download menu handler
  const downloadMenu = document.getElementById("downloadMenu");
  if (downloadMenu) {
    downloadMenu.addEventListener("sl-select", async (event) => {
      const item = event.detail.item;
      const id = item.id;

      try {
        if (id === "download") {
          const svg = stage.querySelector("svg");
          if (!svg) return;
          const svgClone = svg.cloneNode(true);
          const guides = svgClone.querySelector("#guides-layer");
          if (guides) guides.remove();
          const filename = `mandala_${state.preset}_seed_${state.seed}.svg`;
          downloadTextFile(filename, svgClone.outerHTML);
        } else if (id === "downloadPng") {
          const svg = stage.querySelector("svg");
          if (!svg) return;
          const svgClone = svg.cloneNode(true);
          const guides = svgClone.querySelector("#guides-layer");
          if (guides) guides.remove();
          const doc = getCurrentDoc();
          const filename = `mandala_${state.preset}_seed_${state.seed}_${state.pngDpi}dpi.png`;
          const { wMm, hMm } = doc.page;
          await downloadPng(filename, svgClone.outerHTML, wMm, hMm, state.pngDpi || 300);
        } else if (id === "downloadPdf") {
          await downloadManualPdf();
        } else if (id === "share") {
          await shareBtnHandler();
        }
      } catch (error) {
        console.error("Download error:", error);
      }
    });
  }

  const shareBtnHandler = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Mandala Studio',
          text: '¡Mira este mandala que he creado!',
          url: window.location.href,
        });
        console.log('Shared successfully');
      } catch (err) {
        console.log('Share failed', err);
      }
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(window.location.href);
      alert('URL copiada al portapapeles');
    }
  };

  // Individual PDF download with flexible layout
  const downloadPdfSidebar = document.getElementById("downloadPdfSidebar");
  const pageLayoutEl = document.getElementById("pageLayout");

  const downloadManualPdf = async () => {
    const doc = getCurrentDoc();
    const { wMm, hMm } = doc.page;
    const layout = pageLayoutEl.value || "classic";
    const filename = `mandala_page_${layout}_seed${state.seed}.pdf`;

    // 1. Determine how many mandalas of the current design to print
    let count = 1;
    if (layout === "duo" || layout === "mirror") count = 2;
    if (layout === "trio") count = 3;
    if (layout === "collage") count = 4;

    // 2. Build opts (all same design)
    const batchOpts = Array.from({ length: count }, () => buildOpts(state));

    // 3. Get quote if needed
    let quotes = [];
    if (layout === "inspirational" && typeof TAOISTA_DATASET !== "undefined") {
      const allCards = TAOISTA_DATASET.cards || [];
      if (allCards.length > 0) {
        // Quote selection deterministic for reproducible exports
        const quoteRng = mulberry32((state.seed ^ 0xA511E9B3) >>> 0);
        quotes = [allCards[rInt(quoteRng, 0, allCards.length - 1)]];
      }
    }

    if (downloadPdfSidebar) {
      downloadPdfSidebar.loading = true;
      downloadPdfSidebar.disabled = true;
    }

    if (progressDialog) {
      if (progressBar) progressBar.value = 0;
      if (progressStatus) progressStatus.textContent = "Iniciando descarga...";
      progressDialog.show();
    }

    try {
      // We use downloadBatchPdf even for single pages because it handles layouts
      await downloadBatchPdf(
        filename,
        batchOpts,
        getGeneratorFn(state.generatorType),
        wMm,
        hMm,
        layout,
        quotes,
        {
          onProgress: (rendered, total, label) => {
            if (progressDialog && progressBar && progressStatus) {
              const percent = Math.round((rendered / total) * 100);
              progressBar.value = percent;
              progressStatus.textContent = `${label} (${percent}%)`;
            }
          }
        }
      );
      alert("✅ PDF descargado correctamente");
    } catch (error) {
      console.error("PDF download error:", error);
      alert("❌ Error al descargar PDF: " + (error.message || "Intenta de nuevo"));
    } finally {
      if (downloadPdfSidebar) {
        downloadPdfSidebar.loading = false;
        downloadPdfSidebar.disabled = false;
      }
      if (progressDialog) {
        setTimeout(() => {
          progressDialog.hide();
        }, 500);
      }
    }
  };

  if (downloadPdfSidebar) {
    downloadPdfSidebar.addEventListener("click", downloadManualPdf);
  }

  // Libro completo (Amazon KDP): N mandalas planificados para no repetirse
  const bookBtn = document.getElementById("downloadBook");
  const bookPagesEl = document.getElementById("bookPages");
  const bookTitleEl = document.getElementById("bookTitle");
  const bookSubtitleEl = document.getElementById("bookSubtitle");
  const bookAuthorEl = document.getElementById("bookAuthor");
  const bookVaryEl = document.getElementById("bookVary");
  const bookDifficultyEl = document.getElementById("bookDifficulty");
  // Sólo las imágenes con uso elegido a mano Y que pasan la lista de verificación
  const isPageFigure = (m) => m.use && m.use !== "ninguno" && m.use !== "extra"; // «extra» es decorado, no una página
  const chosenFigures = () => userFigures.filter(m => isPageFigure(m) && figureStatus(m).ready);
  const pendingFigures = () => userFigures.filter(m => isPageFigure(m) && !figureStatus(m).ready);
  // Reverso: "blanco" | "negro" | "ninguno" (doble cara, sin páginas en blanco)
  const bookBackEl = document.getElementById("bookBack");
  const backMode = () => bookBackEl?.value || "blanco";
  const bookTitlePageEl = document.getElementById("bookTitlePage");
  const bookCopyrightEl = document.getElementById("bookCopyright");
  const bookColorTestEl = document.getElementById("bookColorTest");
  const bookPageNumbersEl = document.getElementById("bookPageNumbers");
  const bookDpiEl = document.getElementById("bookDpi");
  const bookSummaryEl = document.getElementById("bookSummary");

  const bookCount = () => Math.min(120, Math.max(1, parseInt(bookPagesEl?.value, 10) || 1));
  // Páginas sorprendentes: se suman a los mandalas normales
  const bookGrowthEl = document.getElementById("bookGrowth");
  const bookMysteryEl = document.getElementById("bookMystery");
  const bookNatureEl = document.getElementById("bookNature");
  const bookMuralEl = document.getElementById("bookMural");
  const specialOpts = () => {
    const mural = bookMuralEl?.value && bookMuralEl.value !== "ninguno" ? bookMuralEl.value.split("x").map(Number) : null;
    return {
      growth: Math.max(0, Math.min(3, parseInt(bookGrowthEl?.value, 10) || 0)),
      mystery: Math.max(0, Math.min(7, parseInt(bookMysteryEl?.value, 10) || 0)),
      nature: !!bookNatureEl?.checked,
      mural: mural ? { cols: mural[0], rows: mural[1] } : null,
    };
  };
  // Capítulos temáticos: estilos y pesos del libro (los mismos que usa el plan)
  // BESTSELLER_STYLE_W se importa desde bookPlan.js (fuente única de verdad)
  const bookChaptersEl = document.getElementById("bookChapters");
  const chaptersFor = (regular) => {
    if (!bookChaptersEl?.checked || !bookVaryEl.checked || state.generatorType !== "classic") return [];
    return bestSeller()
      ? chapterLayout(regular, Object.keys(BESTSELLER_STYLE_W), Object.values(BESTSELLER_STYLE_W))
      : chapterLayout(regular, BOOK_STYLES);
  };
  const layoutFor = (regular) => {
    // Cada capítulo suma su portadilla
    const total = regular + specialPageCount(specialOpts()) + chaptersFor(regular).length;
    const off = bookColorTestEl?.checked ? 1 : 0;
    const doubleSided = backMode() === "ninguno";
    return {
      mandalas: total,
      blankBack: !doubleSided,
      // A doble cara, el mural conserva sus reversos en blanco: se recorta
      keepBack: doubleSided ? muralTilePositions(total, specialOpts()).map(i => i + off) : [],
    titlePage: bookTitlePageEl.checked,
    copyrightPage: !!bookCopyrightEl?.checked,
    colorTest: !!bookColorTestEl?.checked,
    };
  };
  // A doble cara, un total impar dejaría la última página en blanco: se añade un mandala
  const regularCount = () => {
    const n = bookCount();
    if (backMode() !== "ninguno") return n;
    const lo = layoutFor(n);
    // Sin el relleno: bookPageCount siempre devuelve un total par
    const natural = bookLayout({ ...lo, mandalas: lo.mandalas + (lo.colorTest ? 1 : 0), pad: false }).length;
    return natural % 2 ? n + 1 : n;
  };
  const bookLayoutOpts = () => layoutFor(regularCount());
  // El margen depende del grosor del libro (medianil de KDP): se calcula con el total
  const bookMargin = (total) => kdpSafeMarginMm(total, 10);

  const updateBookSummary = () => {
    if (!bookSummaryEl) return;
    const total = bookPageCount(bookLayoutOpts());
    const margin = bookMargin(total);
    const { wMm, hMm } = getCurrentDoc().page;
    const dpi = parseInt(bookDpiEl?.value, 10) || 300;
    const checks = kdpChecklist({ pages: total, marginMm: margin, dpi });
    const bad = checks.filter(c => !c.ok);
    bookSummaryEl.innerHTML =
      `${total} páginas · ${wMm}×${hMm} mm · margen ${margin.toFixed(1)} mm · ${dpi} DPI<br>` +
      (bad.length ? bad.map(c => `⚠️ ${c.msg}`).join("<br>") : "✅ Cumple los requisitos de interior de KDP (sin sangrado).");
    // Consejos de calidad (no bloquean): lo que distingue a los libros mejor valorados
    const tips = [];
    if (!/^KDP_/.test(state.preset)) tips.push("💡 8.5×11 in es el formato más común en libros de mandalas; A4 y Carta también los acepta KDP.");
    if (bookCount() < 40) tips.push(`💡 ${bookCount()} mandalas: los libros mejor valorados traen entre 40 y 100.`);
    if (backMode() === "ninguno") {
      tips.push("💡 Doble cara: ideal para lápices de colores. Con marcadores la tinta puede traspasar al dibujo del otro lado.");
      if (regularCount() > bookCount()) tips.push(`➕ Se añade 1 mandala (${regularCount()} en total) para que la última página no quede en blanco.`);
      const sp0 = specialOpts();
      if (sp0.mural) tips.push(`⚠️ El mural se recorta: sus ${sp0.mural.cols * sp0.mural.rows} hojas conservan el reverso en blanco. Quita el mural si no quieres ninguna página en blanco.`);
    }
    // Medido con el nivel Adulto (scripts/bench-book.mjs y la prueba de motores): clásico ≈ 82,
    // capas ≈ 71, radial ≈ 57. Los otros motores no tienen capítulos ni encuadres variados.
    if (state.generatorType !== "classic") tips.push("💡 Para libros, el motor «Clásico» da páginas más fáciles de colorear (≈ 82/100 frente a 57–71) y activa capítulos, encuadres y siluetas variadas.");
    if (state.strokeWidth < 0.45) tips.push("💡 Trazo fino (< 0,45 mm): bonito en pantalla, pero en papel de KDP se ve gris. Prueba «Adulto · Trazo grueso» o sube el grosor.");
    const sp = specialOpts(), extra = [];
    if (sp.growth) extra.push(`${sp.growth} mandala(s) que crece(n) (${sp.growth * GROWTH_STAGES} págs.)`);
    if (sp.mystery) extra.push(`${sp.mystery} misterioso(s) + soluciones`);
    if (sp.nature) extra.push("capítulo de simetrías naturales (4 págs.)");
    if (sp.mural) extra.push(`mural de ${sp.mural.cols}×${sp.mural.rows} hojas + guía`);
    if (extra.length) bookSummaryEl.innerHTML += `<br>✨ ${bookCount()} mandalas + ${extra.join(", ")}.`;
    const chs = chaptersFor(regularCount());
    if (chs.length) bookSummaryEl.innerHTML += `<br>📚 ${chs.length} capítulos con portadilla: ` + chs.map(c => `${escapeXml(c.title)} (${c.size})`).join(" · ") + ".";
    if (tips.length) bookSummaryEl.innerHTML += "<br>" + tips.join("<br>");
    const chosen = chosenFigures();
    const info = document.getElementById("bookImagesInfo");
    if (info) {
      // Sólo cuentas: los nombres de las imágenes no se muestran
      const byUse = FIGURE_USES.filter(u => u[0] !== "ninguno" && u[0] !== "extra").map(u => [u[1].toLowerCase(), chosen.filter(m => m.use === u[0]).length]).filter(([, n]) => n);
      const extras = userFigures.filter(m => m.use === "extra" && m.fig).length;
      info.innerHTML = chosen.length
        ? `🖼️ ${chosen.length} imagen(es) elegida(s) a mano (${byUse.map(([t, n]) => `${n} · ${t}`).join(", ")})`
        : "Ninguna imagen lista: el libro será sólo de mandalas. Para incluir una, elige su uso en «Mis imágenes».";
      if (extras) info.innerHTML += `<br>🌿 ${extras} ilustración(es) extra en el decorado de las páginas.`;
      const pend = pendingFigures();
      if (pend.length) info.innerHTML += `<br>❌ ${pend.length} no entran (no están listas). Revisa su lista de verificación en «Mis imágenes».`;
    }
    if (chosen.length > bookCount()) bookSummaryEl.innerHTML += `<br>⚠️ Hay ${chosen.length} imágenes elegidas y sólo ${bookCount()} páginas: sobran ${chosen.length - bookCount()}.`;
  };

  // ---------- Plan del libro (compartido por la revisión y la descarga) ----------
  // Composiciones permitidas y su peso: «centro» sale más (es el que más se colorea)
  const COMP_WEIGHTS = { centro: 3, fondo: 2, constelacion: 2, esquinas: 1, gigante: 1, medio: 1 };
  const bookProfileEl = document.getElementById("bookProfile");
  const bestSeller = () => (bookProfileEl?.value || "rentable") === "rentable";
  const allowedCompositions = () => {
    if (bestSeller()) return bestSellerProfile(state.preset).compositions;
    const boxes = [...document.querySelectorAll(".bookComp")];
    const on = boxes.filter(b => b.checked).map(b => b.value);
    return on.length ? on : ["centro"];
  };
  // Páginas cambiadas a mano en la revisión: índice → { bump, composition }.
  // Se descartan si cambia la semilla base (el libro entero es otro).
  let bookOverrides = new Map();
  let overridesSeed = state.seed >>> 0;
  const currentOverrides = () => {
    if ((state.seed >>> 0) !== overridesSeed) { bookOverrides = new Map(); overridesSeed = state.seed >>> 0; }
    return bookOverrides;
  };

  const buildBook = () => {
    const regular = regularCount();
    const baseSeed = state.seed >>> 0;
    const isClassic = true; // El libro siempre usa el motor clásico (mejor calidad: ≈84 vs 57-71)
    const chosen = chosenFigures();
    const vary = bookVaryEl.checked;
    const base = buildOpts(state);
    const comps = allowedCompositions();
    // «Lo más vendido»: composiciones, estilos, marcos y pétalos con los pesos del perfil
    const prof = vary && bestSeller() ? bestSellerProfile(state.preset) : null;
    if (prof) {
      // Floral y geométrico dominan; el resto aparece como variación ocasional.
      // Lista y pesos en el mismo orden (shuffleBag los empareja por posición)
      prof.styles = Object.keys(BESTSELLER_STYLE_W);
      prof.styleWeights = Object.values(BESTSELLER_STYLE_W);
    }
    // Plan de todo el libro antes de dibujar: sin rachas de estilos ni encuadres repetidos
    const regularPlan = planBook({
      count: regular, seed: baseSeed,
      styles: vary ? prof?.styles : [state.styleMode],
      styleWeights: prof?.styleWeights ?? null,
      petals: prof?.petals,
      compositions: vary && isClassic ? comps : [state.composition || "centro"],
      compositionWeights: vary && isClassic ? (prof && isClassic ? prof.compositionWeights : comps.map(c => COMP_WEIGHTS[c] ?? 1)) : null,
      frames: vary && isClassic ? prof?.frames : [state.frameStyle || "redondeado"],
      frameWeights: vary && isClassic ? prof?.frameWeights ?? null : null,
      difficulty: bookDifficultyEl?.value || "mixta",
      baseComplexity: base.complexity,
      images: chosen.length,
      // Hoja vertical: el mandala centrado completa las franjas vacías con un fondo
      fillCentro: vary && isClassic && (({ wMm, hMm }) => hMm > wMm * 1.15 || wMm > hMm * 1.15)(getCurrentDoc().page),
      chapters: chaptersFor(regular),
      patternOnly: prof?.patternOnly, // Adulto: solo tramas continuas, no confeti
    });
    // Páginas sorprendentes y, en modo progresivo, dificultad creciente en TODO el libro
    const plan = insertChapterDividers(addSpecialPages(regularPlan, {
      seed: baseSeed, ...specialOpts(),
      difficulty: bookDifficultyEl?.value || "progresiva",
      baseComplexity: base.complexity,
      styles: vary ? prof?.styles : [state.styleMode], styleWeights: prof?.styleWeights ?? null,
    }), baseSeed);
    const count = plan.length;
    const overrides = currentOverrides();
    // Las páginas de un grupo (secuencia que crece, mural) cambian juntas
    const ovKey = (i) => (plan[i].special?.group != null ? `g:${plan[i].special.group}` : i);
    const seedOf = (i) => applyPageOverride(plan[i], overrides.get(ovKey(i))).seed;
    // Soluciones: número de página real de cada mandala misterioso en el PDF
    const solutionEntries = () => {
      const lo = bookLayoutOpts();
      const layout = bookLayout({ ...lo, mandalas: count + (lo.colorTest ? 1 : 0) });
      const off = lo.colorTest ? 1 : 0;
      return plan.map((p, j) => ({ p, j })).filter(({ p }) => p.special?.type === "mystery").map(({ p, j }) => ({
        // El número del misterioso va impreso en su propia página: sirve aunque el libro
        // no lleve números de página
        label: `Misterioso ${p.special.n} (pág. ${layout.findIndex(q => q.kind === "mandala" && q.index === j + off) + 1}) · ${MYSTERY_SHAPES[p.special.shape]?.name || p.special.shape}`,
        shape: p.special.shape, seed: seedOf(j), complexity: p.complexity,
      }));
    };
    // Registro de fuentes: qué imagen va en qué página (trazabilidad de derechos)
    const sourceLog = [];

    const makeOpts = (i) => {
      const pg = plan[i];
      const ov = overrides.get(ovKey(i));
      // «Otro diseño» desplaza la semilla de esa página (o de su grupo) sin tocar las demás
      const seed = seedOf(i);
      if (pg.special) {
        const special = { ...pg.special };
        if (special.type === "solutions") special.entries = solutionEntries();
        const o = { ...base, seed, complexity: pg.complexity, petals: pg.petals, styleMode: pg.styleMode,
          strokeWidthMm: pageStrokeMm(base.strokeWidthMm, pg.strokeScale ?? 1), special,
          ...(pg.silhouette ? { silhouette: pg.silhouette } : {}) };
        sourceLog[i] = { mandala: i + 1, composition: specialLabel(special), style: o.styleMode, image: "", source: "" };
        return o;
      }
      // Mismo redondeo de pétalos que la vista previa en calidad alta (WYSIWYG)
      const o = { ...base, seed, complexity: pg.complexity,
        petals: vary ? pg.petals : Math.max(6, Math.round(state.petals / 2) * 2),
        // Página fácil ⇒ línea más gruesa; difícil ⇒ algo más fina (nunca < 0,35 mm)
        strokeWidthMm: pageStrokeMm(base.strokeWidthMm, pg.strokeScale ?? 1) };
      if (vary) o.styleMode = pg.styleMode;
      // El libro siempre usa el motor clásico (isClassic = true arriba)
      {
        // «Borrar y crear otro» también cambia la silueta y la estructura (applyPageOverride):
        // con las mismas, el reemplazo se parecería demasiado al dibujo descartado
        const ap = applyPageOverride(pg, ov);
        o.composition = ap.composition;
        o.frameStyle = pg.frameStyle;
        if (ap.structure) o.structure = ap.structure;
        if (pg.background) o.background = pg.background;
        if (ap.silhouette) o.silhouette = ap.silhouette;
        // Cada imagen elegida aparece una vez, con el uso que se le asignó a mano;
        // el resto de páginas son mandalas sin imagen
        const entry = pg.centerArt ? chosen[pg.centerArt.imageIndex] : null;
        Object.assign(o, resolveUserImage(state, entry));
        sourceLog[i] = { mandala: i + 1, composition: entry ? entry.use : o.composition, style: o.styleMode, image: entry ? entry.name : "", source: entry ? entry.source : "" };
        return o;
      }
    };
    return { count, baseSeed, plan, makeOpts, ovKey, sourceLog, isClassic, comps, generatorFn: withSpecialPages(getGeneratorFn("classic")) };
  };

  // ---------- Revisión de páginas ----------
  const reviewDialog = document.getElementById("reviewDialog");
  const reviewGrid = document.getElementById("reviewGrid");
  const reviewInfo = document.getElementById("bookReviewInfo");
  const COMP_NAMES = { centro: "Centrado", fondo: "Fondo decorado", constelacion: "Constelación", esquinas: "Esquinas", gigante: "Gigante", medio: "Medio mandala", figura: "Figura", anillos: "Anillos", medallon: "Medallón" };
  const STYLE_NAMES = { sashiko: "Sashiko", floral: "Floral", geometric: "Geométrico", islamico: "Islámico", azteca: "Azteca", yantra: "Yantra", celtico: "Céltico" };
  let reviewToken = 0;

  // Cambios hechos por el control de calidad automático (el resto son a mano)
  const autoKeys = new Set();
  const updateReviewInfo = () => {
    if (!reviewInfo) return;
    const keys = [...currentOverrides().keys()];
    const auto = keys.filter(k => autoKeys.has(k)).length, manual = keys.length - auto;
    const parts = [];
    if (manual) parts.push(`✏️ ${manual} página(s) cambiada(s) a mano`);
    if (auto) parts.push(`✨ ${auto} rehecha(s) por el control de calidad automático`);
    reviewInfo.textContent = parts.length ? `${parts.join(" · ")}: se usarán al crear el libro.` : "";
  };

  const pageSvg = (book, i) => {
    const o = book.makeOpts(i);
    const doc = createDoc({ preset: state.preset, seed: o.seed, marginMm: bookMargin(bookPageCount(bookLayoutOpts())) });
    book.generatorFn(doc, o);
    return { svg: renderDocToSvgString(doc).replace(/width="[^"]+mm" height="[^"]+mm"/, ""), opts: o };
  };

  // ---------- Control de calidad por página ----------
  // La misma puntuación que la vista previa (commercialMetrics.js), medida sobre cada
  // página tal como irá al PDF. Sólo en páginas de mandala: el misterioso tiene celdas
  // pequeñas a propósito, la naturaleza lleva texto y las soluciones no se colorean.
  const reviewScores = new Map(); // índice → puntuación (o null si no se mide)
  const scorable = (o) => !o.special || o.special.type === "grow" || o.special.type === "mural";
  const scoreSvg = (svg, o) => commercialScore(measureSvg(svg), { strokeWidthMm: o.strokeWidthMm, minCellAreaMm2: o.minCellAreaMm2 });
  const scoreColor = (n) => (n >= 80 ? "#2e7d32" : n >= WEAK_SCORE ? "#f57c00" : "#c62828");
  const reviewQualityEl = document.getElementById("reviewQuality");
  const reviewFixBtn = document.getElementById("reviewFixWeak");
  // Repetición: huella geométrica de cada página (variety.js), medida sobre el dibujo.
  // Las páginas especiales no se comparan (las etapas de un mandala que crece se parecen
  // a propósito).
  const reviewFps = new Map(); // índice → huella (o null)
  const fpOf = (svg, o) => (o.special ? null : pageFingerprint(svg, getCurrentDoc().page));
  const fpList = (n) => Array.from({ length: n }, (_, k) => reviewFps.get(k) || null);
  const twinPairs = (n) => similarPairs(fpList(n));
  const weakPages = () => [...reviewScores].filter(([, sc]) => sc != null && sc < WEAK_SCORE).map(([i]) => i);
  const updateQualitySummary = (book) => {
    if (!reviewQualityEl) return;
    const vals = [...reviewScores.values()].filter(v => v != null);
    if (!vals.length) { reviewQualityEl.textContent = ""; return; }
    const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    // Las páginas de un grupo (etapas, hojas del mural) no se rehacen solas: cambiarían todas
    const weak = weakPages(), fixable = weak.filter(i => book.plan[i].special?.group == null);
    reviewQualityEl.innerHTML =
      `Calidad para colorear: media <b style="color:${scoreColor(avg)}">${avg}</b>/100 en ${vals.length} páginas medidas · ` +
      (weak.length
        ? `<b style="color:#c62828">${weak.length} floja(s)</b> (&lt; ${WEAK_SCORE}): págs. ${weak.map(i => i + 1).join(", ")}.` +
          (weak.length > fixable.length
            ? ((g) => g.length === 1
                ? ` La pág. ${g[0]} es de un grupo (mandala que crece o mural): cámbiala con «Cambiar todo el grupo».`
                : ` Las págs. ${g.join(", ")} son de un grupo (mandala que crece o mural): cámbialas con «Cambiar todo el grupo».`)(weak.filter(i => !fixable.includes(i)).map(i => i + 1))
            : "")
        : "ninguna floja ✅.");
    // Variedad: pares de páginas gemelas en todo el libro (huella geométrica ≥ umbral)
    const twins = twinPairs(book.count);
    const twinFix = twinTargets(book, twins);
    const cards = [...reviewGrid.children];
    cards.forEach(c => { c.classList.remove("twin"); c.querySelector(".twin-note")?.remove(); });
    for (const { i, j, sim } of twins) for (const [a, b] of [[i, j], [j, i]]) {
      const c = cards[a]; if (!c) continue;
      c.classList.add("twin");
      const meta = c.querySelector(".meta");
      if (meta && !meta.querySelector(".twin-note")) {
        const note = document.createElement("div");
        note.className = "twin-note";
        note.textContent = `≈ gemela de la pág. ${b + 1} (${Math.round(sim * 100)} %)`;
        meta.appendChild(note);
      }
    }
    reviewQualityEl.innerHTML += "<br><br>Variedad: " + (twins.length
      ? `<b style="color:#f57c00">${twins.length} par(es) de páginas gemelas</b> (se ven casi iguales al hojear): ` +
        twins.slice(0, 8).map(t => `págs. ${t.i + 1} y ${t.j + 1}`).join(" · ") + (twins.length > 8 ? "…" : "") + "."
      : "sin páginas gemelas ✅.");
    // Una página floja de un grupo cuenta una vez por grupo (se rehace el grupo entero)
    const weakGroups = new Set(weak.filter(i => !fixable.includes(i)).map(i => book.plan[i].special.group));
    const todo = new Set([...fixable, ...twinFix]).size + weakGroups.size;
    if (reviewFixBtn) { reviewFixBtn.disabled = !todo; reviewFixBtn.textContent = todo ? `Rehacer flojas y gemelas (${todo})` : "Rehacer flojas y gemelas"; }
  };
  // De cada par gemelo se rehace la página posterior (si no es de un grupo; si lo es, la otra)
  const twinTargets = (book, twins) => curatorTwinTargets(twins, (k) => book.plan[k].special?.group == null);

  const fillCard = (card, book, i) => {
    const { svg, opts } = pageSvg(book, i);
    const changed = currentOverrides().has(book.ovKey(i));
    card.classList.toggle("changed", changed);
    card.querySelector(".thumb").innerHTML = svg;
    let sc = null, issues = [];
    if (scorable(opts)) ({ score: sc, issues } = scoreSvg(svg, opts));
    reviewScores.set(i, sc);
    reviewFps.set(i, fpOf(svg, opts));
    card.classList.toggle("weak", sc != null && sc < WEAK_SCORE);
    const meta = card.querySelector(".meta");
    meta.textContent =
      opts.special
        ? `${i + 1} · ✨ ${specialLabel(opts.special)}`
        : `${i + 1} · ${COMP_NAMES[opts.figure ? "figura" : opts.figureRing ? "anillos" : opts.composition] || opts.composition || ""} · ${STYLE_NAMES[opts.styleMode] || opts.styleMode || ""}`;
    if (sc != null) {
      const b = document.createElement("b");
      b.className = "score";
      b.textContent = ` · ${sc}`;
      b.style.color = scoreColor(sc);
      meta.appendChild(b);
      meta.title = issues.length ? `Puntuación ${sc}/100:\n• ${issues.join("\n• ")}` : `Puntuación ${sc}/100: sin defectos medidos.`;
      // En el móvil no hay «title» al tocar: el motivo de una página floja va a la vista
      if (sc < WEAK_SCORE && issues.length) {
        const why = document.createElement("div");
        why.className = "why";
        why.textContent = issues.slice(0, 2).join(" · ");
        meta.appendChild(why);
      }
    } else meta.title = "Página especial: la puntuación no se aplica.";
  };

  // ---------- Curaduría automática (bookCurator.js) ----------
  // Prueba hasta CURATE_TRIES diseños nuevos por página floja o gemela y se queda con el
  // mejor que no repita otra página. Los primeros intentos cambian el diseño; los últimos,
  // si hace falta, también el encuadre por uno más limpio de los permitidos.
  // measured: [{ score, fp }] por página (de la revisión o medidas aquí mismo).
  const curateOverrides = async (book0, measured, { onStep } = {}) => {
    const pages = measured.map((m, i) => ({ ...m, fixable: book0.plan[i].special?.group == null,
      // Secuencia que crece o mural: se rehace el grupo entero (misma semilla para todas sus páginas)
      group: book0.plan[i].special?.group ?? null, groupFixable: true }));
    return curateBook(pages, async (i, k) => {
      const key = book0.ovKey(i);
      const start = currentOverrides().get(key);
      const pg = book0.plan[i];
      const members = pg.special?.group != null ? book0.plan.map((_, j) => j).filter(j => book0.ovKey(j) === key) : null;
      const choice = {
        ...(start || {}),
        ...attemptChoice(k, {
          current: start?.composition || pg.composition, allowed: book0.comps, startBump: start?.bump || 0,
          // Sólo mandalas normales del motor clásico; un medio mandala cortaría a la figura
          canReframe: book0.isClassic && bookVaryEl.checked && !pg.special && !pg.centerArt,
        }),
      };
      currentOverrides().set(key, choice);
      try {
        const nb = buildBook();
        const measure = (j) => { const { svg, opts } = pageSvg(nb, j); return { i: j, score: scorable(opts) ? scoreSvg(svg, opts).score : null, fp: fpOf(svg, opts) }; };
        if (members) return { members: members.map(measure), choice };
        return { ...measure(i), choice };
      } finally {
        if (start) currentOverrides().set(key, start); else currentOverrides().delete(key);
        await new Promise(r => setTimeout(r, 0)); // la ventana sigue respondiendo
      }
    }, { tries: CURATE_TRIES, onStep }).then(res => {
      for (const [i, choice] of res.changes) { currentOverrides().set(book0.ovKey(i), choice); autoKeys.add(book0.ovKey(i)); }
      return res;
    });
  };

  // Firma del libro (sin los cambios por página): si no cambia, no hace falta volver a curarlo
  const curatedSigs = new Set();
  const bookSignature = (book) => {
    const plain = Object.entries(buildOpts(state)).filter(([, v]) => v === null || typeof v !== "object");
    return JSON.stringify([state.preset, state.generatorType, book.plan, plain, bookMargin(bookPageCount(bookLayoutOpts()))]);
  };
  const autoQualityEl = document.getElementById("bookAutoQuality");
  const autoQuality = () => autoQualityEl ? autoQualityEl.checked : true;

  const fixWeakPages = async () => {
    const book0 = buildBook();
    const measured = Array.from({ length: book0.count }, (_, i) => ({ score: reviewScores.get(i) ?? null, fp: reviewFps.get(i) || null }));
    if (reviewFixBtn) reviewFixBtn.loading = true;
    const cards = [...reviewGrid.children];
    try {
      const res = await curateOverrides(book0, measured);
      const nb = buildBook();
      const keys = new Set([...res.changes.keys()].map(i => nb.ovKey(i)));
      nb.plan.forEach((_, k) => {
        if (!keys.has(nb.ovKey(k))) return;
        fillCard(cards[k], nb, k);
        cards[k].animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 350 });
      });
      curatedSigs.add(bookSignature(nb));
      return res;
    } finally {
      if (reviewFixBtn) reviewFixBtn.loading = false;
      updateQualitySummary(buildBook());
      updateReviewInfo();
    }
  };

  // Antes de crear el PDF sin pasar por la revisión: mide cada página y cura el libro.
  // Devuelve el resumen (o null si no hizo falta).
  const ensureCurated = async (onProgress) => {
    const book0 = buildBook();
    const sig = bookSignature(book0);
    if (!autoQuality() || curatedSigs.has(sig)) return null;
    const measured = [];
    for (let i = 0; i < book0.count; i++) {
      const { svg, opts } = pageSvg(book0, i);
      measured.push({ score: scorable(opts) ? scoreSvg(svg, opts).score : null, fp: fpOf(svg, opts) });
      onProgress?.(i + 1, book0.count, "Revisando la calidad de cada página");
      await new Promise(r => setTimeout(r, 0));
    }
    const res = await curateOverrides(book0, measured, {
      onStep: (n, tot) => onProgress?.(n, tot, "Rehaciendo páginas flojas o repetidas"),
    });
    curatedSigs.add(sig);
    updateReviewInfo();
    return res;
  };

  const openReview = async () => {
    const token = ++reviewToken;
    const book = buildBook();
    reviewGrid.innerHTML = "";
    reviewScores.clear();
    reviewFps.clear();
    if (reviewQualityEl) reviewQualityEl.textContent = "Midiendo la calidad de cada página…";
    if (reviewFixBtn) reviewFixBtn.disabled = true;
    reviewDialog.show();
    for (let i = 0; i < book.count; i++) {
      const card = document.createElement("div");
      card.className = "review-card";
      card.innerHTML = `<div class="thumb"><sl-spinner></sl-spinner></div><div class="meta"></div>
        <div class="actions">${book.plan[i].special?.type === "solutions" ? "" : `<sl-button size="small" variant="danger" outline data-act="seed"><sl-icon slot="prefix" name="trash"></sl-icon>${book.plan[i].special?.group != null ? "Cambiar todo el grupo" : "Borrar y crear otro"}</sl-button>`}${book.isClassic && bookVaryEl.checked && !book.plan[i].special ? '<sl-button size="small" data-act="comp">Otro encuadre</sl-button>' : ""}</div>`;
      card.addEventListener("click", (e) => {
        const act = e.target.closest("sl-button")?.dataset.act;
        if (!act) return;
        const key = book.ovKey(i);
        const ov = { ...(currentOverrides().get(key) || {}) };
        autoKeys.delete(key); // a partir de aquí, la página es un cambio a mano
        if (act === "seed") ov.bump = (ov.bump || 0) + 1;
        if (act === "comp") {
          const b = buildBook();
          const cur = b.makeOpts(i).composition;
          const list = b.comps.length > 1 ? b.comps : Object.keys(COMP_WEIGHTS);
          ov.composition = list[(list.indexOf(cur) + 1) % list.length];
        }
        currentOverrides().set(key, ov);
        // El reemplazo se dibuja en el acto, en el mismo lugar del libro. Con él se
        // redibujan su grupo (etapas, hojas del mural) y la página de soluciones
        const nb = buildBook();
        const cards = [...reviewGrid.children];
        nb.plan.forEach((p, k) => {
          if (k === i || nb.ovKey(k) === key || (p.special?.type === "solutions" && book.plan[i].special?.type === "mystery")) {
            fillCard(cards[k], nb, k);
            cards[k].animate([{ opacity: 0.2 }, { opacity: 1 }], { duration: 350 });
          }
        });
        updateReviewInfo();
        updateQualitySummary(nb);
      });
      reviewGrid.appendChild(card);
    }
    // Miniaturas una a una: la ventana sigue respondiendo mientras se dibujan
    const cards = [...reviewGrid.children];
    for (let i = 0; i < cards.length; i++) {
      if (token !== reviewToken) return;
      await new Promise(r => setTimeout(r, 0));
      try { fillCard(cards[i], book, i); } catch (err) { console.error("Miniatura", i, err); }
    }
    updateQualitySummary(book);
    // Control de calidad automático: rehace solo las flojas y gemelas (una vez por libro)
    if (token !== reviewToken) return;
    if (autoQuality() && !curatedSigs.has(bookSignature(book))) {
      if (reviewQualityEl) reviewQualityEl.innerHTML += "<br>⏳ Rehaciendo automáticamente las páginas flojas y gemelas…";
      const res = await fixWeakPages();
      if (token !== reviewToken || !res || !reviewQualityEl) return;
      if (!res.targets.length) { reviewQualityEl.innerHTML = reviewQualityEl.innerHTML.replace(/<br>⏳[^<]*$/, ""); return; }
      const a = res.after;
      reviewQualityEl.innerHTML += `<br>✨ Control automático: ${res.changes.size} página(s) rehecha(s)` +
        (a.mean != null ? ` · media ${Math.round(res.before.mean)} → ${Math.round(a.mean)}` : "") + ".";
    }
  };

  const reviewBtn = document.getElementById("reviewBook");
  if (reviewBtn && reviewDialog) {
    reviewBtn.addEventListener("click", openReview);
    document.getElementById("reviewClose")?.addEventListener("click", () => reviewDialog.hide());
    document.getElementById("reviewReset")?.addEventListener("click", () => {
      bookOverrides = new Map();
      curatedSigs.clear();
      autoKeys.clear();
      updateReviewInfo();
      openReview();
    });
    document.getElementById("reviewCreate")?.addEventListener("click", () => { reviewDialog.hide(); downloadBook(); });
    reviewFixBtn?.addEventListener("click", () => fixWeakPages());
    reviewDialog.addEventListener("sl-after-hide", (e) => { if (e.target === reviewDialog) reviewToken++; });
  }
  // Cambiar el número de páginas o las composiciones permitidas rehace el plan
  const syncProfileUI = () => {
    const rent = bestSeller();
    const box = document.getElementById("bookCompBox");
    if (box) box.classList.toggle("hidden-by-profile", rent);
    const info = document.getElementById("bookProfileInfo");
    if (info) info.textContent = rent
      ? (/8_5x8_5/.test(state.preset)
          ? "Cuadrado 8.5×8.5: sobre todo mandalas grandes centrados a página completa; pocos fondos decorados; sin medios mandalas. 12–24 pétalos, floral y geométrico primero."
          : "Mandalas grandes centrados como base, con algunas páginas decoradas para variar; sin medios mandalas. 12–24 pétalos, floral y geométrico primero.")
      : "";
  };
  bookProfileEl?.addEventListener("sl-change", () => { bookOverrides = new Map(); updateReviewInfo(); syncProfileUI(); });
  presetEl.addEventListener("sl-change", syncProfileUI);
  syncProfileUI();
  document.querySelectorAll(".bookComp").forEach(b => b.addEventListener("sl-change", () => { bookOverrides = new Map(); updateReviewInfo(); }));
  bookVaryEl?.addEventListener("sl-change", () => { bookOverrides = new Map(); updateReviewInfo(); updateGeneratorUI(); });
  bookChaptersEl?.addEventListener("sl-change", () => { bookOverrides = new Map(); updateReviewInfo(); updateBookSummary(); });
  bookDifficultyEl?.addEventListener("sl-change", () => { bookOverrides = new Map(); updateReviewInfo(); });
  [bookGrowthEl, bookMysteryEl, bookNatureEl, bookMuralEl].forEach(el => el?.addEventListener("sl-change", () => {
    bookOverrides = new Map(); updateReviewInfo(); updateBookSummary();
  }));
  bookMysteryEl?.addEventListener("sl-input", updateBookSummary);

  const downloadBook = async () => {
    const layoutOpts = bookLayoutOpts();
    const total = bookPageCount(layoutOpts);
    if (total < 24 && !confirm(`El libro tendría ${total} páginas y KDP exige mínimo 24. ¿Crear de todos modos?`)) return;
    const marginMm = bookMargin(total);

    bookBtn.loading = true;
    bookBtn.disabled = true;
    if (progressDialog) {
      if (progressBar) progressBar.value = 0;
      if (progressStatus) progressStatus.textContent = "Creando libro...";
      progressDialog.show();
    }
    const progress = (done, tot, label) => {
      if (progressBar && progressStatus) {
        const percent = Math.round((done / tot) * 100);
        progressBar.value = percent;
        progressStatus.textContent = `${label} (${percent}%)`;
      }
    };
    let curated = null;
    try {
      // Control de calidad automático: las páginas flojas o repetidas se rehacen antes
      // de dibujar el PDF (si ya se hizo en la revisión, no se repite)
      curated = await ensureCurated(progress);
      const { count, baseSeed, makeOpts, sourceLog, generatorFn } = buildBook();
      const filename = `libro_${state.preset}_${count}mandalas_semilla${baseSeed}.pdf`;
      await downloadBookPdf(filename, generatorFn, count, {
        preset: state.preset,
        genOpts: makeOpts,
        title: (bookTitleEl.value || "").trim() || "Mandalas para Colorear",
        subtitle: (bookSubtitleEl?.value || "").trim(),
        author: (bookAuthorEl?.value || "").trim(),
        ...layoutOpts,
        pageNumbers: bookPageNumbersEl.checked,
        blackBack: backMode() === "negro",
        marginMm,
        dpi: parseInt(bookDpiEl?.value, 10) || 300,
        onProgress: progress,
      });
      // Registro de fuentes (CSV) junto al PDF, si el libro lleva imágenes del usuario
      if (sourceLog.some(r => r && r.source)) { // sólo si alguna imagen trae fuente anotada
        const layout = bookLayout({ ...layoutOpts, mandalas: count + (layoutOpts.colorTest ? 1 : 0) });
        const off = layoutOpts.colorTest ? 1 : 0;
        const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const rows = [["pagina_pdf", "mandala", "composicion_o_uso", "estilo", "imagen_origen", "fuente"].join(",")];
        sourceLog.forEach((r, i) => {
          if (!r) return;
          const page = layout.findIndex(p => p.kind === "mandala" && p.index === i + off) + 1;
          rows.push([page, r.mandala, q(r.composition), q(r.style), q(r.image), q(r.source)].join(","));
        });
        downloadTextFile(filename.replace(/\.pdf$/, "_registro_fuentes.csv"), rows.join("\n"));
      }
      const qa = curated?.after;
      const qaMsg = qa?.mean != null
        ? ` Control de calidad: ${curated.changes.size} página(s) rehecha(s); media ${Math.round(qa.mean)}/100` +
          (qa.weak.length ? `, ${qa.weak.length} aún floja(s): revísalas en «Revisar páginas».` : ", ninguna floja.") +
          (qa.twins.length ? ` ${qa.twins.length} par(es) de páginas aún parecidas.` : "")
        : "";
      alert(`✅ Libro creado (${total} páginas, margen ${marginMm.toFixed(1)} mm).${qaMsg} ` +
        "En KDP elige: tinta negra, papel blanco, sin sangrado, y el mismo tamaño de corte.");
    } catch (error) {
      console.error("Book PDF error:", error);
      alert("❌ Error al crear el libro: " + (error.message || "Intenta de nuevo"));
    } finally {
      bookBtn.loading = false;
      bookBtn.disabled = false;
      if (progressDialog) setTimeout(() => progressDialog.hide(), 500);
    }
  };

  if (bookBtn) {
    bookBtn.addEventListener("click", downloadBook);
    document.addEventListener("figures-changed", updateBookSummary);
    [bookPagesEl, bookBackEl, bookTitlePageEl, bookCopyrightEl, bookColorTestEl, presetEl, bookDpiEl, coloringPresetEl, strokeWidthEl, generatorTypeEl].forEach(el =>
      el && el.addEventListener("sl-change", updateBookSummary));
    bookPagesEl.addEventListener("sl-input", updateBookSummary);
    updateBookSummary();
  }

  if (shareBtn) {
    shareBtn.addEventListener("click", shareBtnHandler);
  }

  // Keyboard shortcuts for rapid production
  window.addEventListener("keydown", (e) => {
    // Ignore if typing in an input
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

    const key = e.key.toLowerCase();

    if (key === "f") {
      const svg = stage.querySelector("svg");
      if (svg) flattenSvgElement(svg);
    } else if (key === "arrowright" || key === "n") {
      // Next seed
      state.seed = ((state.seed >>> 0) + 1) >>> 0;
      seedInputEl.value = String(state.seed);
      update();
    } else if (key === "arrowleft" || key === "p") {
      // Previous seed
      state.seed = ((state.seed >>> 0) - 1) >>> 0;
      seedInputEl.value = String(state.seed);
      update();
    } else if (key === " " || key === "r") {
      // Random seed
      e.preventDefault();
      state.seed = randomSeed32() >>> 0;
      seedInputEl.value = String(state.seed);
      update();
    } else if (key === "s" && !e.ctrlKey && !e.metaKey) {
      // Quick save to favorites
      const svgEl = stage.querySelector("svg");
      const saveFavoriteQuick = async () => {
        let thumbnail = null;
        if (svgEl) {
          try {
            thumbnail = await svgStringToImageData(svgEl.outerHTML, 150, 150);
          } catch (e) {
            console.error("Could not create PNG thumbnail:", e);
          }
        }
        try {
          await saveToFavorites(state, thumbnail);
          alert("¡Guardado en favoritos!");
        } catch (e) {
          console.error("No se pudo guardar el favorito:", e);
          alert("No se pudo guardar en favoritos (¿sin conexión?).");
        }
      };
      saveFavoriteQuick();
    }
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      console.log('SW registered!', reg);
    }).catch(err => {
      console.log('SW registration failed!', err);
    });
  });
}

// Restore uploaded image from sessionStorage if present
const savedImage = sessionStorage.getItem("mandala_uploaded_image");
if (savedImage) {
  const img = new Image();
  img.onload = () => {
    currentImage = img;
    reprocessImage();
  };
  img.src = savedImage;
}

bindUI();
render();
