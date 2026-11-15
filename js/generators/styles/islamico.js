// js/generators/styles/islamico.js
// Gramática del estilo «islamico». Islámico: ojivas, lotos y antemias.
// Hoy sólo declara pesos de motivos; los motivos exclusivos, vetos y cuota de firma llegan en las
// etapas E2–E10 de docs/ROADMAP_ESTILOS.md.
import { DEFAULT_SILHOUETTES, DEFAULT_CORES } from "./common.js";

export const islamico = {
  id: "islamico",
  // Peso de cada motivo en una banda intermedia. El orden de las claves importa: el sorteo recorre
  // la tabla en ese orden y un cambio altera todas las páginas.
  motifs: { petal: 2, round: 1, lotus: 2, leaf: 1, scallop: 2, heart: 0.5, beads: 1.5, triangle: 1, diamond: 2, ogee: 3, chevron: 1, roseta: 1.5, flame: 0.5, voluta: 1, antemia: 2.5 },
  silhouettes: DEFAULT_SILHOUETTES,
  cores: DEFAULT_CORES,
};
