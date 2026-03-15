import { getStateFromURL, setStateToURL, randomSeed32 } from "./core/urlState.js";
import { createDoc } from "./core/svgDoc.js";
import { renderDocToSvgString } from "./core/svgRender.js";
import { downloadTextFile, downloadPng, downloadPdf, downloadBatchPdf, flattenSvgElement } from "./core/export.js";
import { generateMandalaLayers } from "./generators/mandalaLayers.js";
import { StateHistory } from "./core/history.js";
import { saveToFavorites, getFavorites, deleteFavorite } from "./core/storage.js";

const historyMan = new StateHistory();

const stage = document.getElementById("stage");
const presetEl = document.getElementById("preset");
const petalsEl = document.getElementById("petals");

const complexityEl = document.getElementById("complexity");
const organicEl = document.getElementById("organic");

const seedInputEl = document.getElementById("seed");

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

const DEFAULTS = {
  preset: "A4",
  petals: 12,
  complexity: 110,
  organic: 0.2,
  strokeWidth: 0.6,
  frames: true,
  pageBorder: true,
  styleMode: "hashiko",
  layer1Intensity: 0.8,
  layer2Intensity: 0.6,
  layer3Intensity: 0.7,
  layer4Intensity: 0.5,
  layer5Intensity: 0.4,
  layer6Intensity: 0.7,
  layer7Intensity: 0.6,
  layer8Intensity: 0.3,
  seed: randomSeed32() >>> 0,
};

const recentSeeds = [];

const state = getStateFromURL(DEFAULTS);

if (typeof state.frames === "string") state.frames = state.frames === "true";
if (typeof state.pageBorder === "string") state.pageBorder = state.pageBorder === "true";

if (!stage || !presetEl || !petalsEl || !complexityEl || !organicEl || !seedInputEl) {
  throw new Error("Faltan elementos esenciales de la UI. Verifica que el HTML esté completo.");
}

function clampInt(v, a, b) {
  return Math.max(a, Math.min(b, v | 0));
}

function clampFloat(v, a, b) {
  return Math.max(a, Math.min(b, parseFloat(v) || 0));
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

      card.innerHTML = `
        <div style="font-size: 0.8rem; color: #666;">Seed: ${fav.state.seed}</div>
        <div style="display: flex; gap: 4px;">
          <sl-button size="small" variant="primary" style="flex: 1;" class="load-fav">Cargar</sl-button>
          <sl-button size="small" variant="danger" class="delete-fav"><sl-icon name="trash"></sl-icon></sl-button>
        </div>
      `;

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

  styleModeEl.value = state.styleMode;
  layer1IntensityEl.value = String(state.layer1Intensity);
  layer2IntensityEl.value = String(state.layer2Intensity);
  layer3IntensityEl.value = String(state.layer3Intensity);
  layer4IntensityEl.value = String(state.layer4Intensity);
  layer5IntensityEl.value = String(state.layer5Intensity);
  layer6IntensityEl.value = String(state.layer6Intensity);
  layer7IntensityEl.value = String(state.layer7Intensity);
  layer8IntensityEl.value = String(state.layer8Intensity);

  seedInputEl.value = String(state.seed);

  const update = () => {
    setStateToURL(state);
    render();
  };

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
    await saveToFavorites(state);
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
    update();
  });

  petalsEl.addEventListener("sl-input", () => {
    state.petals = clampInt(petalsEl.value, 6, 96);
  });
  petalsEl.addEventListener("sl-change", update);

  complexityEl.addEventListener("sl-input", () => {
    state.complexity = clampInt(complexityEl.value, 20, 320);
  });
  complexityEl.addEventListener("sl-change", update);

  organicEl.addEventListener("sl-input", () => {
    state.organic = clampFloat(organicEl.value, 0, 1);
  });
  organicEl.addEventListener("sl-change", update);

  strokeWidthEl.addEventListener("sl-input", () => {
    state.strokeWidth = clampFloat(strokeWidthEl.value, 0.1, 5.0);
  });
  strokeWidthEl.addEventListener("sl-change", update);

  framesEl.addEventListener("sl-change", () => {
    state.frames = framesEl.checked;
    update();
  });

  pageBorderEl.addEventListener("sl-change", () => {
    state.pageBorder = pageBorderEl.checked;
    update();
  });

  styleModeEl.addEventListener("sl-change", () => {
    state.styleMode = styleModeEl.value;
    update();
  });

  layer1IntensityEl.addEventListener("sl-input", () => {
    state.layer1Intensity = clampFloat(layer1IntensityEl.value, 0, 1);
  });
  layer1IntensityEl.addEventListener("sl-change", update);

  layer2IntensityEl.addEventListener("sl-input", () => {
    state.layer2Intensity = clampFloat(layer2IntensityEl.value, 0, 1);
  });
  layer2IntensityEl.addEventListener("sl-change", update);

  layer3IntensityEl.addEventListener("sl-input", () => {
    state.layer3Intensity = clampFloat(layer3IntensityEl.value, 0, 1);
  });
  layer3IntensityEl.addEventListener("sl-change", update);

  layer4IntensityEl.addEventListener("sl-input", () => {
    state.layer4Intensity = clampFloat(layer4IntensityEl.value, 0, 1);
  });
  layer4IntensityEl.addEventListener("sl-change", update);

  layer5IntensityEl.addEventListener("sl-input", () => {
    state.layer5Intensity = clampFloat(layer5IntensityEl.value, 0, 1);
  });
  layer5IntensityEl.addEventListener("sl-change", update);

  layer6IntensityEl.addEventListener("sl-input", () => {
    state.layer6Intensity = clampFloat(layer6IntensityEl.value, 0, 1);
  });
  layer6IntensityEl.addEventListener("sl-change", update);

  layer7IntensityEl.addEventListener("sl-input", () => {
    state.layer7Intensity = clampFloat(layer7IntensityEl.value, 0, 1);
  });
  layer7IntensityEl.addEventListener("sl-change", update);

  layer8IntensityEl.addEventListener("sl-input", () => {
    state.layer8Intensity = clampFloat(layer8IntensityEl.value, 0, 1);
  });
  layer8IntensityEl.addEventListener("sl-change", update);

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
  downloadBookBtn.addEventListener("click", async () => {
    const doc = getCurrentDoc();
    const { wMm, hMm } = doc.page;
    const count = 5; // Default batch size
    const filename = `mandala_coloring_book_${state.seed}.pdf`;

    // Create a list of 5 variations based on the current state but different seeds
    const batchStates = Array.from({ length: count }, (_, i) => ({
      ...state,
      seed: (state.seed + i * 1234567) >>> 0
    }));

    alert(`Generando un libro de ${count} mandalas... Por favor, espera.`);

    await downloadBatchPdf(filename, batchStates, generateMandalaLayers, wMm, hMm);
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

  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() !== "f") return;
    const svg = stage.querySelector("svg");
    if (!svg) return;
    flattenSvgElement(svg);
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
