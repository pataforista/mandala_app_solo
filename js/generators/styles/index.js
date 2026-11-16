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

// Versión del dibujo de los estilos. Sube cada vez que una gramática cambia lo que dibuja: un
// proyecto guardado con otra versión conserva sus ajustes, pero sus páginas se redibujan.
//   1 = tabla de pesos común (hasta nov 2026) · 2 = gramática propia por estilo
export const STYLE_GRAMMAR_VERSION = 2;

export const STYLE_GRAMMARS = { floral, geometric, islamico, sashiko, azteca, yantra, celtico };

/** Gramática de un estilo; uno desconocido usa floral (como hacía la tabla de pesos). */
export function grammarOf(style) {
  return STYLE_GRAMMARS[style] || STYLE_GRAMMARS.floral;
}
