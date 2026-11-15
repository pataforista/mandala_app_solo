// js/generators/styles/celtico.js
// Gramática del estilo «celtico». Celta: festones, círculos y corazones.
// Hoy sólo declara pesos de motivos; los motivos exclusivos, vetos y cuota de firma llegan en las
// etapas E2–E10 de docs/ROADMAP_ESTILOS.md.
import { DEFAULT_SILHOUETTES, DEFAULT_CORES } from "./common.js";

export const celtico = {
  id: "celtico",
  // Peso de cada motivo en una banda intermedia. El orden de las claves importa: el sorteo recorre
  // la tabla en ese orden y un cambio altera todas las páginas.
  motifs: { petal: 1.5, round: 2, lotus: 2, leaf: 2, scallop: 2.5, heart: 2, beads: 1.5, triangle: 0.5, diamond: 1, ogee: 2, chevron: 0.5, roseta: 1.2, flame: 0.8, voluta: 1.5, antemia: 0.5 },
  silhouettes: DEFAULT_SILHOUETTES,
  cores: DEFAULT_CORES,
};
