// js/generators/layers/core.js
import { polar } from "../../core/geometry.js";

export function addCircle(pb, cx, cy, r, seg = 24) {
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

export function addSmoothCircle(pb, cx, cy, r, seg = 12) {
  if (r <= 0.05) return;
  const n = Math.max(4, seg);
  const angleStep = (Math.PI * 2) / n;
  const k = (4 / 3) * Math.tan(angleStep / 4);
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

export function addCapsule(pb, ax, ay, bx, by, w) {
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

export function addStar(pb, cx, cy, rOuter, rInner, n, rot = 0) {
  const total = n * 2;
  for (let i = 0; i < total; i++) {
    const a = (i / total) * Math.PI * 2 + rot;
    const r = i % 2 === 0 ? rOuter : rInner;
    if (i === 0) pb.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    else pb.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  pb.close();
}

export function addPoly(pb, cx, cy, r, n, rot = 0) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rot;
    if (i === 0) pb.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    else pb.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  pb.close();
}

export function addTeardrop(pb, cx, cy, length, width, angle) {
  const tip = polar(length, angle, cx, cy);
  const base = polar(-length * 0.15, angle, cx, cy);
  const cpL = polar(length * 0.55, angle - 0.5, cx, cy);
  const cpR = polar(length * 0.55, angle + 0.5, cx, cy);
  const cpBL = polar(width * 0.3, angle - Math.PI * 0.5, cx, cy);
  const cpBR = polar(width * 0.3, angle + Math.PI * 0.5, cx, cy);
  pb.moveTo(base.x, base.y)
    .cubicTo(cpBL.x, cpBL.y, cpL.x, cpL.y, tip.x, tip.y)
    .cubicTo(cpR.x, cpR.y, cpBR.x, cpBR.y, base.x, base.y)
    .close();
}

export function addPearlRing(pb, cx, cy, r, count, dotR, offset = 0) {
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + offset;
    addCircle(pb, cx + Math.cos(a) * r, cy + Math.sin(a) * r, dotR, 8);
  }
}

export function addScallopRing(pb, cx, cy, r, count, amplitude, outward = true, offset = 0) {
  for (let i = 0; i < count; i++) {
    const a1 = (i / count) * Math.PI * 2 + offset;
    const a2 = ((i + 1) / count) * Math.PI * 2 + offset;
    const aM = (a1 + a2) / 2;
    const p1 = polar(r, a1, cx, cy);
    const p2 = polar(r, a2, cx, cy);
    const cpR = outward ? r + amplitude : r - amplitude;
    const cp = polar(cpR, aM, cx, cy);
    pb.moveTo(p1.x, p1.y).quadTo(cp.x, cp.y, p2.x, p2.y);
  }
}

export function addImageLayer(pb, center, R, points, count, scale = 1.0, strokeWidth) {
  if (!points || points.length === 0) return;

  const radius = R * 0.95;
  const connectThreshSq = 0.016 * 0.016;

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    let prevPoint = null;

    for (const p of points) {
      const px = p.x * radius * scale;
      const py = p.y * radius * scale;

      const rx = px * cosA - py * sinA;
      const ry = px * sinA + py * cosA;

      const nx = center.x + rx;
      const ny = center.y + ry;

      if (prevPoint === null) {
        pb.moveTo(nx, ny);
      } else {
        const dx = p.x - prevPoint.x;
        const dy = p.y - prevPoint.y;
        if (dx * dx + dy * dy <= connectThreshSq) {
          pb.lineTo(nx, ny);
        } else {
          pb.moveTo(nx, ny);
        }
      }
      prevPoint = p;
    }
  }
}
