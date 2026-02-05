import { mulberry32, rFloat } from "../core/prng.js";
import { PathBuilder } from "../core/pathBuilder.js";

/**
 * Mandala Radial (Book / Coloring) — Editorial
 * - SVG puro, optimizado: wedge único + <use> radial
 * - Formas cerradas coloreables
 * - Sin micro-celdas (minCellAreaMm2 + guardias anti-sliver)
 * - No líneas < minStrokeMm
 * - Bindu y frames fuera del wedge (no duplicación por <use>)
 */
export function generateMandalaRadial(doc, opts) {
  const {
    seed,
    centerMm,
    radiusMm,

    // Simetría
    petals = 12,

    // Trazo
    stroke = "#000",
    strokeWidthMm = 0.6,

    // Complejidad (40..220 recomendado)
    complexity = 120,

    // Producción / libro
    offsetXmm = 0,
    offsetYmm = 0,
    minStrokeMm = 0.30,
    minCellAreaMm2 = 2.0,

    // Núcleo
    binduRadiusFrac = 0.10,
    binduClearFrac = 0.16,

    // Marcos
    includeFrames = true,

    organicLevel = 0.5, // 0.0 = Geometric, 1.0 = Very Organic

    // PHASE 3: Master Tier Controls
    pageBorder = true,
    alternation = 0.3,
    harmony = 0.5,
    taper = 0.2,
  } = opts;

  const page = doc?.page ?? { wMm: 210, hMm: 297, marginMm: 10 };
  const marginMm = Number.isFinite(page.marginMm) ? page.marginMm : 10;
  const computedCenter = centerMm ?? { x: page.wMm / 2, y: page.hMm / 2 };
  const computedRadius = radiusMm ?? Math.max(10, Math.min(page.wMm, page.hMm) / 2 - marginMm);

  const rng = mulberry32((seed >>> 0) || 0);

  // --- Pisos técnicos ---
  const mainStroke = Math.max(minStrokeMm, strokeWidthMm);
  const detailStroke = Math.max(minStrokeMm, mainStroke * 0.6);
  const fineStroke = Math.max(minStrokeMm * 0.8, mainStroke * 0.4);

  // --- Complejidad normalizada ---
  const cN = _clamp((complexity - 20) / (240 - 20), 0, 1);
  const ringCount = _clamp(Math.round(5 + cN * 7), 5, 12);

  const subProb = _lerp(0.18, 0.72, cN);
  const detailProb = _lerp(0.35, 0.85, cN);

  // --- Rejilla radial ---
  const stepAngle = (2 * Math.PI) / petals;

  // Centro con gutter
  const cx = computedCenter.x + offsetXmm;
  const cy = computedCenter.y + offsetYmm;

  // --- Bindu / núcleo limpio ---
  const binduR = computedRadius * _clamp(binduRadiusFrac, 0.06, 0.18);
  const binduClearR = computedRadius * _clamp(binduClearFrac, binduRadiusFrac + 0.03, 0.26);

  // --- Anillos (phi-like) ---
  const phi = 1.61803398875;
  const rMin = Math.max(binduClearR, computedRadius * 0.08);
  const rMax = computedRadius * 0.985;

  const totalSpan = Math.max(0, rMax - rMin);
  const weights = [];
  for (let i = 0; i < ringCount; i++) weights.push(Math.pow(phi, i));
  if (rng() < 0.35) weights.reverse();
  const sumW = weights.reduce((a, b) => a + b, 0);

  // --- Semántica editorial ---
  function densityForIndex(i, ringCount, cN) {
    if (i === 0) return (cN < 0.55 ? "low" : "med");
    if (i % 3 === 1) return "low";
    if (i === ringCount - 1) return (cN < 0.65 ? "med" : "high");
    if (cN < 0.35) return "med";
    if (cN < 0.75) return (rng() < 0.55 ? "med" : "high");
    return (rng() < 0.35 ? "med" : "high");
  }

  function roleForIndex(i, ringCount) {
    if (i === 0) return "primary";
    if (i === ringCount - 1) return "frame";
    if (i % 3 === 1) return "rest";
    return "secondary";
  }

  const rings = [];
  let r0 = rMin;
  let prevDensity = "low";

  for (let i = 0; i < ringCount; i++) {
    const w = weights[i] / sumW;

    const role = roleForIndex(i, ringCount);
    let density = densityForIndex(i, ringCount, cN);

    if (prevDensity === "high" && density === "high") density = "med";
    prevDensity = density;

    const isInner = i === 0;
    const jitterAmp = isInner ? 0.05 : (density === "low" ? 0.06 : 0.10);
    const jitter = 1 + rFloat(rng, -jitterAmp, jitterAmp);

    const thickness = totalSpan * w * jitter;
    const r1 = Math.min(rMax, r0 + thickness);

    rings.push({
      start: r0,
      end: r1,
      idx: i,
      role,
      density,
      allowDetail: (role !== "rest") && (i !== 0),
      allowSubdivide: (role !== "rest") && (i !== 0),
      type: null,
    });

    r0 = r1;
  }
  if (rings.length) rings[rings.length - 1].end = rMax;

  // --- ID robusto ---
  const wedgeId = `wedge_${(seed >>> 0)}_${petals}_${ringCount}_${Math.round(computedRadius * 10)}_${Math.round(mainStroke * 1000)}_${Math.round(complexity)}`;

  // --- Builders ---
  const pbMain = new PathBuilder();
  const pbDetail = new PathBuilder();
  const pbFine = new PathBuilder();

  // --- Selector de forma ---
  function pickShapeForRing(ring, prevRing) {
    const isOrganic = (rng() < organicLevel); /* Bias general */

    if (ring.role === "rest") return (isOrganic ? pickPetalVariant(ring) : "arch");
    if (ring.role === "frame") return (!isOrganic && rng() < 0.6 ? "diamond" : pickPetalVariant(ring));

    if (ring.role === "primary") {
      // High organic -> favor petals/arches
      // Low organic -> favor geometry (though this engine is radial-petal based, we can use 'diamond' or 'arch' more)
      if (!isOrganic && rng() < 0.6) return "diamond";
      return (rng() < 0.60 ? pickPetalVariant(ring) : "arch");
    }

    const prevType = prevRing?.type;

    if (prevRing && prevRing.density === "high" && ring.density !== "high") {
      return (rng() < 0.65 ? "arch" : "petal");
    }

    // Logic influenced by organicLevel
    const rand = rng();
    // if organicLevel is high, threshold for diamond increases (harder to get diamond)
    // if organicLevel is low, threshold for diamond decreases (easier to get diamond)
    const diamondThresh = _lerp(0.7, 0.95, organicLevel);

    if (rand > diamondThresh) return "diamond";
    if (rand < 0.3 * (1 - organicLevel)) return "islamic_interlace";
    if (rand < 0.2 + 0.3 * organicLevel) return "peacock_feather";
    if (rand < 0.4 + 0.2 * organicLevel) return "paisley_element";
    return (rng() < 0.5 ? "arch" : "petal");
  }
  function pickPetalVariant(ring) {
    // Bias variants based on organicLevel
    const t = rng();

    // Adjusted probabilities
    let pPointy = _lerp(0.3, 0.05, organicLevel);
    let pRound = _lerp(0.2, 0.4, organicLevel);
    let pLotus = _lerp(0.1, 0.3, organicLevel);

    if (ring.role === "frame") {
      if (t < 0.3) return "lotus_petal_advanced";
      return t < 0.6 ? "petal_heart" : t < 0.8 ? "petal_round" : "petal_pointy";
    }

    if (t < pPointy) return "petal_pointy";
    if (t < pPointy + pRound) return "petal_round";
    if (t < pPointy + pRound + pLotus) return "lotus_petal_advanced";

    return (rng() < 0.7 ? "petal_almond" : "fleur");
  }

  // --- Helpers for natural look ---
  function _wobble(val, intensity = 1.0) {
    if (organicLevel < 0.05) return val;
    const noise = Math.sin(val * 17.3 + (seed % 100)) * 0.5 + Math.cos(val * 11.7 + (seed % 71)) * 0.3;
    return val + noise * organicLevel * intensity * 0.8;
  }

  function _polarW(r, theta, intensity = 0.5) {
    const tw = _wobble(theta, intensity);
    const rw = _wobble(r, intensity * 0.2);
    return {
      x: rw * Math.cos(tw),
      y: rw * Math.sin(tw)
    };
  }



  // --- Área aproximada base ---
  function allowSubdivideArea(ring, localStep) {
    const h = Math.max(0, ring.end - ring.start);
    const rMid = (ring.start + ring.end) / 2;
    const arcW = Math.abs(rMid * localStep);
    return (arcW * h) >= minCellAreaMm2;
  }

  // [SEAM-SAFE] Guardias anti-sliver (micro-celdas “en tirita”)
  // - además de área, exige mínimos en dimensiones (arcW y h)
  // - endurece umbral con petals alto y densidad high
  function allowSubdivideSafe(ring, localStep) {
    const h = Math.max(0, ring.end - ring.start);
    const rMid = (ring.start + ring.end) / 2;
    const arcW = Math.abs(rMid * localStep);
    const area = arcW * h;

    // lado mínimo derivado (heurística editorial): evita celdas ultra delgadas
    // base ~ sqrt(minArea), pero endurecido con número de pétalos
    const baseEdge = Math.sqrt(Math.max(0.01, minCellAreaMm2));
    const petalsPenalty = _clamp((petals - 12) / 36, 0, 1); // 0 en 12, ~1 en 48+
    const edgeMin = baseEdge * _lerp(0.95, 1.55, petalsPenalty);

    // factor de seguridad de área: mayor cuando densidad alta o petals alto
    let areaFactor = 1.15;
    if (ring.density === "high") areaFactor += 0.20;
    areaFactor += 0.35 * petalsPenalty; // hasta +0.35

    // el anillo “frame” tolera un poco más subdiv (pero sin slivers)
    if (ring.role === "frame") areaFactor = Math.max(1.10, areaFactor - 0.10);

    // “rest” no subdivide por diseño (pero por si acaso)
    if (ring.role === "rest") return false;

    // chequeos
    if (area < minCellAreaMm2 * areaFactor) return false;
    if (arcW < edgeMin) return false;
    if (h < edgeMin) return false;

    // extra: si está demasiado cerca del umbral, evita subdividir
    // (reduce resultados borderline que se ven “rasposos” en impresión)
    const borderline = minCellAreaMm2 * areaFactor * 1.05;
    if (area < borderline && rng() < 0.65) return false;

    return true;
  }

  // --- Detalle CERRADO ---
  function addCapsule(pb, ax, ay, bx, by, w) {
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return;

    const nx = -dy / len;
    const ny = dx / len;

    const hw = w / 2;

    const a1x = ax + nx * hw, a1y = ay + ny * hw;
    const a2x = ax - nx * hw, a2y = ay - ny * hw;
    const b1x = bx + nx * hw, b1y = by + ny * hw;
    const b2x = bx - nx * hw, b2y = by - ny * hw;

    pb.moveTo(a1x, a1y)
      .lineTo(b1x, b1y)
      .lineTo(b2x, b2y)
      .lineTo(a2x, a2y)
      .close();
  }

  // --- PHASE 2: Textural Fills ---
  function _addStippling(pb, cx, cy, radius, count = 5) {
    if (complexity < 100) return;
    for (let i = 0; i < count; i++) {
      const r = rFloat(rng, radius * 0.2, radius * 0.9);
      const a = rFloat(rng, 0, Math.PI * 2);
      const px = cx + r * Math.cos(a);
      const py = cy + r * Math.sin(a);
      addCirclePoly(pb, px, py, fineStroke * 0.6, 6);
    }
  }

  function _addHatching(pb, p1, p2, p3, p4, density = 4) {
    if (complexity < 140) return;
    for (let i = 1; i < density; i++) {
      const t = i / density;
      const startX = _lerp(p1.x, p2.x, t);
      const startY = _lerp(p1.y, p2.y, t);
      const endX = _lerp(p4.x, p3.x, t);
      const endY = _lerp(p4.y, p3.y, t);
      addCapsule(pb, startX, startY, endX, endY, fineStroke * 0.5);
    }
  }


  function addCirclePoly(pb, cx, cy, r, seg = 16) {
    if (r <= 0) return;
    const step = (Math.PI * 2) / Math.max(6, seg);
    let x0 = cx + Math.cos(0) * r;
    let y0 = cy + Math.sin(0) * r;
    pb.moveTo(x0, y0);
    for (let i = 1; i < seg; i++) {
      const a = step * i;
      pb.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    pb.close();
  }

  function addArcBand(pb, rCenter, thetaL, thetaR, thickness) {
    const t = Math.max(0.10, thickness);
    const rIn = Math.max(0.01, rCenter - t / 2);
    const rOut = rCenter + t / 2;
    const thetaC = (thetaL + thetaR) / 2;

    const pL0 = _polar0(rIn, thetaL);
    const pR0 = _polar0(rIn, thetaR);
    const pL1 = _polar0(rOut, thetaL);
    const pR1 = _polar0(rOut, thetaR);

    const cO = _polar0(rOut, thetaC);
    const cI = _polar0(rIn, thetaC);

    pb.moveTo(pL0.x, pL0.y)
      .lineTo(pL1.x, pL1.y)
      .quadTo(cO.x, cO.y, pR1.x, pR1.y)
      .lineTo(pR0.x, pR0.y)
      .quadTo(cI.x, cI.y, pL0.x, pL0.y)
      .close();
  }

  // --- PHASE 3: Brush Simulation (Tapering) ---
  function addTaperedLine(pb, p1, p2, w1, w2) {
    if (taper < 0.05) {
      addCapsule(pb, p1.x, p1.y, p2.x, p2.y, (w1 + w2) / 2);
      return;
    }
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 1e-6) return;
    const nx = -dy / len;
    const ny = dx / len;

    const hw1 = w1 / 2;
    const hw2 = w2 / 2;

    const a1x = p1.x + nx * hw1, a1y = p1.y + ny * hw1;
    const a2x = p1.x - nx * hw1, a2y = p1.y - ny * hw1;
    const b1x = p2.x + nx * hw2, b1y = p2.y + ny * hw2;
    const b2x = p2.x - nx * hw2, b2y = p2.y - ny * hw2;

    pb.moveTo(a1x, a1y)
      .lineTo(b1x, b1y)
      .lineTo(b2x, b2y)
      .lineTo(a2x, a2y)
      .close();
  }

  // --- Curvas más orgánicas: cubicTo compatible ---
  // Si PathBuilder no soporta cubicTo, aproximamos con 2 cuadráticas.
  function cubicToCompat(pb, c1x, c1y, c2x, c2y, x, y) {
    if (typeof pb.cubicTo === "function") {
      pb.cubicTo(c1x, c1y, c2x, c2y, x, y);
      return;
    }
    // Aproximación: cubic -> 2 quads (split t=0.5).
    const x0 = pb._x, y0 = pb._y;
    if (!Number.isFinite(x0) || !Number.isFinite(y0)) {
      pb.quadTo((c1x + c2x) * 0.5, (c1y + c2y) * 0.5, x, y);
      return;
    }
    const p01x = (x0 + c1x) * 0.5, p01y = (y0 + c1y) * 0.5;
    const p12x = (c1x + c2x) * 0.5, p12y = (c1y + c2y) * 0.5;
    const p23x = (c2x + x) * 0.5, p23y = (c2y + y) * 0.5;

    const p012x = (p01x + p12x) * 0.5, p012y = (p01y + p12y) * 0.5;
    const p123x = (p12x + p23x) * 0.5, p123y = (p12y + p23y) * 0.5;

    const p0123x = (p012x + p123x) * 0.5, p0123y = (p012y + p123y) * 0.5;

    pb.quadTo(p012x, p012y, p0123x, p0123y);
    pb.quadTo(p123x, p123y, x, y);
  }

  // --- Generación del wedge ---
  let prevRing = null;

  const overlapFactor = _lerp(0.12, 0.55, cN);

  for (let ri = 0; ri < rings.length; ri++) {
    const ring = rings[ri];
    const nextRing = (ri + 1 < rings.length ? rings[ri + 1] : null);

    // Intra-ring alternation (Phase 3)
    const typeA = pickShapeForRing(ring, prevRing);
    let typeB = typeA;
    if (mulberry32(seed + ri)() < alternation && ring.role !== "rest") {
      typeB = pickShapeForRing(ring, prevRing);
    }
    ring.type = typeA;

    // Prohibimos subdivisión cerca del núcleo
    let sub = 1;

    if (ring.allowSubdivide && ring.start > binduClearR && rng() < subProb) {
      // candidato 2 o 3, pero con guardia seam-safe
      const candidateSub = (rng() < 0.55 ? 2 : 3);
      const localStepTest = stepAngle / candidateSub;

      // primero: área base
      // luego: seam-safe (anti slivers)
      if (allowSubdivideArea(ring, localStepTest) && allowSubdivideSafe(ring, localStepTest)) {
        sub = candidateSub;
      }
    }

    const localStep = stepAngle / sub;

    // Smart Harmony (Phase 3): Skip detail if too dense
    let skipDetail = false;
    if (ri > 0 && ri < rings.length - 1) {
      const prevR = rings[ri - 1];
      if (prevR.density === "high" && ring.density === "high" && rng() < harmony) {
        skipDetail = true;
      }
    }

    for (let s = 0; s < sub; s++) {
      const type = (s % 2 === 0) ? typeA : typeB;
      const aOff = (s - (sub - 1) / 2) * localStep;

      const thetaL = -localStep / 2 + aOff;
      const thetaR = localStep / 2 + aOff;
      const thetaC = aOff;

      const wobI = organicLevel * 0.6; // Wobble intensity

      if (skipDetail && rng() < harmony * 0.8) {
        // Force a simple arch if harmonic suppression is active
        addArcBand(pbMain, (ring.start + ring.end) / 2, thetaL, thetaR, mainStroke * 0.8);
        continue;
      }

      if (type === "peacock_feather") {
        const span = ring.end - ring.start;
        const pIn = _polarW(ring.start, thetaC, wobI);
        const pOut = _polarW(ring.end, thetaC, wobI);

        const midR = ring.start + span * 0.6;
        const wFactor = 0.8;
        const c1L = _polarW(ring.start + span * 0.2, thetaC - localStep * 0.1, wobI);
        const c2L = _polarW(midR, thetaC - localStep * 0.5 * wFactor, wobI);
        const c1R = _polarW(midR, thetaC + localStep * 0.5 * wFactor, wobI);
        const c2R = _polarW(ring.start + span * 0.2, thetaC + localStep * 0.1, wobI);

        pbMain.moveTo(pIn.x, pIn.y);
        cubicToCompat(pbMain, c1L.x, c1L.y, c2L.x, c2L.y, pOut.x, pOut.y);
        cubicToCompat(pbMain, c1R.x, c1R.y, c2R.x, c2R.y, pIn.x, pIn.y);
        pbMain.close();

        // Eye of the feather
        const eyeR = ring.start + span * 0.75;
        const eyeRad = span * 0.15;
        const pEye = _polarW(eyeR, thetaC, wobI);
        addCirclePoly(pbDetail, pEye.x, pEye.y, eyeRad, 12);
        addCirclePoly(pbDetail, pEye.x, pEye.y, eyeRad * 0.5, 8);

        // Fine detail: eye texturing
        if (complexity > 180) {
          _addStippling(pbFine, pEye.x, pEye.y, eyeRad * 0.4, 3);
        }

        // Radiating veins
        for (let v = -1; v <= 1; v++) {
          if (v === 0) continue;
          const va = thetaC + v * localStep * 0.25;
          const vS = _polarW(ring.start + span * 0.3, va, wobI);
          const vE = _polarW(ring.start + span * 0.6, va, wobI);
          addTaperedLine(pbDetail, vS, vE, detailStroke, fineStroke * 0.5);
        }

      } else if (type === "islamic_interlace") {
        const span = ring.end - ring.start;
        const rMid = ring.start + span * 0.5;
        const thickness = span * 0.2;

        // Ribbon 1: Left-to-Center
        const p1 = _polarW(ring.start, thetaL, wobI);
        const p2 = _polarW(rMid, thetaC, wobI);
        const p3 = _polarW(ring.end, thetaL, wobI);

        pbMain.moveTo(p1.x, p1.y).quadTo(_polarW(rMid, thetaL, wobI).x, _polarW(rMid, thetaL, wobI).y, p2.x, p2.y)
          .quadTo(_polarW(rMid, thetaL, wobI).x, _polarW(rMid, thetaL, wobI).y, p3.x, p3.y);

        // Ribbon 2: Right-to-Center
        const p4 = _polarW(ring.start, thetaR, wobI);
        const p5 = _polarW(ring.end, thetaR, wobI);
        pbMain.moveTo(p4.x, p4.y).quadTo(_polarW(rMid, thetaR, wobI).x, _polarW(rMid, thetaR, wobI).y, p2.x, p2.y)
          .quadTo(_polarW(rMid, thetaR, wobI).x, _polarW(rMid, thetaR, wobI).y, p5.x, p5.y);

      } else if (type === "lotus_petal_advanced") {
        const span = ring.end - ring.start;
        const pIn = _polarW(ring.start, thetaC, wobI);
        const pOut = _polarW(ring.end, thetaC, wobI);

        // Scalloped sides
        const steps = 3;
        let prevL = pIn;
        let prevR = pIn;

        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const currR = ring.start + span * t;
          const currAng = (localStep / 2) * Math.sin(t * Math.PI) * 0.9;
          const pL = _polarW(currR, thetaC - currAng, wobI);
          const pR = _polarW(currR, thetaC + currAng, wobI);

          pbMain.moveTo(prevL.x, prevL.y).lineTo(pL.x, pL.y);
          pbMain.moveTo(prevR.x, prevR.y).lineTo(pR.x, pR.y);

          prevL = pL;
          prevR = pR;
        }
        pbMain.moveTo(prevL.x, prevL.y).lineTo(pOut.x, pOut.y);
        pbMain.moveTo(prevR.x, prevR.y).lineTo(pOut.x, pOut.y);

        // Internal tiers
        if (ring.allowDetail) {
          const tierR = ring.start + span * 0.4;
          const pTier = _polarW(tierR, thetaC, wobI);
          addArcBand(pbDetail, tierR, thetaC - localStep * 0.2, thetaC + localStep * 0.2, detailStroke * 2);

          // Fine veins in lotus
          if (complexity > 160) {
            for (let v = -1; v <= 1; v += 0.5) {
              if (Math.abs(v) < 0.1) continue;
              const va = thetaC + v * localStep * 0.15;
              const vS = _polarW(ring.start + span * 0.45, va, wobI);
              const vE = _polarW(ring.start + span * 0.8, va, wobI);
              addCapsule(pbFine, vS.x, vS.y, vE.x, vE.y, fineStroke * 0.4);
            }
          }
        }

      } else if (type === "paisley_element") {
        const span = ring.end - ring.start;
        const pIn = _polarW(ring.start, thetaC, wobI);
        const curveDir = rng() < 0.5 ? 1 : -1;

        const pOut = _polarW(ring.end, thetaC + localStep * 0.4 * curveDir, wobI);
        const cp1 = _polarW(ring.start + span * 0.6, thetaC + localStep * 0.8 * curveDir, wobI);
        const cp2 = _polarW(ring.end + span * 0.2, thetaC - localStep * 0.2 * curveDir, wobI);

        pbMain.moveTo(pIn.x, pIn.y)
          .quadTo(cp1.x, cp1.y, pOut.x, pOut.y)
          .quadTo(cp2.x, cp2.y, pIn.x, pIn.y)
          .close();

        // Texture: internal hatching
        if (complexity > 120 && ring.allowDetail) {
          _addHatching(pbFine, pIn, cp1, pOut, cp2, 3);
        }

        // Small internal curl
        const curlR = ring.start + span * 0.4;
        const pCurl = _polarW(curlR, thetaC + localStep * 0.2 * curveDir, wobI);
        addCirclePoly(pbDetail, pCurl.x, pCurl.y, span * 0.08, 10);

      } else if (type === "petal" || type === "petal_pointy" || type === "petal_round" || type === "petal_almond") {
        const outR = (nextRing && ring.role !== "frame" && ring.role !== "rest" && rng() < 0.78)
          ? Math.min(rMax, ring.end + (nextRing.end - nextRing.start) * overlapFactor)
          : ring.end;

        const pIn = _polar0(ring.start, thetaC);
        const pOut = _polar0(outR, thetaC);

        const span = (ring.end - ring.start);
        let midR = ring.start + span * 0.55;
        let widthFactor = _clamp(0.40 + rng() * 0.50, 0.35, 0.90);

        // Estilos más “libro de colorear”
        if (type === "petal_pointy") {
          // loto/tulipán: alarga y adelgaza
          midR = ring.start + span * _clamp(rFloat(rng, 0.72, 0.90), 0.70, 0.92);
          widthFactor = _clamp(rFloat(rng, 0.30, 0.58), 0.28, 0.68);
        } else if (type === "petal_round") {
          // pétalo gordito: abre más
          midR = ring.start + span * _clamp(rFloat(rng, 0.40, 0.62), 0.38, 0.70);
          widthFactor = _clamp(rFloat(rng, 0.62, 0.98), 0.58, 0.99);
        } else if (type === "petal_almond") {
          // almendra/hoja: más estrecha, con vena central
          midR = ring.start + span * _clamp(rFloat(rng, 0.78, 0.92), 0.75, 0.94);
          widthFactor = _clamp(rFloat(rng, 0.24, 0.46), 0.22, 0.52);
        }

        const cpL = _polar0(midR, thetaC - (localStep / 2) * widthFactor);
        const cpR = _polar0(midR, thetaC + (localStep / 2) * widthFactor);

        // Curva en “S”: cintura en la base + volumen en la punta
        const waistR = ring.start + span * 0.28;
        const c1L = _polar0(waistR, thetaC - localStep * 0.18 * widthFactor);
        const c2L = _polar0(midR, thetaC - localStep * 0.42 * widthFactor);
        const c1R = _polar0(midR, thetaC + localStep * 0.42 * widthFactor);
        const c2R = _polar0(waistR, thetaC + localStep * 0.18 * widthFactor);

        pbMain.moveTo(pIn.x, pIn.y);
        cubicToCompat(pbMain, c1L.x, c1L.y, c2L.x, c2L.y, pOut.x, pOut.y);
        cubicToCompat(pbMain, c1R.x, c1R.y, c2R.x, c2R.y, pIn.x, pIn.y);
        pbMain.close();

        // Contorno interno (muy típico en los ejemplos): “pétalo dentro de pétalo”
        if (ring.allowDetail && allowSubdivideSafe(ring, localStep) && rng() < 0.70) {
          const i0 = ring.start + span * _clamp(rFloat(rng, 0.14, 0.22), 0.12, 0.28);
          const i1 = ring.end - span * _clamp(rFloat(rng, 0.10, 0.18), 0.08, 0.22);
          if (i1 > i0 + span * 0.20) {
            const pIn2 = _polar0(i0, thetaC);
            const pOut2 = _polar0(i1, thetaC);
            const midR2 = i0 + (i1 - i0) * _clamp(rFloat(rng, 0.52, 0.72), 0.45, 0.80);
            const wf2 = widthFactor * _clamp(rFloat(rng, 0.55, 0.72), 0.45, 0.80);

            const cpL2 = _polar0(midR2, thetaC - (localStep / 2) * wf2);
            const cpR2 = _polar0(midR2, thetaC + (localStep / 2) * wf2);

            pbDetail.moveTo(pIn2.x, pIn2.y)
              .quadTo(cpL2.x, cpL2.y, pOut2.x, pOut2.y)
              .quadTo(cpR2.x, cpR2.y, pIn2.x, pIn2.y)
              .close();
          }
        }


        // Micro-detalle botánico: estambres (3 filamentos + puntitos)
        if (ring.allowDetail && rng() < _lerp(0.25, 0.55, cN) && allowSubdivideSafe(ring, localStep)) {
          const baseR = ring.start + span * 0.14;
          const tipR = ring.start + span * _clamp(rFloat(rng, 0.48, 0.62), 0.42, 0.68);
          const wS = Math.max(detailStroke * 0.9, span * 0.035);


          // Elementos intersticiales: rellena “V” entre pétalos (fase desplazada)
          if (ring.allowDetail && ring.role !== "rest" && rng() < _lerp(0.18, 0.42, cN) && allowSubdivideSafe(ring, localStep)) {
            const dropSpan = span * _clamp(rFloat(rng, 0.30, 0.46), 0.26, 0.55);
            const dropInR = ring.start + span * _clamp(rFloat(rng, 0.10, 0.18), 0.08, 0.24);
            const dropOutR = dropInR + dropSpan;
            const dropW = _clamp(rFloat(rng, 0.20, 0.34), 0.18, 0.40);

            for (const sign of [-1, 1]) {
              const aD = thetaC + sign * localStep * 0.33;
              const dIn = _polar0(dropInR, aD);
              const dOut = _polar0(dropOutR, aD);
              const dMid = dropInR + (dropOutR - dropInR) * 0.60;

              const dCpL = _polar0(dMid, aD - localStep * dropW * 0.40);
              const dCpR = _polar0(dMid, aD + localStep * dropW * 0.40);

              pbDetail.moveTo(dIn.x, dIn.y)
                .quadTo(dCpL.x, dCpL.y, dOut.x, dOut.y)
                .quadTo(dCpR.x, dCpR.y, dIn.x, dIn.y)
                .close();
            }
          }

          for (let j = -1; j <= 1; j++) {
            const aj = thetaC + j * localStep * 0.08;
            const sA = _polar0(baseR, aj);
            const sB = _polar0(tipR, aj);
            if (wS * Math.hypot(sB.x - sA.x, sB.y - sA.y) >= minCellAreaMm2 * 0.55) {
              // Tapered stamens
              addTaperedLine(pbDetail, sA, sB, wS, wS * 0.3);
              addCirclePoly(pbDetail, sB.x, sB.y, Math.max(wS * 0.85, mainStroke * 1.2), 12);
            }
          }
        }

        // Vena central (capsulita cerrada) para hojas/lotus
        if (ring.allowDetail && rng() < detailProb && allowSubdivideSafe(ring, localStep)) {
          const vA = _polar0(ring.start + span * 0.18, thetaC);
          const vB = _polar0(ring.end - span * 0.12, thetaC);

          const w = Math.max(detailStroke * 1.6, span * (type === "petal_almond" ? 0.08 : 0.10));
          const estArea = w * Math.hypot(vB.x - vA.x, vB.y - vA.y);

          if (estArea >= minCellAreaMm2) addCapsule(pbDetail, vA.x, vA.y, vB.x, vB.y, w);

          // PHASE 2: Fine Texture (micro-veins)
          if (complexity > 180 && (type === "petal_almond" || type === "petal_pointy")) {
            for (let v = -1; v <= 1; v++) {
              if (v === 0) continue;
              const av = thetaC + v * localStep * 0.15;
              const vS = _polar0(ring.start + span * 0.3, av);
              const vE = _polar0(ring.start + span * 0.7, av);
              addCapsule(pbFine, vS.x, vS.y, vE.x, vE.y, fineStroke * 0.3);
            }
          }

          // venas laterales discretas solo en “almond”
          if (type === "petal_almond" && rng() < 0.55) {
            const a1 = thetaC - localStep * 0.10;
            const a2 = thetaC + localStep * 0.10;
            const sA = ring.start + span * 0.32;
            const sB = ring.start + span * 0.78;
            const w2 = Math.max(detailStroke * 1.2, span * 0.06);

            const lA = _polar0(sA, a1);
            const lB = _polar0(sB, a1);
            const rA = _polar0(sA, a2);
            const rB = _polar0(sB, a2);

            if (w2 * Math.hypot(lB.x - lA.x, lB.y - lA.y) >= minCellAreaMm2 * 0.70) {
              addCapsule(pbDetail, lA.x, lA.y, lB.x, lB.y, w2);
              addCapsule(pbDetail, rA.x, rA.y, rB.x, rB.y, w2);
            }
          }
        }

      } else if (type === "petal_heart") {
        // Corazón apuntando hacia afuera (anillo tipo página con corazones)
        const span = (ring.end - ring.start);

        const outR = (nextRing && ring.role !== "frame" && ring.role !== "rest" && rng() < 0.78)
          ? Math.min(rMax, ring.end + (nextRing.end - nextRing.start) * overlapFactor)
          : ring.end;

        const tip = _polar0(outR, thetaC);                  // punta exterior
        const base = _polar0(ring.start + span * 0.18, thetaC); // hendidura interior
        const lobeR = ring.start + span * _clamp(rFloat(rng, 0.52, 0.70), 0.48, 0.76);

        const aL = thetaC - localStep * 0.22;
        const aR = thetaC + localStep * 0.22;

        const lobeL = _polar0(lobeR, aL);
        const lobeRgt = _polar0(lobeR, aR);

        // Control points para redondear los lóbulos
        const c1 = _polar0(lobeR + span * 0.10, thetaC - localStep * 0.34);
        const c2 = _polar0(lobeR + span * 0.10, thetaC + localStep * 0.34);

        pbMain.moveTo(base.x, base.y)
          .quadTo(c1.x, c1.y, lobeL.x, lobeL.y)
          .quadTo(tip.x, tip.y, lobeRgt.x, lobeRgt.y)
          .quadTo(c2.x, c2.y, base.x, base.y)
          .close();

        // contorno interno simple (para que se vea “editorial”)
        if (ring.allowDetail && allowSubdivideSafe(ring, localStep) && rng() < 0.65) {
          const inTip = _polar0(ring.end - span * 0.18, thetaC);
          const inBase = _polar0(ring.start + span * 0.30, thetaC);
          const inLobeR = ring.start + span * 0.58;

          const inL = _polar0(inLobeR, aL);
          const inR = _polar0(inLobeR, aR);

          const ic1 = _polar0(inLobeR + span * 0.05, thetaC - localStep * 0.32);
          const ic2 = _polar0(inLobeR + span * 0.05, thetaC + localStep * 0.32);

          pbDetail.moveTo(inBase.x, inBase.y)
            .quadTo(ic1.x, ic1.y, inL.x, inL.y)
            .quadTo(inTip.x, inTip.y, inR.x, inR.y)
            .quadTo(ic2.x, ic2.y, inBase.x, inBase.y)
            .close();
        }

      } else if (type === "fleur") {
        // Flor-de-lis simplificada: punta central (cerrada) + “perlas” laterales (círculos cerrados)
        const span = (ring.end - ring.start);
        const outR = (nextRing && ring.role !== "frame" && ring.role !== "rest" && rng() < 0.78)
          ? Math.min(rMax, ring.end + (nextRing.end - nextRing.start) * overlapFactor)
          : ring.end;

        const pIn = _polar0(ring.start, thetaC);
        const pOut = _polar0(outR, thetaC);

        const midR = ring.start + span * _clamp(rFloat(rng, 0.62, 0.82), 0.60, 0.88);
        const widthFactor = _clamp(rFloat(rng, 0.32, 0.58), 0.28, 0.70);

        const cpL = _polar0(midR, thetaC - (localStep / 2) * widthFactor);
        const cpR = _polar0(midR, thetaC + (localStep / 2) * widthFactor);

        pbMain.moveTo(pIn.x, pIn.y)
          .quadTo(cpL.x, cpL.y, pOut.x, pOut.y)
          .quadTo(cpR.x, cpR.y, pIn.x, pIn.y)
          .close();

        // Perlas laterales (cerradas) para textura sin micro-celdas
        if (ring.allowDetail && allowSubdivideSafe(ring, localStep) && rng() < 0.85) {
          const beadR = _clamp(span * rFloat(rng, 0.06, 0.12), mainStroke * 2.2, span * 0.20);
          const beadMid = ring.start + span * _clamp(rFloat(rng, 0.28, 0.42), 0.25, 0.50);

          const bL = _polar0(beadMid, thetaC - localStep * _clamp(rFloat(rng, 0.22, 0.34), 0.18, 0.42));
          const bR = _polar0(beadMid, thetaC + localStep * _clamp(rFloat(rng, 0.22, 0.34), 0.18, 0.42));

          addCirclePoly(pbDetail, bL.x, bL.y, beadR, 14);
          addCirclePoly(pbDetail, bR.x, bR.y, beadR, 14);

          // Punto conector en el borde interno (similar a “connecting dots”)
          if (rng() < 0.55) {
            const bC = _polar0(ring.start + span * 0.10, thetaC);
            addCirclePoly(pbDetail, bC.x, bC.y, _clamp(beadR * 0.85, mainStroke * 2.0, beadR * 1.0), 12);
          }
        }



      } else if (type === "diamond") {
        const pIn = _polar0(ring.start, thetaC);
        const pOut = _polar0(ring.end, thetaC);
        const mid = (ring.start + ring.end) / 2;
        const pL = _polar0(mid, thetaL);
        const pR = _polar0(mid, thetaR);

        pbMain.moveTo(pIn.x, pIn.y)
          .lineTo(pL.x, pL.y)
          .lineTo(pOut.x, pOut.y)
          .lineTo(pR.x, pR.y)
          .close();

        if (ring.allowDetail && rng() < 0.55 && allowSubdivideSafe(ring, localStep)) {
          const inset = (ring.end - ring.start) * 0.22;
          const rIn2 = ring.start + inset;
          const rOut2 = ring.end - inset;

          if (rOut2 > rIn2) {
            const mid2 = (rIn2 + rOut2) / 2;
            const pIn2 = _polar0(rIn2, thetaC);
            const pOut2 = _polar0(rOut2, thetaC);
            const pL2 = _polar0(mid2, thetaL * 0.85);
            const pR2 = _polar0(mid2, thetaR * 0.85);

            pbDetail.moveTo(pIn2.x, pIn2.y)
              .lineTo(pL2.x, pL2.y)
              .lineTo(pOut2.x, pOut2.y)
              .lineTo(pR2.x, pR2.y)
              .close();
          }
        }

      } else {
        // arch = cinta cerrada (motivo)
        const pL0 = _polar0(ring.start, thetaL);
        const pR0 = _polar0(ring.start, thetaR);
        const pL1 = _polar0(ring.end, thetaL);
        const pR1 = _polar0(ring.end, thetaR);

        const cO = _polar0(ring.end, thetaC);
        const cI = _polar0(ring.start + (ring.end - ring.start) * 0.25, thetaC);

        pbMain.moveTo(pL0.x, pL0.y)
          .lineTo(pL1.x, pL1.y)
          .quadTo(cO.x, cO.y, pR1.x, pR1.y)
          .lineTo(pR0.x, pR0.y)
          .quadTo(cI.x, cI.y, pL0.x, pL0.y)
          .close();

        // Puntos conectores (cerrados) en intersecciones para legibilidad al colorear
        if (ring.allowDetail && rng() < 0.55 && allowSubdivideSafe(ring, localStep)) {
          const dotR = _clamp((ring.end - ring.start) * rFloat(rng, 0.05, 0.10), mainStroke * 2.0, (ring.end - ring.start) * 0.16);
          const d = _polar0(ring.start + (ring.end - ring.start) * 0.10, thetaC);
          addCirclePoly(pbDetail, d.x, d.y, dotR, 14);
        }

        if (ring.allowDetail && rng() < detailProb && allowSubdivideSafe(ring, localStep)) {
          const bands = 1 + (ring.idx % 2);
          for (let b = 0; b < bands; b++) {
            const t = (b + 1) / (bands + 1);
            const rB = ring.start + (ring.end - ring.start) * t;

            const bandT = Math.max(detailStroke * 1.8, (ring.end - ring.start) * 0.10);

            const rMid = (ring.start + ring.end) / 2;
            const arcW = Math.abs(rMid * (thetaR - thetaL));
            if (arcW * bandT >= minCellAreaMm2 && arcW >= 0.9) {
              addArcBand(pbDetail, rB, thetaL * 0.85, thetaR * 0.85, bandT);
            }
          }
        }
      }
    }

    prevRing = ring;
  }

  // --- SPOKES (radios) corregidos: mm -> rad y clamp al wedge ---
  const spokeCount = _clamp(Math.round(petals * _lerp(0.6, 1.2, cN)), 10, 72);
  const targetSpokeWmm = computedRadius * _lerp(0.010, 0.018, cN);

  for (let i = 0; i < spokeCount; i++) {
    // Less spokes if organic
    if (rng() > _lerp(0.6, 0.3, organicLevel)) continue;

    const rA = Math.max(binduR * 1.05, computedRadius * 0.12);
    const rB = computedRadius * (0.55 + 0.40 * rng());
    if (rB <= rA) continue;

    const halfAngA = Math.atan2(targetSpokeWmm / 2, rA);
    const halfAngB = Math.atan2(targetSpokeWmm / 2, rB);

    const margin = Math.max(halfAngA, halfAngB) + 1e-4;
    if (stepAngle <= 2 * margin) continue;

    const a = rFloat(rng, -stepAngle / 2 + margin, stepAngle / 2 - margin);

    const p1 = _polar0(rA, a - halfAngA);
    const p2 = _polar0(rB, a - halfAngB);
    const p3 = _polar0(rB, a + halfAngB);
    const p4 = _polar0(rA, a + halfAngA);

    pbMain.moveTo(p1.x, p1.y)
      .lineTo(p2.x, p2.y)
      .lineTo(p3.x, p3.y)
      .lineTo(p4.x, p4.y)
      .close();
  }

  // --- Guardar wedge (sin bindu) ---
  const wedgeMain = pbMain.toPath({
    stroke,
    strokeWidthMm: mainStroke,
    fill: "none",
    linecap: "round",
    linejoin: "round",
  });

  const wedgeDetail = pbDetail.toPath({
    stroke,
    strokeWidthMm: detailStroke,
    fill: "none",
    linecap: "round",
    linejoin: "round",
  });

  const wedgeFine = pbFine.toPath({
    stroke,
    strokeWidthMm: fineStroke,
    fill: "none",
    linecap: "round",
    linejoin: "round",
  });

  doc.defs.push(`<g id="${wedgeId}">${wedgeMain}${wedgeDetail}${wedgeFine}</g>`);

  // --- Render radial ---
  for (let k = 0; k < petals; k++) {
    const deg = (k * 360) / petals;
    const organicJitter = organicLevel * _lerp(0.05, 0.6, cN);
    const phase = (k / Math.max(1, petals)) * Math.PI * 2;

    // Humaniza la repetición radial: micro-variación angular y de escala
    // para evitar el aspecto excesivamente sintético de un patrón 100% clonado.
    const rotJitterDeg = Math.sin(phase * 2.7 + (seed % 37)) * organicJitter * 2.2;
    const scaleJitter = 1 + Math.cos(phase * 1.9 + (seed % 19)) * organicJitter * 0.035;
    const mirror = (k % 2 === 1 && alternation > 0.24) ? -1 : 1;

    const transform = [
      `translate(${_fmt(cx)} ${_fmt(cy)})`,
      `rotate(${_fmt(deg - 90 + rotJitterDeg)})`,
      `scale(${_fmt(mirror * scaleJitter)} ${_fmt(scaleJitter)})`
    ].join(" ");

    doc.body.push(
      `<use href="#${wedgeId}" transform="${transform}" />`
    );
  }


  // --- Motivo central adicional (roseta avanzada) ---
  if (rng() < 0.98) {
    const rType = rng();
    const cCount = (petals % 2 === 0 ? petals : petals + 1);
    const inner = binduR * 1.05;
    const outer = binduClearR * 0.9;
    const step = (Math.PI * 2) / Math.max(6, cCount);

    const pbC = new PathBuilder();

    if (rType < 0.5) {
      // SUNBURST: Rayos y picos geométricos
      for (let k = 0; k < cCount; k++) {
        const a = k * step;
        const aNext = (k + 1) * step;
        const aMid = a + step * 0.5;

        const p1 = { x: cx + inner * Math.cos(a), y: cy + inner * Math.sin(a) };
        const p2 = { x: cx + outer * Math.cos(aMid), y: cy + outer * Math.sin(aMid) };
        const p3 = { x: cx + inner * Math.cos(aNext), y: cy + inner * Math.sin(aNext) };

        pbC.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).lineTo(p3.x, p3.y);

        // Internal "spark"
        const pSpark = { x: cx + (inner + (outer - inner) * 0.4) * Math.cos(aMid), y: cy + (inner + (outer - inner) * 0.4) * Math.sin(aMid) };
        addTaperedLine(pbC, p1, pSpark, detailStroke * 0.6, fineStroke * 0.3);
      }
    } else {
      // FLORAL COMPASS: Puntos cardinales y pétalos suaves
      for (let k = 0; k < cCount; k++) {
        const a = k * step;
        const pIn = { x: cx + inner * Math.cos(a), y: cy + inner * Math.sin(a) };
        const pOut = { x: cx + outer * Math.cos(a), y: cy + outer * Math.sin(a) };
        const cpL = { x: cx + _lerp(inner, outer, 0.5) * Math.cos(a - step * 0.3), y: cy + _lerp(inner, outer, 0.5) * Math.sin(a - step * 0.3) };
        const cpR = { x: cx + _lerp(inner, outer, 0.5) * Math.cos(a + step * 0.3), y: cy + _lerp(inner, outer, 0.5) * Math.sin(a + step * 0.3) };

        pbC.moveTo(pIn.x, pIn.y).quadTo(cpL.x, cpL.y, pOut.x, pOut.y).quadTo(cpR.x, cpR.y, pIn.x, pIn.y).close();

        // Compass line
        if (k % (cCount / 4) === 0) {
          const pTip = { x: cx + (outer * 1.15) * Math.cos(a), y: cy + (outer * 1.15) * Math.sin(a) };
          addTaperedLine(pbC, pOut, pTip, mainStroke, detailStroke * 0.5);
        }
      }
    }

    doc.body.push(
      `<path d="${pbC.toString()}" fill="none" stroke="${stroke}" stroke-width="${_fmt(detailStroke)}" />`
    );

    // NESTED CORE (Double Core)
    if (complexity > 100) {
      const pbInner = new PathBuilder();
      const innerR = inner * 0.8;
      for (let k = 0; k < cCount; k++) {
        const a = k * (Math.PI * 2 / cCount);
        const p = { x: cx + innerR * Math.cos(a), y: cy + innerR * Math.sin(a) };
        if (k === 0) pbInner.moveTo(p.x, p.y);
        else pbInner.lineTo(p.x, p.y);
      }
      pbInner.close();
      doc.body.push(`<path d="${pbInner.toString()}" fill="none" stroke="${stroke}" stroke-width="${_fmt(fineStroke)}" />`);
    }
  }

  // --- Bindu fuera del wedge (perfecto) ---
  doc.body.push(
    `<circle cx="${_fmt(cx)}" cy="${_fmt(cy)}" r="${_fmt(binduR)}" fill="none" stroke="${stroke}" stroke-width="${_fmt(mainStroke)}" />`
  );
  doc.body.push(
    `<circle cx="${_fmt(cx)}" cy="${_fmt(cy)}" r="${_fmt(binduR * 0.62)}" fill="none" stroke="${stroke}" stroke-width="${_fmt(detailStroke)}" />`
  );

  // --- Frames fuera del wedge ---
  if (includeFrames) {

    // --- Estética “cuadernillo”: anillos de cuentas y borde festoneado (círculos grandes repetidos) ---
    // 1) Bead ring (cerca del núcleo, típico en mandalas impresos)
    if (rng() < _lerp(0.95, 0.62, harmony)) {
      const beadRingR = binduClearR * _clamp(rFloat(rng, 0.72, 0.88), 0.66, 0.92);
      const beadDensity = _lerp(2.4, 1.3, organicLevel);
      const beadCount = _clamp(Math.round(petals * _clamp(rFloat(rng, beadDensity * 0.8, beadDensity * 1.3), 1.1, 2.8)), 14, 82);
      const beadR = _clamp(computedRadius * _clamp(rFloat(rng, 0.006, 0.010), 0.005, 0.012), mainStroke * 2.2, computedRadius * 0.020);

      for (let i = 0; i < beadCount; i++) {
        const a = (i * 2 * Math.PI) / beadCount;
        const bx = cx + beadRingR * Math.cos(a);
        const by = cy + beadRingR * Math.sin(a);
        doc.body.push(
          `<circle cx="${_fmt(bx)}" cy="${_fmt(by)}" r="${_fmt(beadR)}" fill="none" stroke="${stroke}" stroke-width="${_fmt(detailStroke)}" />`
        );
      }
    }

    // 2) Scallop edge: círculos grandes tocando el marco exterior (da ese look “flor” del borde)
    if (rng() < _lerp(0.88, 0.55, harmony)) {
      const scallopCount = _clamp(Math.round(petals * _clamp(rFloat(rng, 0.9, 1.55), 0.8, 2.0)), 10, 56);
      const scallopR = _clamp(computedRadius * _clamp(rFloat(rng, 0.020, 0.040), 0.018, 0.045), mainStroke * 2.6, computedRadius * 0.060);
      const scallopCenterR = computedRadius * 0.985 - scallopR * 0.85;

      for (let i = 0; i < scallopCount; i++) {
        const a = (i * 2 * Math.PI) / scallopCount;
        const sx = cx + scallopCenterR * Math.cos(a);
        const sy = cy + scallopCenterR * Math.sin(a);
        doc.body.push(
          `<circle cx="${_fmt(sx)}" cy="${_fmt(sy)}" r="${_fmt(scallopR)}" fill="none" stroke="${stroke}" stroke-width="${_fmt(mainStroke)}" />`
        );
      }
    }
    doc.body.push(
      `<circle cx="${_fmt(cx)}" cy="${_fmt(cy)}" r="${_fmt(binduClearR)}" fill="none" stroke="${stroke}" stroke-width="${_fmt(Math.max(minStrokeMm, mainStroke * 0.7))}" />`
    );
  }

  // --- PHASE 3: Ornamental Page Border ---
  if (pageBorder) {
    const { wMm, hMm } = page;
    const borderMargin = marginMm * 0.5;
    const pbB = new PathBuilder();

    // Simple ornamental frame: Rect with corner rosettes
    const x0 = borderMargin, y0 = borderMargin;
    const x1 = wMm - borderMargin, y1 = hMm - borderMargin;

    // Draw outer rect
    pbB.moveTo(x0, y0).lineTo(x1, y0).lineTo(x1, y1).lineTo(x0, y1).close();

    // Corners
    const cornerR = marginMm * 0.8;
    addCirclePoly(pbB, x0, y0, cornerR, 12);
    addCirclePoly(pbB, x1, y0, cornerR, 12);
    addCirclePoly(pbB, x1, y1, cornerR, 12);
    addCirclePoly(pbB, x0, y1, cornerR, 12);

    doc.body.push(
      `<path d="${pbB.toString()}" fill="none" stroke="${stroke}" stroke-width="${_fmt(mainStroke * 0.8)}" />`
    );

    // Hairline detail inside border
    const pbB2 = new PathBuilder();
    const b2m = borderMargin + 1.2;
    pbB2.moveTo(b2m, b2m).lineTo(wMm - b2m, b2m).lineTo(wMm - b2m, hMm - b2m).lineTo(b2m, hMm - b2m).close();
    doc.body.push(
      `<path d="${pbB2.toString()}" fill="none" stroke="${stroke}" stroke-width="${_fmt(fineStroke * 0.7)}" />`
    );
  }
}

// --- Helpers ---
function _polar0(r, theta) {
  return { x: r * Math.cos(theta), y: r * Math.sin(theta) };
}
function _lerp(a, b, t) { return a + (b - a) * t; }
function _clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function _fmt(n) { return (Math.round(n * 1000) / 1000).toString(); }
