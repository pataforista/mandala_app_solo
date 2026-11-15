// js/generators/styles/index.js
// Registro de gramáticas de estilo del motor clásico. Un estilo es una gramática: qué motivos
// puede dibujar y con qué peso, qué siluetas exteriores y qué núcleos usa.
import { floral } from "./floral.js";
import { geometric } from "./geometric.js";
import { islamico } from "./islamico.js";
import { sashiko } from "./sashiko.js";
import { azteca } from "./azteca.js";
import { yantra } from "./yantra.js";
import { celtico } from "./celtico.js";

export const STYLE_GRAMMARS = { floral, geometric, islamico, sashiko, azteca, yantra, celtico };

/** Gramática de un estilo; uno desconocido usa floral (como hacía la tabla de pesos). */
export function grammarOf(style) {
  return STYLE_GRAMMARS[style] || STYLE_GRAMMARS.floral;
}
