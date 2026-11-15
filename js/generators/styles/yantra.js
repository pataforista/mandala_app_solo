// js/generators/styles/yantra.js
// Gramática del estilo «yantra». Yantra: lotos, pétalos y triángulos.
// Declara pesos de motivos y vetos; los motivos exclusivos y la cuota de firma llegan con cada
// estilo (etapas E3–E10 de docs/ROADMAP_ESTILOS.md).
import { DEFAULT_SILHOUETTES, DEFAULT_CORES } from "./common.js";

// Vetos: motivos que este estilo nunca dibuja. Ningún peso de `motifs` puede estar aquí.
const banned = ["heart", "scallop", "beads", "flame"];

export const yantra = {
  id: "yantra",
  // Peso de cada motivo en una banda intermedia. El orden de las claves importa: el sorteo recorre
  // la tabla en ese orden y un cambio altera todas las páginas.
  motifs: { petal: 3, round: 1, lotus: 3, leaf: 1, triangle: 2.5, diamond: 1.5, ogee: 1.5, chevron: 1 },
  banned,
  // La silueta exterior también respeta los vetos.
  silhouettes: DEFAULT_SILHOUETTES.filter(s => !banned.includes(s)),
  cores: DEFAULT_CORES,
};
