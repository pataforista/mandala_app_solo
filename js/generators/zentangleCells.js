// js/generators/zentangleCells.js
import { mulberry32, rFloat } from "../core/prng.js";
import { PathBuilder } from "../core/pathBuilder.js";

/**
 * Zentangle Cells Generator
 * - Uses BSP to create a grid of rectangular cells.
 * - Fills cells with patterns.
 * - Respects the 3-tier stroke hierarchy.
 */
export function generateZentangleCells(doc, opts) {
    const {
        seed,
        areaMm,
        stroke = "#000",
        strokeWidthMm = 0.6,
        complexity = 120,
        organicLevel = 0.5,

        // Zentangle specific
        cellCount = 20,
        minCellSizeMm = 14,
        patternStrokeMm = 0.35,
        cellBorderWidthMm = 0.75,
        minGapMm = 1.4,
        whiteSpaceMm = 1.0,
        innerOrganicBorderEnabled = true,
    } = opts;

    const rng = mulberry32(seed >>> 0);
    const pbMain = new PathBuilder();
    const pbDetail = new PathBuilder();
    const pbFine = new PathBuilder();

    const cells = partitionArea(areaMm, cellCount, minCellSizeMm, rng);

    cells.forEach(cell => {
        drawCell(pbMain, pbDetail, pbFine, cell, {
            rng,
            complexity,
            organicLevel,
            cellBorderWidthMm,
            patternStrokeMm,
            minGapMm,
            whiteSpaceMm,
            innerOrganicBorderEnabled,
            strokeWidthMm
        });
    });

    const mainStroke = Math.max(0.3, strokeWidthMm);
    const detailStroke = Math.max(0.25, patternStrokeMm);
    const fineStroke = detailStroke * 0.6;

    doc.body.push(pbMain.toPath({ stroke, strokeWidthMm: mainStroke }));
    doc.body.push(pbDetail.toPath({ stroke, strokeWidthMm: detailStroke }));
    doc.body.push(pbFine.toPath({ stroke, strokeWidthMm: fineStroke }));
}

function partitionArea(area, targetCount, minSize, rng) {
    let cells = [area];

    while (cells.length < targetCount) {
        // Pick the largest cell to split
        cells.sort((a, b) => (b.w * b.h) - (a.w * a.h));
        const toSplit = cells[0];

        if (toSplit.w < minSize * 2 && toSplit.h < minSize * 2) break;

        const horizontal = toSplit.w > toSplit.h ? false : (toSplit.h > toSplit.w ? true : rng() < 0.5);

        if (!horizontal && toSplit.w < minSize * 2) continue;
        if (horizontal && toSplit.h < minSize * 2) continue;

        const splitIdx = cells.indexOf(toSplit);
        cells.splice(splitIdx, 1);

        if (horizontal) {
            const splitY = rFloat(rng, minSize, toSplit.h - minSize);
            cells.push({ x: toSplit.x, y: toSplit.y, w: toSplit.w, h: splitY });
            cells.push({ x: toSplit.x, y: toSplit.y + splitY, w: toSplit.w, h: toSplit.h - splitY });
        } else {
            const splitX = rFloat(rng, minSize, toSplit.w - minSize);
            cells.push({ x: toSplit.x, y: toSplit.y, w: splitX, h: toSplit.h });
            cells.push({ x: toSplit.x + splitX, y: toSplit.y, w: toSplit.w - splitX, h: toSplit.h });
        }
    }
    return cells;
}

function drawCell(pbMain, pbDetail, pbFine, cell, opts) {
    const { rng, cellBorderWidthMm, organicLevel, innerOrganicBorderEnabled } = opts;

    // Outer border
    const margin = 0.5;
    const rect = {
        x0: cell.x + margin,
        y0: cell.y + margin,
        x1: cell.x + cell.w - margin,
        y1: cell.y + cell.h - margin
    };

    pbMain.moveTo(rect.x0, rect.y0)
        .lineTo(rect.x1, rect.y0)
        .lineTo(rect.x1, rect.y1)
        .lineTo(rect.x0, rect.y1)
        .close();

    // Pattern fill (Simplified for now: Hatching or Stippling)
    const patternType = rng() < 0.5 ? "hatching" : "grid";

    const innerMargin = opts.whiteSpaceMm + (innerOrganicBorderEnabled ? 1.5 : 0);
    const innerRect = {
        x0: rect.x0 + innerMargin,
        y0: rect.y0 + innerMargin,
        x1: rect.x1 - innerMargin,
        y1: rect.y1 - innerMargin
    };

    if (innerRect.x1 > innerRect.x0 && innerRect.y1 > innerRect.y0) {
        if (patternType === "hatching") {
            const spacing = opts.minGapMm * 1.5;
            for (let x = innerRect.x0; x <= innerRect.x1; x += spacing) {
                pbDetail.moveTo(x, innerRect.y0).lineTo(x, innerRect.y1);
            }
        } else {
            const spacing = opts.minGapMm * 2;
            for (let x = innerRect.x0; x <= innerRect.x1; x += spacing) {
                for (let y = innerRect.y0; y <= innerRect.y1; y += spacing) {
                    pbFine.moveTo(x - 0.2, y).lineTo(x + 0.2, y);
                    pbFine.moveTo(x, y - 0.2).lineTo(x, y + 0.2);
                }
            }
        }
    }
}
