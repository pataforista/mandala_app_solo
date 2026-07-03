import { mulberry32, rFloat } from "../core/prng.js";
import { PathBuilder } from "../core/pathBuilder.js";

/**
 * Mandala con arquitectura de capas modulares - VERSION PREMIUM
 * - 8 capas independientes y controlables
 * - 7 estilos culturales: Sashiko, Floral, Geométrico, Islámico, Azteca, Yantra, Céltico
 * - Geometría de alta calidad para libros de colorear
 */

// --- Helpers de utilidad ---
function _lerp(a, b, t) { return a + (b - a) * t; }
function _clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function _polar0(r, theta, center = { x: 0, y: 0 }) {
  return {
    x: center.x + r * Math.cos(theta),
    y: center.y + r * Math.sin(theta)
  };
}

/**
 * Genera un nudo céltico continuo usando curvas Bézier
 * Basado en patrones tradicionales de Book of Kells
 */
function addCelticKnot(pb, cx, cy, outerR, innerR, rotation = 0, segments = 8) {
  const knotPoints = [];
  
  // Generar puntos de control para el nudo
  for (let i = 0; i < segments; i++) {
    const baseAngle = (i / segments) * Math.PI * 2 + rotation;
    const nextAngle = ((i + 1) / segments) * Math.PI * 2 + rotation;
    
    // Punto exterior (cresta del nudo)
    const outPt = _polar0(outerR, baseAngle, {x: cx, y: cy});
    knotPoints.push({ type: 'outer', pt: outPt, angle: baseAngle });
    
    // Punto interior (valle del nudo) - con desplazamiento para entrelazado
    const inAngle = baseAngle + (Math.PI / segments) * 0.5;
    const inPt = _polar0(innerR, inAngle, {x: cx, y: cy});
    knotPoints.push({ type: 'inner', pt: inPt, angle: inAngle });
  }
  
  // Dibujar el nudo continuo con curvas suaves
  if (knotPoints.length > 0) {
    pb.moveTo(knotPoints[0].pt.x, knotPoints[0].pt.y);
    
    for (let i = 0; i < knotPoints.length; i++) {
      const curr = knotPoints[i];
      const next = knotPoints[(i + 1) % knotPoints.length];
      
      // Calcular punto de control para curva Bézier suave
      const midAngle = (curr.angle + next.angle) / 2;
      const controlDist = (curr.type === 'outer' ? outerR : innerR) * 0.85;
      const cp = _polar0(controlDist, midAngle, {x: cx, y: cy});
      
      pb.quadTo(cp.x, cp.y, next.pt.x, next.pt.y);
    }
    pb.close();
  }
  
  // Añadir círculos decorativos en las intersecciones (nudos tradicionales)
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2 + rotation;
    const circlePt = _polar0(outerR * 0.95, angle, {x: cx, y: cy});
    addCirclePoly(pb, circlePt.x, circlePt.y, outerR * 0.08, 12);
  }
}

/**
 * Dibuja espirales celtas auténticas (triskele-inspired)
 */
function addCelticSpiral(pb, cx, cy, radius, turns = 2, clockwise = true) {
  const points = [];
  const totalPoints = turns * 36;
  const dir = clockwise ? 1 : -1;
  
  for (let i = 0; i <= totalPoints; i++) {
    const t = i / totalPoints;
    const angle = t * Math.PI * 2 * turns * dir;
    const r = radius * t;
    points.push({
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle)
    });
  }
  
  if (points.length > 1) {
    pb.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      pb.lineTo(points[i].x, points[i].y);
    }
  }
}

/**
 * Genera el símbolo Vajra (Dorje) tibetano simplificado
 */
function addVajra(pb, cx, cy, size, rotation = 0) {
  const halfSize = size / 2;
  
  // Eje central
  addCapsule(pb, cx, cy - halfSize * 0.3, cx, cy + halfSize * 0.3, size * 0.12);
  
  // Brazos superiores (izquierda y derecha)
  const armTopY = cy - halfSize * 0.15;
  const armCurveLeft = [
    {x: cx, y: armTopY},
    {x: cx - size * 0.25, y: armTopY - size * 0.15},
    {x: cx - size * 0.35, y: armTopY - size * 0.35},
    {x: cx - size * 0.2, y: armTopY - size * 0.45}
  ];
  const armCurveRight = [
    {x: cx, y: armTopY},
    {x: cx + size * 0.25, y: armTopY - size * 0.15},
    {x: cx + size * 0.35, y: armTopY - size * 0.35},
    {x: cx + size * 0.2, y: armTopY - size * 0.45}
  ];
  
  pb.moveTo(armCurveLeft[0].x, armCurveLeft[0].y);
  for (let i = 1; i < armCurveLeft.length; i++) {
    pb.quadTo(armCurveLeft[i-1].x + (armCurveLeft[i].x - armCurveLeft[i-1].x)*0.5, 
              armCurveLeft[i-1].y + (armCurveLeft[i].y - armCurveLeft[i-1].y)*0.5,
              armCurveLeft[i].x, armCurveLeft[i].y);
  }
  
  pb.moveTo(armCurveRight[0].x, armCurveRight[0].y);
  for (let i = 1; i < armCurveRight.length; i++) {
    pb.quadTo(armCurveRight[i-1].x + (armCurveRight[i].x - armCurveRight[i-1].x)*0.5, 
              armCurveRight[i-1].y + (armCurveRight[i].y - armCurveRight[i-1].y)*0.5,
              armCurveRight[i].x, armCurveRight[i].y);
  }
  
  // Brazos inferiores (simétricos)
  const armBotY = cy + halfSize * 0.15;
  const armCurveLeftBot = [
    {x: cx, y: armBotY},
    {x: cx - size * 0.25, y: armBotY + size * 0.15},
    {x: cx - size * 0.35, y: armBotY + size * 0.35},
    {x: cx - size * 0.2, y: armBotY + size * 0.45}
  ];
  const armCurveRightBot = [
    {x: cx, y: armBotY},
    {x: cx + size * 0.25, y: armBotY + size * 0.15},
    {x: cx + size * 0.35, y: armBotY + size * 0.35},
    {x: cx + size * 0.2, y: armBotY + size * 0.45}
  ];
  
  pb.moveTo(armCurveLeftBot[0].x, armCurveLeftBot[0].y);
  for (let i = 1; i < armCurveLeftBot.length; i++) {
    pb.quadTo(armCurveLeftBot[i-1].x + (armCurveLeftBot[i].x - armCurveLeftBot[i-1].x)*0.5, 
              armCurveLeftBot[i-1].y + (armCurveLeftBot[i].y - armCurveLeftBot[i-1].y)*0.5,
              armCurveLeftBot[i].x, armCurveLeftBot[i].y);
  }
  
  pb.moveTo(armCurveRightBot[0].x, armCurveRightBot[0].y);
  for (let i = 1; i < armCurveRightBot.length; i++) {
    pb.quadTo(armCurveRightBot[i-1].x + (armCurveRightBot[i].x - armCurveRightBot[i-1].x)*0.5, 
              armCurveRightBot[i-1].y + (armCurveRightBot[i].y - armCurveRightBot[i-1].y)*0.5,
              armCurveRightBot[i].x, armCurveRightBot[i].y);
  }
  
  // Círculo central (bindu tibetano)
  addCirclePoly(pb, cx, cy, size * 0.12, 16);
}

