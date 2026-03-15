import { mulberry32, rFloat } from "../core/prng.js";
import { PathBuilder } from "../core/pathBuilder.js";

/**
 * Mandala con arquitectura de capas modulares - VERSION PREMIUM v2
 * - 8 capas principales + anillos intermedios de conexión
 * - 7 estilos culturales con patrones ricos y detallados
 * - Geometría de calidad profesional para libros de colorear
 */

// --- Helpers ---
function _lerp(a, b, t) { return a + (b - a) * t; }
function _clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function _polar(r, theta, cx, cy) {
  return { x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) };
}

function _p(r, theta, center) {
  return { x: center.x + r * Math.cos(theta), y: center.y + r * Math.sin(theta) };
}

// --- Shape Primitives ---

function addCircle(pb, cx, cy, r, seg = 24) {
  if (r <= 0.05) return;
  seg = Math.max(8, seg);
  const step = (Math.PI * 2) / seg;
  pb.moveTo(cx + r, cy);
  for (let i = 1; i < seg; i++) {
    const a = step * i;
    pb.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  pb.close();
}

function addSmoothCircle(pb, cx, cy, r, seg = 12) {
  if (r <= 0.05) return;
  // Use cubic beziers for smoother circles
  const n = Math.max(4, seg);
  const angleStep = (Math.PI * 2) / n;
  const k = (4 / 3) * Math.tan(angleStep / 4); // bezier approximation factor
  let px = cx + r, py = cy;
  pb.moveTo(px, py);
  for (let i = 0; i < n; i++) {
    const a1 = angleStep * i;
    const a2 = angleStep * (i + 1);
    const cos1 = Math.cos(a1), sin1 = Math.sin(a1);
    const cos2 = Math.cos(a2), sin2 = Math.sin(a2);
    const cp1x = cx + r * (cos1 - k * sin1);
    const cp1y = cy + r * (sin1 + k * cos1);
    const cp2x = cx + r * (cos2 + k * sin2);
    const cp2y = cy + r * (sin2 - k * cos2);
    const ex = cx + r * cos2, ey = cy + r * sin2;
    pb.cubicTo(cp1x, cp1y, cp2x, cp2y, ex, ey);
  }
}

function addCapsule(pb, ax, ay, bx, by, w) {
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return;
  const nx = -dy / len, ny = dx / len;
  const hw = w / 2;
  pb.moveTo(ax + nx * hw, ay + ny * hw)
    .lineTo(bx + nx * hw, by + ny * hw)
    .lineTo(bx - nx * hw, by - ny * hw)
    .lineTo(ax - nx * hw, ay - ny * hw)
    .close();
}

function addStar(pb, cx, cy, rOuter, rInner, n, rot = 0) {
  const total = n * 2;
  for (let i = 0; i < total; i++) {
    const a = (i / total) * Math.PI * 2 + rot;
    const r = i % 2 === 0 ? rOuter : rInner;
    if (i === 0) pb.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    else pb.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  pb.close();
}

function addPoly(pb, cx, cy, r, n, rot = 0) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rot;
    if (i === 0) pb.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    else pb.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  pb.close();
}

/** Teardrop / gota - elemento clave de mandalas profesionales */
function addTeardrop(pb, cx, cy, length, width, angle) {
  const tip = _polar(length, angle, cx, cy);
  const base = _polar(-length * 0.15, angle, cx, cy);
  const cpL = _polar(length * 0.55, angle - 0.5, cx, cy);
  const cpR = _polar(length * 0.55, angle + 0.5, cx, cy);
  const cpBL = _polar(width * 0.3, angle - Math.PI * 0.5, cx, cy);
  const cpBR = _polar(width * 0.3, angle + Math.PI * 0.5, cx, cy);
  pb.moveTo(base.x, base.y)
    .cubicTo(cpBL.x, cpBL.y, cpL.x, cpL.y, tip.x, tip.y)
    .cubicTo(cpR.x, cpR.y, cpBR.x, cpBR.y, base.x, base.y)
    .close();
}

/** Ring of evenly-spaced dots */
function addPearlRing(pb, cx, cy, r, count, dotR, offset = 0) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + offset;
    addCircle(pb, cx + Math.cos(a) * r, cy + Math.sin(a) * r, dotR, 8);
  }
}

/** Scalloped ring - semicircular bumps along a circle */
function addScallopRing(pb, cx, cy, r, count, amplitude, outward = true, offset = 0) {
  for (let i = 0; i < count; i++) {
    const a1 = (i / count) * Math.PI * 2 + offset;
    const a2 = ((i + 1) / count) * Math.PI * 2 + offset;
    const aM = (a1 + a2) / 2;
    const p1 = _polar(r, a1, cx, cy);
    const p2 = _polar(r, a2, cx, cy);
    const cpR = outward ? r + amplitude : r - amplitude;
    const cp = _polar(cpR, aM, cx, cy);
    pb.moveTo(p1.x, p1.y).quadTo(cp.x, cp.y, p2.x, p2.y);
  }
}

/** Compound petal - outer petal with inner nested petal and vein line */
function addCompoundPetal(pb, center, rIn, rOut, angle, angSpread, hasInner, hasDot, hasVein, fineStroke) {
  const aC = angle;
  const halfSpread = angSpread * 0.45;
  const aL = aC - halfSpread;
  const aR = aC + halfSpread;

  // Outer petal shape
  const pBase = _p(rIn, aC, center);
  const pTip = _p(rOut, aC, center);
  const cpL = _p(rIn + (rOut - rIn) * 0.5, aL, center);
  const cpR = _p(rIn + (rOut - rIn) * 0.5, aR, center);
  pb.moveTo(pBase.x, pBase.y)
    .quadTo(cpL.x, cpL.y, pTip.x, pTip.y)
    .quadTo(cpR.x, cpR.y, pBase.x, pBase.y)
    .close();

  // Inner nested petal
  if (hasInner) {
    const rIn2 = rIn + (rOut - rIn) * 0.2;
    const rOut2 = rIn + (rOut - rIn) * 0.72;
    const cpL2 = _p(rIn2 + (rOut2 - rIn2) * 0.5, aC - halfSpread * 0.55, center);
    const cpR2 = _p(rIn2 + (rOut2 - rIn2) * 0.5, aC + halfSpread * 0.55, center);
    const pBase2 = _p(rIn2, aC, center);
    const pTip2 = _p(rOut2, aC, center);
    pb.moveTo(pBase2.x, pBase2.y)
      .quadTo(cpL2.x, cpL2.y, pTip2.x, pTip2.y)
      .quadTo(cpR2.x, cpR2.y, pBase2.x, pBase2.y)
      .close();
  }

  // Vein line through center
  if (hasVein) {
    const vStart = _p(rIn + (rOut - rIn) * 0.15, aC, center);
    const vEnd = _p(rIn + (rOut - rIn) * 0.88, aC, center);
    addCapsule(pb, vStart.x, vStart.y, vEnd.x, vEnd.y, fineStroke * 0.5);
  }

  // Dot at tip
  if (hasDot) {
    const dotPos = _p(rOut - (rOut - rIn) * 0.08, aC, center);
    addCircle(pb, dotPos.x, dotPos.y, (rOut - rIn) * 0.06, 8);
  }
}

