import type { PathNode } from "@laser/shared-types";

export type Point = { x: number; y: number };

/** Affine matrix in SVG order: [a, b, c, d, e, f]. */
export type Matrix = [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export function multiply(m1: Matrix, m2: Matrix): Matrix {
  const [a1, b1, c1, d1, e1, f1] = m1;
  const [a2, b2, c2, d2, e2, f2] = m2;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

export function applyMatrix(m: Matrix, x: number, y: number): Point {
  return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] };
}

/** Average uniform scale factor of a matrix (used to scale radii / sizes). */
export function matrixScale(m: Matrix): number {
  const sx = Math.hypot(m[0], m[1]);
  const sy = Math.hypot(m[2], m[3]);
  return (sx + sy) / 2 || 1;
}

/** Rotation angle (degrees) encoded in a matrix. */
export function matrixRotation(m: Matrix): number {
  return (Math.atan2(m[1], m[0]) * 180) / Math.PI;
}

export function hasRotationOrSkew(m: Matrix): boolean {
  // Pure translate/scale matrices have b == 0 and c == 0.
  return Math.abs(m[1]) > 1e-6 || Math.abs(m[2]) > 1e-6;
}

const NUM = "[-+]?(?:\\d*\\.\\d+|\\d+\\.?)(?:[eE][-+]?\\d+)?";