/**
 * Genera llamas/fuego protector tibetano (estilo tradicional)
 */
function addTibetanFire(pb, cx, cy, radius, count = 8) {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const nextAngle = ((i + 1) / count) * Math.PI * 2;
    const midAngle = (angle + nextAngle) / 2;
    
    const basePt = _polar0(radius, angle, {x: cx, y: cy});
    const nextBasePt = _polar0(radius, nextAngle, {x: cx, y: cy});
    const flameTip = _polar0(radius * 1.35, midAngle, {x: cx, y: cy});
    const flameInner = _polar0(radius * 0.85, midAngle, {x: cx, y: cy});
    
    // Llama curvada estilo tibetano
    pb.moveTo(basePt.x, basePt.y);
    pb.quadTo(
      _polar0(radius * 1.1, angle + 0.15, {x: cx, y: cy}).x,
      _polar0(radius * 1.1, angle + 0.15, {x: cx, y: cy}).y,
      flameTip.x, flameTip.y
    );
    pb.quadTo(
      _polar0(radius * 1.1, nextAngle - 0.15, {x: cx, y: cy}).x,
      _polar0(radius * 1.1, nextAngle - 0.15, {x: cx, y: cy}).y,
      nextBasePt.x, nextBasePt.y
    );
    pb.quadTo(flameInner.x, flameInner.y, basePt.x, basePt.y);
  }
}

function addCirclePoly(pb, cx, cy, r, seg = 16) {
  if (r <= 0) return;
  const step = (Math.PI * 2) / Math.max(6, seg);
  pb.moveTo(cx + r, cy);
  for (let i = 1; i < seg; i++) {
    const a = step * i;
    pb.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  pb.close();
}

function addCapsule(pb, ax, ay, bx, by, w) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return;
  const nx = -dy / len;
  const ny = dx / len;
  const hw = w / 2;
  pb.moveTo(ax + nx * hw, ay + ny * hw)
    .lineTo(bx + nx * hw, by + ny * hw)
    .lineTo(bx - nx * hw, by - ny * hw)
    .lineTo(ax - nx * hw, ay - ny * hw)
    .close();
}

