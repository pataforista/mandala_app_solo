// js/generators/styles/azteca.js
// Gramática del estilo «azteca». Azteca: triángulos, chevrones y llamas.
// Declara pesos de motivos y vetos; los motivos exclusivos y la cuota de firma llegan con cada
// estilo (etapas E3–E10 de docs/ROADMAP_ESTILOS.md).
import { DEFAULT_SILHOUETTES, DEFAULT_CORES } from "./common.js";

// Vetos: motivos que este estilo nunca dibuja. Ningún peso de `motifs` puede estar aquí.
const banned = ["heart", "leaf", "round", "scallop"];

export const azteca = {
  id: "azteca",
  // Peso de cada motivo en una banda intermedia. El orden de las claves importa: el sorteo recorre
  // la tabla en ese orden y un cambio altera todas las páginas.
  motifs: { petal: 2, lotus: 1, triangle: 3, diamond: 2, ogee: 1, chevron: 3, flame: 2 },
  banned,
  // La silueta exterior también respeta los vetos.
  silhouettes: DEFAULT_SILHOUETTES.filter(s => !banned.includes(s)),
  cores: DEFAULT_CORES,
};
