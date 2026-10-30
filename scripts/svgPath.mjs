// Lector mínimo de SVG para figuras: <path>, <circle>, <ellipse>, <rect>, <polygon>, <polyline> → comandos
// absolutos M/L/Q/C/Z (los que usa el exportador). Cubre lo que producen Illustrator, Inkscape y Figma:
// comandos relativos, H/V, S/T y arcos (convertidos a cúbicas). No aplica `transform` (avisa).
const NUM = /[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g;

// Arco SVG → cúbicas (https://www.w3.org/TR/SVG/implnote.html#ArcConversionEndpointToCenter)
function arcToCubics(x1, y1, rx, ry, phiDeg, fa, fs, x2, y2) {
  if (!rx || !ry || (x1 === x2 && y1 === y2)) return [["L", x2, y2]];
  rx = Math.abs(rx); ry = Math.abs(ry);
  const phi = (phiDeg * Math.PI) / 180, cp = Math.cos(phi), sp = Math.sin(phi);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2, x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
  const sign = fa === fs ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const co = sign * Math.sqrt(Math.max(0, num / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)));
  const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx;
  const cx = cp * cxp - sp * cyp + (x1 + x2) / 2, cy = sp * cxp + cp * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  let th1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry), dth = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dth > 0) dth -= 2 * Math.PI; else if (fs && dth < 0) dth += 2 * Math.PI;
  const n = Math.max(1, Math.ceil(Math.abs(dth) / (Math.PI / 2))), step = dth / n, k = (4 / 3) * Math.tan(step / 4), out = [];
  for (let i = 0; i < n; i++) {
    const a1 = th1 + i * step, a2 = a1 + step, c1 = Math.cos(a1), s1 = Math.sin(a1), c2 = Math.cos(a2), s2 = Math.sin(a2);
    const P = (x, y) => [cp * rx * x - sp * ry * y + cx, sp * rx * x + cp * ry * y + cy];
    const [p1x, p1y] = P(c1 - k * s1, s1 + k * c1), [p2x, p2y] = P(c2 + k * s2, s2 - k * c2), [ex, ey] = P(c2, s2);
    out.push(["C", p1x, p1y, p2x, p2y, ex, ey]);
  }
  return out;
}

export function parseSvgPath(d) {
  const toks = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
  const out = [];
  let i = 0, cmd = "", x = 0, y = 0, sx = 0, sy = 0, lcx = 0, lcy = 0, prev = "";
  const num = () => parseFloat(toks[i++]);
  const flag = () => { const t = toks[i]; if (t.length > 1 && /^[01]/.test(t)) { toks[i] = t.slice(1); return +t[0]; } i++; return +t; }; // flags pegados: «a1 1 0 01.5 2»
  while (i < toks.length) {
    if (/[a-zA-Z]/.test(toks[i])) cmd = toks[i++];
    else if (cmd === "M") cmd = "L"; else if (cmd === "m") cmd = "l";
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === "Z") { out.push(["Z"]); x = sx; y = sy; prev = "Z"; continue; }
    if (C === "M") { x = ox + num(); y = oy + num(); sx = x; sy = y; out.push(["M", x, y]); }
    else if (C === "L") { x = ox + num(); y = oy + num(); out.push(["L", x, y]); }
    else if (C === "H") { x = ox + num(); out.push(["L", x, y]); }
    else if (C === "V") { y = oy + num(); out.push(["L", x, y]); }
    else if (C === "C") { const a = ox + num(), b = oy + num(), c = ox + num(), e = oy + num(); x = ox + num(); y = oy + num(); out.push(["C", a, b, c, e, x, y]); lcx = c; lcy = e; }
    else if (C === "S") { const a = prev === "C" || prev === "S" ? 2 * x - lcx : x, b = prev === "C" || prev === "S" ? 2 * y - lcy : y; const c = ox + num(), e = oy + num(); x = ox + num(); y = oy + num(); out.push(["C", a, b, c, e, x, y]); lcx = c; lcy = e; }
    else if (C === "Q") { const a = ox + num(), b = oy + num(); x = ox + num(); y = oy + num(); out.push(["Q", a, b, x, y]); lcx = a; lcy = b; }
    else if (C === "T") { const a = prev === "Q" || prev === "T" ? 2 * x - lcx : x, b = prev === "Q" || prev === "T" ? 2 * y - lcy : y; x = ox + num(); y = oy + num(); out.push(["Q", a, b, x, y]); lcx = a; lcy = b; }
    else if (C === "A") { const rx = num(), ry = num(), rot = num(), fa = flag(), fs = flag(); const nx = ox + num(), ny = oy + num(); out.push(...arcToCubics(x, y, rx, ry, rot, fa, fs, nx, ny)); x = nx; y = ny; }
    else throw new Error(`comando SVG no reconocido: ${cmd}`);
    prev = C;
  }
  return out;
}

const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)].map((m) => [m[1], m[2]]));
const styleOf = (a) => Object.fromEntries((a.style || "").split(";").map((s) => s.split(":").map((t) => t.trim())).filter((p) => p[0] && p[1]));
const ellipseCmds = (cx, cy, rx, ry) => { const k = 0.5523; return [["M", cx + rx, cy], ["C", cx + rx, cy + ry * k, cx + rx * k, cy + ry, cx, cy + ry], ["C", cx - rx * k, cy + ry, cx - rx, cy + ry * k, cx - rx, cy], ["C", cx - rx, cy - ry * k, cx - rx * k, cy - ry, cx, cy - ry], ["C", cx + rx * k, cy - ry, cx + rx, cy - ry * k, cx + rx, cy], ["Z"]]; };

/** Devuelve [{ cmds, filled, id }] y avisos. `filled`: la forma tiene relleno (fill distinto de none). */
export function parseSvg(text) {
  const shapes = [], warnings = [];
  if (/\btransform\s*=/.test(text)) warnings.push("el SVG usa transform: no se aplica; conviene aplanarlo (en Inkscape/Illustrator: «aplicar transformaciones»)");
  for (const m of text.matchAll(/<(path|circle|ellipse|rect|polygon|polyline)\b([^>]*?)\/?>/gi)) {
    const kind = m[1].toLowerCase(), a = attrs(m[2]), st = styleOf(a), fill = (st.fill ?? a.fill ?? "black").toLowerCase();
    const filled = fill !== "none" && fill !== "transparent";
    const n = (k) => parseFloat(a[k] ?? 0);
    let cmds;
    if (kind === "path") cmds = parseSvgPath(a.d || "");
    else if (kind === "circle") cmds = ellipseCmds(n("cx"), n("cy"), n("r"), n("r"));
    else if (kind === "ellipse") cmds = ellipseCmds(n("cx"), n("cy"), n("rx"), n("ry"));
    else if (kind === "rect") cmds = [["M", n("x"), n("y")], ["L", n("x") + n("width"), n("y")], ["L", n("x") + n("width"), n("y") + n("height")], ["L", n("x"), n("y") + n("height")], ["Z"]];
    else { const p = (a.points || "").match(NUM).map(Number); cmds = []; for (let i = 0; i + 1 < p.length; i += 2) cmds.push([i ? "L" : "M", p[i], p[i + 1]]); if (kind === "polygon") cmds.push(["Z"]); }
    if (cmds.length) shapes.push({ cmds, filled, id: a.id || "" });
  }
  return { shapes, warnings };
}
