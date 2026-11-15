// js/generators/styles/azteca.js
// Gramática del estilo «azteca». Azteca: triángulos, chevrones y llamas.
// Hoy sólo declara pesos de motivos; los motivos exclusivos, vetos y cuota de firma llegan en las
// etapas E2–E10 de docs/ROADMAP_ESTILOS.md.
import { DEFAULT_SILHOUETTES, DEFAULT_CORES } from "./common.js";

export const azteca = {
  id: "azteca",
  // Peso de cada motivo en una banda intermedia. El orden de las claves importa: el sorteo recorre
  // la tabla en ese orden y un cambio altera todas las páginas.
  motifs: { petal: 2, round: 0.5, lotus: 1, leaf: 0.5, scallop: 1, heart: 0.5, beads: 1.5, triangle: 3, diamond: 2, ogee: 1, chevron: 3, roseta: 0.6, flame: 2, voluta: 0.3, antemia: 2.5 },
  silhouettes: DEFAULT_SILHOUETTES,
  cores: DEFAULT_CORES,
};