/** Parse an SVG/CSS transform attribute into a single combined matrix. */
export function parseTransform(transform?: string | null): Matrix {
  if (!transform) return IDENTITY;
  let matrix: Matrix = IDENTITY;
  const re = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let token: RegExpExecArray | null;
  while ((token = re.exec(transform)) !== null) {
    const name = token[1];
    const args = (token[2].match(new RegExp(NUM, "g")) ?? []).map(Number);
    let local: Matrix = IDENTITY;
    switch (name) {
      case "matrix":
        if (args.length === 6) local = args as Matrix;
        break;
      case "translate":
        local = [1, 0, 0, 1, args[0] ?? 0, args[1] ?? 0];
        break;
      case "scale": {
        const sx = args[0] ?? 1;
        const sy = args.length > 1 ? args[1] : sx;
        local = [sx, 0, 0, sy, 0, 0];
        break;
      }
      case "rotate": {
        const angle = ((args[0] ?? 0) * Math.PI) / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const rot: Matrix = [cos, sin, -sin, cos, 0, 0];
        if (args.length >= 3) {
          const cx = args[1];
          const cy = args[2];
          local = multiply(
            [1, 0, 0, 1, cx, cy],
            multiply(rot, [1, 0, 0, 1, -cx, -cy]),
          );
        } else {
          local = rot;
        }
        break;
      }
      case "skewX":
        local = [1, 0, Math.tan(((args[0] ?? 0) * Math.PI) / 180), 1, 0, 0];
        break;
      case "skewY":
        local = [1, Math.tan(((args[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
        break;
    }
    matrix = multiply(matrix, local);
  }
  return matrix;
}

/** Apply a matrix to every coordinate of a path node list. */
export function transformPathNodes(points: PathNode[], m: Matrix): PathNode[] {
  return points.map((node) => {
    const p = applyMatrix(m, node.x, node.y);
    if (node.type === "Q") {
      const c = applyMatrix(m, node.cx, node.cy);
      return { ...node, x: p.x, y: p.y, cx: c.x, cy: c.y };
    }
    if (node.type === "C") {
      const c1 = applyMatrix(m, node.cx1, node.cy1);
      const c2 = applyMatrix(m, node.cx2, node.cy2);
      return {
        ...node,
        x: p.x,
        y: p.y,
        cx1: c1.x,
        cy1: c1.y,
        cx2: c2.x,
        cy2: c2.y,
      };
    }
    return { ...node, x: p.x, y: p.y };
  });
}

/**
 * Convert an SVG elliptical arc to a sequence of cubic Bézier segments.
 * Based on the endpoint-to-center parameterisation from the SVG spec.
 */
function arcToCubics(
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  phiDeg: number,
  largeArc: boolean,
  sweep: boolean,
  x2: number,
  y2: number,
): Array<{ cx1: number; cy1: number; cx2: number; cy2: number; x: number; y: number }> {
  if (rx === 0 || ry === 0) {
    return [{ cx1: x1, cy1: y1, cx2: x2, cy2: y2, x: x2, y: y2 }];
  }
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const phi = (phiDeg * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  let rxSq = rx * rx;
  let rySq = ry * ry;
  const lambda = (x1p * x1p) / rxSq + (y1p * y1p) / rySq;
  if (lambda > 1) {
    const s = Math.sqrt(lambda);
    rx *= s;
    ry *= s;
    rxSq = rx * rx;
    rySq = ry * ry;
  }

  const sign = largeArc === sweep ? -1 : 1;
  const num = rxSq * rySq - rxSq * y1p * y1p - rySq * x1p * x1p;
  const den = rxSq * y1p * y1p + rySq * x1p * x1p;
  const coef = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (coef * (rx * y1p)) / ry;
  const cyp = (coef * -(ry * x1p)) / rx;
  const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
  const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;

  const angle = (ux: number, uy: number, vx: number, vy: number) => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    let a = Math.acos(Math.min(1, Math.max(-1, dot / len)));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };

  const theta1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = angle(
    (x1p - cxp) / rx,
    (y1p - cyp) / ry,
    (-x1p - cxp) / rx,
    (-y1p - cyp) / ry,
  );
  if (!sweep && dTheta > 0) dTheta -= 2 * Math.PI;
  if (sweep && dTheta < 0) dTheta += 2 * Math.PI;

  const segments = Math.max(1, Math.ceil(Math.abs(dTheta) / (Math.PI / 2)));
  const delta = dTheta / segments;
  const t = (4 / 3) * Math.tan(delta / 4);
  const result = [];
  let theta = theta1;
  for (let i = 0; i < segments; i += 1) {
    const cosT1 = Math.cos(theta);
    const sinT1 = Math.sin(theta);
    const theta2 = theta + delta;
    const cosT2 = Math.cos(theta2);
    const sinT2 = Math.sin(theta2);

    const e = (ct: number, st: number) => ({
      x: cx + cosPhi * rx * ct - sinPhi * ry * st,
      y: cy + sinPhi * rx * ct + cosPhi * ry * st,
    });
    const p1 = e(cosT1, sinT1);
    const p2 = e(cosT2, sinT2);
    const dp1 = {
      x: -rx * cosPhi * sinT1 - ry * sinPhi * cosT1,
      y: -rx * sinPhi * sinT1 + ry * cosPhi * cosT1,
    };
    const dp2 = {
      x: -rx * cosPhi * sinT2 - ry * sinPhi * cosT2,
      y: -rx * sinPhi * sinT2 + ry * cosPhi * cosT2,
    };
    result.push({
      cx1: p1.x + t * dp1.x,
      cy1: p1.y + t * dp1.y,
      cx2: p2.x - t * dp2.x,
      cy2: p2.y - t * dp2.y,
      x: p2.x,
      y: p2.y,
    });
    theta = theta2;
  }
  return result;
}

/**
 * Parse an SVG path `d` attribute into absolute PathNode[] (M/L/Q/C only —
 * arcs are converted to cubics, smooth/relative commands are normalised).
 */
export function parsePathData(d: string): PathNode[] {
  const nodes: PathNode[] = [];
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g);
  if (!tokens) return nodes;

  let i = 0;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let prevCtrlX = 0;
  let prevCtrlY = 0;
  let prevCmd = "";
  let command = "";

  const num = () => Number(tokens[i++]);
  const isCmd = (tok: string) => /^[a-zA-Z]$/.test(tok);

  while (i < tokens.length) {
    if (isCmd(tokens[i])) {
      command = tokens[i];
      i += 1;
    } else if (command === "") {
      break;
    }
    const rel = command === command.toLowerCase();
    const up = command.toUpperCase();

    switch (up) {
      case "M": {
        const x = num() + (rel ? cx : 0);
        const y = num() + (rel ? cy : 0);
        cx = x;
        cy = y;
        sx = x;
        sy = y;
        nodes.push({ type: "M", x, y });
        command = rel ? "l" : "L"; // subsequent pairs are implicit lineto
        break;
      }
      case "L": {
        const x = num() + (rel ? cx : 0);
        const y = num() + (rel ? cy : 0);
        cx = x;
        cy = y;
        nodes.push({ type: "L", x, y });
        break;
      }
      case "H": {
        const x = num() + (rel ? cx : 0);
        cx = x;
        nodes.push({ type: "L", x, y: cy });
        break;
      }
      case "V": {
        const y = num() + (rel ? cy : 0);
        cy = y;
        nodes.push({ type: "L", x: cx, y });
        break;
      }
      case "C": {
        const cx1 = num() + (rel ? cx : 0);
        const cy1 = num() + (rel ? cy : 0);
        const cx2 = num() + (rel ? cx : 0);
        const cy2 = num() + (rel ? cy : 0);
        const x = num() + (rel ? cx : 0);
        const y = num() + (rel ? cy : 0);
        nodes.push({ type: "C", x, y, cx1, cy1, cx2, cy2 });
        prevCtrlX = cx2;
        prevCtrlY = cy2;
        cx = x;
        cy = y;
        break;
      }
      case "S": {
        const reflect = prevCmd === "C" || prevCmd === "S";
        const cx1 = reflect ? 2 * cx - prevCtrlX : cx;
        const cy1 = reflect ? 2 * cy - prevCtrlY : cy;
        const cx2 = num() + (rel ? cx : 0);
        const cy2 = num() + (rel ? cy : 0);
        const x = num() + (rel ? cx : 0);
        const y = num() + (rel ? cy : 0);
        nodes.push({ type: "C", x, y, cx1, cy1, cx2, cy2 });
        prevCtrlX = cx2;
        prevCtrlY = cy2;
        cx = x;
        cy = y;
        break;
      }
      case "Q": {
        const qcx = num() + (rel ? cx : 0);
        const qcy = num() + (rel ? cy : 0);
        const x = num() + (rel ? cx : 0);
        const y = num() + (rel ? cy : 0);
        nodes.push({ type: "Q", x, y, cx: qcx, cy: qcy });
        prevCtrlX = qcx;
        prevCtrlY = qcy;
        cx = x;
        cy = y;
        break;
      }
      case "T": {
        const reflect = prevCmd === "Q" || prevCmd === "T";
        const qcx = reflect ? 2 * cx - prevCtrlX : cx;
        const qcy = reflect ? 2 * cy - prevCtrlY : cy;
        const x = num() + (rel ? cx : 0);
        const y = num() + (rel ? cy : 0);
        nodes.push({ type: "Q", x, y, cx: qcx, cy: qcy });
        prevCtrlX = qcx;
        prevCtrlY = qcy;
        cx = x;
        cy = y;
        break;
      }
      case "A": {
        const rx = num();
        const ry = num();
        const rot = num();
        const large = num() !== 0;
        const sweep = num() !== 0;
        const x = num() + (rel ? cx : 0);
        const y = num() + (rel ? cy : 0);
        const cubics = arcToCubics(cx, cy, rx, ry, rot, large, sweep, x, y);
        cubics.forEach((c) => {
          nodes.push({
            type: "C",
            x: c.x,
            y: c.y,
            cx1: c.cx1,
            cy1: c.cy1,
            cx2: c.cx2,
            cy2: c.cy2,
          });
        });
        cx = x;
        cy = y;
        break;
      }
      case "Z": {
        nodes.push({ type: "L", x: sx, y: sy });
        cx = sx;
        cy = sy;
        break;
      }
      default:
        // Unknown command — consume a token to avoid an infinite loop.
        i += 1;
    }
    prevCmd = up;
  }

  return nodes;
}

function sampleCubic(
  p0: Point,
  c1: Point,
  c2: Point,
  p1: Point,
  segments: number,
): Point[] {
  const out: Point[] = [];
  for (let s = 1; s <= segments; s += 1) {
    const t = s / segments;
    const mt = 1 - t;
    const a = mt * mt * mt;
    const b = 3 * mt * mt * t;
    const c = 3 * mt * t * t;
    const d = t * t * t;
    out.push({
      x: a * p0.x + b * c1.x + c * c2.x + d * p1.x,
      y: a * p0.y + b * c1.y + c * c2.y + d * p1.y,
    });
  }
  return out;
}

function sampleQuadratic(
  p0: Point,
  c: Point,
  p1: Point,
  segments: number,
): Point[] {
  const out: Point[] = [];
  for (let s = 1; s <= segments; s += 1) {
    const t = s / segments;
    const mt = 1 - t;
    out.push({
      x: mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x,
      y: mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y,
    });
  }
  return out;
}

/**
 * Flatten PathNode[] into one polyline per subpath (each subpath begins at an
 * "M" node). Bézier curves are subdivided proportionally to their length.
 */
export function flattenPathNodes(
  points: PathNode[],
  tolerance = 0.4,
): Point[][] {
  const subpaths: Point[][] = [];
  let current: Point[] = [];
  let cursor: Point = { x: 0, y: 0 };

  const pushSub = () => {
    if (current.length > 0) subpaths.push(current);
  };

  points.forEach((node) => {
    if (node.type === "M") {
      pushSub();
      current = [{ x: node.x, y: node.y }];
      cursor = { x: node.x, y: node.y };
      return;
    }
    if (node.type === "L") {
      current.push({ x: node.x, y: node.y });
      cursor = { x: node.x, y: node.y };
      return;
    }
    if (node.type === "Q") {
      const len =
        Math.hypot(node.cx - cursor.x, node.cy - cursor.y) +
        Math.hypot(node.x - node.cx, node.y - node.cy);
      const segs = Math.max(2, Math.ceil(len / Math.max(0.1, tolerance * 12)));
      current.push(
        ...sampleQuadratic(cursor, { x: node.cx, y: node.cy }, node, segs),
      );
      cursor = { x: node.x, y: node.y };
      return;
    }
    // Cubic
    const len =
      Math.hypot(node.cx1 - cursor.x, node.cy1 - cursor.y) +
      Math.hypot(node.cx2 - node.cx1, node.cy2 - node.cy1) +
      Math.hypot(node.x - node.cx2, node.y - node.cy2);
    const segs = Math.max(2, Math.ceil(len / Math.max(0.1, tolerance * 12)));
    current.push(
      ...sampleCubic(
        cursor,
        { x: node.cx1, y: node.cy1 },
        { x: node.cx2, y: node.cy2 },
        node,
        segs,
      ),
    );
    cursor = { x: node.x, y: node.y };
  });
  pushSub();
  return subpaths;
}

/** Bounding box of a list of path nodes (anchors + control points). */
export function pathNodesBounds(points: PathNode[]) {
  const xs: number[] = [];
  const ys: number[] = [];
  points.forEach((node) => {
    xs.push(node.x);
    ys.push(node.y);
    if (node.type === "Q") {
      xs.push(node.cx);
      ys.push(node.cy);
    } else if (node.type === "C") {
      xs.push(node.cx1, node.cx2);
      ys.push(node.cy1, node.cy2);
    }
  });
  if (xs.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
}
