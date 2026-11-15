// js/generators/styles/celtico.js
// Gramática del estilo «celtico». Celta: festones, círculos y corazones.
// Declara pesos de motivos y vetos; los motivos exclusivos y la cuota de firma llegan con cada
// estilo (etapas E3–E10 de docs/ROADMAP_ESTILOS.md).
import { DEFAULT_SILHOUETTES, DEFAULT_CORES } from "./common.js";

// Vetos: motivos que este estilo nunca dibuja. Ningún peso de `motifs` puede estar aquí.
const banned = ["triangle", "diamond", "chevron", "flame"];

export const celtico = {
  id: "celtico",
  // Peso de cada motivo en una banda intermedia. El orden de las claves importa: el sorteo recorre
  // la tabla en ese orden y un cambio altera todas las páginas.
  motifs: { petal: 1.5, round: 2, lotus: 2, leaf: 2, scallop: 2.5, heart: 2, ogee: 2 },
  banned,
  // La silueta exterior también respeta los vetos.
  silhouettes: DEFAULT_SILHOUETTES.filter(s => !banned.includes(s)),
  cores: DEFAULT_CORES,
};
