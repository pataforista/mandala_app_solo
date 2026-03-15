import { getStateFromURL, setStateToURL, randomSeed32 } from "./core/urlState.js";
import { createDoc } from "./core/svgDoc.js";
import { renderDocToSvgString } from "./core/svgRender.js";
import { downloadTextFile, downloadPng, downloadPdf, downloadBatchPdf, flattenSvgElement } from "./core/export.js";
import { generateMandalaLayers } from "./generators/mandalaLayers.js";
import { StateHistory } from "./core/history.js";
import { saveToFavorites, getFavorites, deleteFavorite } from "./core/storage.js";

const historyMan = new StateHistory();
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

const styleModeEl = document.getElementById("styleMode");
const layer1IntensityEl = document.getElementById("layer1Intensity");
const layer2IntensityEl = document.getElementById("layer2Intensity");
const layer3IntensityEl = document.getElementById("layer3Intensity");
const layer4IntensityEl = document.getElementById("layer4Intensity");
const layer5IntensityEl = document.getElementById("layer5Intensity");
const layer6IntensityEl = document.getElementById("layer6Intensity");
const layer7IntensityEl = document.getElementById("layer7Intensity");
const layer8IntensityEl = document.getElementById("layer8Intensity");

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

const DEFAULTS = {
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

const recentSeeds = [];

const state = getStateFromURL(DEFAULTS);

if (typeof state.frames === "string") state.frames = state.frames === "true";
if (typeof state.pageBorder === "string") state.pageBorder = state.pageBorder === "true";
if (typeof state.kaleidoscope === "string") state.kaleidoscope = state.kaleidoscope === "true";
if (typeof state.textures === "string") state.textures = state.textures === "true";
if (!STRUCTURE_PRESETS[state.structurePreset]) state.structurePreset = "custom";

if (state.styleMode === "hashiko") state.styleMode = "sashiko";

if (!stage || !presetEl || !petalsEl || !complexityEl || !organicEl || !seedInputEl || !structurePresetEl || !applyStructureBtn) {
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

function getCurrentDoc() {
  return createDoc({
    preset: state.preset,
    seed: state.seed,
    marginMm: 10,
  });
}

function render() {
  seedText.textContent = String(state.seed >>> 0);

  const doc = getCurrentDoc();

  generateMandalaLayers(doc, {
    seed: state.seed,
    petals: state.petals,
    complexity: state.complexity,
    strokeWidthMm: state.strokeWidth,
    organicLevel: state.organic,
    includeFrames: state.frames,
    pageBorder: state.pageBorder,
    kaleidoscope: state.kaleidoscope,
    textures: state.textures,
    styleMode: state.styleMode,
    layer1Intensity: state.layer1Intensity,
    layer2Intensity: state.layer2Intensity,
    layer3Intensity: state.layer3Intensity,
    layer4Intensity: state.layer4Intensity,
    layer5Intensity: state.layer5Intensity,
    layer6Intensity: state.layer6Intensity,
    layer7Intensity: state.layer7Intensity,
    layer8Intensity: state.layer8Intensity,
  });

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

  // Push to history after render
  historyMan.push(state);
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

      const thumbHtml = fav.thumbnail
        ? `<div style="width:100%; aspect-ratio:1; overflow:hidden; border-radius:6px; background:#fafafa; display:flex; align-items:center; justify-content:center;">${fav.thumbnail}</div>`
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

  styleModeEl.value = state.styleMode;
  layer1IntensityEl.value = String(state.layer1Intensity);
  layer2IntensityEl.value = String(state.layer2Intensity);
  layer3IntensityEl.value = String(state.layer3Intensity);
  layer4IntensityEl.value = String(state.layer4Intensity);
  layer5IntensityEl.value = String(state.layer5Intensity);
  layer6IntensityEl.value = String(state.layer6Intensity);
  layer7IntensityEl.value = String(state.layer7Intensity);
  layer8IntensityEl.value = String(state.layer8Intensity);

  structurePresetEl.value = state.structurePreset;
  seedInputEl.value = String(state.seed);

  const update = () => {
    setStateToURL(state);
    render();
  };

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
    const svgEl = stage.querySelector("svg");
    const thumbnail = svgEl ? svgEl.outerHTML : null;
    await saveToFavorites(state, thumbnail);
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
  seedInputEl.addEventListener("sl-change", update);

  presetEl.addEventListener("sl-change", () => {
    state.preset = presetEl.value;
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
    update();
  });

  petalsEl.addEventListener("sl-input", () => {
    state.petals = clampInt(petalsEl.value, 6, 96);
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
  });
  petalsEl.addEventListener("sl-change", update);

  complexityEl.addEventListener("sl-input", () => {
    state.complexity = clampInt(complexityEl.value, 20, 320);
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
  });
  complexityEl.addEventListener("sl-change", update);

  organicEl.addEventListener("sl-input", () => {
    state.organic = clampFloat(organicEl.value, 0, 1);
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
  });
  organicEl.addEventListener("sl-change", update);

  strokeWidthEl.addEventListener("sl-input", () => {
    state.strokeWidth = clampFloat(strokeWidthEl.value, 0.1, 5.0);
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
  });
  strokeWidthEl.addEventListener("sl-change", update);

  framesEl.addEventListener("sl-change", () => {
    state.frames = framesEl.checked;
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
    update();
  });

  pageBorderEl.addEventListener("sl-change", () => {
    state.pageBorder = pageBorderEl.checked;
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
    update();
  });

  kaleidoscopeEl.addEventListener("sl-change", () => {
    state.kaleidoscope = kaleidoscopeEl.checked;
    update();
  });

  texturesEl.addEventListener("sl-change", () => {
    state.textures = texturesEl.checked;
    update();
  });

  styleModeEl.addEventListener("sl-change", () => {
    state.styleMode = styleModeEl.value;
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
    update();
  });

  layer1IntensityEl.addEventListener("sl-input", () => {
    state.layer1Intensity = clampFloat(layer1IntensityEl.value, 0, 1);
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
  });
  layer1IntensityEl.addEventListener("sl-change", update);

  layer2IntensityEl.addEventListener("sl-input", () => {
    state.layer2Intensity = clampFloat(layer2IntensityEl.value, 0, 1);
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
  });
  layer2IntensityEl.addEventListener("sl-change", update);

  layer3IntensityEl.addEventListener("sl-input", () => {
    state.layer3Intensity = clampFloat(layer3IntensityEl.value, 0, 1);
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
  });
  layer3IntensityEl.addEventListener("sl-change", update);

  layer4IntensityEl.addEventListener("sl-input", () => {
    state.layer4Intensity = clampFloat(layer4IntensityEl.value, 0, 1);
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
  });
  layer4IntensityEl.addEventListener("sl-change", update);

  layer5IntensityEl.addEventListener("sl-input", () => {
    state.layer5Intensity = clampFloat(layer5IntensityEl.value, 0, 1);
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
  });
  layer5IntensityEl.addEventListener("sl-change", update);

  layer6IntensityEl.addEventListener("sl-input", () => {
    state.layer6Intensity = clampFloat(layer6IntensityEl.value, 0, 1);
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
  });
  layer6IntensityEl.addEventListener("sl-change", update);

  layer7IntensityEl.addEventListener("sl-input", () => {
    state.layer7Intensity = clampFloat(layer7IntensityEl.value, 0, 1);
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
  });
  layer7IntensityEl.addEventListener("sl-change", update);

  layer8IntensityEl.addEventListener("sl-input", () => {
    state.layer8Intensity = clampFloat(layer8IntensityEl.value, 0, 1);
    state.structurePreset = "custom";
    structurePresetEl.value = "custom";
  });
  layer8IntensityEl.addEventListener("sl-change", update);

  structurePresetEl.addEventListener("sl-change", () => {
    state.structurePreset = structurePresetEl.value || "custom";
  });

  applyStructureBtn.addEventListener("click", () => {
    if (applyStructurePreset(state.structurePreset)) {
      bindUI();
      update();
    }
  });

  const prevSeedBtn = document.getElementById("prevSeed");
  const nextSeedBtn = document.getElementById("nextSeed");

  prevSeedBtn.addEventListener("click", () => {
    state.seed = ((state.seed >>> 0) - 1) >>> 0;
    seedInputEl.value = String(state.seed);
    update();
  });

  nextSeedBtn.addEventListener("click", () => {
    state.seed = ((state.seed >>> 0) + 1) >>> 0;
    seedInputEl.value = String(state.seed);
    update();
  });

  regenBtn.addEventListener("click", () => {
    state.seed = randomSeed32() >>> 0;
    update();
  });

  downloadBtn.addEventListener("click", () => {
    const svg = stage.querySelector("svg");
    if (!svg) return;
    const filename = `mandala_${state.preset}_seed_${state.seed}.svg`;
    downloadTextFile(filename, svg.outerHTML);
  });

  downloadPngBtn.addEventListener("click", () => {
    const svg = stage.querySelector("svg");
    if (!svg) return;
    const doc = getCurrentDoc();
    const filename = `mandala_${state.preset}_seed_${state.seed}_300dpi.png`;
    const { wMm, hMm } = doc.page;
    downloadPng(filename, svg.outerHTML, wMm, hMm, 300);
  });

  downloadPdfBtn.addEventListener("click", async () => {
    const svg = stage.querySelector("svg");
    if (!svg) return;
    const doc = getCurrentDoc();
    const filename = `mandala_${state.preset}_seed_${state.seed}.pdf`;
    const { wMm, hMm } = doc.page;
    await downloadPdf(filename, svg, wMm, hMm);
  });

  const downloadBookBtn = document.getElementById("downloadBook");
  const bookPageCountEl = document.getElementById("bookPageCount");
  downloadBookBtn.addEventListener("click", async () => {
    const doc = getCurrentDoc();
    const { wMm, hMm } = doc.page;
    const count = parseInt(bookPageCountEl.value, 10) || 10;
    const filename = `mandala_coloring_book_${count}p_seed${state.seed}.pdf`;

    // Build proper generator opts for each page
    const buildOpts = (s) => ({
      seed: s.seed,
      petals: s.petals,
      complexity: s.complexity,
      strokeWidthMm: s.strokeWidth,
      organicLevel: s.organic,
      includeFrames: s.frames,
      pageBorder: s.pageBorder,
      kaleidoscope: s.kaleidoscope,
      textures: s.textures,
      styleMode: s.styleMode,
      layer1Intensity: s.layer1Intensity,
      layer2Intensity: s.layer2Intensity,
      layer3Intensity: s.layer3Intensity,
      layer4Intensity: s.layer4Intensity,
      layer5Intensity: s.layer5Intensity,
      layer6Intensity: s.layer6Intensity,
      layer7Intensity: s.layer7Intensity,
      layer8Intensity: s.layer8Intensity,
    });

    const batchOpts = Array.from({ length: count }, (_, i) =>
      buildOpts({ ...state, seed: (state.seed + i * 1234567) >>> 0 })
    );

    downloadBookBtn.loading = true;
    downloadBookBtn.disabled = true;

    try {
      await downloadBatchPdf(filename, batchOpts, generateMandalaLayers, wMm, hMm);
    } finally {
      downloadBookBtn.loading = false;
      downloadBookBtn.disabled = false;
    }
  });

  shareBtn.addEventListener("click", async () => {
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
  });

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
      const thumbnail = svgEl ? svgEl.outerHTML : null;
      saveToFavorites(state, thumbnail);
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

bindUI();
render();
