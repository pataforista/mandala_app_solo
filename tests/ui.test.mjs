import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { planBook, BOOK_THEMES, PRODUCT_PROFILES, chapterLayout } from "../js/core/bookPlan.js";

// Build a lightweight DOM simulation from index.html so js/app.js can initialize and bind all handlers in Node
const indexHtml = fs.readFileSync("index.html", "utf8");
const idRegex = /\bid=["']([^"']+)["']/g;
const htmlIds = new Set();
let match;
while ((match = idRegex.exec(indexHtml)) !== null) {
  htmlIds.add(match[1]);
}

function makeMockElement(id = "", tag = "DIV") {
  const listeners = new Map();
  const children = [];
  const el = {
    id,
    tagName: tag.toUpperCase(),
    value: id === "bookPages" ? "50" : id === "bookDpi" ? "300" : id === "preset" ? "KDP_85x11" : "",
    checked: true,
    disabled: false,
    loading: false,
    innerHTML: "",
    textContent: "",
    style: {},
    dataset: {},
    files: [],
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() { return false; }
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      if (!listeners.has(type)) return;
      listeners.set(type, listeners.get(type).filter(f => f !== fn));
    },
    dispatchEvent(evt) {
      const list = listeners.get(evt.type) || [];
      for (const fn of list) fn(evt);
      return true;
    },
    click() {
      this.dispatchEvent({ type: "click", target: this, preventDefault() {} });
    },
    focus() {},
    show() { this.open = true; },
    hide() { this.open = false; },
    toast() { return Promise.resolve(); },
    remove() {},
    appendChild(child) {
      children.push(child);
      return child;
    },
    insertAdjacentHTML() {},
    setAttribute(k, v) { this[k] = v; },
    getAttribute(k) { return this[k] || null; },
    querySelector() { return makeMockElement("", "DIV"); },
    querySelectorAll(sel) {
      if (sel.includes("btn-load-proj")) return children.filter(c => c._projId);
      return [];
    },
    closest() { return null; },
    getBoundingClientRect() {
      return { width: 800, height: 800, left: 0, top: 0 };
    },
    getContext() {
      return {
        fillRect() {},
        clearRect() {},
        drawImage() {},
        getImageData: () => ({ data: new Uint8ClampedArray(400) }),
        putImageData() {},
        beginPath() {},
        arc() {},
        fill() {},
        stroke() {}
      };
    },
    _listeners: listeners,
    _children: children,
  };
  return el;
}

const elementMap = new Map();
for (const id of htmlIds) {
  elementMap.set(id, makeMockElement(id));
}
// Specific defaults matching index.html
elementMap.get("bookTheme").value = "none";
elementMap.get("bookProductProfile").value = "none";
elementMap.get("bookProfile").value = "rentable";
elementMap.get("bookDifficulty").value = "progresiva";
elementMap.get("bookBack").value = "blanco";
elementMap.get("bookMural").value = "3x3";
elementMap.get("bookGrowth").value = "1";
elementMap.get("bookMystery").value = "3";
elementMap.get("styleMode").value = "sashiko";
elementMap.get("generatorType").value = "classic";
elementMap.get("coloringPreset").value = "adulto";
elementMap.get("composition").value = "centro";
elementMap.get("frameStyle").value = "redondeado";
elementMap.get("strokeWidth").value = "0.55";
elementMap.get("petals").value = "12";
elementMap.get("complexity").value = "130";

const docListeners = new Map();
globalThis.document = {
  getElementById(id) {
    if (!elementMap.has(id)) {
      elementMap.set(id, makeMockElement(id));
    }
    return elementMap.get(id);
  },
  querySelector() { return makeMockElement(); },
  querySelectorAll(sel) {
    if (sel === ".bookComp") {
      return ["centro", "fondo", "constelacion", "esquinas", "gigante", "medio"].map(v => {
        const c = makeMockElement("", "SL-CHECKBOX");
        c.value = v;
        c.checked = true;
        return c;
      });
    }
    return [];
  },
  createElement(tag) { return makeMockElement("", tag); },
  createElementNS(ns, tag) { return makeMockElement("", tag); },
  addEventListener(type, fn) {
    if (!docListeners.has(type)) docListeners.set(type, []);
    docListeners.get(type).push(fn);
  },
  dispatchEvent(evt) {
    const list = docListeners.get(evt.type) || [];
    for (const fn of list) fn(evt);
    return true;
  },
  body: makeMockElement("body", "BODY"),
  head: makeMockElement("head", "HEAD"),
  documentElement: makeMockElement("html", "HTML"),
};

globalThis.window = {
  location: { search: "", hash: "", href: "http://localhost/", pathname: "/" },
  history: { replaceState() {}, pushState() {} },
  addEventListener() {},
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  devicePixelRatio: 1,
};

Object.defineProperty(globalThis, "navigator", {
  value: {
    clipboard: { writeText: async () => {} },
    serviceWorker: { register: async () => ({}) },
  },
  configurable: true,
});

