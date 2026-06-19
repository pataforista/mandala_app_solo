// js/generators/layers/styles.js
import { polar } from "../../core/geometry.js";
import { addCircle, addCapsule, addTeardrop } from "./core.js";

/** Compound petal - outer petal with inner nested petal and vein line */
export function addCompoundPetal(pb, center, rIn, rOut, angle, angSpread, hasInner, hasDot, hasVein, fineStroke) {
  const aC = angle;
  const halfSpread = angSpread * 0.45;
  const aL = aC - halfSpread;
  const aR = aC + halfSpread;

  // Outer petal shape
  const pBase = polar(rIn, aC, center.x, center.y);
  const pTip = polar(rOut, aC, center.x, center.y);
  const cpL = polar(rIn + (rOut - rIn) * 0.5, aL, center.x, center.y);
  const cpR = polar(rIn + (rOut - rIn) * 0.5, aR, center.x, center.y);
  pb.moveTo(pBase.x, pBase.y)
    .quadTo(cpL.x, cpL.y, pTip.x, pTip.y)
    .quadTo(cpR.x, cpR.y, pBase.x, pBase.y)
    .close();

  // Inner nested petal
  if (hasInner) {
    const rIn2 = rIn + (rOut - rIn) * 0.2;
    const rOut2 = rIn + (rOut - rIn) * 0.72;
    const cpL2 = polar(rIn2 + (rOut2 - rIn2) * 0.5, aC - halfSpread * 0.55, center.x, center.y);
    const cpR2 = polar(rIn2 + (rOut2 - rIn2) * 0.5, aC + halfSpread * 0.55, center.x, center.y);
    const pBase2 = polar(rIn2, aC, center.x, center.y);
    const pTip2 = polar(rOut2, aC, center.x, center.y);
    pb.moveTo(pBase2.x, pBase2.y)
      .quadTo(cpL2.x, cpL2.y, pTip2.x, pTip2.y)
      .quadTo(cpR2.x, cpR2.y, pBase2.x, pBase2.y)
      .close();
  }

  // Vein line through center
  if (hasVein) {
    const vStart = polar(rIn + (rOut - rIn) * 0.15, aC, center.x, center.y);
    const vEnd = polar(rIn + (rOut - rIn) * 0.88, aC, center.x, center.y);
    addCapsule(pb, vStart.x, vStart.y, vEnd.x, vEnd.y, fineStroke * 0.5);
  }

  // Dot at tip
  if (hasDot) {
    const dotPos = polar(rOut - (rOut - rIn) * 0.08, aC, center.x, center.y);
    addCircle(pb, dotPos.x, dotPos.y, (rOut - rIn) * 0.06, 8);
  }
}

/** Lotus petal - pointed tip with inner curve detail */
export function addLotusPetal(pb, center, rIn, rOut, angle, angSpread) {
  const halfSpread = angSpread * 0.42;
  const pBase1 = polar(rIn, angle - halfSpread * 0.6, center.x, center.y);
  const pBase2 = polar(rIn, angle + halfSpread * 0.6, center.x, center.y);
  const pTip = polar(rOut, angle, center.x, center.y);
  const cpL1 = polar(rIn + (rOut - rIn) * 0.4, angle - halfSpread, center.x, center.y);
  const cpL2 = polar(rIn + (rOut - rIn) * 0.85, angle - halfSpread * 0.3, center.x, center.y);
  const cpR1 = polar(rIn + (rOut - rIn) * 0.85, angle + halfSpread * 0.3, center.x, center.y);
  const cpR2 = polar(rIn + (rOut - rIn) * 0.4, angle + halfSpread, center.x, center.y);
  pb.moveTo(pBase1.x, pBase1.y)
    .cubicTo(cpL1.x, cpL1.y, cpL2.x, cpL2.y, pTip.x, pTip.y)
    .cubicTo(cpR1.x, cpR1.y, cpR2.x, cpR2.y, pBase2.x, pBase2.y)
    .close();

  // Inner detail curve
  const iRIn = rIn + (rOut - rIn) * 0.25;
  const iROut = rIn + (rOut - rIn) * 0.65;
  const iCpL = polar(iRIn + (iROut - iRIn) * 0.5, angle - halfSpread * 0.45, center.x, center.y);
  const iCpR = polar(iRIn + (iROut - iRIn) * 0.5, angle + halfSpread * 0.45, center.x, center.y);
  const iTip = polar(iROut, angle, center.x, center.y);
  const iBase = polar(iRIn, angle, center.x, center.y);
  pb.moveTo(iBase.x, iBase.y)
    .quadTo(iCpL.x, iCpL.y, iTip.x, iTip.y)
    .quadTo(iCpR.x, iCpR.y, iBase.x, iBase.y);
}

/** Heart petal: two rounded lobes meeting at a pointed outer tip */
export function addHeartPetal(pb, center, rIn, rOut, angle, angStep) {
  const span = rOut - rIn;
  const tip = polar(rOut, angle, center.x, center.y);
  const base = polar(rIn + span * 0.18, angle, center.x, center.y);
  const lobeR = rIn + span * 0.6;
  const lh = angStep * 0.22;
  const lobeL = polar(lobeR, angle - lh, center.x, center.y);
  const lobeRgt = polar(lobeR, angle + lh, center.x, center.y);
  const c1 = polar(lobeR + span * 0.1, angle - angStep * 0.34, center.x, center.y);
  const c2 = polar(lobeR + span * 0.1, angle + angStep * 0.34, center.x, center.y);
  pb.moveTo(base.x, base.y)
    .quadTo(c1.x, c1.y, lobeL.x, lobeL.y)
    .quadTo(tip.x, tip.y, lobeRgt.x, lobeRgt.y)
    .quadTo(c2.x, c2.y, base.x, base.y).close();

  // Inner echo for coloring depth
  const iLobeR = rIn + span * 0.47;
  const iL = polar(iLobeR, angle - angStep * 0.19, center.x, center.y);
  const iR = polar(iLobeR, angle + angStep * 0.19, center.x, center.y);
  const ic1 = polar(iLobeR + span * 0.05, angle - angStep * 0.30, center.x, center.y);
  const ic2 = polar(iLobeR + span * 0.05, angle + angStep * 0.30, center.x, center.y);
  const iBase = polar(rIn + span * 0.28, angle, center.x, center.y);
  const iApex = polar(rOut - span * 0.18, angle, center.x, center.y);
  pb.moveTo(iBase.x, iBase.y)
    .quadTo(ic1.x, ic1.y, iL.x, iL.y)
    .quadTo(iApex.x, iApex.y, iR.x, iR.y)
    .quadTo(ic2.x, ic2.y, iBase.x, iBase.y).close();
}