/** Polígono estrella (n puntas) con radios exterior/interior alternos */
function addStarPolygon(pb, cx, cy, rOuter, rInner, nPoints, rotation = 0) {
  const total = nPoints * 2;
  for (let i = 0; i < total; i++) {
    const a = (i / total) * Math.PI * 2 + rotation;
    const r = i % 2 === 0 ? rOuter : rInner;
    if (i === 0) pb.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    else pb.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  pb.close();
}

/** Polígono regular de n lados */
function addRegularPolygon(pb, cx, cy, r, nSides, rotation = 0) {
  for (let i = 0; i < nSides; i++) {
    const a = (i / nSides) * Math.PI * 2 + rotation;
    if (i === 0) pb.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    else pb.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  pb.close();
}

export function generateMandalaLayers(doc, opts) {
  const {
    seed,
    petals = 12,
    stroke = "#000",
    strokeWidthMm = 0.6,

    // Intensidades (0-1)
    layer1Intensity = 0.8, // Núcleo
    layer2Intensity = 0.8, // Pétalos Int.
    layer3Intensity = 0.7, // Flores / Sashiko / Cultural
    layer4Intensity = 0.8, // Anillo Geom.
    layer5Intensity = 0.6, // Detalles Finos
    layer6Intensity = 0.7, // Borde Decor.
    layer7Intensity = 0.5, // Natural / Hojas / Cultural
    layer8Intensity = 0.4, // Texturas

    styleMode = "sashiko",
    organicLevel = 0.2,
    complexity = 110,
    includeFrames = true,
    pageBorder = true,
  } = opts;

  const page = doc?.page ?? { wMm: 210, hMm: 297, marginMm: 10 };
  const marginMm = page.marginMm || 10;
  const center = { x: page.wMm / 2, y: page.hMm / 2 };
  const maxRadius = Math.min(page.wMm, page.hMm) / 2 - marginMm - 5;

  const rng = mulberry32(seed);
  const paths = [];

  // Compatibilidad: algunos estados guardados usan "hashiko" para el estilo floral base.
  const normalizedStyleMode = styleMode === "hashiko" ? "sashiko" : styleMode;

  const mainStroke = strokeWidthMm;
  const detailStroke = strokeWidthMm * 0.7;
  const fineStroke = strokeWidthMm * 0.4;

  // ==================== L1: NÚCLEO (BINDU) ====================
  if (layer1Intensity > 0.05) {
    const pb = new PathBuilder();
    const r = maxRadius * 0.12 * layer1Intensity;

    // Bindu central
    addCirclePoly(pb, center.x, center.y, r * 0.2, 12);

    // Anillo protector
    if (layer1Intensity > 0.4) {
      addCirclePoly(pb, center.x, center.y, r * 0.5, 16);

      // Radios
      const radialCount = Math.max(8, petals);
      for (let i = 0; i < radialCount; i++) {
        const a = (i / radialCount) * Math.PI * 2;
        const p1 = _polar0(r * 0.5, a, center);
        const p2 = _polar0(r * 0.8, a, center);
        addCapsule(pb, p1.x, p1.y, p2.x, p2.y, fineStroke);
      }
    }

    // Borde de núcleo
    addCirclePoly(pb, center.x, center.y, r, 24);

    // Yantra: bindu expandido con triángulos en el núcleo
    if (normalizedStyleMode === "yantra" && layer1Intensity > 0.6) {
      addRegularPolygon(pb, center.x, center.y, r * 0.75, 3, 0);
      addRegularPolygon(pb, center.x, center.y, r * 0.75, 3, Math.PI);
    }

    paths.push(pb.toPath({ stroke, strokeWidthMm: detailStroke }));
  }

  // ==================== L2: PÉTALOS INTERNOS ====================
  if (layer2Intensity > 0.05) {
    const pb = new PathBuilder();
    const rIn = maxRadius * 0.12;
    const rOut = rIn + maxRadius * 0.15 * layer2Intensity;
    const count = petals;

    for (let i = 0; i < count; i++) {
      const aC = (i / count) * Math.PI * 2;
      const aL = aC - (Math.PI / count) * 0.8;
      const aR = aC + (Math.PI / count) * 0.8;

      const pIn = _polar0(rIn, aC, center);
      const pOut = _polar0(rOut, aC, center);
      const pL = _polar0(rIn + (rOut - rIn) * 0.4, aL, center);
      const pR = _polar0(rIn + (rOut - rIn) * 0.4, aR, center);

      if (normalizedStyleMode === "islamico") {
        // Pétalos angulares tipo khatam
        const pMidL = _polar0(rIn + (rOut - rIn) * 0.5, aL, center);
        const pMidR = _polar0(rIn + (rOut - rIn) * 0.5, aR, center);
        pb.moveTo(pIn.x, pIn.y).lineTo(pMidL.x, pMidL.y).lineTo(pOut.x, pOut.y)
          .lineTo(pMidR.x, pMidR.y).close();
      } else if (normalizedStyleMode === "azteca") {
        // Pétalos trapezoidales angulares
        pb.moveTo(pIn.x, pIn.y).lineTo(pL.x, pL.y).lineTo(pOut.x, pOut.y)
          .lineTo(pR.x, pR.y).close();
      } else {
        pb.moveTo(pIn.x, pIn.y)
          .quadTo(pL.x, pL.y, pOut.x, pOut.y)
          .quadTo(pR.x, pR.y, pIn.x, pIn.y)
          .close();
        // Detalle interno
        if (layer2Intensity > 0.6) {
          const pDetail = _polar0(rIn + (rOut - rIn) * 0.6, aC, center);
          addCirclePoly(pb, pDetail.x, pDetail.y, (rOut - rIn) * 0.1, 8);
        }
      }
    }
    paths.push(pb.toPath({ stroke, strokeWidthMm: mainStroke }));
  }

  // ==================== L3: PATRÓN CULTURAL / FLORES / SASHIKO ====================
  if (layer3Intensity > 0.05) {
    const pb = new PathBuilder();
    const rMid = maxRadius * 0.4;
    const fSize = maxRadius * 0.12 * layer3Intensity;

    // Densidad de elementos según estilo
    const countByMode = {
      sashiko: Math.max(8, petals),
      islamico: Math.max(8, petals),
      azteca: Math.max(6, petals),
      yantra: Math.max(6, petals),
      celtico: Math.max(6, Math.round(petals * 0.75)),
      tibetano: Math.max(8, petals),
      floral: Math.max(6, Math.round(petals / 2)),
      geometric: Math.max(6, Math.round(petals / 2)),
    };
    const count = countByMode[normalizedStyleMode] ?? Math.max(6, Math.round(petals / 2));

    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const fCenter = _polar0(rMid, a, center);

      if (normalizedStyleMode === "sashiko") {
        // Rosetas repetitivas inspiradas en bordados Sashiko
        const pCount = 6;
        for (let j = 0; j < pCount; j++) {
          const pa = (j / pCount) * Math.PI * 2 + a;
          const pOuter = _polar0(fSize, pa, fCenter);
          const pInner = _polar0(fSize * 0.4, pa + Math.PI / pCount, fCenter);
          pb.moveTo(fCenter.x, fCenter.y).lineTo(pOuter.x, pOuter.y);
          pb.moveTo(pInner.x, pInner.y).lineTo(pOuter.x, pOuter.y);
        }
        addCirclePoly(pb, fCenter.x, fCenter.y, fSize * 0.78, 12);
        addCirclePoly(pb, fCenter.x, fCenter.y, fSize * 0.3, 10);

      } else if (normalizedStyleMode === "floral") {
        const pCount = 5;
        for (let j = 0; j < pCount; j++) {
          const pa = (j / pCount) * Math.PI * 2 + a;
          const pOuter = _polar0(fSize, pa, fCenter);
          const cpL = _polar0(fSize * 0.6, pa - 0.4, fCenter);
          const cpR = _polar0(fSize * 0.6, pa + 0.4, fCenter);
          pb.moveTo(fCenter.x, fCenter.y)
            .quadTo(cpL.x, cpL.y, pOuter.x, pOuter.y)
            .quadTo(cpR.x, cpR.y, fCenter.x, fCenter.y)
            .close();
        }
        addCirclePoly(pb, fCenter.x, fCenter.y, fSize * 0.15, 8);

      } else if (normalizedStyleMode === "geometric") {
        const gCount = 8;
        pb.moveTo(fCenter.x + fSize, fCenter.y);
        for (let j = 1; j < gCount; j++) {
          const ga = (j / gCount) * Math.PI * 2;
          pb.lineTo(fCenter.x + Math.cos(ga) * fSize, fCenter.y + Math.sin(ga) * fSize);
        }
        pb.close();
        addCapsule(pb, fCenter.x - fSize, fCenter.y, fCenter.x + fSize, fCenter.y, fineStroke);
        addCapsule(pb, fCenter.x, fCenter.y - fSize, fCenter.x, fCenter.y + fSize, fineStroke);

      } else if (normalizedStyleMode === "islamico") {
        // Estrella de 8 puntas (khatam) - dos cuadrados superpuestos girados 45°
        addStarPolygon(pb, fCenter.x, fCenter.y, fSize, fSize * 0.38, 8, a);
        // Octágono interior (girih)
        addRegularPolygon(pb, fCenter.x, fCenter.y, fSize * 0.38, 8, a + Math.PI / 8);
        // Líneas girih conectoras en cruz
        if (layer3Intensity > 0.5) {
          addCapsule(pb, fCenter.x - fSize * 0.9, fCenter.y, fCenter.x + fSize * 0.9, fCenter.y, fineStroke * 0.6);
          addCapsule(pb, fCenter.x, fCenter.y - fSize * 0.9, fCenter.x, fCenter.y + fSize * 0.9, fineStroke * 0.6);
        }

      } else if (normalizedStyleMode === "azteca") {
        // Glifo solar azteca: estrella de 4 puntas + marco octagonal
        addStarPolygon(pb, fCenter.x, fCenter.y, fSize, fSize * 0.5, 4, a + Math.PI / 4);
        addRegularPolygon(pb, fCenter.x, fCenter.y, fSize * 1.05, 8, a);
        // Marcas de cruz (rayos calendáricos)
        for (let j = 0; j < 4; j++) {
          const ja = a + (j / 4) * Math.PI * 2;
          const jp = _polar0(fSize * 0.7, ja, fCenter);
          addCapsule(pb, fCenter.x, fCenter.y, jp.x, jp.y, fineStroke * 0.7);
        }

      } else if (normalizedStyleMode === "yantra") {
        // Shatkona: dos triángulos equiláteros entrelazados (△ + ▽)
        addRegularPolygon(pb, fCenter.x, fCenter.y, fSize, 3, a);         // △ Shiva
        addRegularPolygon(pb, fCenter.x, fCenter.y, fSize, 3, a + Math.PI); // ▽ Shakti
        // Círculo exterior y bindu
        addCirclePoly(pb, fCenter.x, fCenter.y, fSize * 1.05, 20);
        addCirclePoly(pb, fCenter.x, fCenter.y, fSize * 0.15, 6);

      } else if (normalizedStyleMode === "celtico") {
        // Nudo céltico continuo auténtico (Book of Kells style)
        addCelticKnot(pb, fCenter.x, fCenter.y, fSize * 0.85, fSize * 0.42, a, 8);
        // Espirales decorativas en el centro
        if (layer3Intensity > 0.5) {
          addCelticSpiral(pb, fCenter.x, fCenter.y, fSize * 0.25, 1.5, true);
          addCelticSpiral(pb, fCenter.x, fCenter.y, fSize * 0.25, 1.5, false);
        }
      } else if (normalizedStyleMode === "tibetano") {
        // Vajra central (Dorje) - símbolo de iluminación en budismo tibetano
        addVajra(pb, fCenter.x, fCenter.y, fSize * 1.2, a);
        // Círculo protector exterior
        addCirclePoly(pb, fCenter.x, fCenter.y, fSize * 1.15, 24);
        // Puntos de energía (bindus pequeños)
        for (let j = 0; j < 8; j++) {
          const binduAngle = a + (j / 8) * Math.PI * 2;
          const binduPt = _polar0(fSize * 0.95, binduAngle, fCenter);
          addCirclePoly(pb, binduPt.x, binduPt.y, fSize * 0.08, 8);
        }
      }
    }
    paths.push(pb.toPath({ stroke, strokeWidthMm: detailStroke }));
  }

  // ==================== L4: ANILLO CULTURAL / GEOMÉTRICO ====================
  if (layer4Intensity > 0.05) {
    const pb = new PathBuilder();
    const r1 = maxRadius * 0.55;
    const r2 = r1 + maxRadius * 0.08 * layer4Intensity;
    const count = petals * 2;

    for (let i = 0; i < count; i++) {
      const a1 = (i / count) * Math.PI * 2;
      const a2 = ((i + 1) / count) * Math.PI * 2;
      const aM = (a1 + a2) / 2;

      const p1a = _polar0(r1, a1, center);
      const p2a = _polar0(r1, a2, center);
      const pM = _polar0(r2, aM, center);

      if (normalizedStyleMode === "geometric") {
        pb.moveTo(p1a.x, p1a.y).lineTo(pM.x, pM.y).lineTo(p2a.x, p2a.y);

      } else if (normalizedStyleMode === "islamico") {
        // Zigzag de diamantes (girih border)
        pb.moveTo(p1a.x, p1a.y).lineTo(pM.x, pM.y).lineTo(p2a.x, p2a.y);
        if (i % 2 === 0) {
          const pIn = _polar0(r1 - maxRadius * 0.03, aM, center);
          addCapsule(pb, pIn.x, pIn.y, pM.x, pM.y, fineStroke * 0.5);
        }

      } else if (normalizedStyleMode === "azteca") {
        // Anillo escalonado tipo pirámide azteca
        const pStep1 = _polar0(r1 + (r2 - r1) * 0.5, a1, center);
        const pStep2 = _polar0(r1 + (r2 - r1) * 0.5, a2, center);
        pb.moveTo(p1a.x, p1a.y).lineTo(pStep1.x, pStep1.y)
          .lineTo(pM.x, pM.y).lineTo(pStep2.x, pStep2.y).lineTo(p2a.x, p2a.y);

      } else if (normalizedStyleMode === "yantra") {
        // Pétalo de loto apuntado (yantra petal)
        const cpL = _polar0(r2 * 0.96, aM - 0.12, center);
        const cpR = _polar0(r2 * 0.96, aM + 0.12, center);
        pb.moveTo(p1a.x, p1a.y).quadTo(cpL.x, cpL.y, pM.x, pM.y)
          .quadTo(cpR.x, cpR.y, p2a.x, p2a.y);

      } else if (normalizedStyleMode === "celtico") {
        // Arco apuntado gótico con entrelazado (tracería celta auténtica)
        const cpA = _polar0(r1 + (r2 - r1) * 0.9, a1 + (a2 - a1) * 0.15, center);
        const cpB = _polar0(r1 + (r2 - r1) * 0.9, a2 - (a2 - a1) * 0.15, center);
        pb.moveTo(p1a.x, p1a.y).quadTo(cpA.x, cpA.y, pM.x, pM.y)
          .quadTo(cpB.x, cpB.y, p2a.x, p2a.y);
        // Añadir pequeña espiral en el ápice del arco
        if (i % 4 === 0 && layer4Intensity > 0.6) {
          addCelticSpiral(pb, pM.x, pM.y, (r2 - r1) * 0.35, 1.2, i % 8 < 4);
        }

      } else if (normalizedStyleMode === "tibetano") {
        // Pétalos de loto tibetanos con curvas suaves
        const cpL = _polar0(r2 * 0.94, aM - 0.18, center);
        const cpR = _polar0(r2 * 0.94, aM + 0.18, center);
        pb.moveTo(p1a.x, p1a.y).quadTo(cpL.x, cpL.y, pM.x, pM.y)
          .quadTo(cpR.x, cpR.y, p2a.x, p2a.y);
        // Línea central decorativa (simula nervadura del pétalo)
        if (layer4Intensity > 0.5) {
          const pInner = _polar0(r1 + (r2 - r1) * 0.3, aM, center);
          addCapsule(pb, pInner.x, pInner.y, pM.x, pM.y, fineStroke * 0.5);
        }

      } else {
        pb.moveTo(p1a.x, p1a.y).quadTo(pM.x, pM.y, p2a.x, p2a.y);
      }

      if (normalizedStyleMode === "sashiko" && i % 3 === 0) {
        const pInner = _polar0(r1 - maxRadius * 0.03, aM, center);
        const pOuter = _polar0(r2 + maxRadius * 0.025, aM, center);
        addCapsule(pb, pInner.x, pInner.y, pOuter.x, pOuter.y, fineStroke * 0.6);
      }
    }
    paths.push(pb.toPath({ stroke, strokeWidthMm: mainStroke }));
  }

  // ==================== L5: DETALLES FINOS ====================
  if (layer5Intensity > 0.05) {
    const pb = new PathBuilder();
    const rStart = maxRadius * 0.65;
    const rEnd = rStart + maxRadius * 0.1 * layer5Intensity;
    const count = petals * 4;

    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const p1 = _polar0(rStart, a, center);
      const p2 = _polar0(rEnd, a, center);

      if (i % 2 === 0) {
        addCapsule(pb, p1.x, p1.y, p2.x, p2.y, fineStroke);
      } else if (layer5Intensity > 0.5) {
        const pDot = _polar0(rEnd + 2, a, center);
        addCirclePoly(pb, pDot.x, pDot.y, 0.8, 6);
      }
    }

    // Islámico: añadir pequeños diamantes entre los radios
    if (normalizedStyleMode === "islamico" && layer5Intensity > 0.4) {
      const dCount = petals * 2;
      for (let i = 0; i < dCount; i++) {
        const a = ((i + 0.5) / dCount) * Math.PI * 2;
        const dCenter = _polar0((rStart + rEnd) / 2, a, center);
        addStarPolygon(pb, dCenter.x, dCenter.y, 1.2, 0.5, 4, a);
      }
    }

    paths.push(pb.toPath({ stroke, strokeWidthMm: fineStroke }));
  }

  // ==================== L6: BORDE DECORATIVO ====================
  if (layer6Intensity > 0.05) {
    const pb = new PathBuilder();
    const rBase = maxRadius * 0.82;
    const rTop = rBase + maxRadius * 0.12 * layer6Intensity;
    const count = petals;

    for (let i = 0; i < count; i++) {
      const aC = (i / count) * Math.PI * 2;
      const aL = aC - (Math.PI / count);
      const aR = aC + (Math.PI / count);

      const pL = _polar0(rBase, aL, center);
      const pR = _polar0(rBase, aR, center);
      const pTop = _polar0(rTop, aC, center);

      if (normalizedStyleMode === "islamico") {
        // Corona de diamantes geométricos
        const pMidL = _polar0(rBase + (rTop - rBase) * 0.5, aC - 0.1, center);
        const pMidR = _polar0(rBase + (rTop - rBase) * 0.5, aC + 0.1, center);
        pb.moveTo(pL.x, pL.y).lineTo(pMidL.x, pMidL.y).lineTo(pTop.x, pTop.y)
          .lineTo(pMidR.x, pMidR.y).lineTo(pR.x, pR.y);
      } else if (normalizedStyleMode === "azteca") {
        // Corona escalonada azteca
        const pStepL = _polar0(rBase + (rTop - rBase) * 0.6, aC - 0.08, center);
        const pStepR = _polar0(rBase + (rTop - rBase) * 0.6, aC + 0.08, center);
        pb.moveTo(pL.x, pL.y).lineTo(pStepL.x, pStepL.y).lineTo(pTop.x, pTop.y)
          .lineTo(pStepR.x, pStepR.y).lineTo(pR.x, pR.y);
        if (layer6Intensity > 0.7) {
          addStarPolygon(pb, pTop.x, pTop.y, 1.8, 0.8, 4, aC);
        }
      } else if (normalizedStyleMode === "celtico") {
        // Arco gótico apuntado con entrelazado celta auténtico
        const cpL2 = _polar0(rTop * 0.97, aC - 0.12, center);
        const cpR2 = _polar0(rTop * 0.97, aC + 0.12, center);
        pb.moveTo(pL.x, pL.y).quadTo(cpL2.x, cpL2.y, pTop.x, pTop.y)
          .quadTo(cpR2.x, cpR2.y, pR.x, pR.y);
        if (layer6Intensity > 0.6) {
          // Pequeño nudo céltico en el ápice (en lugar de simple círculo)
          addCelticSpiral(pb, pTop.x, pTop.y, 2.2, 1.0, i % 2 === 0);
        }

      } else if (normalizedStyleMode === "tibetano") {
        // Corona de llamas protectoras (fuego de la sabiduría)
        const flameBase = rBase + (rTop - rBase) * 0.3;
        const flameTip = _polar0(rTop, aC, center);
        const flameL = _polar0(flameBase, aC - 0.15, center);
        const flameR = _polar0(flameBase, aC + 0.15, center);
        pb.moveTo(flameL.x, flameL.y)
          .quadTo(_polar0(rTop * 0.92, aC - 0.08, center).x, _polar0(rTop * 0.92, aC - 0.08, center).y, flameTip.x, flameTip.y)
          .quadTo(_polar0(rTop * 0.92, aC + 0.08, center).x, _polar0(rTop * 0.92, aC + 0.08, center).y, flameR.x, flameR.y);
        if (layer6Intensity > 0.65) {
          // Bindu decorativo en la base de cada llama
          const binduPt = _polar0(flameBase, aC, center);
          addCirclePoly(pb, binduPt.x, binduPt.y, 1.4, 8);
        }

      } else {
        pb.moveTo(pL.x, pL.y)
          .quadTo(_polar0(rTop * 0.95, aC - 0.2, center).x, _polar0(rTop * 0.95, aC - 0.2, center).y, pTop.x, pTop.y)
          .quadTo(_polar0(rTop * 0.95, aC + 0.2, center).x, _polar0(rTop * 0.95, aC + 0.2, center).y, pR.x, pR.y);
        if (layer6Intensity > 0.7) {
          addCirclePoly(pb, pTop.x, pTop.y, 2, 8);
        }
      }
    }

    // Motivo clásico: guirnalda de arcos con perlas exteriores (no en azteca/islámico)
    if (layer6Intensity > 0.35 && normalizedStyleMode !== "azteca" && normalizedStyleMode !== "islamico") {
      const archCount = petals * 2;
      const archRise = maxRadius * (0.02 + layer6Intensity * 0.03);
      const pearlRadius = _clamp(maxRadius * 0.006 + layer6Intensity * 0.7, 0.5, 1.8);

      for (let i = 0; i < archCount; i++) {
        const a1 = (i / archCount) * Math.PI * 2;
        const a2 = ((i + 1) / archCount) * Math.PI * 2;
        const am = (a1 + a2) / 2;

        const p1 = _polar0(rBase + 1.1, a1, center);
        const p2 = _polar0(rBase + 1.1, a2, center);
        const pArc = _polar0(rBase + archRise + 1.1, am, center);

        pb.moveTo(p1.x, p1.y).quadTo(pArc.x, pArc.y, p2.x, p2.y);

        if (i % 2 === 0) {
          const pearl = _polar0(rTop + 1.6, am, center);
          addCirclePoly(pb, pearl.x, pearl.y, pearlRadius, 8);
        }
      }
    }

    // Islámico: banda de estrellas en el borde
    if (normalizedStyleMode === "islamico" && layer6Intensity > 0.35) {
      const starCount = petals * 2;
      for (let i = 0; i < starCount; i++) {
        const a = ((i + 0.5) / starCount) * Math.PI * 2;
        const sp = _polar0(rBase + (rTop - rBase) * 0.5, a, center);
        addStarPolygon(pb, sp.x, sp.y, 1.4, 0.6, 6, a);
      }
    }

    addCirclePoly(pb, center.x, center.y, rBase, 128);
    paths.push(pb.toPath({ stroke, strokeWidthMm: mainStroke }));
  }

  // ==================== L7: NATURAL / CULTURAL / HOJAS ====================
  if (layer7Intensity > 0.05 && normalizedStyleMode !== "geometric") {
    const pb = new PathBuilder();
    const rInner = maxRadius * 0.45;
    const rOuter = rInner + maxRadius * 0.25 * layer7Intensity;
    const count = petals;

    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (Math.PI / count);
      const p1 = _polar0(rInner, a, center);
      const p2 = _polar0(rOuter, a, center);

      if (normalizedStyleMode === "islamico") {
        // Pequeño octágono decorativo entre los elementos (tesela islámica)
        const pC = _polar0((rInner + rOuter) * 0.5, a, center);
        const dR = (rOuter - rInner) * 0.3 * layer7Intensity;
        addStarPolygon(pb, pC.x, pC.y, dR, dR * 0.42, 8, a);

      } else if (normalizedStyleMode === "azteca") {
        // Elemento escalonado angular (pirámide azteca en perfil)
        const pMid = _polar0((rInner + rOuter) * 0.5, a, center);
        const stepL = _polar0((rInner + rOuter) * 0.5, a - 0.28, center);
        const stepR = _polar0((rInner + rOuter) * 0.5, a + 0.28, center);
        pb.moveTo(p1.x, p1.y).lineTo(stepL.x, stepL.y).lineTo(p2.x, p2.y)
          .lineTo(stepR.x, stepR.y).close();
        // Marca central
        addCapsule(pb, p1.x, p1.y, p2.x, p2.y, fineStroke * 0.5);

      } else if (normalizedStyleMode === "yantra") {
        // Diamante / rombo entre pétalos (energía entre los triángulos)
        const pTop = _polar0(rOuter, a, center);
        const pBot = _polar0(rInner, a, center);
        const pL = _polar0((rInner + rOuter) * 0.5, a - 0.28 * layer7Intensity, center);
        const pR = _polar0((rInner + rOuter) * 0.5, a + 0.28 * layer7Intensity, center);
        pb.moveTo(pTop.x, pTop.y).lineTo(pL.x, pL.y).lineTo(pBot.x, pBot.y)
          .lineTo(pR.x, pR.y).close();

      } else if (normalizedStyleMode === "celtico") {
        // Nudos entrelazados célticos auténticos (trenzado continuo)
        const knotCenter = _polar0((rInner + rOuter) * 0.5, a, center);
        const knotSize = (rOuter - rInner) * 0.45;
        addCelticKnot(pb, knotCenter.x, knotCenter.y, knotSize, knotSize * 0.45, a, 6);

      } else if (normalizedStyleMode === "tibetano") {
        // Símbolos de buena fortuna tibetanos (nudo infinito simplificado)
        const knotCenter = _polar0((rInner + rOuter) * 0.5, a, center);
        const knotR = (rOuter - rInner) * 0.35;
        
        // Nudo infinito (endless knot) simplificado
        for (let loop = 0; loop < 2; loop++) {
          const loopAngle = a + (loop / 2) * Math.PI;
          const loopPt = _polar0(knotR * 0.5, loopAngle, knotCenter);
          addCirclePoly(pb, loopPt.x, loopPt.y, knotR * 0.35, 10);
        }
        // Líneas conectoras en forma de 8
        const pTop = _polar0(knotR, a, knotCenter);
        const pBot = _polar0(knotR, a + Math.PI, knotCenter);
        const pL = _polar0(knotR * 0.6, a - Math.PI/2, knotCenter);
        const pR = _polar0(knotR * 0.6, a + Math.PI/2, knotCenter);
        pb.moveTo(pTop.x, pTop.y).quadTo(pL.x, pL.y, pBot.x, pBot.y);
        pb.moveTo(pTop.x, pTop.y).quadTo(pR.x, pR.y, pBot.x, pBot.y);

      } else {
        // Hoja orgánica (sashiko / floral)
        const cp1 = _polar0(rInner + (rOuter - rInner) * 0.5, a - 0.4 * layer7Intensity, center);
        const cp2 = _polar0(rInner + (rOuter - rInner) * 0.5, a + 0.4 * layer7Intensity, center);
        pb.moveTo(p1.x, p1.y)
          .quadTo(cp1.x, cp1.y, p2.x, p2.y)
          .quadTo(cp2.x, cp2.y, p1.x, p1.y)
          .close();
        addCapsule(pb, p1.x, p1.y, p2.x, p2.y, fineStroke * 0.4);
      }
    }
    paths.push(pb.toPath({ stroke, strokeWidthMm: detailStroke }));
  }

  // ==================== L8: TEXTURAS CULTURALES ====================
  if (layer8Intensity > 0.1) {
    const pb = new PathBuilder();

    if (normalizedStyleMode === "sashiko") {
      // Trama de puntadas: líneas cortas repetitivas en anillos concéntricos
      const ringCount = Math.max(3, Math.round(4 + layer8Intensity * 8));
      for (let ring = 0; ring < ringCount; ring++) {
        const t = ring / Math.max(1, ringCount - 1);
        const rBase = _lerp(maxRadius * 0.2, maxRadius * 0.95, t);
        const stitches = Math.max(24, Math.round(petals * (2.5 + layer8Intensity * 2.5) + ring * 8));
        const stitchLen = maxRadius * (0.012 + layer8Intensity * 0.008);

        for (let i = 0; i < stitches; i++) {
          const a = (i / stitches) * Math.PI * 2 + ((ring % 2) * Math.PI / stitches);
          const jitter = rFloat(rng, -0.6, 0.6);
          const anchor = _polar0(rBase + jitter, a, center);
          const tangent = a + Math.PI / 2;
          const p1 = _polar0(stitchLen * 0.5, tangent, anchor);
          const p2 = _polar0(stitchLen * 0.5, tangent + Math.PI, anchor);
          pb.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y);
        }
      }

    } else if (normalizedStyleMode === "islamico") {
      // Retícula geométrica fina (muqarnas inspirado) - triángulos alternados
      const ringCount = Math.max(3, Math.round(3 + layer8Intensity * 6));
      for (let ring = 0; ring < ringCount; ring++) {
        const t = ring / Math.max(1, ringCount - 1);
        const rB = _lerp(maxRadius * 0.25, maxRadius * 0.92, t);
        const segCount = Math.max(petals * 3, Math.round(petals * (3 + layer8Intensity * 3) + ring * 4));
        for (let i = 0; i < segCount; i++) {
          if (i % 2 !== 0) continue;
          const a1 = (i / segCount) * Math.PI * 2;
          const a2 = ((i + 2) / segCount) * Math.PI * 2;
          const am = (a1 + a2) / 2;
          const p1 = _polar0(rB, a1, center);
          const p2 = _polar0(rB + maxRadius * 0.022, am, center);
          const p3 = _polar0(rB, a2, center);
          pb.moveTo(p1.x, p1.y).lineTo(p2.x, p2.y).lineTo(p3.x, p3.y);
        }
      }

    } else if (normalizedStyleMode === "azteca") {
      // Marcas de calendario: muescas radiales en bandas concéntricas
      const ringCount = Math.max(2, Math.round(2 + layer8Intensity * 5));
      for (let ring = 0; ring < ringCount; ring++) {
        const t = ring / Math.max(1, ringCount - 1);
        const rB = _lerp(maxRadius * 0.3, maxRadius * 0.88, t);
        const notchCount = Math.round(petals * (3 + layer8Intensity * 4));
        const notchLen = maxRadius * (0.014 + layer8Intensity * 0.01);
        for (let i = 0; i < notchCount; i++) {
          const a = (i / notchCount) * Math.PI * 2;
          const pStart = _polar0(rB - notchLen * 0.5, a, center);
          const pEnd = _polar0(rB + notchLen * 0.5, a, center);
          const thick = (i % 4 === 0) ? fineStroke * 1.6 : fineStroke * 0.65;
          addCapsule(pb, pStart.x, pStart.y, pEnd.x, pEnd.y, thick);
        }
      }

    } else if (normalizedStyleMode === "yantra") {
      // Expansión del bindu: anillos concéntricos de puntos (yantra dot matrix)
      const ringCount = Math.max(3, Math.round(4 + layer8Intensity * 8));
      for (let ring = 0; ring < ringCount; ring++) {
        const t = ring / Math.max(1, ringCount - 1);
        const rB = _lerp(maxRadius * 0.2, maxRadius * 0.93, t);
        const dotCount = Math.max(petals * 2, Math.round(petals * (2 + layer8Intensity * 2) + ring * 6));
        for (let i = 0; i < dotCount; i++) {
          const a = (i / dotCount) * Math.PI * 2;
          const p = _polar0(rB, a, center);
          addCirclePoly(pb, p.x, p.y, 0.45, 4);
        }
      }

    } else if (normalizedStyleMode === "celtico") {
      // Textura de nudos y espirales celtas auténticas
      const ringCount = Math.max(3, Math.round(3 + layer8Intensity * 6));
      for (let ring = 0; ring < ringCount; ring++) {
        const t = ring / Math.max(1, ringCount - 1);
        const rB = _lerp(maxRadius * 0.22, maxRadius * 0.92, t);
        const segCount = Math.round(petals * (3 + layer8Intensity * 3) + ring * 6);
        for (let i = 0; i < segCount; i++) {
          const a = (i / segCount) * Math.PI * 2;
          const anchor = _polar0(rB, a, center);
          
          if (i % 3 === 0) {
            // Pequeña espiral céltica
            addCelticSpiral(pb, anchor.x, anchor.y, maxRadius * 0.015, 1.5, ring % 2 === 0);
          } else {
            // Cruz céltica simplificada
            const d = maxRadius * 0.012;
            pb.moveTo(anchor.x - d, anchor.y).lineTo(anchor.x + d, anchor.y);
            pb.moveTo(anchor.x, anchor.y - d).lineTo(anchor.x, anchor.y + d);
          }
        }
      }

    } else if (normalizedStyleMode === "tibetano") {
      // Textura de puntos sagrados y símbolos de buena fortuna
      const ringCount = Math.max(4, Math.round(4 + layer8Intensity * 7));
      for (let ring = 0; ring < ringCount; ring++) {
        const t = ring / Math.max(1, ringCount - 1);
        const rB = _lerp(maxRadius * 0.18, maxRadius * 0.90, t);
        const symbolCount = Math.round(petals * (2.5 + layer8Intensity * 2.5) + ring * 5);
        
        for (let i = 0; i < symbolCount; i++) {
          const a = (i / symbolCount) * Math.PI * 2 + ((ring % 2) * Math.PI / symbolCount);
          const anchor = _polar0(rB, a, center);
          
          if (i % 4 === 0) {
            // Bindu (punto de energía)
            addCirclePoly(pb, anchor.x, anchor.y, 0.55, 6);
          } else if (i % 4 === 1) {
            // Pequeño Vajra simplificado
            const vajraSize = maxRadius * 0.025;
            addCapsule(pb, anchor.x, anchor.y - vajraSize * 0.3, anchor.x, anchor.y + vajraSize * 0.3, vajraSize * 0.15);
            addCirclePoly(pb, anchor.x, anchor.y, vajraSize * 0.18, 8);
          } else if (i % 4 === 2) {
            // Loto pequeño (círculo con pétalos sugeridos)
            addCirclePoly(pb, anchor.x, anchor.y, maxRadius * 0.018, 12);
          } else {
            // Nube de la fortuna (forma de 8 horizontal)
            const cloudR = maxRadius * 0.012;
            addCirclePoly(pb, anchor.x - cloudR, anchor.y, cloudR, 8);
            addCirclePoly(pb, anchor.x + cloudR, anchor.y, cloudR, 8);
          }
        }
      }

    } else {
      // Puntillismo libre (floral / geometric)
      const dotCount = Math.round(complexity * 4 * layer8Intensity);
      for (let i = 0; i < dotCount; i++) {
        const a = rFloat(rng, 0, Math.PI * 2);
        const r = rFloat(rng, maxRadius * 0.1, maxRadius * 0.98);
        const dotX = center.x + Math.cos(a) * r;
        const dotY = center.y + Math.sin(a) * r;
        addCirclePoly(pb, dotX, dotY, 0.4, 4);
      }
    }
    paths.push(pb.toPath({ stroke, strokeWidthMm: fineStroke }));
  }

  // ==================== FRAMES ====================
  if (includeFrames) {
    const pb = new PathBuilder();
    addCirclePoly(pb, center.x, center.y, maxRadius, 128);
    addCirclePoly(pb, center.x, center.y, maxRadius + 3, 128);

    // Islámico: tercer anillo decorativo
    if (normalizedStyleMode === "islamico") {
      addCirclePoly(pb, center.x, center.y, maxRadius + 1.5, 128);
    }
    
    // Tibetano: anillo de fuego protector exterior
    if (normalizedStyleMode === "tibetano") {
      const fireR = maxRadius + 2;
      addTibetanFire(pb, center.x, center.y, fireR, Math.max(16, petals * 2));
      // Anillo concéntrico adicional
      addCirclePoly(pb, center.x, center.y, maxRadius + 4.5, 128);
    }

    paths.push(pb.toPath({ stroke, strokeWidthMm: detailStroke }));
  }

  if (pageBorder) {
    const pb = new PathBuilder();
    pb.moveTo(marginMm, marginMm)
      .lineTo(page.wMm - marginMm, marginMm)
      .lineTo(page.wMm - marginMm, page.hMm - marginMm)
      .lineTo(marginMm, page.hMm - marginMm)
      .close();
    paths.push(pb.toPath({ stroke, strokeWidthMm: mainStroke }));
  }

  paths.forEach(p => {
    if (p) doc.body.push(p);
  });
}
