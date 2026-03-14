import { mulberry32, rFloat } from "../core/prng.js";
import { PathBuilder } from "../core/pathBuilder.js";

/**
 * Mandala con arquitectura de capas modulares
 * - 6-8 capas independientes y controlables
 * - Patrón Hashiko (flores, pétalos, hojas) + Geométrico
 * - Blanco y negro para colorear
 */

export function generateMandalaLayers(doc, opts) {
  const {
    seed,
    petals = 12,
    stroke = "#000",
    strokeWidthMm = 0.6,

    // Controles de capas (0-1: intensidad de cada capa)
    layer1Intensity = 0.8,  // Centro/núcleo
    layer2Intensity = 0.8,  // Pétalos internos
    layer3Intensity = 0.7,  // Flores Hashiko
    layer4Intensity = 0.8,  // Anillo geométrico
    layer5Intensity = 0.6,  // Detalles finos
    layer6Intensity = 0.7,  // Borde decorativo
    layer7Intensity = 0.5,  // Elementos naturales (hojas)
    layer8Intensity = 0.4,  // Texturas extras

    // Estilo
    styleMode = "hashiko", // "hashiko" o "geometric"
    organicLevel = 0.5,     // 0 = geométrico, 1 = orgánico
    complexity = 120,        // 20-320

    // Opcionales
    includeFrames = true,
    pageBorder = true,
  } = opts;

  const page = doc?.page ?? { wMm: 210, hMm: 297, marginMm: 10 };
  const marginMm = Number.isFinite(page.marginMm) ? page.marginMm : 10;
  const computedCenter = { x: page.wMm / 2, y: page.hMm / 2 };
  const radiusMm = Math.min(page.wMm, page.hMm) / 2 - marginMm - 10;

  const rng = mulberry32(seed);
  const paths = [];

  // ==================== LAYER 1: NÚCLEO ====================
  if (layer1Intensity > 0.1) {
    const coreRadius = radiusMm * 0.08 * layer1Intensity;
    const coreCircle = new PathBuilder()
      .moveTo(computedCenter.x + coreRadius, computedCenter.y)
      .cubicTo(
        computedCenter.x + coreRadius, computedCenter.y + coreRadius * 0.55,
        computedCenter.x + coreRadius * 0.55, computedCenter.y + coreRadius,
        computedCenter.x, computedCenter.y + coreRadius
      )
      .cubicTo(
        computedCenter.x - coreRadius * 0.55, computedCenter.y + coreRadius,
        computedCenter.x - coreRadius, computedCenter.y + coreRadius * 0.55,
        computedCenter.x - coreRadius, computedCenter.y
      )
      .cubicTo(
        computedCenter.x - coreRadius, computedCenter.y - coreRadius * 0.55,
        computedCenter.x - coreRadius * 0.55, computedCenter.y - coreRadius,
        computedCenter.x, computedCenter.y - coreRadius
      )
      .cubicTo(
        computedCenter.x + coreRadius * 0.55, computedCenter.y - coreRadius,
        computedCenter.x + coreRadius, computedCenter.y - coreRadius * 0.55,
        computedCenter.x + coreRadius, computedCenter.y
      )
      .close();

    paths.push(coreCircle.toPath({ stroke, strokeWidthMm }));
  }

  // ==================== LAYER 2: PÉTALOS INTERNOS ====================
  if (layer2Intensity > 0.1) {
    const petalRadius = radiusMm * 0.15;
    const petalCount = Math.round(petals * 0.8);

    for (let i = 0; i < petalCount; i++) {
      const angle = (i / petalCount) * Math.PI * 2;
      const x = computedCenter.x + Math.cos(angle) * radiusMm * 0.12;
      const y = computedCenter.y + Math.sin(angle) * radiusMm * 0.12;

      const petal = new PathBuilder()
        .moveTo(x + petalRadius * 0.3 * layer2Intensity, y)
        .cubicTo(
          x + petalRadius * 0.5 * layer2Intensity, y + petalRadius * 0.3 * layer2Intensity,
          x + petalRadius * 0.5 * layer2Intensity, y - petalRadius * 0.3 * layer2Intensity,
          x + petalRadius * 0.3 * layer2Intensity, y
        )
        .close();
      paths.push(petal.toPath({ stroke, strokeWidthMm }));
    }
  }

  // ==================== LAYER 3: FLORES HASHIKO ====================
  if (layer3Intensity > 0.1 && styleMode === "hashiko") {
    const flowerRadius = radiusMm * 0.25;
    const flowerCount = Math.max(6, Math.round(petals * 0.6));

    for (let i = 0; i < flowerCount; i++) {
      const angle = (i / flowerCount) * Math.PI * 2;
      const distance = radiusMm * 0.35;
      const centerX = computedCenter.x + Math.cos(angle) * distance;
      const centerY = computedCenter.y + Math.sin(angle) * distance;

      // Flor con 5 pétalos (estilo Hashiko)
      const petalCount = 5;
      for (let p = 0; p < petalCount; p++) {
        const petalAngle = (p / petalCount) * Math.PI * 2;
        const petalX = centerX + Math.cos(petalAngle) * (flowerRadius * 0.15 * layer3Intensity);
        const petalY = centerY + Math.sin(petalAngle) * (flowerRadius * 0.15 * layer3Intensity);

        // Círculo de pétalo
        const petalDim = flowerRadius * 0.08 * layer3Intensity;
        const petal = new PathBuilder()
          .moveTo(petalX + petalDim, petalY)
          .cubicTo(
            petalX + petalDim, petalY + petalDim * 0.55,
            petalX + petalDim * 0.55, petalY + petalDim,
            petalX, petalY + petalDim
          )
          .cubicTo(
            petalX - petalDim * 0.55, petalY + petalDim,
            petalX - petalDim, petalY + petalDim * 0.55,
            petalX - petalDim, petalY
          )
          .cubicTo(
            petalX - petalDim, petalY - petalDim * 0.55,
            petalX - petalDim * 0.55, petalY - petalDim,
            petalX, petalY - petalDim
          )
          .cubicTo(
            petalX + petalDim * 0.55, petalY - petalDim,
            petalX + petalDim, petalY - petalDim * 0.55,
            petalX + petalDim, petalY
          )
          .close();
        paths.push(petal.toPath({ stroke, strokeWidthMm }));
      }

      // Centro de la flor
      const centerDim = flowerRadius * 0.06 * layer3Intensity;
      const centerFlower = new PathBuilder()
        .moveTo(centerX + centerDim, centerY)
        .cubicTo(
          centerX + centerDim, centerY + centerDim * 0.55,
          centerX + centerDim * 0.55, centerY + centerDim,
          centerX, centerY + centerDim
        )
        .cubicTo(
          centerX - centerDim * 0.55, centerY + centerDim,
          centerX - centerDim, centerY + centerDim * 0.55,
          centerX - centerDim, centerY
        )
        .cubicTo(
          centerX - centerDim, centerY - centerDim * 0.55,
          centerX - centerDim * 0.55, centerY - centerDim,
          centerX, centerY - centerDim
        )
        .cubicTo(
          centerX + centerDim * 0.55, centerY - centerDim,
          centerX + centerDim, centerY - centerDim * 0.55,
          centerX + centerDim, centerY
        )
        .close();
      paths.push(centerFlower.toPath({ stroke, strokeWidthMm }));
    }
  }

  // ==================== LAYER 4: ANILLO GEOMÉTRICO ====================
  if (layer4Intensity > 0.1) {
    const ringRadius = radiusMm * 0.55;
    const ringThickness = radiusMm * 0.05;
    const segmentCount = Math.max(12, petals);

    for (let i = 0; i < segmentCount; i++) {
      const angle1 = (i / segmentCount) * Math.PI * 2;
      const angle2 = ((i + 1) / segmentCount) * Math.PI * 2;

      const x1a = computedCenter.x + Math.cos(angle1) * ringRadius;
      const y1a = computedCenter.y + Math.sin(angle1) * ringRadius;
      const x1b = computedCenter.x + Math.cos(angle1) * (ringRadius - ringThickness);
      const y1b = computedCenter.y + Math.sin(angle1) * (ringRadius - ringThickness);

      const x2a = computedCenter.x + Math.cos(angle2) * ringRadius;
      const y2a = computedCenter.y + Math.sin(angle2) * ringRadius;
      const x2b = computedCenter.x + Math.cos(angle2) * (ringRadius - ringThickness);
      const y2b = computedCenter.y + Math.sin(angle2) * (ringRadius - ringThickness);

      const ring = new PathBuilder()
        .moveTo(x1a, y1a)
        .lineTo(x2a, y2a)
        .lineTo(x2b, y2b)
        .lineTo(x1b, y1b)
        .close();

      paths.push(ring.toPath({ stroke, strokeWidthMm }));
    }
  }

  // ==================== LAYER 5: DETALLES FINOS ====================
  if (layer5Intensity > 0.1) {
    const detailRadius = radiusMm * 0.65;
    const detailCount = Math.round(petals * 1.5);

    for (let i = 0; i < detailCount; i++) {
      const angle = (i / detailCount) * Math.PI * 2;
      const x = computedCenter.x + Math.cos(angle) * detailRadius;
      const y = computedCenter.y + Math.sin(angle) * detailRadius;
      const size = radiusMm * 0.04 * layer5Intensity;

      const detail = new PathBuilder()
        .moveTo(x + size, y)
        .lineTo(x, y + size)
        .lineTo(x - size, y)
        .lineTo(x, y - size)
        .close();

      paths.push(detail.toPath({ stroke, strokeWidthMm }));
    }
  }

  // ==================== LAYER 6: BORDE DECORATIVO ====================
  if (layer6Intensity > 0.1) {
    const borderRadius = radiusMm * 0.85;
    const borderHeight = radiusMm * 0.08;
    const borderSegments = Math.round(petals * 2);

    for (let i = 0; i < borderSegments; i++) {
      const angle1 = (i / borderSegments) * Math.PI * 2;
      const angle2 = ((i + 1) / borderSegments) * Math.PI * 2;

      const r1 = borderRadius;
      const r2 = borderRadius + borderHeight * layer6Intensity;

      const x1a = computedCenter.x + Math.cos(angle1) * r1;
      const y1a = computedCenter.y + Math.sin(angle1) * r1;
      const x1b = computedCenter.x + Math.cos(angle1) * r2;
      const y1b = computedCenter.y + Math.sin(angle1) * r2;

      const x2a = computedCenter.x + Math.cos(angle2) * r1;
      const y2a = computedCenter.y + Math.sin(angle2) * r1;
      const x2b = computedCenter.x + Math.cos(angle2) * r2;
      const y2b = computedCenter.y + Math.sin(angle2) * r2;

      const border = new PathBuilder()
        .moveTo(x1a, y1a)
        .lineTo(x1b, y1b)
        .lineTo(x2b, y2b)
        .lineTo(x2a, y2a)
        .close();

      paths.push(border.toPath({ stroke, strokeWidthMm }));
    }
  }

  // ==================== LAYER 7: HOJAS (NATURAL) ====================
  if (layer7Intensity > 0.1 && styleMode === "hashiko") {
    const leafRadius = radiusMm * 0.45;
    const leafCount = Math.round(petals * 0.5);

    for (let i = 0; i < leafCount; i++) {
      const angle = (i / leafCount) * Math.PI * 2;
      const x = computedCenter.x + Math.cos(angle) * leafRadius;
      const y = computedCenter.y + Math.sin(angle) * leafRadius;

      const leafSize = radiusMm * 0.05 * layer7Intensity;
      const leafAngle = angle + Math.PI / 4;

      const leaf = new PathBuilder()
        .moveTo(x, y)
        .cubicTo(
          x + Math.cos(leafAngle) * leafSize * 0.5,
          y + Math.sin(leafAngle) * leafSize * 0.5,
          x + Math.cos(leafAngle) * leafSize * 0.7,
          y + Math.sin(leafAngle) * leafSize * 0.7,
          x + Math.cos(leafAngle) * leafSize,
          y + Math.sin(leafAngle) * leafSize
        )
        .cubicTo(
          x + Math.cos(leafAngle + Math.PI * 0.3) * leafSize * 0.4,
          y + Math.sin(leafAngle + Math.PI * 0.3) * leafSize * 0.4,
          x + Math.cos(leafAngle - Math.PI * 0.3) * leafSize * 0.4,
          y + Math.sin(leafAngle - Math.PI * 0.3) * leafSize * 0.4,
          x,
          y
        )
        .close();

      paths.push(leaf.toPath({ stroke, strokeWidthMm }));
    }
  }

  // ==================== LAYER 8: TEXTURAS EXTRAS ====================
  if (layer8Intensity > 0.1) {
    const textureRadius = radiusMm * 0.7;
    const textureCount = Math.round(complexity * 0.3 * layer8Intensity);

    for (let i = 0; i < textureCount; i++) {
      const randAngle = rFloat(rng, 0, Math.PI * 2);
      const randDist = rFloat(rng, radiusMm * 0.2, textureRadius);
      const x = computedCenter.x + Math.cos(randAngle) * randDist;
      const y = computedCenter.y + Math.sin(randAngle) * randDist;
      const dotSize = radiusMm * 0.02;

      const dot = new PathBuilder()
        .moveTo(x + dotSize, y)
        .cubicTo(
          x + dotSize, y + dotSize * 0.55,
          x + dotSize * 0.55, y + dotSize,
          x, y + dotSize
        )
        .cubicTo(
          x - dotSize * 0.55, y + dotSize,
          x - dotSize, y + dotSize * 0.55,
          x - dotSize, y
        )
        .cubicTo(
          x - dotSize, y - dotSize * 0.55,
          x - dotSize * 0.55, y - dotSize,
          x, y - dotSize
        )
        .cubicTo(
          x + dotSize * 0.55, y - dotSize,
          x + dotSize, y - dotSize * 0.55,
          x + dotSize, y
        )
        .close();

      paths.push(dot.toPath({ stroke, strokeWidthMm }));
    }
  }

  // ==================== FRAMES Y BORDES ====================
  if (includeFrames) {
    const frameInner = radiusMm * 0.95;
    const frameOuter = radiusMm * 1.0;
    const frame = new PathBuilder()
      .moveTo(computedCenter.x + frameInner, computedCenter.y)
      .cubicTo(
        computedCenter.x + frameInner, computedCenter.y + frameInner * 0.55,
        computedCenter.x + frameInner * 0.55, computedCenter.y + frameInner,
        computedCenter.x, computedCenter.y + frameInner
      )
      .cubicTo(
        computedCenter.x - frameInner * 0.55, computedCenter.y + frameInner,
        computedCenter.x - frameInner, computedCenter.y + frameInner * 0.55,
        computedCenter.x - frameInner, computedCenter.y
      )
      .cubicTo(
        computedCenter.x - frameInner, computedCenter.y - frameInner * 0.55,
        computedCenter.x - frameInner * 0.55, computedCenter.y - frameInner,
        computedCenter.x, computedCenter.y - frameInner
      )
      .cubicTo(
        computedCenter.x + frameInner * 0.55, computedCenter.y - frameInner,
        computedCenter.x + frameInner, computedCenter.y - frameInner * 0.55,
        computedCenter.x + frameInner, computedCenter.y
      )
      .close();
    paths.push(frame.toPath({ stroke, strokeWidthMm }));
  }

  if (pageBorder) {
    const pagePath = new PathBuilder()
      .moveTo(marginMm, marginMm)
      .lineTo(page.wMm - marginMm, marginMm)
      .lineTo(page.wMm - marginMm, page.hMm - marginMm)
      .lineTo(marginMm, page.hMm - marginMm)
      .close();
    paths.push(pagePath.toPath({ stroke, strokeWidthMm }));
  }

  // ==================== ADD PATHS TO DOC ====================
  paths.forEach(pathSvg => {
    if (pathSvg && pathSvg.trim()) {
      doc.paths.push(pathSvg);
    }
  });
}
