import DxfParser from "dxf-parser";
import type { PathNode, VectorObject } from "@laser/shared-types";

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

type Pt = { x: number; y: number };

type Shape =
  | { kind: "circle"; c: Pt; r: number }
  | { kind: "polyline"; pts: Pt[]; closed: boolean }
  | { kind: "text"; pos: Pt; height: number; text: string };

const ENTITY_COLOR = "#60a5fa";

function n(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Sample the circular arc described by a polyline bulge between two points. */
function bulgePoints(p1: Pt, p2: Pt, bulge: number): Pt[] {
  if (!bulge) return [p2];
  const theta = 4 * Math.atan(bulge);
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const chord = Math.hypot(dx, dy);
  if (chord === 0) return [p2];
  const radius = chord / 2 / Math.sin(Math.abs(theta) / 2);
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  const apothem = radius * Math.cos(theta / 2);
  const dir = bulge > 0 ? 1 : -1;
  const nx = -dy / chord;
  const ny = dx / chord;
  const center = {
    x: mid.x + nx * apothem * dir,
    y: mid.y + ny * apothem * dir,
  };
  const start = Math.atan2(p1.y - center.y, p1.x - center.x);
  const segments = Math.max(2, Math.ceil((Math.abs(theta) / (Math.PI / 2)) * 6));
  const pts: Pt[] = [];
  for (let i = 1; i <= segments; i += 1) {
    const a = start + (theta * i) / segments;
    pts.push({
      x: center.x + Math.cos(a) * radius,
      y: center.y + Math.sin(a) * radius,
    });
  }
  return pts;
}

function arcPoints(
  cx: number,
  cy: number,
  r: number,
  startDeg: number,
  endDeg: number,
): Pt[] {
  let start = (startDeg * Math.PI) / 180;
  let end = (endDeg * Math.PI) / 180;
  if (end <= start) end += Math.PI * 2;
  const segments = Math.max(2, Math.ceil(((end - start) / (Math.PI * 2)) * 64));
  const pts: Pt[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const a = start + ((end - start) * i) / segments;
    pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
  }
  return pts;
}

function ellipsePoints(entity: Record<string, unknown>): Pt[] {
  const center = entity.center as Pt | undefined;
  const major = entity.majorAxisEndPoint as Pt | undefined;
  if (!center || !major) return [];
  const ratio = n(entity.axisRatio, 1);
  const majorLen = Math.hypot(major.x, major.y);
  const minorLen = majorLen * ratio;
  const rot = Math.atan2(major.y, major.x);
  let start = n(entity.startAngle, 0);
  let end = n(entity.endAngle, Math.PI * 2);
  if (end <= start) end += Math.PI * 2;
  const segments = Math.max(8, Math.ceil(((end - start) / (Math.PI * 2)) * 64));
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const pts: Pt[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const a = start + ((end - start) * i) / segments;
    const ex = Math.cos(a) * majorLen;
    const ey = Math.sin(a) * minorLen;
    pts.push({
      x: center.x + ex * cos - ey * sin,
      y: center.y + ex * sin + ey * cos,
    });
  }
  return pts;
}

export function importDxfString(
  dxfText: string,
  activeLayerId: string,
): VectorObject[] {
  const parser = new DxfParser();
  let dxf: { entities?: Array<Record<string, unknown>> } | null = null;
  try {
    dxf = parser.parseSync(dxfText) as unknown as {
      entities?: Array<Record<string, unknown>>;
    };
  } catch {
    return [];
  }

  const entities = dxf?.entities ?? [];
  const shapes: Shape[] = [];

  entities.forEach((entity) => {
    const type = String(entity.type ?? "");
    switch (type) {
      case "LINE": {
        const v = entity.vertices as Pt[] | undefined;
        if (v?.[0] && v?.[1]) {
          shapes.push({ kind: "polyline", pts: [v[0], v[1]], closed: false });
        }
        break;
      }
      case "CIRCLE": {
        const c = entity.center as Pt | undefined;
        if (c) shapes.push({ kind: "circle", c, r: n(entity.radius, 10) });
        break;
      }
      case "ARC": {
        const c = entity.center as Pt | undefined;
        if (c) {
          shapes.push({
            kind: "polyline",
            pts: arcPoints(
              c.x,
              c.y,
              n(entity.radius, 10),
              n(entity.startAngle, 0),
              n(entity.endAngle, 360),
            ),
            closed: false,
          });
        }
        break;
      }
      case "ELLIPSE": {
        const pts = ellipsePoints(entity);
        if (pts.length >= 2) {
          shapes.push({ kind: "polyline", pts, closed: false });
        }
        break;
      }
      case "LWPOLYLINE":
      case "POLYLINE": {
        const verts =
          (entity.vertices as Array<Pt & { bulge?: number }>) ?? [];
        if (verts.length < 2) break;
        const closed = Boolean(entity.closed) || n(entity.shape) === 1;
        const pts: Pt[] = [{ x: verts[0].x, y: verts[0].y }];
        for (let i = 0; i < verts.length - 1; i += 1) {
          const bulge = n(verts[i].bulge, 0);
          if (bulge) {
            pts.push(...bulgePoints(verts[i], verts[i + 1], bulge));
          } else {
            pts.push({ x: verts[i + 1].x, y: verts[i + 1].y });
          }
        }
        if (closed) {
          const lastBulge = n(verts[verts.length - 1].bulge, 0);
          if (lastBulge) {
            pts.push(...bulgePoints(verts[verts.length - 1], verts[0], lastBulge));
          } else {
            pts.push({ x: verts[0].x, y: verts[0].y });
          }
        }
        shapes.push({ kind: "polyline", pts, closed });
        break;
      }
      case "SPLINE": {
        const fit = entity.fitPoints as Pt[] | undefined;
        const control = entity.controlPoints as Pt[] | undefined;
        const source = fit && fit.length >= 2 ? fit : control;
        if (source && source.length >= 2) {
          shapes.push({
            kind: "polyline",
            pts: source.map((p) => ({ x: p.x, y: p.y })),
            closed: Boolean(entity.closed),
          });
        }
        break;
      }
      case "SOLID":
      case "3DFACE": {
        const v = entity.vertices as Pt[] | undefined;
        if (v && v.length >= 3) {
          shapes.push({
            kind: "polyline",
            pts: v.map((p) => ({ x: p.x, y: p.y })),
            closed: true,
          });
        }
        break;
      }
      case "TEXT":
      case "MTEXT": {
        const pos = (entity.startPoint ?? entity.position) as Pt | undefined;
        const text = String(entity.text ?? "");
        if (pos && text) {
          shapes.push({
            kind: "text",
            pos,
            height: n(entity.textHeight ?? entity.height, 12),
            text,
          });
        }
        break;
      }
      default:
        break;
    }
  });

  // DXF uses a Y-up coordinate system; flip into the canvas' Y-down space so
  // imported geometry is not rendered upside-down.
  let maxY = -Infinity;
  const consider = (p: Pt) => {
    if (p.y > maxY) maxY = p.y;
  };
  shapes.forEach((shape) => {
    if (shape.kind === "circle") consider(shape.c);
    else if (shape.kind === "text") consider(shape.pos);
    else shape.pts.forEach(consider);
  });
  if (!Number.isFinite(maxY)) maxY = 0;
  const flip = (p: Pt): Pt => ({ x: p.x, y: maxY - p.y });

  const objects: VectorObject[] = [];
  const base = () => ({
    rotation: 0,
    scale: { x: 1, y: 1 },
    stroke: ENTITY_COLOR,
    fill: "none",
    power: 80,
    speed: 300,
    passes: 1,
    layer: activeLayerId,
    airAssist: false,
    zIndex: objects.length,
  });

  shapes.forEach((shape) => {
    if (shape.kind === "circle") {
      const c = flip(shape.c);
      objects.push({
        ...base(),
        id: randomId(),
        type: "circle",
        position: c,
        metadata: { radius: shape.r },
      });
      return;
    }
    if (shape.kind === "text") {
      const pos = flip(shape.pos);
      objects.push({
        ...base(),
        id: randomId(),
        type: "text",
        stroke: ENTITY_COLOR,
        fill: ENTITY_COLOR,
        position: pos,
        metadata: { text: shape.text, fontSize: shape.height, fontFamily: "Arial" },
      });
      return;
    }
    const flipped = shape.pts.map(flip);
    if (flipped.length === 2) {
      objects.push({
        ...base(),
        id: randomId(),
        type: "line",
        position: flipped[0],
        metadata: { x2: flipped[1].x, y2: flipped[1].y },
      });
      return;
    }
    const nodes: PathNode[] = flipped.map((p, index) => ({
      type: index === 0 ? "M" : "L",
      x: p.x,
      y: p.y,
    }));
    objects.push({
      ...base(),
      id: randomId(),
      type: "path",
      position: { x: 0, y: 0 },
      metadata: {
        points: nodes,
        d: nodes
          .map((node) => `${node.type} ${node.x} ${node.y}`)
          .join(" "),
      },
    });
  });

  return objects;
}
