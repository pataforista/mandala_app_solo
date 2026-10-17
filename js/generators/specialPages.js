// js/generators/specialPages.js
// Páginas sorprendentes del libro: un solo punto de entrada para el planificador.
// opts.special = { type: "grow" | "mystery" | "nature" | "mural" | "solutions", … }
import { generateMandalaClassic } from "./mandalaClassic.js";
import { generateMysteryMandala, generateMysterySolutions, MYSTERY_SHAPES } from "./mysteryMandala.js";
import { generateNaturePage, NATURE_TEXT } from "./natureSymmetry.js";
import { generateMuralPage, tileName } from "./muralPage.js";
import { svgText } from "../core/svgText.js";

const NO_IMAGE = { centerArt: null, figure: null, figureRing: null };

export function generateSpecialPage(doc, opts) {
  const sp = opts.special;
  switch (sp.type) {
    case "grow": {
      // El mismo mandala en cada etapa: misma semilla, bandas y motivos; sólo cambia
      // cuántos anillos se dibujan
      generateMandalaClassic(doc, { ...opts, ...NO_IMAGE, special: undefined, composition: "centro", frameStyle: "redondeado",
        growth: sp.of > 1 ? sp.stage / (sp.of - 1) : 1, minBands: 8 });
      const m = Number.isFinite(doc.page.marginMm) ? doc.page.marginMm : 10;
      const label = sp.stage === sp.of - 1 ? `Mandala que crece · etapa ${sp.stage + 1} de ${sp.of}: completo` : `Mandala que crece · etapa ${sp.stage + 1} de ${sp.of}`;
      doc.body.push(svgText(m, doc.page.hMm - Math.max(4.2, m * 0.42), label, { size: 2.8, anchor: "start", fill: "#444" }));
      return doc;
    }
    case "mystery":
      return generateMysteryMandala(doc, { ...opts, shape: sp.shape });
    case "nature":
      return generateNaturePage(doc, { ...opts, kind: sp.kind, captions: sp.captions ?? true });
    case "mural":
      return generateMuralPage(doc, { ...opts, ...NO_IMAGE, mural: sp });
    case "solutions":
      return generateMysterySolutions(doc, { entries: sp.entries || [] });
    default:
      return generateMandalaClassic(doc, { ...opts, special: undefined });
  }
}

/** Envuelve el generador del libro: las páginas especiales usan su propio dibujo. */
export function withSpecialPages(fn) {
  return (doc, o) => (o && o.special ? generateSpecialPage(doc, o) : fn(doc, o));
}

/** Nombre corto para la revisión de páginas y el registro. */
export function specialLabel(sp) {
  if (!sp) return "";
  switch (sp.type) {
    case "grow": return `Crece ${sp.stage + 1}/${sp.of}`;
    case "mystery": return `Misterio: ${MYSTERY_SHAPES[sp.shape]?.name || sp.shape}`;
    case "nature": return NATURE_TEXT[sp.kind]?.title.split(" · ")[0] || sp.kind;
    case "mural": return sp.guide ? "Guía del mural" : `Mural ${tileName(sp.col, sp.row)}`;
    case "solutions": return "Soluciones";
    default: return sp.type;
  }
}