/** Lotus petal - pointed tip with inner curve detail */
function addLotusPetal(pb, center, rIn, rOut, angle, angSpread) {
  const halfSpread = angSpread * 0.42;
  const pBase1 = _p(rIn, angle - halfSpread * 0.6, center);
  const pBase2 = _p(rIn, angle + halfSpread * 0.6, center);
  const pTip = _p(rOut, angle, center);
  const cpL1 = _p(rIn + (rOut - rIn) * 0.4, angle - halfSpread, center);
  const cpL2 = _p(rIn + (rOut - rIn) * 0.85, angle - halfSpread * 0.3, center);
  const cpR1 = _p(rIn + (rOut - rIn) * 0.85, angle + halfSpread * 0.3, center);
  const cpR2 = _p(rIn + (rOut - rIn) * 0.4, angle + halfSpread, center);
  pb.moveTo(pBase1.x, pBase1.y)
    .cubicTo(cpL1.x, cpL1.y, cpL2.x, cpL2.y, pTip.x, pTip.y)
    .cubicTo(cpR1.x, cpR1.y, cpR2.x, cpR2.y, pBase2.x, pBase2.y)
    .close();
  // Inner detail curve
  const iRIn = rIn + (rOut - rIn) * 0.25;
  const iROut = rIn + (rOut - rIn) * 0.65;
  const iCpL = _p(iRIn + (iROut - iRIn) * 0.5, angle - halfSpread * 0.45, center);
  const iCpR = _p(iRIn + (iROut - iRIn) * 0.5, angle + halfSpread * 0.45, center);
  const iTip = _p(iROut, angle, center);
  const iBase = _p(iRIn, angle, center);
  pb.moveTo(iBase.x, iBase.y)
    .quadTo(iCpL.x, iCpL.y, iTip.x, iTip.y)
    .quadTo(iCpR.x, iCpR.y, iBase.x, iBase.y);
}

