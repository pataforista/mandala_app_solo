// Figuras redibujadas para la corona de Mandala Studio. Las del motor de Zentangle (kraken, greyalien,
// ufo, wendigo) estaban pensadas para ocupar toda una página y, a ~45 mm, salían diminutas, cargadas de
// tinta o con piezas sueltas. Estas siguen otra regla: silueta grande y legible, 3–7 regiones cerradas,
// sin piezas que se crucen. Coordenadas de figura (x, y de −1 a 1, y hacia abajo), como en figure.js.
//
// h: herramientas del motor de Zentangle { ell, xform, taper, smoothPoly, qpts }.
export function buildOverrides(h) {
  const { ell, xform, taper, smoothPoly, qpts } = h; // h = módulo cargado de figure.js (con FIGURES)
  const mirror = (cmds) => xform(cmds, 0, 0, 0, -1, 1);
  const line = (...pts) => pts.map(([x, y], i) => [i ? "L" : "M", x, y]);

  // ---- Platillo volador: disco, cúpula y haz de luz que se cierra contra el disco ----
  const UFO_DISC = ell(0, 0.12, 0.98, 0.24);
  const UFO_DOME = [["M", -0.42, 0.04], ["C", -0.42, -0.46, 0.42, -0.46, 0.42, 0.04], ["Z"]];
  const UFO_BEAM = line([-0.38, 0.34], [-0.84, 0.98], [0.84, 0.98], [0.38, 0.34]);
  const ufo = {
    parts: [{ cmds: UFO_DISC }, { cmds: UFO_DOME }],
    front: [{ cmds: UFO_BEAM }],
    deco: () => [
      { cmds: ell(0, -0.17, 0.1) },                                   // ventana de la cúpula
      ...[-0.6, 0, 0.6].map((x) => ({ cmds: ell(x, 0.15, 0.09) })),   // luces del disco
      { cmds: line([-0.14, 0.36], [-0.3, 0.98]) }, { cmds: line([0.14, 0.36], [0.3, 0.98]) }, // rayos del haz
    ],
    silhouette: [UFO_DISC, UFO_DOME, line([-0.38, 0.34], [-0.84, 0.98], [0.84, 0.98], [0.38, 0.34], [-0.38, 0.34])],
    branch: 0, science: "ufo", noEcho: true,
  };

  // ---- Alienígena gris: cabeza grande con ojos almendrados, cuerpo menudo ----
  const AL_HEAD = smoothPoly([[0, -0.98], [0.32, -0.93], [0.52, -0.72], [0.54, -0.5], [0.42, -0.26], [0.2, -0.08], [0, -0.03], [-0.2, -0.08], [-0.42, -0.26], [-0.54, -0.5], [-0.52, -0.72], [-0.32, -0.93]]);
  const AL_EYE = smoothPoly([[-0.12, -0.46], [-0.3, -0.6], [-0.46, -0.68], [-0.42, -0.52], [-0.26, -0.4]]);
  const AL_BODY = smoothPoly([[-0.17, 0.0], [0.17, 0.0], [0.26, 0.35], [0.2, 0.62], [-0.2, 0.62], [-0.26, 0.35]]);
  const AL_ARM = taper(qpts([0.2, 0.08], [0.52, 0.16], [0.62, 0.56]), 0.06, 0.03);
  const AL_LEG = taper(qpts([0.1, 0.6], [0.14, 0.8], [0.18, 0.98]), 0.07, 0.045);
  const greyalien = {
    parts: [{ cmds: AL_HEAD }, { cmds: AL_BODY }],
    front: [{ cmds: AL_ARM }, { cmds: mirror(AL_ARM) }, { cmds: AL_LEG }, { cmds: mirror(AL_LEG) }],
    deco: () => [{ cmds: AL_EYE }, { cmds: mirror(AL_EYE) }],
    silhouette: [AL_HEAD, AL_BODY, AL_ARM, mirror(AL_ARM), AL_LEG, mirror(AL_LEG)],
    science: "ufo", noEcho: true,
  };

  // ---- Pulpo (sustituye al kraken): manto redondo y cuatro tentáculos que no se cruzan ----
  const OC_MANTLE = smoothPoly([[0, -0.98], [0.35, -0.9], [0.55, -0.62], [0.5, -0.3], [0.35, -0.12], [0.1, -0.06], [-0.1, -0.06], [-0.35, -0.12], [-0.5, -0.3], [-0.55, -0.62], [-0.35, -0.9]]);
  // Cada tentáculo es una S: sale hacia afuera, se curva y termina enroscado hacia arriba
  const tentacle = (x0) => {
    const sgn = Math.sign(x0), ax = Math.abs(x0);
    const p0 = [x0, -0.1], mid = [sgn * (ax * 2.6 + 0.16), 0.42], end = [sgn * (ax * 2.2 + 0.52), 0.82];
    const pts = [...qpts(p0, [sgn * (ax * 1.4 + 0.1), 0.2], mid, 8), ...qpts(mid, [sgn * (ax * 3.2 + 0.3), 0.7], end, 8).slice(1)];
    return taper(pts, 0.075, 0.03);
  };
  const OC_TENT = [-0.27, -0.09, 0.09, 0.27].map(tentacle);
  const kraken = {
    parts: [{ cmds: OC_MANTLE }],
    front: OC_TENT.map((cmds) => ({ cmds })),
    deco: () => [{ cmds: ell(-0.2, -0.45, 0.1) }, { cmds: ell(0.2, -0.45, 0.1) }],
    silhouette: [OC_MANTLE, ...OC_TENT],
    science: "bio", noEcho: true,
  };

  // ---- Wendigo: cabeza de ciervo con cornamenta ramificada y hombros anchos ----
  const WE_HEAD = smoothPoly([[0, -0.3], [0.24, -0.22], [0.3, 0.0], [0.22, 0.3], [0.12, 0.55], [0, 0.62], [-0.12, 0.55], [-0.22, 0.3], [-0.3, 0.0], [-0.24, -0.22]]);
  const WE_BODY = smoothPoly([[-0.2, 0.58], [0.2, 0.58], [0.55, 0.78], [0.62, 0.98], [-0.62, 0.98], [-0.55, 0.78]]);
  // Astas: líneas abiertas; al estamparse con trazo grueso quedan como astas llenas, sin muñones
  const beam = qpts([0.16, -0.24], [0.62, -0.42], [0.56, -0.97], 14);
  const asLine = (pts) => pts.map(([x, y], i) => [i ? "L" : "M", x, y]);
  const tine = (i, dx, dy) => asLine([beam[i], [beam[i][0] + dx * 0.5, beam[i][1] + dy * 0.5], [beam[i][0] + dx, beam[i][1] + dy]]);
  const WE_ANTLER = [asLine(beam), tine(3, 0.28, -0.1), tine(7, 0.26, -0.16), tine(11, 0.2, -0.08)];
  const wendigo = {
    parts: [{ cmds: WE_HEAD }, { cmds: WE_BODY }],
    front: [...WE_ANTLER, ...WE_ANTLER.map(mirror)].map((cmds) => ({ cmds })),
    deco: () => [{ cmds: ell(-0.12, 0.0, 0.07) }, { cmds: ell(0.12, 0.0, 0.07) }],
    silhouette: [WE_HEAD, WE_BODY, ...WE_ANTLER, ...WE_ANTLER.map(mirror)],
    science: "cryptid", noEcho: true,
  };

  // ---- Terópodos: se conserva la silueta de esqueleto de Zentangle (buena), pero sin escamas, sin ecos
  // y con un solo corte por pieza: lo que los cargaba de tinta a ~45 mm eran las texturas, no el contorno ----
  const lighter = (name) => {
    const d = h.FIGURES[name];
    return {
      ...d, science: "dinoplain", noEcho: true,
      parts: (d.parts || []).map((p) => (p.strings ? { ...p, strings: { ...p.strings, a: [1, 1], b: [1, 1] } } : p)),
    };
  };
  const allosaurus = lighter("allosaurus"), velociraptor = lighter("velociraptor");

  // ---- Mosasaurio: cuerpo fusiforme, dos aletas anchas y cola con aleta ----
  const MOSA = smoothPoly([[0.98, -0.08], [0.82, -0.2], [0.6, -0.2], [0.3, -0.3], [-0.1, -0.3], [-0.5, -0.2], [-0.78, -0.06], [-0.9, -0.36], [-0.99, -0.34],
    [-0.94, -0.04], [-0.99, 0.26], [-0.9, 0.28], [-0.76, 0.08], [-0.45, 0.2], [-0.05, 0.28], [0.35, 0.26], [0.65, 0.14], [0.8, 0.06], [0.96, 0.0]]);
  // Aletas abiertas por arriba: arrancan en la línea del vientre y se cierran contra ella (sin lazos dentro del cuerpo)
  const flipper = (x) => [["M", x - 0.1, 0.19], ["C", x - 0.15, 0.4, x - 0.03, 0.6, x + 0.1, 0.64], ["C", x + 0.22, 0.56, x + 0.2, 0.36, x + 0.12, 0.18]];
  const MOSA_FLIP = [flipper(0.22), flipper(-0.3)];
  const mosasaurus = {
    parts: [{ cmds: MOSA, strings: { angle: Math.PI / 2, a: [0, 0], b: [2, 2] } }],
    front: MOSA_FLIP.map((cmds) => ({ cmds })),
    deco: () => [{ cmds: ell(0.7, -0.08, 0.055) }],
    silhouette: [MOSA, ...MOSA_FLIP],
    science: "dinoplain", noEcho: true,
  };

  // ---- Conejo de frente: cabeza, orejas, cuerpo, panza y patas, todo cerrado ----
  const R_HEAD = ell(0, -0.3, 0.3, 0.27), R_BODY = ell(0, 0.4, 0.42, 0.46);
  const R_EAR = (sx) => xform(ell(0, 0, 0.1, 0.4), sx * 0.15, -0.95, sx * 0.1);
  const R_EAR_IN = (sx) => xform(ell(0, 0, 0.045, 0.27), sx * 0.15, -0.93, sx * 0.1);
  const R_FOOT = (sx) => ell(sx * 0.22, 0.9, 0.18, 0.085);
  const rabbit = {
    parts: [{ cmds: R_HEAD }, { cmds: R_BODY }],
    front: [R_EAR(-1), R_EAR(1), ell(0, 0.44, 0.23, 0.27), R_FOOT(-1), R_FOOT(1)].map((cmds) => ({ cmds })),
    deco: () => [{ cmds: R_EAR_IN(-1) }, { cmds: R_EAR_IN(1) }, { cmds: ell(-0.11, -0.34, 0.055) }, { cmds: ell(0.11, -0.34, 0.055) },
      { cmds: ell(0, -0.2, 0.035, 0.025) }],
    silhouette: [R_HEAD, R_BODY, R_EAR(-1), R_EAR(1), R_FOOT(-1), R_FOOT(1)],
    science: "kids", noEcho: true,
  };

  return { ufo, greyalien, kraken, wendigo, allosaurus, velociraptor, mosasaurus, rabbit };
}
