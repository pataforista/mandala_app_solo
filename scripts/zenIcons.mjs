// Dinosaurios de estilo «icono»: un solo contorno continuo y suave por animal, con el rasgo que lo define
// exagerado y casi nada de detalle interior. Es el estilo de los iconos de referencia: se leen a cualquier
// tamaño, que es lo que necesita una figura de ~45 mm en la corona. Miran a la derecha; x, y de −1 a 1,
// y hacia abajo, suelo en y ≈ 0.98.
//
// outline(pts): contorno cerrado por Catmull-Rom. Un punto [x, y, 1] es una esquina (sin suavizar): cuernos,
// placas, garras, dedos. Los demás se suavizan.
export function outline(pts) {
  const n = pts.length, P = (i) => pts[((i % n) + n) % n];
  const m = (i) => {
    const p = P(i);
    if (p[2]) return [0, 0];
    const a = P(i - 1), b = P(i + 1);
    return [(b[0] - a[0]) / 6, (b[1] - a[1]) / 6];
  };
  const out = [["M", P(0)[0], P(0)[1]]];
  for (let i = 0; i < n; i++) {
    const a = P(i), b = P(i + 1), ma = m(i), mb = m(i + 1);
    out.push(["C", a[0] + ma[0], a[1] + ma[1], b[0] - mb[0], b[1] - mb[1], b[0], b[1]]);
  }
  return [...out, ["Z"]];
}