const storageMap = new Map();
globalThis.localStorage = {
  getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
  setItem: (k, v) => storageMap.set(k, String(v)),
  removeItem: (k) => storageMap.delete(k),
};
globalThis.sessionStorage = globalThis.localStorage;
globalThis.Worker = class Worker {
  postMessage() {}
  addEventListener() {}
  terminate() {}
};

globalThis.Event = class Event {
  constructor(type) { this.type = type; }
};
globalThis.CustomEvent = class CustomEvent extends globalThis.Event {
  constructor(type, opts = {}) { super(type); this.detail = opts.detail; }
};

test("UI initialization, controls, themes, and project lifecycle in js/app.js", async (t) => {
  await import("../js/app.js");

  await t.test("initial render populates #stage with an SVG mandala and updates KDP summary", () => {
    const stage = document.getElementById("stage");
    assert.ok(stage.innerHTML.includes("<svg"), "Stage should contain rendered SVG on startup");
    const summary = document.getElementById("bookSummary");
    assert.ok(summary.innerHTML.includes("páginas"), "Book summary should be populated");
    const canvaDetails = document.getElementById("canvaCoverDetails");
    assert.ok(canvaDetails.innerHTML.includes("Tamaño lienzo Canva"), "Canva cover dimensions should be calculated");
  });

  await t.test("interactive stage zoom controls update scale and percentage text", () => {
    const stage = document.getElementById("stage");
    const zoomText = document.getElementById("zoomLevelText");
    const btnIn = document.getElementById("btnZoomIn");
    const btnOut = document.getElementById("btnZoomOut");
    const btnReset = document.getElementById("btnZoomReset");

    btnIn.click();
    assert.equal(zoomText.textContent, "125%");
    assert.equal(stage.style.transform, "scale(1.25)");

    btnOut.click();
    btnOut.click();
    assert.equal(zoomText.textContent, "75%");
    assert.equal(stage.style.transform, "scale(0.75)");

    btnReset.click();
    assert.equal(zoomText.textContent, "100%");
    assert.equal(stage.style.transform, "none");
  });

  await t.test("selecting a book theme updates themeActionBox and chapter styles", () => {
    const bookTheme = document.getElementById("bookTheme");
    const themeActionBox = document.getElementById("themeActionBox");
    const themeDescText = document.getElementById("themeDescText");

    assert.equal(themeActionBox.style.display, "none");

    bookTheme.value = "espacio";
    bookTheme.dispatchEvent(new Event("sl-change"));

    assert.equal(themeActionBox.style.display, "block");
    assert.ok(themeDescText.innerHTML.includes("Espacio y Cosmos"));

    // Verify bookSummary chapters reflect theme styles (geometric, yantra, islamico)
    const summary = document.getElementById("bookSummary");
    assert.ok(!summary.innerHTML.includes("Jardín de pétalos"), "Space theme should not include floral chapter");

    bookTheme.value = "none";
    bookTheme.dispatchEvent(new Event("sl-change"));
    assert.equal(themeActionBox.style.display, "none");
  });

  await t.test("planBook respects theme backgrounds and product profile useBackground=false", () => {
    const oceanTheme = BOOK_THEMES.oceano;
    const chapters = chapterLayout(20, oceanTheme.styles, oceanTheme.styleWeights);
    const oceanPlan = planBook({
      count: 20,
      seed: 42,
      styles: oceanTheme.styles,
      styleWeights: oceanTheme.styleWeights,
      chapters,
      backgrounds: oceanTheme.backgrounds,
    });
    for (const p of oceanPlan) {
      assert.ok(oceanTheme.styles.includes(p.styleMode), `Unexpected style ${p.styleMode} for ocean theme`);
      if (p.background) {
        assert.ok(oceanTheme.backgrounds.includes(p.background), `Unexpected background ${p.background} for ocean theme`);
      }
    }

    const largePrint = PRODUCT_PROFILES.large_print_easy;
    const lpPlan = planBook({
      count: 20,
      seed: 42,
      styles: largePrint.styles,
      styleWeights: largePrint.styleWeights,
      useBackground: largePrint.useBackground,
    });
    for (const p of lpPlan) {
      assert.equal(p.background, null, "large_print_easy profile must disable backgrounds");
    }
  });

  await t.test("no native alert, confirm, or prompt calls remain in app.js or preprocesar.html", () => {
    const appCode = fs.readFileSync("js/app.js", "utf8");
    const preCode = fs.readFileSync("preprocesar.html", "utf8");
    assert.ok(!/\b(?:alert|confirm|prompt)\s*\(/.test(appCode), "js/app.js should not use blocking alert/confirm/prompt");
    assert.ok(!/\b(?:alert|confirm|prompt)\s*\(/.test(preCode), "preprocesar.html should not use blocking alert/confirm/prompt");
  });
});
