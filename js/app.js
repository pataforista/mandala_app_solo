import { getStateFromURL, setStateToURL, randomSeed32 } from "./core/urlState.js";
import { createDoc, presets } from "./core/svgDoc.js";
import { renderDocToSvgString } from "./core/svgRender.js";
import { downloadTextFile, downloadPng, flattenSvgElement } from "./core/export.js";
import { generateMandalaRadial } from "./generators/mandalaRadial.js";

const stage = document.getElementById("stage");
const presetEl = document.getElementById("preset");
const petalsEl = document.getElementById("petals");
const petalsOut = document.getElementById("petalsOut");

const complexityEl = document.getElementById("complexity");
const complexityOut = document.getElementById("complexityOut");
const organicEl = document.getElementById("organic");
const organicOut = document.getElementById("organicOut");

const strokeWidthEl = document.getElementById("strokeWidth");
const strokeWidthOut = document.getElementById("strokeWidthOut");
const framesEl = document.getElementById("frames");

const regenBtn = document.getElementById("regen");
const downloadBtn = document.getElementById("download");
const downloadPngBtn = document.getElementById("downloadPng");
const seedText = document.getElementById("seedText");
const pathsText = document.getElementById("pathsText");

const DEFAULTS = {
  preset: "A4",
  petals: 12,
  complexity: 110,
  organic: 0.2, // Nuevo
  strokeWidth: 0.6, // Nuevo
  frames: true, // Nuevo
  seed: (randomSeed32() >>> 0),
};

let state = getStateFromURL(DEFAULTS);

// Fix boolean parsing from URL if needed (URL params are strings)
if (typeof state.frames === "string") state.frames = (state.frames === "true");

function clampInt(v, a, b) { return Math.max(a, Math.min(b, v | 0)); }
function clampFloat(v, a, b) { return Math.max(a, Math.min(b, parseFloat(v) || 0)); }

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

  // --- Listeners ---
  const update = () => { setStateToURL(state); render(); };

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

  generateMandalaRadial(doc, {
    seed: state.seed,
    petals: state.petals,
    complexity: state.complexity,
    strokeWidthMm: state.strokeWidth, // passed as param
    organicLevel: state.organic,      // passed as param
    includeFrames: state.frames       // passed as param
  });

  const svgStr = renderDocToSvgString(doc);
  stage.innerHTML = svgStr;

  const svgEl = stage.querySelector("svg");
  const pathCount = svgEl ? svgEl.querySelectorAll("path").length : 0;
  pathsText.textContent = String(pathCount);
}

bindUI();
render();
