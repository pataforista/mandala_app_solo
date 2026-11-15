// js/generators/styles/sashiko.js
// Gramática del estilo «sashiko». Sashiko: festones y círculos de costura japonesa.
// Hoy sólo declara pesos de motivos; los motivos exclusivos, vetos y cuota de firma llegan en las
// etapas E2–E10 de docs/ROADMAP_ESTILOS.md.
import { DEFAULT_SILHOUETTES, DEFAULT_CORES } from "./common.js";

export const sashiko = {
  id: "sashiko",
  // Peso de cada motivo en una banda intermedia. El orden de las claves importa: el sorteo recorre
  // la tabla en ese orden y un cambio altera todas las páginas.
  motifs: { petal: 2, round: 2, lotus: 2, leaf: 1, scallop: 3, heart: 1, beads: 2, triangle: 1, diamond: 1.5, ogee: 1, chevron: 1, roseta: 1, flame: 0.5, voluta: 0.8, antemia: 0.6 },
  silhouettes: DEFAULT_SILHOUETTES,
  cores: DEFAULT_CORES,
};