export function buildIcons(h) {
  const { ell, xform, taper, qpts } = h;
  const c = (x, y) => [x, y, 1];   // esquina
  const base = { science: "dinoplain", noEcho: true };
  const eye = (x, y, r = 0.045) => ell(x, y, r);
  const line = (...pts) => pts.map(([x, y], i) => [i ? "L" : "M", x, y]);

  // T. rex: cabeza grande con mandíbula, tronco con barriga, cola gruesa que se afina, brazos diminutos
  const trexBody = outline([c(-1.02, -0.2), [-0.76, -0.28], [-0.5, -0.32], [-0.22, -0.38], [0.08, -0.42], [0.28, -0.5], [0.36, -0.62], [0.42, -0.82], [0.62, -0.94],
    [0.95, -0.88], c(1.08, -0.74), [1.02, -0.66], [0.86, -0.6], c(1.0, -0.54), [0.92, -0.46], [0.7, -0.46], [0.55, -0.4], [0.5, -0.22], [0.46, 0.0], [0.38, 0.18],
    [0.4, 0.34], [0.46, 0.56], [0.4, 0.74], [0.4, 0.88], c(0.66, 0.94), c(0.66, 0.99), c(0.2, 0.99), [0.18, 0.88], [0.16, 0.7], [0.08, 0.5], [-0.04, 0.38],
    [-0.3, 0.2], [-0.6, 0.08], [-0.84, -0.04]]);
  const trexLeg2 = outline([[-0.34, 0.2], [-0.16, 0.34], [-0.1, 0.55], [-0.16, 0.74], [-0.12, 0.88], c(0.08, 0.94), c(0.08, 0.99), c(-0.32, 0.99), [-0.3, 0.88], [-0.28, 0.7], [-0.32, 0.5]]);
  const trexArm = outline([[0.46, -0.2], [0.6, -0.12], c(0.68, 0.0), [0.6, 0.03], [0.5, -0.04], [0.44, -0.04]]);
  const trex = { ...base, union: [trexBody, trexLeg2, trexArm],
    detail: [eye(0.76, -0.78), line([0.86, -0.6], [1.0, -0.6], [0.96, -0.55])] };

  // Braquiosaurio: cuello larguísimo y vertical, cabeza pequeña, cola que cae, patas de columna
  const brachio = outline([c(-1.0, 0.55), [-0.8, 0.3], [-0.55, 0.16], [-0.3, 0.07], [0.0, 0.03], [0.24, -0.04], [0.3, -0.3], [0.33, -0.6], [0.36, -0.85],
    [0.42, -0.98], [0.58, -1.04], [0.74, -0.99], [0.8, -0.92], [0.7, -0.86], [0.56, -0.82], [0.52, -0.6], [0.5, -0.3], [0.52, -0.05], [0.56, 0.25],
    [0.56, 0.55], [0.58, 0.86], c(0.72, 0.95), c(0.72, 0.99), c(0.3, 0.99), [0.32, 0.88], [0.32, 0.6], [0.28, 0.36], [0.12, 0.33], [-0.02, 0.5], [0.0, 0.8],
    [0.04, 0.9], c(0.16, 0.95), c(0.16, 0.99), c(-0.3, 0.99), [-0.28, 0.9], [-0.3, 0.6], [-0.42, 0.36], [-0.56, 0.38], [-0.8, 0.54]]);
  const brachiosaurus = { ...base, union: [brachio], detail: [eye(0.64, -0.97, 0.035), line([0.36, -0.45], [0.5, -0.45]), line([0.35, -0.72], [0.52, -0.72])] };

  // Estegosaurio: lomo bajo con placas redondeadas (la señal del animal) y púas en la cola
  const backY = (x) => -0.06 - 0.28 * Math.sqrt(Math.max(0, 1 - (x / 0.62) ** 2));
  const plates = [[-0.42, 0.28], [-0.24, 0.42], [-0.05, 0.5], [0.14, 0.46], [0.32, 0.34]];
  const platePts = [];
  plates.forEach(([x, hh], i) => {
    const yb = (xx) => backY(xx) + 0.03;
    if (i === 0) platePts.push(c(x - 0.1, yb(x - 0.1)));
    platePts.push([x - 0.065, yb(x) - hh * 0.62], [x, yb(x) - hh], [x + 0.065, yb(x) - hh * 0.62], c(x + 0.1, yb(x + 0.1)));
  });
  const stego = outline([c(-1.02, 0.34), [-0.8, 0.2], [-0.6, 0.04], ...platePts, [0.5, -0.02], [0.74, 0.08], [0.94, 0.22], [1.0, 0.32],
    [0.9, 0.4], [0.7, 0.36], [0.52, 0.42], [0.5, 0.62], [0.52, 0.86], c(0.66, 0.95), c(0.66, 0.99), c(0.3, 0.99), [0.32, 0.88], [0.3, 0.66], [0.14, 0.52],
    [0.0, 0.52], [-0.12, 0.66], [-0.1, 0.88], c(0.04, 0.95), c(0.04, 0.99), c(-0.4, 0.99), [-0.38, 0.88], [-0.4, 0.66], [-0.5, 0.52], [-0.76, 0.46]]);
  const tri3 = (a, b, tip) => [["M", ...a], ["L", ...b], ["L", ...tip], ["Z"]];
  const stegosaurus = { ...base, union: [stego, tri3([-0.84, 0.2], [-0.7, 0.14], [-0.9, -0.22]), tri3([-1.0, 0.3], [-0.88, 0.22], [-1.1, -0.12])], detail: [eye(0.86, 0.26, 0.035)] };

  // Triceratops: gola de puntas (la señal), dos cuernos largos y uno corto, pico
  const frill = [];
  for (let k = 0; k <= 36; k++) { // semicírculo detrás de la cabeza, con puntas
    const t = Math.PI * 0.62 + (k / 36) * Math.PI * 1.1, r = 0.46 * (0.9 + 0.12 * (k % 3 === 0 ? 1 : 0));
    frill.push([0.42 + r * Math.cos(t), -0.04 + r * Math.sin(t) * 1.15, k % 3 === 0 ? 1 : 0]);
  }
  const tri = outline([c(-1.0, 0.34), [-0.74, 0.14], [-0.42, -0.08], [-0.08, -0.14], [0.12, -0.1], [0.5, 0.0], c(0.74, -0.02), [0.92, 0.1], [1.02, 0.28], c(1.04, 0.36),
    [0.94, 0.4], [0.78, 0.42], [0.62, 0.42], [0.52, 0.5], [0.55, 0.7], [0.55, 0.88], c(0.68, 0.95), c(0.68, 0.99), c(0.34, 0.99), [0.36, 0.88], [0.36, 0.7],
    [0.2, 0.55], [0.0, 0.52], [-0.1, 0.66], [-0.1, 0.88], c(0.02, 0.95), c(0.02, 0.99), c(-0.42, 0.99), [-0.4, 0.88], [-0.42, 0.65], [-0.55, 0.45], [-0.8, 0.45]]);
  const tri3b = (a, b, tip) => [["M", ...a], ["L", ...b], ["L", ...tip], ["Z"]];
  const triceratops = { ...base, union: [tri, outline(frill), tri3b([0.56, -0.08], [0.7, 0.02], [0.92, -0.56]), tri3b([0.76, 0.02], [0.9, 0.1], [1.2, -0.36]), tri3b([0.96, 0.14], [1.04, 0.22], [1.14, 0.0])],
    detail: [eye(0.8, 0.16, 0.04), line([0.72, 0.36], [0.94, 0.38])] };

  // Pterosaurio (pteranodon) en vuelo, visto desde arriba: pico largo, alas extendidas con borde festoneado, cola corta
  const half = [[0.06, -0.78], [0.08, -0.5], [0.16, -0.4], [0.55, -0.58], c(1.08, -0.3), c(0.76, -0.02), [0.66, 0.12], c(0.46, 0.04), [0.34, 0.2], [0.14, 0.34], [0.07, 0.62]];
  const mirror = half.map(([x, y, k]) => [-x, y, k]).reverse();
  const ptero = outline([c(0, -1.0), ...half, c(0, 0.98), ...mirror]);
  const pterosaur = { ...base, union: [ptero], detail: [eye(0.03, -0.72, 0.025), line([0.16, -0.4], [0.76, -0.02]), line([-0.16, -0.4], [-0.76, -0.02])] };

  return { trex, brachiosaurus, stegosaurus, triceratops, pterosaur };
}
