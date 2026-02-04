import { getStateFromURL, setStateToURL, randomSeed32 } from "./core/urlState.js";
import { createDoc, presets } from "./core/svgDoc.js";
import { renderDocToSvgString } from "./core/svgRender.js";
import { downloadTextFile, downloadPng, flattenSvgElement } from "./core/export.js";
import { generateMandalaRadial } from "./generators/mandalaRadial.js";
import { generateZentangleCells } from "./generators/zentangleCells.js";
import { ZENTANGLE_PRESETS } from "./generators/zentangle.presets.js";

const stage = document.getElementById("stage");
const presetEl = document.getElementById("preset");
const petalsEl = document.getElementById("petals");
const petalsOut = document.getElementById("petalsOut");

const complexityEl = document.getElementById("complexity");
const complexityOut = document.getElementById("complexityOut");
const organicEl = document.getElementById("organic");
const organicOut = document.getElementById("organicOut");

const modeEl = document.getElementById("mode");
const seedInputEl = document.getElementById("seed");
const mandalaControls = document.getElementById("mandalaControls");
const zentangleControls = document.getElementById("zentangleControls");

const zPresetEl = document.getElementById("zPreset");
const cellCountEl = document.getElementById("cellCount");
const cellCountOut = document.getElementById("cellCountOut");
const minCellSizeMmEl = document.getElementById("minCellSizeMm");
const minCellSizeMmOut = document.getElementById("minCellSizeMmOut");

const strokeWidthEl = document.getElementById("strokeWidth");
const strokeWidthOut = document.getElementById("strokeWidthOut");
const framesEl = document.getElementById("frames");
const pageBorderEl = document.getElementById("pageBorder");

const alternationEl = document.getElementById("alternation");
const alternationOut = document.getElementById("alternationOut");
const harmonyEl = document.getElementById("harmony");
const harmonyOut = document.getElementById("harmonyOut");
const taperEl = document.getElementById("taper");
const taperOut = document.getElementById("taperOut");

const regenBtn = document.getElementById("regen");
const downloadBtn = document.getElementById("download");
const downloadPngBtn = document.getElementById("downloadPng");
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
  alternation: 0.3,
  harmony: 0.5,
  taper: 0.2,
  mode: "mandala",
  seed: (randomSeed32() >>> 0),
  zPreset: "editorial_premium",
  cellCount: 30,
  minCellSizeMm: 14
};

let state = getStateFromURL(DEFAULTS);

// Fix boolean parsing from URL if needed (URL params are strings)
if (typeof state.frames === "string") state.frames = (state.frames === "true");
if (typeof state.pageBorder === "string") state.pageBorder = (state.pageBorder === "true");

function clampInt(v, a, b) { return Math.max(a, Math.min(b, v | 0)); }
function clampFloat(v, a, b) { return Math.max(a, Math.min(b, parseFloat(v) || 0)); }

function applyPresetToControls(presetKey) {
  const preset = ZENTANGLE_PRESETS[presetKey];
  if (!preset) return;

  if (Number.isFinite(preset.cellCount)) {
    state.cellCount = preset.cellCount;
    cellCountEl.value = String(preset.cellCount);
    cellCountOut.value = String(preset.cellCount);
  }
  if (Number.isFinite(preset.minCellSizeMm)) {
    state.minCellSizeMm = preset.minCellSizeMm;
    minCellSizeMmEl.value = String(preset.minCellSizeMm);
    minCellSizeMmOut.value = String(preset.minCellSizeMm);
  }

  // Overwrite base style params if preset defines them
  if (preset.cellBorderWidthMm) state.strokeWidth = preset.cellBorderWidthMm;
  // etc for other params...
}

