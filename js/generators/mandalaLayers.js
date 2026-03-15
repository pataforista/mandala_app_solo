import { mulberry32, rFloat } from "../core/prng.js";
import { PathBuilder } from "../core/pathBuilder.js";

/**
 * Mandala con arquitectura de capas modulares - VERSION PREMIUM
 * - 8 capas independientes y controlables
 * - Dual style modes: Hashiko (flores) & Geometric
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

export function generateMandalaLayers(doc, opts) {
  const {
    seed,
    petals = 12,
    stroke = "#000",
    strokeWidthMm = 0.6,

    // Intensidades (0-1)
    layer1Intensity = 0.8, // Núcleo
    layer2Intensity = 0.8, // Pétalos Int.
    layer3Intensity = 0.7, // Flores / Hashiko
    layer4Intensity = 0.8, // Anillo Geom.
    layer5Intensity = 0.6, // Detalles Finos
    layer6Intensity = 0.7, // Borde Decor.
    layer7Intensity = 0.5, // Natural / Hojas
    layer8Intensity = 0.4, // Texturas

    styleMode = "hashiko",
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
    paths.push(pb.toPath({ stroke, strokeWidthMm: mainStroke }));
  }

  // ==================== L3: HASHIKO FLOWERS / GEOMETRIC ====================
  if (layer3Intensity > 0.05) {
    const pb = new PathBuilder();
    const rMid = maxRadius * 0.4;
    const fSize = maxRadius * 0.12 * layer3Intensity;
    const count = Math.max(6, Math.round(petals / 2));
    
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      const fCenter = _polar0(rMid, a, center);
      
      if (styleMode === "hashiko") {
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
      } else {
        const gCount = 8;
        pb.moveTo(fCenter.x + fSize, fCenter.y);
        for (let j = 1; j < gCount; j++) {
          const ga = (j / gCount) * Math.PI * 2;
          pb.lineTo(fCenter.x + Math.cos(ga) * fSize, fCenter.y + Math.sin(ga) * fSize);
        }
        pb.close();
        addCapsule(pb, fCenter.x - fSize, fCenter.y, fCenter.x + fSize, fCenter.y, fineStroke);
        addCapsule(pb, fCenter.x, fCenter.y - fSize, fCenter.x, fCenter.y + fSize, fineStroke);
      }
    }
    paths.push(pb.toPath({ stroke, strokeWidthMm: detailStroke }));
  }

  // ==================== L4: ANILLO GEOMETRICO ====================
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
      
      if (styleMode === "geometric") {
        pb.moveTo(p1a.x, p1a.y).lineTo(pM.x, pM.y).lineTo(p2a.x, p2a.y);
      } else {
        pb.moveTo(p1a.x, p1a.y).quadTo(pM.x, pM.y, p2a.x, p2a.y);
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
      
      pb.moveTo(pL.x, pL.y)
        .quadTo(_polar0(rTop * 0.95, aC - 0.2, center).x, _polar0(rTop * 0.95, aC - 0.2, center).y, pTop.x, pTop.y)
        .quadTo(_polar0(rTop * 0.95, aC + 0.2, center).x, _polar0(rTop * 0.95, aC + 0.2, center).y, pR.x, pR.y);
        
      if (layer6Intensity > 0.7) {
        addCirclePoly(pb, pTop.x, pTop.y, 2, 8);
      }
    }
    addCirclePoly(pb, center.x, center.y, rBase, 128);
    paths.push(pb.toPath({ stroke, strokeWidthMm: mainStroke }));
  }

  // ==================== L7: NATURAL / HOJAS ====================
  if (layer7Intensity > 0.05 && styleMode === "hashiko") {
    const pb = new PathBuilder();
    const rInner = maxRadius * 0.45;
    const rOuter = rInner + maxRadius * 0.25 * layer7Intensity;
    const count = petals;
    
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (Math.PI / count);
      const p1 = _polar0(rInner, a, center);
      const p2 = _polar0(rOuter, a, center);
      
      const cp1 = _polar0(rInner + (rOuter - rInner) * 0.5, a - 0.4 * layer7Intensity, center);
      const cp2 = _polar0(rInner + (rOuter - rInner) * 0.5, a + 0.4 * layer7Intensity, center);
      
      pb.moveTo(p1.x, p1.y)
        .quadTo(cp1.x, cp1.y, p2.x, p2.y)
        .quadTo(cp2.x, cp2.y, p1.x, p1.y)
        .close();
        
      addCapsule(pb, p1.x, p1.y, p2.x, p2.y, fineStroke * 0.4);
    }
    paths.push(pb.toPath({ stroke, strokeWidthMm: detailStroke }));
  }

  // ==================== L8: TEXTURAS ====================
  if (layer8Intensity > 0.1) {
    const pb = new PathBuilder();
    const dotCount = Math.round(complexity * 4 * layer8Intensity);
    for (let i = 0; i < dotCount; i++) {
      const a = rFloat(rng, 0, Math.PI * 2);
      const r = rFloat(rng, maxRadius * 0.1, maxRadius * 0.98);
      const dotX = center.x + Math.cos(a) * r;
      const dotY = center.y + Math.sin(a) * r;
      addCirclePoly(pb, dotX, dotY, 0.4, 4);
    }
    paths.push(pb.toPath({ stroke, strokeWidthMm: fineStroke }));
  }

  // ==================== FRAMES ====================
  if (includeFrames) {
    const pb = new PathBuilder();
    addCirclePoly(pb, center.x, center.y, maxRadius, 128);
    addCirclePoly(pb, center.x, center.y, maxRadius + 3, 128);
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

  paths.forEach(p => { if (p) doc.paths.push(p); });
}
