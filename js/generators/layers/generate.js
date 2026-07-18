// js/generators/layers/generate.js
import { mulberry32, rFloat } from "../../core/prng.js";
import { PathBuilder } from "../../core/pathBuilder.js";
import { lerp, clamp, polar } from "../../core/geometry.js";
import {
  addCircle,
  addSmoothCircle,
  addCapsule,
  addStar,
  addPoly,
  addTeardrop,
  addPearlRing,
  addScallopRing,
  addImageLayer
} from "./core.js";
import {
  addCompoundPetal,
  addLotusPetal,
  addHeartPetal,
  addFleurPetal,
  addPeacockPetal,
  addSpearPetal
} from "./styles.js";

// Local compatibility wrappers
const _lerp = (a, b, t) => lerp(a, b, t);
const _clamp = (v, min, max) => clamp(v, min, max);
const _polar = (r, theta, cx, cy) => polar(r, theta, cx, cy);
const _p = (r, theta, center) => polar(r, theta, center.x, center.y);

export function generateMandalaLayers(doc, opts) {
  const {
    seed,
    petals = 12,
    stroke = "#000",
    strokeWidthMm = 0.6,
    layer1Intensity = 0.6,
    layer2Intensity = 0.55,
    layer3Intensity = 0.45,
    layer4Intensity = 0.5,
    layer5Intensity = 0.4,
    layer6Intensity = 0.45,
    layer7Intensity = 0.35,
    layer8Intensity = 0.3,
    styleMode = "sashiko",
    organicLevel = 0.2,
    complexity = 110,
    includeFrames = true,
    pageBorder = true,
    kaleidoscope = true,
    textures = true,
    imagePoints = null,
    imageScale = 1.0,
    imageIntensity = 1.0,
    imageMirror = false,
  } = opts;

  const page = doc?.page ?? { wMm: 210, hMm: 297, marginMm: 10 };
  const marginMm = page.marginMm || 10;
  const center = opts.center || { x: page.wMm / 2, y: page.hMm / 2 };
  const R = opts.radius || (Math.min(page.wMm, page.hMm) / 2 - marginMm - 5);

  const rng = mulberry32(seed);
  const paths = [];

  const style = styleMode === "hashiko" ? "sashiko" : styleMode;

  // Complexity factor: scales density of sub-elements (0..1 from range 20..320)
  const cFactor = _clamp((complexity - 20) / (320 - 20), 0, 1);

  const mainW = strokeWidthMm;
  const detailW = strokeWidthMm * 0.75;
  const fineW = strokeWidthMm * 0.45;
  const hairW = strokeWidthMm * 0.25;

  // Structural Jitter: vary the base radii of rings based on seed
  const rJitter = (base, scale = 0.05) => base * (1 + (rng() - 0.5) * 2 * scale);
  const R1 = rJitter(0.12); // L1 radius
  const R2 = rJitter(0.24); // L2 radius limit
  const R3 = rJitter(0.42); // L3 radius limit
  const R4 = rJitter(0.55); // L4 radius limit
  const R5 = rJitter(0.68); // L5 radius limit
  const R6 = rJitter(0.80); // L6 radius limit
  const R7 = rJitter(0.92); // L7 radius limit
  const R8 = rJitter(1.0);  // L8 radius limit

  // Seeded shape variants — picked once per seed, consistent every render
  const PETAL_V = ["compound", "compound", "compound", "heart", "fleur", "peacock", "spear", "lotus"];
  const pv1 = Math.floor(rng() * PETAL_V.length);
  const petalVariant = PETAL_V[pv1];
  const altPetalV = PETAL_V[(pv1 + 1 + Math.floor(rng() * (PETAL_V.length - 1))) % PETAL_V.length];
  const CORE_V = ["standard", "standard", "sunburst", "star_multi", "nested_geo"];
  const coreVariant = CORE_V[Math.floor(rng() * CORE_V.length)];

  // Helper: push a PathBuilder as a path element
  const pushPath = (pb, w = detailW) => {
    const p = pb.toPath({ stroke, strokeWidthMm: w });
    if (p) paths.push(p);
  };

  // ==================== L0: CAPA DE IMAGEN (ZENTANGLE) ====================
  if (imagePoints && imagePoints.length > 0 && imageIntensity > 0.05) {
    const pb = new PathBuilder();
    addImageLayer(pb, center, R, imagePoints, petals, imageScale, detailW, imageMirror);
    pushPath(pb, detailW);
  }

  // ==================== L1: NÚCLEO (BINDU) ====================
  if (layer1Intensity > 0.05) {
    const pb = new PathBuilder();
    const rCore = R * R1 * layer1Intensity;

    // Bindu central dot (always present)
    addCircle(pb, center.x, center.y, rCore * 0.14, 12);

    if (coreVariant === "sunburst") {
      // Radiating spokes of two lengths
      const spokeCount = Math.max(petals, 12);
      for (let i = 0; i < spokeCount; i++) {
        const a = (i / spokeCount) * Math.PI * 2;
        pb.moveTo(_p(rCore * 0.15, a, center).x, _p(rCore * 0.15, a, center).y)
          .lineTo(_p(rCore * 0.88, a, center).x, _p(rCore * 0.88, a, center).y);
      }
      if (layer1Intensity > 0.5) {
        for (let i = 0; i < spokeCount; i++) {
          const a = ((i + 0.5) / spokeCount) * Math.PI * 2;
          pb.moveTo(_p(rCore * 0.2, a, center).x, _p(rCore * 0.2, a, center).y)
            .lineTo(_p(rCore * 0.52, a, center).x, _p(rCore * 0.52, a, center).y);
        }
      }
      addCircle(pb, center.x, center.y, rCore * 0.88, 48);

    } else if (coreVariant === "star_multi") {
      // Overlapping multi-pointed stars
      addStar(pb, center.x, center.y, rCore * 0.82, rCore * 0.35, 8, 0);
      addStar(pb, center.x, center.y, rCore * 0.5, rCore * 0.2, 6, Math.PI / 6);
      addCircle(pb, center.x, center.y, rCore * 0.19, 10);
      if (layer1Intensity > 0.5) {
        addStar(pb, center.x, center.y, rCore * 0.27, rCore * 0.11, 4, Math.PI / 4);
      }
      addCircle(pb, center.x, center.y, rCore, 32);

    } else if (coreVariant === "nested_geo") {
      // Concentric nested polygons (sides depend on style)
      const sides = style === "islamico" ? 8 : style === "yantra" ? 3 : style === "azteca" ? 4 : 6;
      const levels = layer1Intensity > 0.5 ? 4 : 3;
      for (let l = 0; l < levels; l++) {
        addPoly(pb, center.x, center.y, rCore * (0.2 + l * 0.18), sides, l % 2 === 0 ? 0 : Math.PI / sides);
      }
      addCircle(pb, center.x, center.y, rCore, 32);

    } else {
      // Standard: seed of life + protection ring + mini petals
      if (layer1Intensity > 0.3) {
        const seedR = rCore * 0.38;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          addSmoothCircle(pb, center.x + Math.cos(a) * seedR, center.y + Math.sin(a) * seedR, seedR, 12);
        }
        addSmoothCircle(pb, center.x, center.y, seedR, 12);
      }
      if (layer1Intensity > 0.5) {
        addCircle(pb, center.x, center.y, rCore * 0.55, 20);
        const miniCount = Math.max(8, petals);
        for (let i = 0; i < miniCount; i++) {
          const a = (i / miniCount) * Math.PI * 2;
          const tipR = rCore * 0.82;
          const baseR = rCore * 0.58;
          pb.moveTo(_p(baseR, a, center).x, _p(baseR, a, center).y)
            .quadTo(_p(baseR + (tipR - baseR) * 0.5, a - 0.18, center).x, _p(baseR + (tipR - baseR) * 0.5, a - 0.18, center).y,
                    _p(tipR, a, center).x, _p(tipR, a, center).y)
            .quadTo(_p(baseR + (tipR - baseR) * 0.5, a + 0.18, center).x, _p(baseR + (tipR - baseR) * 0.5, a + 0.18, center).y,
                    _p(baseR, a, center).x, _p(baseR, a, center).y);
        }
      }
      addCircle(pb, center.x, center.y, rCore, 32);
    }

    // Pearl ring (all variants) - reduced density for coloring space
    if (layer1Intensity > 0.7) {
      addPearlRing(pb, center.x, center.y, rCore * 1.08, Math.max(12, petals), rCore * 0.04);
    }

    // Yantra always gets interlocked triangles on top
    if (style === "yantra" && layer1Intensity > 0.5) {
      addPoly(pb, center.x, center.y, rCore * 0.8, 3, -Math.PI / 2);
      addPoly(pb, center.x, center.y, rCore * 0.8, 3, Math.PI / 2);
      addPoly(pb, center.x, center.y, rCore * 0.5, 3, -Math.PI / 2);
      addPoly(pb, center.x, center.y, rCore * 0.5, 3, Math.PI / 2);
    }

    pushPath(pb, detailW);
  }

  // ==================== L2: PÉTALOS INTERNOS (Compound) - Simplified for coloring ====================
  if (layer2Intensity > 0.05) {
    const pb = new PathBuilder();
    const rIn = R * R1 + 2; 
    const rOut = rIn + (R * R2 - rIn) * layer2Intensity;
    const count = petals;
    const angStep = (Math.PI * 2) / count;

    for (let i = 0; i < count; i++) {
      const aC = (i / count) * Math.PI * 2;
      // Kaleidoscope: alternate petal scale for visual rhythm
      const kScale = kaleidoscope && i % 2 === 1 ? 0.82 : 1.0;
      const kROut = rIn + (rOut - rIn) * kScale;

      if (style === "islamico") {
        // Angular khatam petals - simplified without inner diamond for coloring space
        const pIn = _p(rIn, aC, center);
        const pOut = _p(kROut, aC, center);
        const pML = _p(rIn + (kROut - rIn) * 0.55, aC - angStep * 0.35, center);
        const pMR = _p(rIn + (kROut - rIn) * 0.55, aC + angStep * 0.35, center);
        pb.moveTo(pIn.x, pIn.y).lineTo(pML.x, pML.y).lineTo(pOut.x, pOut.y)
          .lineTo(pMR.x, pMR.y).close();

      } else if (style === "azteca") {
        // Stepped pyramid petals - simplified
        const pIn = _p(rIn, aC, center);
        const pOut = _p(kROut, aC, center);
        const pL = _p(rIn + (kROut - rIn) * 0.4, aC - angStep * 0.35, center);
        const pR = _p(rIn + (kROut - rIn) * 0.4, aC + angStep * 0.35, center);
        const pStL = _p(rIn + (kROut - rIn) * 0.7, aC - angStep * 0.2, center);
        const pStR = _p(rIn + (kROut - rIn) * 0.7, aC + angStep * 0.2, center);
        pb.moveTo(pIn.x, pIn.y).lineTo(pL.x, pL.y).lineTo(pStL.x, pStL.y)
          .lineTo(pOut.x, pOut.y).lineTo(pStR.x, pStR.y).lineTo(pR.x, pR.y).close();

      } else if (style === "geometric") {
        // Diamond petals - simplified
        const pIn = _p(rIn, aC, center);
        const pOut = _p(kROut, aC, center);
        const pL = _p(rIn + (kROut - rIn) * 0.5, aC - angStep * 0.38, center);
        const pR = _p(rIn + (kROut - rIn) * 0.5, aC + angStep * 0.38, center);
        pb.moveTo(pIn.x, pIn.y).lineTo(pL.x, pL.y).lineTo(pOut.x, pOut.y)
          .lineTo(pR.x, pR.y).close();

      } else {
        // Kaleidoscope alternates between two seeded petal shapes for visual rhythm
        const vType = kaleidoscope && i % 2 === 1 ? altPetalV : petalVariant;
        if (vType === "heart") {
          addHeartPetal(pb, center, rIn, kROut, aC, angStep);
        } else if (vType === "fleur") {
          addFleurPetal(pb, center, rIn, kROut, aC, angStep, fineW);
        } else if (vType === "peacock") {
          addPeacockPetal(pb, center, rIn, kROut, aC, angStep, fineW);
        } else if (vType === "spear") {
          addSpearPetal(pb, center, rIn, kROut, aC, angStep, fineW);
        } else if (vType === "lotus") {
          addLotusPetal(pb, center, rIn, kROut, aC, angStep * 0.9);
        } else {
          // Compound petal - simplified without inner details for more coloring space
          addCompoundPetal(pb, center, rIn, kROut, aC, angStep,
            false, false, layer2Intensity > 0.5, fineW);
        }
      }
    }

    // Connecting circle at petal tips - only for higher intensity
    if (layer2Intensity > 0.5) {
      addCircle(pb, center.x, center.y, rOut, 48);
    }

    pushPath(pb, mainW);
  }

  // ==================== RING A: Transition ring (between L2 and L3) - Simplified ====================
  {
    const rRing = R * (R1 + R2) / 2 + 5;
    const intensity = Math.min(layer2Intensity, layer3Intensity);
    if (intensity > 0.3) {
      const pb = new PathBuilder();
      addCircle(pb, center.x, center.y, rRing, 64);

      // Scalloped decoration - reduced density
      if (intensity > 0.5) {
        addScallopRing(pb, center.x, center.y, rRing + 1.2, petals, 1.2, true);
      }

      pushPath(pb, fineW);
    }
  }

  // ==================== L3: PATRÓN CULTURAL (Simplified for coloring) ====================
  if (layer3Intensity > 0.05) {
    const pb = new PathBuilder();
    const rMid = R * R3;
    const fSize = R * 0.11 * layer3Intensity;

    // Complexity scales element count per motif ring - reduced for coloring space
    const cMul = _lerp(0.5, 1.0, cFactor);
    const countMap = {
      sashiko: Math.max(6, Math.round(petals * 0.7 * cMul)),
      islamico: Math.max(6, Math.round(petals * 0.7 * cMul)),
      azteca: Math.max(5, Math.round(petals * 0.6 * cMul)),
      yantra: Math.max(5, Math.round(petals * 0.6 * cMul)),
      celtico: Math.max(4, Math.round(petals * 0.5 * cMul)),
      floral: Math.max(4, Math.round(petals / 2.5 * cMul)),
      geometric: Math.max(4, Math.round(petals / 2.5 * cMul)),
    };
    const count = countMap[style] ?? Math.max(4, Math.round(petals / 2.5 * cMul));

    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const fc = _p(rMid, a, center);

      if (style === "sashiko") {
        // Simplified sashiko rosette - fewer lines for coloring space
        const pCount = 6;
        for (let j = 0; j < pCount; j++) {
          const pa = (j / pCount) * Math.PI * 2 + a;
          const pOuter = _polar(fSize, pa, fc.x, fc.y);
          pb.moveTo(fc.x, fc.y).lineTo(pOuter.x, pOuter.y);
        }
        addCircle(pb, fc.x, fc.y, fSize * 0.8, 16);

      } else if (style === "floral") {
        // Simplified botanical flower
        const pCount = 5;
        for (let j = 0; j < pCount; j++) {
          const pa = (j / pCount) * Math.PI * 2 + a;
          addLotusPetal(pb, fc, fSize * 0.18, fSize * 0.95, pa, (Math.PI * 2) / pCount);
        }
        // Center pistil only
        addCircle(pb, fc.x, fc.y, fSize * 0.18, 10);

      } else if (style === "geometric") {
        // Octagon only - no inner star or cross axes
        addPoly(pb, fc.x, fc.y, fSize, 8, a);
        addCircle(pb, fc.x, fc.y, fSize * 0.28, 10);

      } else if (style === "islamico") {
        // 8-pointed khatam star - simplified without extra details
        addStar(pb, fc.x, fc.y, fSize, fSize * 0.38, 8, a);
        addPoly(pb, fc.x, fc.y, fSize * 0.38, 8, a + Math.PI / 8);

      } else if (style === "azteca") {
        // Solar glyph - simplified
        addStar(pb, fc.x, fc.y, fSize, fSize * 0.5, 4, a + Math.PI / 4);
        addPoly(pb, fc.x, fc.y, fSize * 1.05, 8, a);

      } else if (style === "yantra") {
        // Shatkona without nested geometry
        addPoly(pb, fc.x, fc.y, fSize, 3, a);
        addPoly(pb, fc.x, fc.y, fSize, 3, a + Math.PI);
        addCircle(pb, fc.x, fc.y, fSize * 1.05, 20);

      } else if (style === "celtico") {
        // Trefoil without knotwork
        const lCount = 3;
        const lobeR = fSize * 0.52;
        const lobeDist = fSize * 0.43;
        for (let j = 0; j < lCount; j++) {
          const la = a + (j / lCount) * Math.PI * 2 + Math.PI / 6;
          const lc = _polar(lobeDist, la, fc.x, fc.y);
          addSmoothCircle(pb, lc.x, lc.y, lobeR, 10);
        }
        addCircle(pb, fc.x, fc.y, fSize * 0.9, 22);
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

  // ==================== L4: ANILLO GEOMÉTRICO (Simplified for coloring) ====================
  if (layer4Intensity > 0.05) {
    const pb = new PathBuilder();
    const r1 = R * 0.56;
    const r2 = r1 + R * 0.1 * layer4Intensity;
    const count = Math.max(petals, Math.round(petals * 1.5 * _lerp(0.7, 1.1, cFactor)));

    // Inner ring only - no outer ring for more coloring space
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

      } else if (style === "islamico") {
        pb.moveTo(p1a.x, p1a.y).lineTo(pM.x, pM.y).lineTo(p2a.x, p2a.y);

      } else if (style === "azteca") {
        // Simplified stepped pyramid motif
        const pStep3 = _p(r1 + (r2 - r1) * 0.7, aM - (a2 - a1) * 0.15, center);
        const pStep4 = _p(r1 + (r2 - r1) * 0.7, aM + (a2 - a1) * 0.15, center);
        pb.moveTo(p1a.x, p1a.y).lineTo(pM.x, pM.y)
          .lineTo(pStep4.x, pStep4.y).lineTo(p2a.x, p2a.y);

      } else if (style === "yantra") {
        // Lotus petal arch - simplified
        const cpL = _p(r2 * 0.98, aM - 0.1, center);
        const cpR = _p(r2 * 0.98, aM + 0.1, center);
        pb.moveTo(p1a.x, p1a.y).quadTo(cpL.x, cpL.y, pM.x, pM.y)
          .quadTo(cpR.x, cpR.y, p2a.x, p2a.y);

      } else if (style === "celtico") {
        // Gothic pointed arch - simplified
        const cpA = _p(r1 + (r2 - r1) * 0.92, a1 + (a2 - a1) * 0.15, center);
        const cpB = _p(r1 + (r2 - r1) * 0.92, a2 - (a2 - a1) * 0.15, center);
        pb.moveTo(p1a.x, p1a.y).quadTo(cpA.x, cpA.y, pM.x, pM.y)
          .quadTo(cpB.x, cpB.y, p2a.x, p2a.y);

      } else {
        // Default: smooth arch without extra details
        pb.moveTo(p1a.x, p1a.y).quadTo(pM.x, pM.y, p2a.x, p2a.y);
      }
    }

    pushPath(pb, mainW);
  }

  // ==================== RING C: Between L4 and L5 - Simplified ====================
  {
    const rRing = R * 0.68;
    const intensity = Math.min(layer4Intensity, layer5Intensity);
    if (intensity > 0.3) {
      const pb = new PathBuilder();
      addCircle(pb, center.x, center.y, rRing, 80);

      pushPath(pb, fineW);
    }
  }

  // ==================== L5: DETALLES FINOS (Simplified for coloring) ====================
  if (layer5Intensity > 0.05) {
    const pb = new PathBuilder();
    const rStart = R * 0.7;
    const rEnd = rStart + R * 0.1 * layer5Intensity;
    const count = Math.max(petals, Math.round(petals * 2 * _lerp(0.6, 1.0, cFactor)));

    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;

      if (i % 2 === 0) {
        // Simple line instead of teardrop
        const p1 = _p(rStart, a, center);
        const p2 = _p(rEnd, a, center);
        addCapsule(pb, p1.x, p1.y, p2.x, p2.y, fineW);
      }
    }

    pushPath(pb, fineW);
  }

  // ==================== L7: NATURAL / HOJAS / CULTURAL (Simplified for coloring) ====================
  if (layer7Intensity > 0.05 && style !== "geometric") {
    const pb = new PathBuilder();
    // Position L7 in the mid-ring zone (between L3 and L4), above L2/L3 content
    const rInner = R * (R3 + 0.06);
    const rOuter = rInner + R * 0.18 * layer7Intensity;
    const count = petals;

    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (Math.PI / count);

      if (style === "islamico") {
        // Simplified tessellation element - single star only
        const pC = _p((rInner + rOuter) * 0.5, a, center);
        const dR = (rOuter - rInner) * 0.32 * layer7Intensity;
        addStar(pb, pC.x, pC.y, dR, dR * 0.42, 8, a);

      } else if (style === "azteca") {
        // Simplified stepped pyramid profile
        const p1 = _p(rInner, a, center);
        const p2 = _p(rOuter, a, center);
        const pMid = _p((rInner + rOuter) * 0.5, a, center);
        const stepL = _p((rInner + rOuter) * 0.5, a - 0.25, center);
        const stepR = _p((rInner + rOuter) * 0.5, a + 0.25, center);
        pb.moveTo(p1.x, p1.y).lineTo(stepL.x, stepL.y).lineTo(p2.x, p2.y)
          .lineTo(stepR.x, stepR.y).close();

      } else if (style === "yantra") {
        // Energy diamond - simplified without inner detail
        const pTop = _p(rOuter, a, center);
        const pBot = _p(rInner, a, center);
        const pL = _p((rInner + rOuter) * 0.5, a - 0.3 * layer7Intensity, center);
        const pR = _p((rInner + rOuter) * 0.5, a + 0.3 * layer7Intensity, center);
        pb.moveTo(pTop.x, pTop.y).lineTo(pL.x, pL.y).lineTo(pBot.x, pBot.y)
          .lineTo(pR.x, pR.y).close();

      } else if (style === "celtico") {
        // Simplified interlaced curves without knotwork
        const p1 = _p(rInner, a, center);
        const p2 = _p(rOuter, a, center);
        const cpA = _p((rInner + rOuter) * 0.5, a - 0.55 * layer7Intensity, center);
        const cpB = _p((rInner + rOuter) * 0.5, a + 0.55 * layer7Intensity, center);
        pb.moveTo(p1.x, p1.y).quadTo(cpA.x, cpA.y, p2.x, p2.y);
        pb.moveTo(p1.x, p1.y).quadTo(cpB.x, cpB.y, p2.x, p2.y);

      } else {
        // Rich organic leaf (sashiko / floral) - simplified without veins
        const p1 = _p(rInner, a, center);
        const p2 = _p(rOuter, a, center);
        // Scale leaf width by angular spacing so leaves don't overlap at high petal counts
        const leafW = Math.min(0.45, (Math.PI / count) * 0.7) * layer7Intensity;
        const cp1 = _p(rInner + (rOuter - rInner) * 0.5, a - leafW, center);
        const cp2 = _p(rInner + (rOuter - rInner) * 0.5, a + leafW, center);
        // Leaf outline only - no midrib or side veins
        pb.moveTo(p1.x, p1.y)
          .quadTo(cp1.x, cp1.y, p2.x, p2.y)
          .quadTo(cp2.x, cp2.y, p1.x, p1.y)
          .close();
      }
    }

    pushPath(pb, detailW);
  }

  // ==================== RING D: Between L5/L7 and L6 - Simplified ====================
  {
    const rRing = R * 0.80;
    const intensity = Math.min(Math.max(layer5Intensity, layer7Intensity), layer6Intensity);
    if (intensity > 0.2) {
      const pb = new PathBuilder();
      addCircle(pb, center.x, center.y, rRing, 96);

      pushPath(pb, fineW);
    }
  }

  // ==================== L6: BORDE DECORATIVO (Simplified for coloring) ====================
  if (layer6Intensity > 0.05) {
    const pb = new PathBuilder();
    const rBase = R * 0.83;
    const rTop = rBase + R * 0.13 * layer6Intensity;
    const count = petals;

    // Main crown arches - simplified without inner details
    for (let i = 0; i < count; i++) {
      const aC = (i / count) * Math.PI * 2;
      const aL = aC - (Math.PI / count);
      const aR = aC + (Math.PI / count);

      const pL = _p(rBase, aL, center);
      const pR = _p(rBase, aR, center);
      const pTop = _p(rTop, aC, center);

      if (style === "islamico") {
        // Simplified geometric diamond crown
        const pMidL = _p(rBase + (rTop - rBase) * 0.5, aC - 0.12, center);
        const pMidR = _p(rBase + (rTop - rBase) * 0.5, aC + 0.12, center);
        pb.moveTo(pL.x, pL.y).lineTo(pMidL.x, pMidL.y).lineTo(pTop.x, pTop.y)
          .lineTo(pMidR.x, pMidR.y).lineTo(pR.x, pR.y);

      } else if (style === "azteca") {
        // Simplified stepped crown
        const pStepL = _p(rBase + (rTop - rBase) * 0.5, aC - 0.1, center);
        const pStepR = _p(rBase + (rTop - rBase) * 0.5, aC + 0.1, center);
        const pNarrowL = _p(rBase + (rTop - rBase) * 0.8, aC - 0.05, center);
        const pNarrowR = _p(rBase + (rTop - rBase) * 0.8, aC + 0.05, center);
        pb.moveTo(pL.x, pL.y).lineTo(pStepL.x, pStepL.y).lineTo(pNarrowL.x, pNarrowL.y)
          .lineTo(pTop.x, pTop.y).lineTo(pNarrowR.x, pNarrowR.y)
          .lineTo(pStepR.x, pStepR.y).lineTo(pR.x, pR.y);

      } else if (style === "celtico") {
        // Simplified Gothic pointed arch
        const cpL2 = _p(rTop * 0.97, aC - 0.13, center);
        const cpR2 = _p(rTop * 0.97, aC + 0.13, center);
        pb.moveTo(pL.x, pL.y).quadTo(cpL2.x, cpL2.y, pTop.x, pTop.y)
          .quadTo(cpR2.x, cpR2.y, pR.x, pR.y);

      } else {
        // Default smooth arch
        const cpL = _p(rBase + (rTop - rBase) * 0.6, aC - 0.15, center);
        const cpR = _p(rBase + (rTop - rBase) * 0.6, aC + 0.15, center);
        pb.moveTo(pL.x, pL.y).quadTo(cpL.x, cpL.y, pTop.x, pTop.y)
          .quadTo(cpR.x, cpR.y, pR.x, pR.y);
      }
    }

    pushPath(pb, mainW);
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
  if (layer8Intensity > 0.1 && textures) {
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