function bindUI() {
  presetEl.value = state.preset;

  petalsEl.value = String(state.petals);
  petalsOut.value = String(state.petals);

  complexityEl.value = String(state.complexity);
  complexityOut.value = String(state.complexity);

  organicEl.value = String(state.organic);
  organicOut.value = String(state.organic);

  strokeWidthEl.value = String(state.strokeWidth);
  strokeWidthOut.value = String(state.strokeWidth);

  framesEl.checked = state.frames;
  pageBorderEl.checked = state.pageBorder;

  alternationEl.value = String(state.alternation);
  alternationOut.value = String(state.alternation);
  harmonyEl.value = String(state.harmony);
  harmonyOut.value = String(state.harmony);
  taperEl.value = String(state.taper);
  taperOut.value = String(state.taper);

  modeEl.value = state.mode;
  seedInputEl.value = String(state.seed);
  zPresetEl.value = state.zPreset;
  cellCountEl.value = String(state.cellCount);
  cellCountOut.value = String(state.cellCount);
  minCellSizeMmEl.value = String(state.minCellSizeMm);
  minCellSizeMmOut.value = String(state.minCellSizeMm);

  syncModeUI();

  // --- Listeners ---
  const update = () => { setStateToURL(state); render(); };

  modeEl.addEventListener("change", () => {
    state.mode = modeEl.value;
    syncModeUI();
    update();
  });

  seedInputEl.addEventListener("input", () => {
    state.seed = (parseInt(seedInputEl.value, 10) >>> 0) || 0;
  });
  seedInputEl.addEventListener("change", update);

  presetEl.addEventListener("change", () => { state.preset = presetEl.value; update(); });

  petalsEl.addEventListener("input", () => {
    state.petals = clampInt(petalsEl.value, 6, 96);
    petalsOut.value = String(state.petals);
  });
  petalsEl.addEventListener("change", update);

  complexityEl.addEventListener("input", () => {
    state.complexity = clampInt(complexityEl.value, 20, 320);
    complexityOut.value = String(state.complexity);
  });
  complexityEl.addEventListener("change", update);

  organicEl.addEventListener("input", () => {
    state.organic = clampFloat(organicEl.value, 0, 1);
    organicOut.value = String(state.organic);
  });
  organicEl.addEventListener("change", update);

  strokeWidthEl.addEventListener("input", () => {
    state.strokeWidth = clampFloat(strokeWidthEl.value, 0.1, 5.0);
    strokeWidthOut.value = String(state.strokeWidth);
  });
  strokeWidthEl.addEventListener("change", update);

  framesEl.addEventListener("change", () => {
    state.frames = framesEl.checked;
    update();
  });

  pageBorderEl.addEventListener("change", () => {
    state.pageBorder = pageBorderEl.checked;
    update();
  });

  alternationEl.addEventListener("input", () => {
    state.alternation = clampFloat(alternationEl.value, 0, 1);
    alternationOut.value = String(state.alternation);
  });
  alternationEl.addEventListener("change", update);

  harmonyEl.addEventListener("input", () => {
    state.harmony = clampFloat(harmonyEl.value, 0, 1);
    harmonyOut.value = String(state.harmony);
  });
  harmonyEl.addEventListener("change", update);

  taperEl.addEventListener("input", () => {
    state.taper = clampFloat(taperEl.value, 0, 1);
    taperOut.value = String(state.taper);
  });
  taperEl.addEventListener("change", update);

  regenBtn.addEventListener("click", () => {
    state.seed = (randomSeed32() >>> 0);
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
    const doc = getCurrentDoc(); // Need to regenerate or extract dims
    if (!doc) return;
    const filename = `mandala_${state.preset}_seed_${state.seed}_300dpi.png`;

    // We render the current doc to string again to be sure, or just use innerHTML
    // but we need w/h in mm.
    const { wMm, hMm } = doc.page;
    downloadPng(filename, svg.outerHTML, wMm, hMm, 300);
  });

  window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() !== "f") return;
    const svg = stage.querySelector("svg");
    if (!svg) return;
    flattenSvgElement(svg);
  });

  // Zentangle spezifische Listeners
  zPresetEl.addEventListener("change", () => {
    state.zPreset = zPresetEl.value;
    applyPresetToControls(state.zPreset);
    update();
  });
  cellCountEl.addEventListener("input", () => {
    state.cellCount = parseInt(cellCountEl.value, 10);
    cellCountOut.value = String(state.cellCount);
  });
  cellCountEl.addEventListener("change", update);

  minCellSizeMmEl.addEventListener("input", () => {
    state.minCellSizeMm = parseInt(minCellSizeMmEl.value, 10);
    minCellSizeMmOut.value = String(state.minCellSizeMm);
  });
  minCellSizeMmEl.addEventListener("change", update);
}

function syncModeUI() {
  if (state.mode === "mandala") {
    mandalaControls.style.display = "flex";
    zentangleControls.style.display = "none";
  } else {
    mandalaControls.style.display = "none";
    zentangleControls.style.display = "flex";
  }
}

function getCurrentDoc() {
  const p = presets[state.preset] ?? presets.A4;
  return createDoc({
    preset: state.preset,
    seed: state.seed,
    marginMm: 10,
  });
}

function render() {
  seedText.textContent = String(state.seed >>> 0);

  const doc = getCurrentDoc();

  if (state.mode === "mandala") {
    generateMandalaRadial(doc, {
      seed: state.seed,
      petals: state.petals,
      complexity: state.complexity,
      strokeWidthMm: state.strokeWidth,
      organicLevel: state.organic,
      includeFrames: state.frames,
      pageBorder: state.pageBorder,
      alternation: state.alternation,
      harmony: state.harmony,
      taper: state.taper
    });
  } else {
    const marginMm = doc.page.marginMm || 10;
    const areaMm = {
      x: marginMm,
      y: marginMm,
      w: doc.page.wMm - marginMm * 2,
      h: doc.page.hMm - marginMm * 2
    };

    generateZentangleCells(doc, {
      seed: state.seed,
      areaMm,
      complexity: state.complexity,
      organicLevel: state.organic,
      strokeWidthMm: state.strokeWidth,

      cellCount: state.cellCount,
      minCellSizeMm: state.minCellSizeMm,
      zPreset: state.zPreset
    });
  }

  const svgStr = renderDocToSvgString(doc);
  stage.innerHTML = svgStr;

  const svgEl = stage.querySelector("svg");
  const pathCount = svgEl ? svgEl.querySelectorAll("path").length : 0;
  pathsText.textContent = String(pathCount);
}

bindUI();
render();
