// js/generators/styles/geometric.js
// Gramática del estilo «geometric». Geométrico: triángulos, rombos y cuentas.
// Hoy sólo declara pesos de motivos; los motivos exclusivos, vetos y cuota de firma llegan en las
// etapas E2–E10 de docs/ROADMAP_ESTILOS.md.
import { DEFAULT_SILHOUETTES, DEFAULT_CORES } from "./common.js";

export const geometric = {
  id: "geometric",
  // Peso de cada motivo en una banda intermedia. El orden de las claves importa: el sorteo recorre
  // la tabla en ese orden y un cambio altera todas las páginas.
  motifs: { petal: 2, round: 0.5, lotus: 1, leaf: 0.5, scallop: 1, heart: 0.3, beads: 2, triangle: 3, diamond: 3, ogee: 1, chevron: 2, roseta: 0.8, flame: 0.3, voluta: 0.4, antemia: 2 },
  silhouettes: DEFAULT_SILHOUETTES,
  cores: DEFAULT_CORES,
};