/** Fleur-de-lis petal: narrow central spike with two side bead ornaments */
export function addFleurPetal(pb, center, rIn, rOut, angle, angStep, fineStroke) {
  const span = rOut - rIn;
  const pIn = polar(rIn, angle, center.x, center.y);
  const pOut = polar(rOut, angle, center.x, center.y);
  const midR = rIn + span * 0.72;
  pb.moveTo(pIn.x, pIn.y)
    .quadTo(polar(midR, angle - angStep * 0.22, center.x, center.y).x, polar(midR, angle - angStep * 0.22, center.x, center.y).y, pOut.x, pOut.y)
    .quadTo(polar(midR, angle + angStep * 0.22, center.x, center.y).x, polar(midR, angle + angStep * 0.22, center.x, center.y).y, pIn.x, pIn.y)
    .close();
  const beadR = Math.max(span * 0.08, fineStroke * 2);
  const beadMid = rIn + span * 0.34;
  addCircle(pb, polar(beadMid, angle - angStep * 0.27, center.x, center.y).x, polar(beadMid, angle - angStep * 0.27, center.x, center.y).y, beadR, 12);
  addCircle(pb, polar(beadMid, angle + angStep * 0.27, center.x, center.y).x, polar(beadMid, angle + angStep * 0.27, center.x, center.y).y, beadR, 12);
  addCircle(pb, polar(rIn + span * 0.1, angle, center.x, center.y).x, polar(rIn + span * 0.1, angle, center.x, center.y).y, beadR * 0.75, 10);
}

/** Peacock feather: wide teardrop body with concentric eye and lateral veins */
export function addPeacockPetal(pb, center, rIn, rOut, angle, angStep, fineStroke) {
  const span = rOut - rIn;
  const pIn = polar(rIn, angle, center.x, center.y);
  const pOut = polar(rOut, angle, center.x, center.y);
  const midR = rIn + span * 0.6;
  pb.moveTo(pIn.x, pIn.y)
    .cubicTo(
      polar(rIn + span * 0.2, angle - angStep * 0.1, center.x, center.y).x, polar(rIn + span * 0.2, angle - angStep * 0.1, center.x, center.y).y,
      polar(midR, angle - angStep * 0.4, center.x, center.y).x, polar(midR, angle - angStep * 0.4, center.x, center.y).y,
      pOut.x, pOut.y)
    .cubicTo(
      polar(midR, angle + angStep * 0.4, center.x, center.y).x, polar(midR, angle + angStep * 0.4, center.x, center.y).y,
      polar(rIn + span * 0.2, angle + angStep * 0.1, center.x, center.y).x, polar(rIn + span * 0.2, angle + angStep * 0.1, center.x, center.y).y,
      pIn.x, pIn.y)
    .close();
  const eyeRad = span * 0.14;
  const pEye = polar(rIn + span * 0.74, angle, center.x, center.y);
  addCircle(pb, pEye.x, pEye.y, eyeRad, 12);
  addCircle(pb, pEye.x, pEye.y, eyeRad * 0.45, 8);
  for (const v of [-1, 1]) {
    const va = angle + v * angStep * 0.24;
    addCapsule(pb, polar(rIn + span * 0.3, va, center.x, center.y).x, polar(rIn + span * 0.3, va, center.x, center.y).y,
               polar(rIn + span * 0.62, va, center.x, center.y).x, polar(rIn + span * 0.62, va, center.x, center.y).y, fineStroke * 0.4);
  }
}

/** Spear petal: narrow pointed tribal shape with central vein and cross-notch */
export function addSpearPetal(pb, center, rIn, rOut, angle, angStep, fineStroke) {
  const span = rOut - rIn;
  const pIn = polar(rIn, angle, center.x, center.y);
  const pTip = polar(rOut, angle, center.x, center.y);
  const pL = polar(rIn + span * 0.5, angle - angStep * 0.2, center.x, center.y);
  const pR = polar(rIn + span * 0.5, angle + angStep * 0.2, center.x, center.y);
  pb.moveTo(pIn.x, pIn.y).lineTo(pL.x, pL.y).lineTo(pTip.x, pTip.y).lineTo(pR.x, pR.y).close();
  const pM = polar(rIn + span * 0.68, angle, center.x, center.y);
  addCapsule(pb, pIn.x, pIn.y, pM.x, pM.y, fineStroke * 0.35);
  addCapsule(pb, polar(rIn + span * 0.42, angle - angStep * 0.18, center.x, center.y).x, polar(rIn + span * 0.42, angle - angStep * 0.18, center.x, center.y).y,
             polar(rIn + span * 0.42, angle + angStep * 0.18, center.x, center.y).x, polar(rIn + span * 0.42, angle + angStep * 0.18, center.x, center.y).y,
             fineStroke * 0.3);
}
