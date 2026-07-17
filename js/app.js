import { getStateFromURL, setStateToURL, randomSeed32 } from "./core/urlState.js";
import { createDoc } from "./core/svgDoc.js";
import { renderDocToSvgString } from "./core/svgRender.js";
import { downloadTextFile, downloadPng, downloadPdf, downloadBatchPdf, flattenSvgElement, svgStringToImageData } from "./core/export.js";
import { mulberry32, pick, rFloat, rInt } from "./core/prng.js";
import { TAOISTA_DATASET } from "../dataset_taoista.js";
import { generateMandalaLayers } from "./generators/mandalaLayers.js";
import { generateMandalaRadial } from "./generators/mandalaRadial.js";
import { StateHistory } from "./core/history.js";
import { saveToFavorites, getFavorites, deleteFavorite } from "./core/storage.js";
import { ImageProcessor } from "./core/imageProcessor.js";
import { PathBuilder } from "./core/pathBuilder.js";

const historyMan = new StateHistory();
const imgProc = new ImageProcessor();
let currentImage = null;
let currentImagePoints = [];
let listenersBound = false;

const stage = document.getElementById("stage");
const presetEl = document.getElementById("preset");
const petalsEl = document.getElementById("petals");

const complexityEl = document.getElementById("complexity");
const organicEl = document.getElementById("organic");

const seedInputEl = document.getElementById("seed");
const structurePresetEl = document.getElementById("structurePreset");
const applyStructureBtn = document.getElementById("applyStructure");

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
const applyColoringPresetBtn = document.getElementById("applyColoringPreset");

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

const kaleidoscopeEl = document.getElementById("kaleidoscope");
const texturesEl = document.getElementById("textures");

const imageThresholdEl = document.getElementById("imageThreshold");
const imageZoomEl = document.getElementById("imageZoom");
const imageScaleEl = document.getElementById("imageScale");
const imageOffsetXEl = document.getElementById("imageOffsetX");
const imageOffsetYEl = document.getElementById("imageOffsetY");
const imageIntensityEl = document.getElementById("imageIntensity");
const imageUploadEl = document.getElementById("imageUpload");
const uploadBtn = document.getElementById("uploadBtn");

