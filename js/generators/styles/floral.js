// js/generators/styles/floral.js
// Gramática del estilo «floral». Floral: pétalos, hojas y lotos; el estilo por defecto y el de mayor peso en el libro.
// Hoy sólo declara pesos de motivos; los motivos exclusivos, vetos y cuota de firma llegan en las
// etapas E2–E10 de docs/ROADMAP_ESTILOS.md.
import { DEFAULT_SILHOUETTES, DEFAULT_CORES } from "./common.js";

export const floral = {
  id: "floral",
  // Peso de cada motivo en una banda intermedia. El orden de las claves importa: el sorteo recorre
  // la tabla en ese orden y un cambio altera todas las páginas.
  motifs: { petal: 3, round: 3, lotus: 3, leaf: 3, scallop: 2, heart: 2, beads: 1, triangle: 0.5, diamond: 0.5, ogee: 1, chevron: 0.3, roseta: 1.5, flame: 0.8, voluta: 0.6, antemia: 0.5 },
  silhouettes: DEFAULT_SILHOUETTES,
  cores: DEFAULT_CORES,
};
