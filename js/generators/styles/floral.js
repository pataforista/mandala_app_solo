// js/generators/styles/floral.js
// Gramática del estilo «floral». Floral: pétalos, hojas y lotos; el estilo por defecto y el de mayor peso en el libro.
// Declara pesos de motivos y vetos; los motivos exclusivos y la cuota de firma llegan con cada
// estilo (etapas E3–E10 de docs/ROADMAP_ESTILOS.md).
import { DEFAULT_SILHOUETTES, DEFAULT_CORES } from "./common.js";

// Vetos: motivos que este estilo nunca dibuja. Ningún peso de `motifs` puede estar aquí.
const banned = ["triangle", "diamond", "chevron"];

export const floral = {
  id: "floral",
  // Peso de cada motivo en una banda intermedia. El orden de las claves importa: el sorteo recorre
  // la tabla en ese orden y un cambio altera todas las páginas.
  motifs: { petal: 3, round: 3, lotus: 3, leaf: 3, scallop: 2, heart: 2, ogee: 1, flame: 0.8 },
  banned,
  // La silueta exterior también respeta los vetos.
  silhouettes: DEFAULT_SILHOUETTES.filter(s => !banned.includes(s)),
  cores: DEFAULT_CORES,
};