// ====================================================================
// MAIN GENERATOR
// ====================================================================
export function generateMandalaLayers(doc, opts) {
  const {
    seed,
    petals = 12,
    stroke = "#000",
    strokeWidthMm = 0.6,
    layer1Intensity = 0.8,
    layer2Intensity = 0.8,
    layer3Intensity = 0.7,
    layer4Intensity = 0.8,
    layer5Intensity = 0.6,
    layer6Intensity = 0.7,
    layer7Intensity = 0.5,
    layer8Intensity = 0.4,
    styleMode = "sashiko",
    organicLevel = 0.2,
    complexity = 110,
    includeFrames = true,
    pageBorder = true,
  } = opts;

  const page = doc?.page ?? { wMm: 210, hMm: 297, marginMm: 10 };
  const marginMm = page.marginMm || 10;
  const center = { x: page.wMm / 2, y: page.hMm / 2 };
  const R = Math.min(page.wMm, page.hMm) / 2 - marginMm - 5;

  const rng = mulberry32(seed);
  const paths = [];

  const style = styleMode === "hashiko" ? "sashiko" : styleMode;

  const mainW = strokeWidthMm;
  const detailW = strokeWidthMm * 0.7;
  const fineW = strokeWidthMm * 0.4;
  const hairW = strokeWidthMm * 0.25;

  // Helper: push a PathBuilder as a path element
  const pushPath = (pb, w = detailW) => {
    const p = pb.toPath({ stroke, strokeWidthMm: w });
    if (p) paths.push(p);
  };

  // ==================== L1: NÚCLEO (BINDU) ====================
  if (layer1Intensity > 0.05) {
    const pb = new PathBuilder();
    const rCore = R * 0.12 * layer1Intensity;

    // Bindu central
    addCircle(pb, center.x, center.y, rCore * 0.12, 10);

    // Seed of life pattern (6 overlapping circles)
    if (layer1Intensity > 0.3) {
      const seedR = rCore * 0.35;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        addSmoothCircle(pb, center.x + Math.cos(a) * seedR, center.y + Math.sin(a) * seedR, seedR, 10);
      }
      addSmoothCircle(pb, center.x, center.y, seedR, 10);
    }

    // Inner protection ring with small petals
    if (layer1Intensity > 0.5) {
      addCircle(pb, center.x, center.y, rCore * 0.55, 20);
      // Mini petal ring
      const miniCount = Math.max(8, petals);
      for (let i = 0; i < miniCount; i++) {
        const a = (i / miniCount) * Math.PI * 2;
        const tipR = rCore * 0.82;
        const baseR = rCore * 0.58;
        const tip = _p(tipR, a, center);
        const base = _p(baseR, a, center);
        const cpL = _p(baseR + (tipR - baseR) * 0.5, a - 0.18, center);
        const cpR = _p(baseR + (tipR - baseR) * 0.5, a + 0.18, center);
        pb.moveTo(base.x, base.y)
          .quadTo(cpL.x, cpL.y, tip.x, tip.y)
          .quadTo(cpR.x, cpR.y, base.x, base.y);
      }
    }

    // Outer core ring
    addCircle(pb, center.x, center.y, rCore, 32);

    // Pearl ring around core
    if (layer1Intensity > 0.6) {
      addPearlRing(pb, center.x, center.y, rCore * 1.08, Math.max(12, petals), rCore * 0.05);
    }

    // Yantra: interlocked triangles
    if (style === "yantra" && layer1Intensity > 0.5) {
      addPoly(pb, center.x, center.y, rCore * 0.8, 3, -Math.PI / 2);
      addPoly(pb, center.x, center.y, rCore * 0.8, 3, Math.PI / 2);
      // Nested smaller pair
      addPoly(pb, center.x, center.y, rCore * 0.5, 3, -Math.PI / 2);
      addPoly(pb, center.x, center.y, rCore * 0.5, 3, Math.PI / 2);
    }

    pushPath(pb, detailW);
  }

  // ==================== L2: PÉTALOS INTERNOS (Compound) ====================
  if (layer2Intensity > 0.05) {
    const pb = new PathBuilder();
    const rIn = R * 0.13;
    const rOut = rIn + R * 0.17 * layer2Intensity;
    const count = petals;
    const angStep = (Math.PI * 2) / count;

    for (let i = 0; i < count; i++) {
      const aC = (i / count) * Math.PI * 2;

      if (style === "islamico") {
        // Angular khatam petals with inner diamond
        const pIn = _p(rIn, aC, center);
        const pOut = _p(rOut, aC, center);
        const pML = _p(rIn + (rOut - rIn) * 0.55, aC - angStep * 0.35, center);
        const pMR = _p(rIn + (rOut - rIn) * 0.55, aC + angStep * 0.35, center);
        pb.moveTo(pIn.x, pIn.y).lineTo(pML.x, pML.y).lineTo(pOut.x, pOut.y)
          .lineTo(pMR.x, pMR.y).close();
        // Inner diamond
        if (layer2Intensity > 0.4) {
          const dC = _p(rIn + (rOut - rIn) * 0.45, aC, center);
          addStar(pb, dC.x, dC.y, (rOut - rIn) * 0.18, (rOut - rIn) * 0.08, 4, aC);
        }

      } else if (style === "azteca") {
        // Stepped trapezoidal petals with notch
        const pIn = _p(rIn, aC, center);
        const pOut = _p(rOut, aC, center);
        const pL = _p(rIn + (rOut - rIn) * 0.4, aC - angStep * 0.35, center);
        const pR = _p(rIn + (rOut - rIn) * 0.4, aC + angStep * 0.35, center);
        const pStL = _p(rIn + (rOut - rIn) * 0.7, aC - angStep * 0.2, center);
        const pStR = _p(rIn + (rOut - rIn) * 0.7, aC + angStep * 0.2, center);
        pb.moveTo(pIn.x, pIn.y).lineTo(pL.x, pL.y).lineTo(pStL.x, pStL.y)
          .lineTo(pOut.x, pOut.y).lineTo(pStR.x, pStR.y).lineTo(pR.x, pR.y).close();

      } else if (style === "geometric") {
        // Sharp geometric petal
        const pIn = _p(rIn, aC, center);
        const pOut = _p(rOut, aC, center);
        const pL = _p(rIn + (rOut - rIn) * 0.5, aC - angStep * 0.38, center);
        const pR = _p(rIn + (rOut - rIn) * 0.5, aC + angStep * 0.38, center);
        pb.moveTo(pIn.x, pIn.y).lineTo(pL.x, pL.y).lineTo(pOut.x, pOut.y)
          .lineTo(pR.x, pR.y).close();
        // Inner lines
        const pM = _p(rIn + (rOut - rIn) * 0.55, aC, center);
        addCapsule(pb, pIn.x, pIn.y, pM.x, pM.y, fineW * 0.4);

      } else {
        // Compound organic petals (sashiko, floral, celtico, yantra)
        addCompoundPetal(pb, center, rIn, rOut, aC, angStep,
          layer2Intensity > 0.4,  // inner petal
          layer2Intensity > 0.6,  // dot
          layer2Intensity > 0.3,  // vein
          fineW);
      }
    }

    // Connecting circle at petal tips
    if (layer2Intensity > 0.3) {
      addCircle(pb, center.x, center.y, rOut, 48);
    }

    pushPath(pb, mainW);
  }

  // ==================== RING A: Transition ring (between L2 and L3) ====================
  {
    const rRing = R * 0.31;
    const intensity = Math.min(layer2Intensity, layer3Intensity);
    if (intensity > 0.2) {
      const pb = new PathBuilder();
      addCircle(pb, center.x, center.y, rRing, 64);

      // Scalloped decoration
      if (intensity > 0.4) {
        addScallopRing(pb, center.x, center.y, rRing + 1.2, petals * 2, 1.5, true);
      }

      // Pearl dots
      if (intensity > 0.5) {
        addPearlRing(pb, center.x, center.y, rRing - 1.5, petals * 2, 0.5);
      }

      pushPath(pb, fineW);
    }
  }

  // ==================== L3: PATRÓN CULTURAL (Enhanced) ====================
  if (layer3Intensity > 0.05) {
    const pb = new PathBuilder();
    const rMid = R * 0.42;
    const fSize = R * 0.11 * layer3Intensity;

    const countMap = {
      sashiko: Math.max(8, petals),
      islamico: Math.max(8, petals),
      azteca: Math.max(6, petals),
      yantra: Math.max(6, petals),
      celtico: Math.max(6, Math.round(petals * 0.75)),
      floral: Math.max(6, Math.round(petals / 2)),
      geometric: Math.max(6, Math.round(petals / 2)),
    };
    const count = countMap[style] ?? Math.max(6, Math.round(petals / 2));

    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const fc = _p(rMid, a, center);

      if (style === "sashiko") {
        // Enhanced sashiko rosette with stitching detail
        const pCount = 6;
        for (let j = 0; j < pCount; j++) {
          const pa = (j / pCount) * Math.PI * 2 + a;
          const pOuter = _polar(fSize, pa, fc.x, fc.y);
          const pInner = _polar(fSize * 0.42, pa + Math.PI / pCount, fc.x, fc.y);
          pb.moveTo(fc.x, fc.y).lineTo(pOuter.x, pOuter.y);
          pb.moveTo(pInner.x, pInner.y).lineTo(pOuter.x, pOuter.y);
          // Cross-stitch detail
          if (layer3Intensity > 0.5) {
            const cp1 = _polar(fSize * 0.6, pa - 0.2, fc.x, fc.y);
            const cp2 = _polar(fSize * 0.6, pa + 0.2, fc.x, fc.y);
            pb.moveTo(cp1.x, cp1.y).lineTo(cp2.x, cp2.y);
          }
        }
        addCircle(pb, fc.x, fc.y, fSize * 0.8, 16);
        addCircle(pb, fc.x, fc.y, fSize * 0.32, 12);
        // Outer petal highlights
        if (layer3Intensity > 0.6) {
          for (let j = 0; j < pCount; j++) {
            const pa = (j / pCount) * Math.PI * 2 + a + Math.PI / pCount;
            addTeardrop(pb, fc.x, fc.y, fSize * 0.55, fSize * 0.2, pa);
          }
        }

      } else if (style === "floral") {
        // Rich botanical flower
        const pCount = 5;
        for (let j = 0; j < pCount; j++) {
          const pa = (j / pCount) * Math.PI * 2 + a;
          // Outer petal
          addLotusPetal(pb, fc, fSize * 0.18, fSize * 0.95, pa, (Math.PI * 2) / pCount);
        }
        // Center pistil
        addCircle(pb, fc.x, fc.y, fSize * 0.18, 10);
        addCircle(pb, fc.x, fc.y, fSize * 0.08, 8);
        // Small sepals between petals
        if (layer3Intensity > 0.5) {
          for (let j = 0; j < pCount; j++) {
            const pa = (j / pCount) * Math.PI * 2 + a + Math.PI / pCount;
            addTeardrop(pb, fc.x, fc.y, fSize * 0.45, fSize * 0.12, pa);
          }
        }

      } else if (style === "geometric") {
        // Octagon with inner star
        addPoly(pb, fc.x, fc.y, fSize, 8, a);
        addStar(pb, fc.x, fc.y, fSize * 0.7, fSize * 0.3, 8, a + Math.PI / 8);
        // Cross axes
        for (let j = 0; j < 4; j++) {
          const ja = a + (j / 4) * Math.PI * 2;
          const p1 = _polar(fSize * 0.85, ja, fc.x, fc.y);
          const p2 = _polar(fSize * 0.85, ja + Math.PI, fc.x, fc.y);
          addCapsule(pb, p1.x, p1.y, p2.x, p2.y, fineW * 0.4);
        }
        // Inner circle
        addCircle(pb, fc.x, fc.y, fSize * 0.28, 10);

      } else if (style === "islamico") {
        // 8-pointed khatam star with girih detail
        addStar(pb, fc.x, fc.y, fSize, fSize * 0.38, 8, a);
        addPoly(pb, fc.x, fc.y, fSize * 0.38, 8, a + Math.PI / 8);
        // Inner 4-pointed star
        if (layer3Intensity > 0.4) {
          addStar(pb, fc.x, fc.y, fSize * 0.35, fSize * 0.15, 4, a);
        }
        // Girih connecting lines
        if (layer3Intensity > 0.5) {
          for (let j = 0; j < 4; j++) {
            const ja = a + (j / 4) * Math.PI * 2;
            const p1 = _polar(fSize * 0.95, ja, fc.x, fc.y);
            const p2 = _polar(fSize * 0.95, ja + Math.PI, fc.x, fc.y);
            addCapsule(pb, p1.x, p1.y, p2.x, p2.y, fineW * 0.5);
          }
        }
        // Outer rim dots
        if (layer3Intensity > 0.6) {
          addPearlRing(pb, fc.x, fc.y, fSize * 0.85, 8, fSize * 0.06, a + Math.PI / 8);
        }

      } else if (style === "azteca") {
        // Solar glyph with stepped frame
        addStar(pb, fc.x, fc.y, fSize, fSize * 0.5, 4, a + Math.PI / 4);
        addPoly(pb, fc.x, fc.y, fSize * 1.05, 8, a);
        // Calendar marks
        for (let j = 0; j < 4; j++) {
          const ja = a + (j / 4) * Math.PI * 2;
          const jp = _polar(fSize * 0.72, ja, fc.x, fc.y);
          addCapsule(pb, fc.x, fc.y, jp.x, jp.y, fineW * 0.7);
        }
        // Stepped ring detail
        if (layer3Intensity > 0.5) {
          addPoly(pb, fc.x, fc.y, fSize * 0.65, 4, a);
          addPoly(pb, fc.x, fc.y, fSize * 0.3, 4, a + Math.PI / 4);
        }

      } else if (style === "yantra") {
        // Shatkona with nested geometry
        addPoly(pb, fc.x, fc.y, fSize, 3, a);
        addPoly(pb, fc.x, fc.y, fSize, 3, a + Math.PI);
        addCircle(pb, fc.x, fc.y, fSize * 1.05, 20);
        addCircle(pb, fc.x, fc.y, fSize * 0.15, 8);
        // Inner second shatkona
        if (layer3Intensity > 0.5) {
          addPoly(pb, fc.x, fc.y, fSize * 0.55, 3, a + Math.PI / 6);
          addPoly(pb, fc.x, fc.y, fSize * 0.55, 3, a + Math.PI + Math.PI / 6);
        }

      } else if (style === "celtico") {
        // Trefoil with knotwork suggestion
        const lCount = 3;
        const lobeR = fSize * 0.52;
        const lobeDist = fSize * 0.43;
        for (let j = 0; j < lCount; j++) {
          const la = a + (j / lCount) * Math.PI * 2 + Math.PI / 6;
          const lc = _polar(lobeDist, la, fc.x, fc.y);
          addSmoothCircle(pb, lc.x, lc.y, lobeR, 10);
          // Inner lobe circle
          if (layer3Intensity > 0.5) {
            addCircle(pb, lc.x, lc.y, lobeR * 0.5, 10);
          }
        }
        addCircle(pb, fc.x, fc.y, fSize * 0.9, 22);
        if (layer3Intensity > 0.5) {
          addCircle(pb, fc.x, fc.y, fSize * 0.25, 10);
          // Connecting arcs between lobes
          for (let j = 0; j < lCount; j++) {
            const la1 = a + (j / lCount) * Math.PI * 2 + Math.PI / 6;
            const la2 = a + ((j + 1) / lCount) * Math.PI * 2 + Math.PI / 6;
            const p1 = _polar(lobeDist + lobeR * 0.7, la1, fc.x, fc.y);
            const p2 = _polar(lobeDist + lobeR * 0.7, la2, fc.x, fc.y);
            const cp = _polar(fSize * 1.1, (la1 + la2) / 2, fc.x, fc.y);
            pb.moveTo(p1.x, p1.y).quadTo(cp.x, cp.y, p2.x, p2.y);
          }
        }
      }
    }

    // Secondary ring of smaller elements between main motifs
    if (layer3Intensity > 0.4 && count >= 4) {
      const smallCount = count;
      const smallSize = fSize * 0.35;
      for (let i = 0; i < smallCount; i++) {
        const a = ((i + 0.5) / smallCount) * Math.PI * 2;
        const sc = _p(rMid, a, center);
        if (style === "floral" || style === "sashiko") {
          addTeardrop(pb, sc.x, sc.y, smallSize, smallSize * 0.4, a);
        } else if (style === "islamico" || style === "geometric") {
          addStar(pb, sc.x, sc.y, smallSize, smallSize * 0.4, 4, a);
        } else if (style === "azteca") {
          addPoly(pb, sc.x, sc.y, smallSize, 4, a);
        } else {
          addCircle(pb, sc.x, sc.y, smallSize * 0.6, 10);
        }
      }
    }

    pushPath(pb, detailW);
  }

  // ==================== RING B: Between L3 and L4 ====================
  {
    const rRing = R * 0.52;
    const intensity = Math.min(layer3Intensity, layer4Intensity);
    if (intensity > 0.15) {
      const pb = new PathBuilder();
      addCircle(pb, center.x, center.y, rRing, 80);

      if (intensity > 0.35) {
        // Teardrop ring pointing outward
        const tdCount = petals;
        for (let i = 0; i < tdCount; i++) {
          const a = (i / tdCount) * Math.PI * 2;
          const base = _p(rRing + 0.5, a, center);
          addTeardrop(pb, base.x, base.y, R * 0.035 * intensity, R * 0.015, a);
        }
      }

      if (intensity > 0.5) {
        addCircle(pb, center.x, center.y, rRing - 1.5, 80);
      }

      pushPath(pb, fineW);
    }
  }

  // ==================== L4: ANILLO GEOMÉTRICO (Enhanced) ====================
  if (layer4Intensity > 0.05) {
    const pb = new PathBuilder();
    const r1 = R * 0.56;
    const r2 = r1 + R * 0.1 * layer4Intensity;
    const count = petals * 2;

    // Inner ring
    addCircle(pb, center.x, center.y, r1, 80);

    for (let i = 0; i < count; i++) {
      const a1 = (i / count) * Math.PI * 2;
      const a2 = ((i + 1) / count) * Math.PI * 2;
      const aM = (a1 + a2) / 2;

      const p1a = _p(r1, a1, center);
      const p2a = _p(r1, a2, center);
      const pM = _p(r2, aM, center);

      if (style === "geometric") {
        pb.moveTo(p1a.x, p1a.y).lineTo(pM.x, pM.y).lineTo(p2a.x, p2a.y);
        // Inner triangle fill
        if (layer4Intensity > 0.5 && i % 2 === 0) {
          const pMid = _p(r1 + (r2 - r1) * 0.4, aM, center);
          addCircle(pb, pMid.x, pMid.y, (r2 - r1) * 0.12, 6);
        }

      } else if (style === "islamico") {
        pb.moveTo(p1a.x, p1a.y).lineTo(pM.x, pM.y).lineTo(p2a.x, p2a.y);
        if (i % 2 === 0) {
          const pIn = _p(r1 - R * 0.025, aM, center);
          addCapsule(pb, pIn.x, pIn.y, pM.x, pM.y, fineW * 0.5);
        }
        // Diamond detail
        if (layer4Intensity > 0.5 && i % 2 === 1) {
          const dC = _p(r1 + (r2 - r1) * 0.35, aM, center);
          addStar(pb, dC.x, dC.y, (r2 - r1) * 0.2, (r2 - r1) * 0.08, 4, aM);
        }

      } else if (style === "azteca") {
        // Stepped pyramid motif
        const pStep1 = _p(r1 + (r2 - r1) * 0.35, a1, center);
        const pStep2 = _p(r1 + (r2 - r1) * 0.35, a2, center);
        const pStep3 = _p(r1 + (r2 - r1) * 0.7, aM - (a2 - a1) * 0.15, center);
        const pStep4 = _p(r1 + (r2 - r1) * 0.7, aM + (a2 - a1) * 0.15, center);
        pb.moveTo(p1a.x, p1a.y).lineTo(pStep1.x, pStep1.y)
          .lineTo(pStep3.x, pStep3.y).lineTo(pM.x, pM.y)
          .lineTo(pStep4.x, pStep4.y).lineTo(pStep2.x, pStep2.y)
          .lineTo(p2a.x, p2a.y);

      } else if (style === "yantra") {
        // Lotus petal arch
        const cpL = _p(r2 * 0.98, aM - 0.1, center);
        const cpR = _p(r2 * 0.98, aM + 0.1, center);
        pb.moveTo(p1a.x, p1a.y).quadTo(cpL.x, cpL.y, pM.x, pM.y)
          .quadTo(cpR.x, cpR.y, p2a.x, p2a.y);
        // Inner lotus detail
        if (layer4Intensity > 0.5 && i % 2 === 0) {
          const cpLi = _p(r1 + (r2 - r1) * 0.55, aM - 0.06, center);
          const cpRi = _p(r1 + (r2 - r1) * 0.55, aM + 0.06, center);
          const pMi = _p(r1 + (r2 - r1) * 0.65, aM, center);
          pb.moveTo(p1a.x, p1a.y).quadTo(cpLi.x, cpLi.y, pMi.x, pMi.y)
            .quadTo(cpRi.x, cpRi.y, p2a.x, p2a.y);
        }

      } else if (style === "celtico") {
        // Gothic pointed arch
        const cpA = _p(r1 + (r2 - r1) * 0.92, a1 + (a2 - a1) * 0.15, center);
        const cpB = _p(r1 + (r2 - r1) * 0.92, a2 - (a2 - a1) * 0.15, center);
        pb.moveTo(p1a.x, p1a.y).quadTo(cpA.x, cpA.y, pM.x, pM.y)
          .quadTo(cpB.x, cpB.y, p2a.x, p2a.y);
        // Trefoil at apex
        if (layer4Intensity > 0.6 && i % 2 === 0) {
          addCircle(pb, pM.x, pM.y, (r2 - r1) * 0.15, 8);
        }

      } else {
        // Default: smooth arch with detail
        pb.moveTo(p1a.x, p1a.y).quadTo(pM.x, pM.y, p2a.x, p2a.y);
        // Alternating detail
        if (i % 3 === 0 && layer4Intensity > 0.4) {
          const pInner = _p(r1 - R * 0.02, aM, center);
          const pOuter = _p(r2 + R * 0.02, aM, center);
          addCapsule(pb, pInner.x, pInner.y, pOuter.x, pOuter.y, fineW * 0.6);
        }
      }
    }

    // Outer ring with scallop
    addCircle(pb, center.x, center.y, r2, 80);
    if (layer4Intensity > 0.5) {
      addScallopRing(pb, center.x, center.y, r2 + 1, count, 1.2, true);
    }

    pushPath(pb, mainW);
  }

  // ==================== RING C: Between L4 and L5 ====================
  {
    const rRing = R * 0.68;
    const intensity = Math.min(layer4Intensity, layer5Intensity);
    if (intensity > 0.2) {
      const pb = new PathBuilder();
      addCircle(pb, center.x, center.y, rRing, 80);

      // Alternating dots and dashes
      if (intensity > 0.35) {
        const count = petals * 3;
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2;
          if (i % 3 === 0) {
            addCircle(pb, center.x + Math.cos(a) * rRing, center.y + Math.sin(a) * rRing, 0.6, 6);
          } else if (i % 3 === 1) {
            const p1 = _p(rRing - 1, a, center);
            const p2 = _p(rRing + 1, a, center);
            addCapsule(pb, p1.x, p1.y, p2.x, p2.y, fineW * 0.4);
          }
        }
      }

      pushPath(pb, fineW);
    }
  }

  // ==================== L5: DETALLES FINOS (Enhanced) ====================
  if (layer5Intensity > 0.05) {
    const pb = new PathBuilder();
    const rStart = R * 0.7;
    const rEnd = rStart + R * 0.1 * layer5Intensity;
    const count = petals * 4;

    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;

      if (i % 4 === 0) {
        // Teardrop pointing outward
        const base = _p(rStart, a, center);
        addTeardrop(pb, base.x, base.y, (rEnd - rStart) * 0.8, (rEnd - rStart) * 0.25, a);
      } else if (i % 4 === 2) {
        // Line
        const p1 = _p(rStart, a, center);
        const p2 = _p(rEnd, a, center);
        addCapsule(pb, p1.x, p1.y, p2.x, p2.y, fineW);
      } else if (layer5Intensity > 0.4) {
        // Small dot
        const pDot = _p(rEnd + 1.5, a, center);
        addCircle(pb, pDot.x, pDot.y, 0.7, 6);
      }
    }

    // Secondary fine ring with micro-petals
    if (layer5Intensity > 0.5) {
      const rMicro = rEnd + 3;
      addCircle(pb, center.x, center.y, rMicro, 80);
      const microCount = petals * 2;
      for (let i = 0; i < microCount; i++) {
        const a = (i / microCount) * Math.PI * 2;
        const base = _p(rMicro, a, center);
        const tip = _p(rMicro + R * 0.025, a, center);
        const cpL = _p(rMicro + R * 0.015, a - 0.08, center);
        const cpR = _p(rMicro + R * 0.015, a + 0.08, center);
        pb.moveTo(base.x, base.y)
          .quadTo(cpL.x, cpL.y, tip.x, tip.y)
          .quadTo(cpR.x, cpR.y, base.x, base.y);
      }
    }

    // Islamic small diamonds
    if (style === "islamico" && layer5Intensity > 0.35) {
      const dCount = petals * 2;
      for (let i = 0; i < dCount; i++) {
        const a = ((i + 0.5) / dCount) * Math.PI * 2;
        const dc = _p((rStart + rEnd) / 2, a, center);
        addStar(pb, dc.x, dc.y, 1.5, 0.6, 4, a);
      }
    }

    // Yantra: diamond accents
    if (style === "yantra" && layer5Intensity > 0.4) {
      const dCount = petals * 2;
      for (let i = 0; i < dCount; i++) {
        const a = ((i + 0.5) / dCount) * Math.PI * 2;
        const dc = _p((rStart + rEnd) / 2, a, center);
        addStar(pb, dc.x, dc.y, 1.2, 0.4, 4, a);
      }
    }

    pushPath(pb, fineW);
  }

  // ==================== L7: NATURAL / HOJAS / CULTURAL (Enhanced) ====================
  if (layer7Intensity > 0.05 && style !== "geometric") {
    const pb = new PathBuilder();
    const rInner = R * 0.34;
    const rOuter = rInner + R * 0.3 * layer7Intensity;
    const count = petals;

    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (Math.PI / count);

      if (style === "islamico") {
        // Tessellation element
        const pC = _p((rInner + rOuter) * 0.5, a, center);
        const dR = (rOuter - rInner) * 0.32 * layer7Intensity;
        addStar(pb, pC.x, pC.y, dR, dR * 0.42, 8, a);
        if (layer7Intensity > 0.5) {
          addCircle(pb, pC.x, pC.y, dR * 0.3, 8);
        }

      } else if (style === "azteca") {
        // Stepped pyramid profile
        const p1 = _p(rInner, a, center);
        const p2 = _p(rOuter, a, center);
        const pMid = _p((rInner + rOuter) * 0.5, a, center);
        const stepL = _p((rInner + rOuter) * 0.5, a - 0.25, center);
        const stepR = _p((rInner + rOuter) * 0.5, a + 0.25, center);
        pb.moveTo(p1.x, p1.y).lineTo(stepL.x, stepL.y).lineTo(p2.x, p2.y)
          .lineTo(stepR.x, stepR.y).close();
        addCapsule(pb, p1.x, p1.y, p2.x, p2.y, fineW * 0.5);
        // Small glyph
        if (layer7Intensity > 0.5) {
          addPoly(pb, pMid.x, pMid.y, (rOuter - rInner) * 0.12, 4, a);
        }

      } else if (style === "yantra") {
        // Energy diamond between triangles
        const pTop = _p(rOuter, a, center);
        const pBot = _p(rInner, a, center);
        const pL = _p((rInner + rOuter) * 0.5, a - 0.3 * layer7Intensity, center);
        const pR = _p((rInner + rOuter) * 0.5, a + 0.3 * layer7Intensity, center);
        pb.moveTo(pTop.x, pTop.y).lineTo(pL.x, pL.y).lineTo(pBot.x, pBot.y)
          .lineTo(pR.x, pR.y).close();
        // Inner diamond
        if (layer7Intensity > 0.5) {
          const s = 0.7;
          const iTop = _p(_lerp(rInner, rOuter, 0.5 + 0.3 * s), a, center);
          const iBot = _p(_lerp(rInner, rOuter, 0.5 - 0.3 * s), a, center);
          const iL = _p((rInner + rOuter) * 0.5, a - 0.15 * layer7Intensity, center);
          const iR = _p((rInner + rOuter) * 0.5, a + 0.15 * layer7Intensity, center);
          pb.moveTo(iTop.x, iTop.y).lineTo(iL.x, iL.y).lineTo(iBot.x, iBot.y)
            .lineTo(iR.x, iR.y).close();
        }

      } else if (style === "celtico") {
        // Interlaced curves
        const p1 = _p(rInner, a, center);
        const p2 = _p(rOuter, a, center);
        const cpA = _p((rInner + rOuter) * 0.5, a - 0.55 * layer7Intensity, center);
        const cpB = _p((rInner + rOuter) * 0.5, a + 0.55 * layer7Intensity, center);
        pb.moveTo(p1.x, p1.y).quadTo(cpA.x, cpA.y, p2.x, p2.y);
        pb.moveTo(p1.x, p1.y).quadTo(cpB.x, cpB.y, p2.x, p2.y);
        // Knotwork crossing
        if (layer7Intensity > 0.5) {
          const pMid = _p((rInner + rOuter) * 0.5, a, center);
          addCircle(pb, pMid.x, pMid.y, (rOuter - rInner) * 0.08, 6);
        }

      } else {
        // Rich organic leaf (sashiko / floral)
        const p1 = _p(rInner, a, center);
        const p2 = _p(rOuter, a, center);
        const leafW = 0.45 * layer7Intensity;
        const cp1 = _p(rInner + (rOuter - rInner) * 0.5, a - leafW, center);
        const cp2 = _p(rInner + (rOuter - rInner) * 0.5, a + leafW, center);
        // Leaf outline
        pb.moveTo(p1.x, p1.y)
          .quadTo(cp1.x, cp1.y, p2.x, p2.y)
          .quadTo(cp2.x, cp2.y, p1.x, p1.y)
          .close();
        // Midrib
        addCapsule(pb, p1.x, p1.y, p2.x, p2.y, fineW * 0.4);
        // Side veins
        if (layer7Intensity > 0.4) {
          for (let v = 0.25; v < 0.85; v += 0.2) {
            const vBase = _p(rInner + (rOuter - rInner) * v, a, center);
            const vTipL = _p(rInner + (rOuter - rInner) * (v + 0.08), a - leafW * 0.5, center);
            const vTipR = _p(rInner + (rOuter - rInner) * (v + 0.08), a + leafW * 0.5, center);
            pb.moveTo(vBase.x, vBase.y).lineTo(vTipL.x, vTipL.y);
            pb.moveTo(vBase.x, vBase.y).lineTo(vTipR.x, vTipR.y);
          }
        }
        // Berry/bud at leaf base (between leaves)
        if (layer7Intensity > 0.5 && i % 2 === 0) {
          const aNext = a + Math.PI / count;
          const budPos = _p(rInner + (rOuter - rInner) * 0.3, aNext, center);
          addCircle(pb, budPos.x, budPos.y, (rOuter - rInner) * 0.06, 8);
        }
      }
    }

    pushPath(pb, detailW);
  }

  // ==================== RING D: Between L5/L7 and L6 ====================
  {
    const rRing = R * 0.80;
    const intensity = Math.min(Math.max(layer5Intensity, layer7Intensity), layer6Intensity);
    if (intensity > 0.15) {
      const pb = new PathBuilder();
      addCircle(pb, center.x, center.y, rRing, 96);

      if (intensity > 0.3) {
        // Inward-pointing scallops
        addScallopRing(pb, center.x, center.y, rRing - 0.5, petals * 2, 1.8, false);
      }

      if (intensity > 0.45) {
        addCircle(pb, center.x, center.y, rRing + 1.2, 96);
        addPearlRing(pb, center.x, center.y, rRing + 1.2, petals * 3, 0.45);
      }

      pushPath(pb, fineW);
    }
  }

  // ==================== L6: BORDE DECORATIVO (Enhanced Crown) ====================
  if (layer6Intensity > 0.05) {
    const pb = new PathBuilder();
    const rBase = R * 0.83;
    const rTop = rBase + R * 0.13 * layer6Intensity;
    const count = petals;

    // Main crown arches
    for (let i = 0; i < count; i++) {
      const aC = (i / count) * Math.PI * 2;
      const aL = aC - (Math.PI / count);
      const aR = aC + (Math.PI / count);

      const pL = _p(rBase, aL, center);
      const pR = _p(rBase, aR, center);
      const pTop = _p(rTop, aC, center);

      if (style === "islamico") {
        // Geometric diamond crown
        const pMidL = _p(rBase + (rTop - rBase) * 0.5, aC - 0.12, center);
        const pMidR = _p(rBase + (rTop - rBase) * 0.5, aC + 0.12, center);
        pb.moveTo(pL.x, pL.y).lineTo(pMidL.x, pMidL.y).lineTo(pTop.x, pTop.y)
          .lineTo(pMidR.x, pMidR.y).lineTo(pR.x, pR.y);
        // Inner diamond detail
        if (layer6Intensity > 0.5) {
          const dc = _p(rBase + (rTop - rBase) * 0.4, aC, center);
          addStar(pb, dc.x, dc.y, (rTop - rBase) * 0.2, (rTop - rBase) * 0.08, 4, aC);
        }

      } else if (style === "azteca") {
        // Stepped crown with glyphs
        const pStepL = _p(rBase + (rTop - rBase) * 0.5, aC - 0.1, center);
        const pStepR = _p(rBase + (rTop - rBase) * 0.5, aC + 0.1, center);
        const pNarrowL = _p(rBase + (rTop - rBase) * 0.8, aC - 0.05, center);
        const pNarrowR = _p(rBase + (rTop - rBase) * 0.8, aC + 0.05, center);
        pb.moveTo(pL.x, pL.y).lineTo(pStepL.x, pStepL.y).lineTo(pNarrowL.x, pNarrowL.y)
          .lineTo(pTop.x, pTop.y).lineTo(pNarrowR.x, pNarrowR.y)
          .lineTo(pStepR.x, pStepR.y).lineTo(pR.x, pR.y);
        if (layer6Intensity > 0.6) {
          addStar(pb, pTop.x, pTop.y, 1.8, 0.8, 4, aC);
        }

      } else if (style === "celtico") {
        // Gothic pointed arch with trefoil
        const cpL2 = _p(rTop * 0.97, aC - 0.13, center);
        const cpR2 = _p(rTop * 0.97, aC + 0.13, center);
        pb.moveTo(pL.x, pL.y).quadTo(cpL2.x, cpL2.y, pTop.x, pTop.y)
          .quadTo(cpR2.x, cpR2.y, pR.x, pR.y);
        // Inner arch
        if (layer6Intensity > 0.4) {
          const irBase = rBase + (rTop - rBase) * 0.15;
          const irTop = rBase + (rTop - rBase) * 0.75;
          const ipL = _p(irBase, aL, center);
          const ipR = _p(irBase, aR, center);
          const ipTop = _p(irTop, aC, center);
          const icpL = _p(irTop * 0.97, aC - 0.1, center);
          const icpR = _p(irTop * 0.97, aC + 0.1, center);
          pb.moveTo(ipL.x, ipL.y).quadTo(icpL.x, icpL.y, ipTop.x, ipTop.y)
            .quadTo(icpR.x, icpR.y, ipR.x, ipR.y);
        }
        if (layer6Intensity > 0.6) {
          addCircle(pb, pTop.x, pTop.y, 1.6, 10);
        }

      } else {
        // Organic arch with nested curve
        const cpLo = _p(rTop * 0.96, aC - 0.2, center);
        const cpRo = _p(rTop * 0.96, aC + 0.2, center);
        pb.moveTo(pL.x, pL.y)
          .quadTo(cpLo.x, cpLo.y, pTop.x, pTop.y)
          .quadTo(cpRo.x, cpRo.y, pR.x, pR.y);

        // Nested inner arch
        if (layer6Intensity > 0.4) {
          const irBase = rBase + (rTop - rBase) * 0.12;
          const irTop = rBase + (rTop - rBase) * 0.7;
          const ipL = _p(irBase, aL, center);
          const ipR = _p(irBase, aR, center);
          const ipTop = _p(irTop, aC, center);
          pb.moveTo(ipL.x, ipL.y)
            .quadTo(_p(irTop * 0.96, aC - 0.15, center).x, _p(irTop * 0.96, aC - 0.15, center).y, ipTop.x, ipTop.y)
            .quadTo(_p(irTop * 0.96, aC + 0.15, center).x, _p(irTop * 0.96, aC + 0.15, center).y, ipR.x, ipR.y);
        }

        // Dot at tip
        if (layer6Intensity > 0.6) {
          addCircle(pb, pTop.x, pTop.y, 1.5, 8);
        }
      }
    }

    // Garland of arches with pearls below the crown
    if (layer6Intensity > 0.3 && style !== "azteca" && style !== "islamico") {
      const archCount = petals * 2;
      const archRise = R * (0.025 + layer6Intensity * 0.03);
      const pearlR = _clamp(R * 0.006 + layer6Intensity * 0.7, 0.5, 1.8);

      for (let i = 0; i < archCount; i++) {
        const a1 = (i / archCount) * Math.PI * 2;
        const a2 = ((i + 1) / archCount) * Math.PI * 2;
        const am = (a1 + a2) / 2;

        const p1 = _p(rBase + 1.1, a1, center);
        const p2 = _p(rBase + 1.1, a2, center);
        const pArc = _p(rBase + archRise + 1.1, am, center);

        pb.moveTo(p1.x, p1.y).quadTo(pArc.x, pArc.y, p2.x, p2.y);

        if (i % 2 === 0) {
          const pearl = _p(rTop + 1.6, am, center);
          addCircle(pb, pearl.x, pearl.y, pearlR, 8);
        }
      }
    }

    // Islamic: star band in border
    if (style === "islamico" && layer6Intensity > 0.3) {
      const starCount = petals * 2;
      for (let i = 0; i < starCount; i++) {
        const a = ((i + 0.5) / starCount) * Math.PI * 2;
        const sp = _p(rBase + (rTop - rBase) * 0.5, a, center);
        addStar(pb, sp.x, sp.y, 1.6, 0.6, 6, a);
      }
    }

    // Base ring
    addCircle(pb, center.x, center.y, rBase, 128);

    pushPath(pb, mainW);
  }

  // ==================== L8: TEXTURAS CULTURALES (Enhanced) ====================
  if (layer8Intensity > 0.1) {
    const pb = new PathBuilder();

    if (style === "sashiko") {
      // Enhanced sashiko stitching with pattern variation
      const ringCount = Math.max(4, Math.round(5 + layer8Intensity * 10));
      for (let ring = 0; ring < ringCount; ring++) {
        const t = ring / Math.max(1, ringCount - 1);
        const rB = _lerp(R * 0.18, R * 0.95, t);
        const stitches = Math.max(24, Math.round(petals * (3 + layer8Intensity * 3) + ring * 8));
        const stitchLen = R * (0.012 + layer8Intensity * 0.008);

        for (let i = 0; i < stitches; i++) {
          const a = (i / stitches) * Math.PI * 2 + ((ring % 2) * Math.PI / stitches);
          const jitter = rFloat(rng, -0.5, 0.5);
          const anchor = _polar(rB + jitter, a, center.x, center.y);
          const tangent = a + Math.PI / 2;
          const p1 = _polar(stitchLen * 0.5, tangent, anchor.x, anchor.y);
          const p2 = _polar(stitchLen * 0.5, tangent + Math.PI, anchor.x, anchor.y);
          pb.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y);
        }
      }
      // Cross-stitch accents at regular intervals
      if (layer8Intensity > 0.4) {
        const accentCount = petals * 3;
        for (let i = 0; i < accentCount; i++) {
          const a = (i / accentCount) * Math.PI * 2;
          const r = R * 0.35 + rFloat(rng, 0, R * 0.45);
          const x = center.x + Math.cos(a) * r;
          const y = center.y + Math.sin(a) * r;
          const sz = R * 0.008;
          pb.moveTo(x - sz, y - sz).lineTo(x + sz, y + sz);
          pb.moveTo(x + sz, y - sz).lineTo(x - sz, y + sz);
        }
      }

    } else if (style === "islamico") {
      // Geometric grid - triangles
      const ringCount = Math.max(3, Math.round(4 + layer8Intensity * 7));
      for (let ring = 0; ring < ringCount; ring++) {
        const t = ring / Math.max(1, ringCount - 1);
        const rB = _lerp(R * 0.22, R * 0.92, t);
        const segCount = Math.max(petals * 3, Math.round(petals * (3 + layer8Intensity * 3) + ring * 5));
        for (let i = 0; i < segCount; i++) {
          if (i % 2 !== 0) continue;
          const a1 = (i / segCount) * Math.PI * 2;
          const a2 = ((i + 2) / segCount) * Math.PI * 2;
          const am = (a1 + a2) / 2;
          const p1 = _polar(rB, a1, center.x, center.y);
          const p2 = _polar(rB + R * 0.022, am, center.x, center.y);
          const p3 = _polar(rB, a2, center.x, center.y);
          pb.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).lineTo(p3.x, p3.y);
        }
      }

    } else if (style === "azteca") {
      // Calendar notch marks
      const ringCount = Math.max(3, Math.round(3 + layer8Intensity * 6));
      for (let ring = 0; ring < ringCount; ring++) {
        const t = ring / Math.max(1, ringCount - 1);
        const rB = _lerp(R * 0.25, R * 0.88, t);
        const notchCount = Math.round(petals * (3 + layer8Intensity * 4));
        const notchLen = R * (0.014 + layer8Intensity * 0.01);
        for (let i = 0; i < notchCount; i++) {
          const a = (i / notchCount) * Math.PI * 2;
          const pStart = _polar(rB - notchLen * 0.5, a, center.x, center.y);
          const pEnd = _polar(rB + notchLen * 0.5, a, center.x, center.y);
          const thick = (i % 4 === 0) ? fineW * 1.6 : fineW * 0.65;
          addCapsule(pb, pStart.x, pStart.y, pEnd.x, pEnd.y, thick);
        }
      }

    } else if (style === "yantra") {
      // Concentric dot rings
      const ringCount = Math.max(4, Math.round(5 + layer8Intensity * 9));
      for (let ring = 0; ring < ringCount; ring++) {
        const t = ring / Math.max(1, ringCount - 1);
        const rB = _lerp(R * 0.18, R * 0.93, t);
        const dotCount = Math.max(petals * 2, Math.round(petals * (2.5 + layer8Intensity * 2.5) + ring * 6));
        for (let i = 0; i < dotCount; i++) {
          const a = (i / dotCount) * Math.PI * 2;
          const p = _polar(rB, a, center.x, center.y);
          addCircle(pb, p.x, p.y, 0.45, 4);
        }
      }

    } else if (style === "celtico") {
      // Cross and diamond motif grid
      const ringCount = Math.max(3, Math.round(4 + layer8Intensity * 7));
      for (let ring = 0; ring < ringCount; ring++) {
        const t = ring / Math.max(1, ringCount - 1);
        const rB = _lerp(R * 0.2, R * 0.92, t);
        const segCount = Math.round(petals * (3 + layer8Intensity * 3) + ring * 6);
        const segLen = R * (0.01 + layer8Intensity * 0.008);
        for (let i = 0; i < segCount; i++) {
          const a = (i / segCount) * Math.PI * 2;
          const anchor = _polar(rB, a, center.x, center.y);
          const d = segLen * 0.5;
          const ang1 = a + Math.PI / 4;
          const p1a = _polar(d, ang1, anchor.x, anchor.y);
          const p1b = _polar(d, ang1 + Math.PI, anchor.x, anchor.y);
          pb.moveTo(p1a.x, p1a.y).lineTo(p1b.x, p1b.y);
          if (ring % 2 === 0) {
            const ang2 = a - Math.PI / 4;
            const p2a = _polar(d, ang2, anchor.x, anchor.y);
            const p2b = _polar(d, ang2 + Math.PI, anchor.x, anchor.y);
            pb.moveTo(p2a.x, p2a.y).lineTo(p2b.x, p2b.y);
          }
        }
      }

    } else {
      // Enhanced stippling (floral/geometric) with radial bias
      const dotCount = Math.round(complexity * 5 * layer8Intensity);
      for (let i = 0; i < dotCount; i++) {
        const a = rFloat(rng, 0, Math.PI * 2);
        const r = rFloat(rng, R * 0.08, R * 0.98);
        const dotX = center.x + Math.cos(a) * r;
        const dotY = center.y + Math.sin(a) * r;
        addCircle(pb, dotX, dotY, 0.4, 4);
      }
      // Additional radial stitch lines for floral
      if (style === "floral" && layer8Intensity > 0.3) {
        const lineCount = petals * 4;
        for (let i = 0; i < lineCount; i++) {
          const a = (i / lineCount) * Math.PI * 2;
          const r1 = rFloat(rng, R * 0.2, R * 0.5);
          const r2 = r1 + rFloat(rng, R * 0.03, R * 0.08);
          const p1 = _p(r1, a, center);
          const p2 = _p(r2, a, center);
          pb.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y);
        }
      }
    }

    pushPath(pb, hairW);
  }

  // ==================== FRAMES ====================
  if (includeFrames) {
    const pb = new PathBuilder();
    addCircle(pb, center.x, center.y, R, 128);
    addCircle(pb, center.x, center.y, R + 3, 128);

    // Decorative ring between frames
    if (style === "islamico") {
      addCircle(pb, center.x, center.y, R + 1.5, 128);
    }

    // Pearl dots along outer frame
    addPearlRing(pb, center.x, center.y, R + 1.5, petals * 4, 0.4);

    pushPath(pb, detailW);
  }

  if (pageBorder) {
    const pb = new PathBuilder();
    const m = marginMm;
    pb.moveTo(m, m).lineTo(page.wMm - m, m)
      .lineTo(page.wMm - m, page.hMm - m)
      .lineTo(m, page.hMm - m).close();

    // Corner ornaments
    const cornerSize = 8;
    const corners = [
      { x: m, y: m },
      { x: page.wMm - m, y: m },
      { x: page.wMm - m, y: page.hMm - m },
      { x: m, y: page.hMm - m },
    ];
    for (const c of corners) {
      const dx = c.x < page.wMm / 2 ? 1 : -1;
      const dy = c.y < page.hMm / 2 ? 1 : -1;
      pb.moveTo(c.x + dx * cornerSize, c.y).lineTo(c.x, c.y).lineTo(c.x, c.y + dy * cornerSize);
      addCircle(pb, c.x + dx * 3, c.y + dy * 3, 1.2, 8);
    }

    pushPath(pb, mainW);
  }

  paths.forEach(p => {
    if (p) doc.body.push(p);
  });
}