const DEFAULTS = {
  generatorType: "layers",
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
    layer1Intensity: 0.5,
    layer2Intensity: 0.3,
    layer3Intensity: 0.2,
    layer4Intensity: 0.3,
    layer5Intensity: 0.1,
    layer6Intensity: 0.3,
    layer7Intensity: 0.15,
    layer8Intensity: 0.1,
    outlineMode: true,
  },
  ninos_grande: {
    // Niños grandes (9-12 años) - Simple
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
    layer1Intensity: 0.6,
    layer2Intensity: 0.45,
    layer3Intensity: 0.35,
    layer4Intensity: 0.45,
    layer5Intensity: 0.2,
    layer6Intensity: 0.45,
    layer7Intensity: 0.25,
    layer8Intensity: 0.15,
    outlineMode: true,
  },
  adulto: {
    // Adulto - Balanceado (default)
    complexity: 130,
    organic: 0.25,
    strokeWidth: 0.55,
    spacing: 0.3,
    densityFactor: 0.7,
    minCellArea: 3.0,
    detailSimplification: 0.5,
    textures: true,
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
if (!state.generatorType) state.generatorType = "layers";
if (!state.structurePreset || !STRUCTURE_PRESETS[state.structurePreset]) state.structurePreset = "custom";
if (!state.coloringPreset || !COLORING_PRESETS[state.coloringPreset]) state.coloringPreset = "adulto";

if (state.styleMode === "hashiko") state.styleMode = "sashiko";

if (!stage || !presetEl || !petalsEl || !seedInputEl || !structurePresetEl || !applyStructureBtn) {
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

function buildOpts(s) {
  return {
    seed: s.seed,
    petals: s.petals,
    complexity: s.complexity,
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
    // Phase 5: Coloring Book Controls
    spacing: s.spacing,
    densityFactor: s.densityFactor,
    minCellAreaMm2: s.minCellArea,
    detailSimplification: s.detailSimplification,
    outlineMode: s.outlineMode,
  };
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
  
  if (layersAccordionItem) layersAccordionItem.style.display = isRadial ? "none" : "block";
  
  if (styleModeEl) {
    const styleModeGroup = styleModeEl.closest('.control-group > sl-select') || styleModeEl;
    styleModeGroup.style.display = isRadial ? "none" : "block";
  }

  if (imageAccordionItem) imageAccordionItem.style.display = isRadial ? "none" : "block";
  
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

  const effectiveComplexity = Math.max(20, Math.round(state.complexity * scaleComplexity));
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

    const generatorFn = state.generatorType === "radial" ? generateMandalaRadial : generateMandalaLayers;

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
  } else {
    generateMandalaLayers(doc, {
      ...opts,
      imagePoints: currentImagePoints,
      imageScale: state.imageScale,
      imageIntensity: state.imageIntensity,
    });
  }

  const svgStr = renderDocToSvgString(doc);
  stage.innerHTML = svgStr;

  const svgEl = stage.querySelector("svg");
  const pathCount = svgEl ? svgEl.querySelectorAll("path").length : 0;
  pathsText.textContent = String(pathCount);

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
  const favorites = await getFavorites();
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

  if (complexityEl) complexityEl.value = String(state.complexity);
  if (organicEl) organicEl.value = String(state.organic);

  // Phase 5: Coloring Book Controls
  if (spacingEl) spacingEl.value = String(state.spacing);
  if (densityFactorEl) densityFactorEl.value = String(state.densityFactor);
  if (minCellAreaEl) minCellAreaEl.value = String(state.minCellArea);
  if (detailSimplificationEl) detailSimplificationEl.value = String(state.detailSimplification);

  strokeWidthEl.value = String(state.strokeWidth);
  framesEl.checked = state.frames;
  pageBorderEl.checked = state.pageBorder;
  kaleidoscopeEl.checked = state.kaleidoscope;
  texturesEl.checked = state.textures;
  
  // New coloring book features
  if (coloringPresetEl) coloringPresetEl.value = state.coloringPreset;
  if (outlineModeEl) outlineModeEl.checked = state.outlineMode;

  styleModeEl.value = state.styleMode;
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
    await saveToFavorites(state, thumbnail);
    saveFavBtn.loading = false;
    alert("¡Guardado en favoritos!");
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
      state.generatorType = generatorTypeEl.value || "layers";
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

  if (complexityEl) {
    complexityEl.addEventListener("sl-input", () => {
      state.complexity = clampInt(complexityEl.value, 20, 320);
      state.structurePreset = "custom";
      structurePresetEl.value = "custom";
      debouncedRender();
    });
    complexityEl.addEventListener("sl-change", updateImmediate);
  }

  if (organicEl) {
    organicEl.addEventListener("sl-input", () => {
      state.organic = clampFloat(organicEl.value, 0, 1);
      state.structurePreset = "custom";
      structurePresetEl.value = "custom";
      debouncedRender();
    });
    organicEl.addEventListener("sl-change", updateImmediate);
  }

  // Phase 5: Coloring Book Controls
  if (spacingEl) {
    spacingEl.addEventListener("sl-input", () => {
      state.spacing = clampFloat(spacingEl.value, 0, 1);
      debouncedRender();
    });
    spacingEl.addEventListener("sl-change", updateImmediate);
  }

  if (densityFactorEl) {
    densityFactorEl.addEventListener("sl-input", () => {
      state.densityFactor = clampFloat(densityFactorEl.value, 0.2, 1.5);
      debouncedRender();
    });
    densityFactorEl.addEventListener("sl-change", updateImmediate);
  }

  if (minCellAreaEl) {
    minCellAreaEl.addEventListener("sl-input", () => {
      state.minCellArea = clampFloat(minCellAreaEl.value, 1, 8);
      debouncedRender();
    });
    minCellAreaEl.addEventListener("sl-change", updateImmediate);
  }

  if (detailSimplificationEl) {
    detailSimplificationEl.addEventListener("sl-input", () => {
      state.detailSimplification = clampFloat(detailSimplificationEl.value, 0, 1);
      debouncedRender();
    });
    detailSimplificationEl.addEventListener("sl-change", updateImmediate);
  }

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

  uploadBtn.onclick = () => imageUploadEl.click();
  imageUploadEl.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      compressAndStoreImage(file, (img) => {
        currentImage = img;
        reprocessImage();
      });
    }
  };

  structurePresetEl.addEventListener("sl-change", () => {
    state.structurePreset = structurePresetEl.value || "custom";
  });

  applyStructureBtn.addEventListener("click", () => {
    if (applyStructurePreset(state.structurePreset)) {
      bindUI();
      update();
    }
  });
  
  // Coloring preset button
  if (applyColoringPresetBtn && coloringPresetEl) {
    applyColoringPresetBtn.addEventListener("click", () => {
      const presetKey = coloringPresetEl.value;
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
      state.generatorType = pick(shuffleRng, ["layers", "radial"]);
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
        Object.entries(coloringPreset).forEach(([key, value]) => {
          // Don't override seed or style-related properties in shuffle
          if (!['complexity', 'organic', 'styleMode'].includes(key)) {
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
          const filename = `mandala_${state.preset}_seed_${state.seed}.svg`;
          downloadTextFile(filename, svg.outerHTML);
        } else if (id === "downloadPng") {
          const svg = stage.querySelector("svg");
          if (!svg) return;
          const doc = getCurrentDoc();
          const filename = `mandala_${state.preset}_seed_${state.seed}_${state.pngDpi}dpi.png`;
          const { wMm, hMm } = doc.page;
          await downloadPng(filename, svg.outerHTML, wMm, hMm, state.pngDpi || 300);
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
        state.generatorType === "radial" ? generateMandalaRadial : generateMandalaLayers,
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
        await saveToFavorites(state, thumbnail);
        alert("¡Guardado en favoritos!");
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
