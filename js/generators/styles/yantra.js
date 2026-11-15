// js/generators/styles/yantra.js
// Gramática del estilo «yantra». Yantra: lotos, pétalos y triángulos.
// Hoy sólo declara pesos de motivos; los motivos exclusivos, vetos y cuota de firma llegan en las
// etapas E2–E10 de docs/ROADMAP_ESTILOS.md.
import { DEFAULT_SILHOUETTES, DEFAULT_CORES } from "./common.js";

export const yantra = {
  id: "yantra",
  // Peso de cada motivo en una banda intermedia. El orden de las claves importa: el sorteo recorre
  // la tabla en ese orden y un cambio altera todas las páginas.
  motifs: { petal: 3, round: 1, lotus: 3, leaf: 1, scallop: 1, heart: 0.5, beads: 1.5, triangle: 2.5, diamond: 1.5, ogee: 1.5, chevron: 1, roseta: 2, flame: 1, voluta: 0.8, antemia: 1 },
  silhouettes: DEFAULT_SILHOUETTES,
  cores: DEFAULT_CORES,
};
