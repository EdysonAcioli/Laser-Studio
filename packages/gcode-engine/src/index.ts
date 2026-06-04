import type { PathNode, VectorObject } from "@laser/shared-types";

export type GCodeFlavor =
  | "grbl"
  | "smoothieware"
  | "marlin"
  | "ruida"
  | "esp32"
  | "laserweb";

export interface GCodeOptions {
  /** PWM value that maps to 100% power (S parameter at full power). */
  pwmMax: number;
  /** Rapid (travel) feed rate in mm/min, used for G0 moves and estimates. */
  rapidRate: number;
}

const DEFAULT_OPTIONS: GCodeOptions = { pwmMax: 1000, rapidRate: 6000 };

type Point = { x: number; y: number };

type Motion = {
  command: "G0" | "G1";
  x: number;
  y: number;
  feed: number;
  power: number;
};

function motion(
  command: Motion["command"],
  x: number,
  y: number,
  feed: number,
  power = 0,
): Motion {
  return { command, x, y, feed, power };
}

function rotatePoint(p: Point, pivot: Point, angleDeg: number): Point {
  if (!angleDeg) return p;
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = p.x - pivot.x;
  const dy = p.y - pivot.y;
  return {
    x: pivot.x + dx * cos - dy * sin,
    y: pivot.y + dx * sin + dy * cos,
  };
}

function sampleCubic(p0: Point, c1: Point, c2: Point, p1: Point, segs: number) {
  const out: Point[] = [];
  for (let s = 1; s <= segs; s += 1) {
    const t = s / segs;
    const mt = 1 - t;
    out.push({
      x: mt * mt * mt * p0.x + 3 * mt * mt * t * c1.x + 3 * mt * t * t * c2.x + t * t * t * p1.x,
      y: mt * mt * mt * p0.y + 3 * mt * mt * t * c1.y + 3 * mt * t * t * c2.y + t * t * t * p1.y,
    });
  }
  return out;
}

function sampleQuadratic(p0: Point, c: Point, p1: Point, segs: number) {
  const out: Point[] = [];
  for (let s = 1; s <= segs; s += 1) {
    const t = s / segs;
    const mt = 1 - t;
    out.push({
      x: mt * mt * p0.x + 2 * mt * t * c.x + t * t * p1.x,
      y: mt * mt * p0.y + 2 * mt * t * c.y + t * t * p1.y,
    });
  }
  return out;
}

/** Flatten PathNode[] into one polyline per subpath. */
function flattenNodes(points: PathNode[]): Point[][] {
  const subpaths: Point[][] = [];
  let current: Point[] = [];
  let cursor: Point = { x: 0, y: 0 };
  const flush = () => {
    if (current.length > 0) subpaths.push(current);
  };
  points.forEach((node) => {
    if (node.type === "M") {
      flush();
      current = [{ x: node.x, y: node.y }];
      cursor = node;
    } else if (node.type === "L") {
      current.push({ x: node.x, y: node.y });
      cursor = node;
    } else if (node.type === "Q") {
      const len =
        Math.hypot(node.cx - cursor.x, node.cy - cursor.y) +
        Math.hypot(node.x - node.cx, node.y - node.cy);
      current.push(
        ...sampleQuadratic(
          cursor,
          { x: node.cx, y: node.cy },
          node,
          Math.max(2, Math.ceil(len / 4)),
        ),
      );
      cursor = node;
    } else {
      const len =
        Math.hypot(node.cx1 - cursor.x, node.cy1 - cursor.y) +
        Math.hypot(node.cx2 - node.cx1, node.cy2 - node.cy1) +
        Math.hypot(node.x - node.cx2, node.y - node.cy2);
      current.push(
        ...sampleCubic(
          cursor,
          { x: node.cx1, y: node.cy1 },
          { x: node.cx2, y: node.cy2 },
          node,
          Math.max(3, Math.ceil(len / 4)),
        ),
      );
      cursor = node;
    }
  });
  flush();
  return subpaths;
}

/** Minimal `d` parser used only as a fallback when no node list is present. */
function parseDFallback(d: string): Point[][] {
  const subpaths: Point[][] = [];
  let current: Point[] = [];
  const tokens = d.match(/[MLHVZ]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/gi);
  if (!tokens) return subpaths;
  let i = 0;
  let cmd = "";
  let cx = 0;
  let cy = 0;
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) {
      cmd = tokens[i++].toUpperCase();
    }
    if (cmd === "M") {
      if (current.length) subpaths.push(current);
      cx = Number(tokens[i++]);
      cy = Number(tokens[i++]);
      current = [{ x: cx, y: cy }];
    } else if (cmd === "L") {
      cx = Number(tokens[i++]);
      cy = Number(tokens[i++]);
      current.push({ x: cx, y: cy });
    } else if (cmd === "H") {
      cx = Number(tokens[i++]);
      current.push({ x: cx, y: cy });
    } else if (cmd === "V") {
      cy = Number(tokens[i++]);
      current.push({ x: cx, y: cy });
    } else if (cmd === "Z") {
      if (current[0]) current.push({ ...current[0] });
    } else {
      i += 1;
    }
  }
  if (current.length) subpaths.push(current);
  return subpaths;
}

/**
 * Produce the absolute-world outline of an object as one or more polylines,
 * with the object's rotation applied. Returns an empty array for objects that
 * cannot be engraved as vectors (e.g. bare text).
 */
function objectOutline(object: VectorObject): Point[][] {
  const metadata = object.metadata ?? {};
  const pivot = object.position;
  const rot = (pts: Point[]) =>
    object.rotation ? pts.map((p) => rotatePoint(p, pivot, object.rotation)) : pts;

  switch (object.type) {
    case "rectangle":
    case "bitmap": {
      const w = Number(metadata.width ?? 80) * object.scale.x;
      const h = Number(metadata.height ?? 50) * object.scale.y;
      const x = object.position.x;
      const y = object.position.y;
      return [
        rot([
          { x, y },
          { x: x + w, y },
          { x: x + w, y: y + h },
          { x, y: y + h },
          { x, y },
        ]),
      ];
    }
    case "circle": {
      const r = Number(metadata.radius ?? 30) * object.scale.x;
      const segs = Math.max(24, Math.ceil(r));
      const pts: Point[] = [];
      for (let i = 0; i <= segs; i += 1) {
        const a = (i / segs) * Math.PI * 2;
        pts.push({
          x: object.position.x + Math.cos(a) * r,
          y: object.position.y + Math.sin(a) * r,
        });
      }
      return [pts];
    }
    case "ellipse": {
      const rx = (Number(metadata.width ?? 80) / 2) * object.scale.x;
      const ry = (Number(metadata.height ?? 50) / 2) * object.scale.y;
      const segs = Math.max(32, Math.ceil(Math.max(rx, ry)));
      const pts: Point[] = [];
      for (let i = 0; i <= segs; i += 1) {
        const a = (i / segs) * Math.PI * 2;
        pts.push({
          x: object.position.x + Math.cos(a) * rx,
          y: object.position.y + Math.sin(a) * ry,
        });
      }
      return [rot(pts)];
    }
    case "line": {
      const x2 = Number(metadata.x2 ?? object.position.x + 80);
      const y2 = Number(metadata.y2 ?? object.position.y);
      return [rot([{ x: object.position.x, y: object.position.y }, { x: x2, y: y2 }])];
    }
    case "path":
    case "bezier": {
      const nodes = metadata.points as PathNode[] | undefined;
      const subpaths =
        nodes && nodes.length
          ? flattenNodes(nodes)
          : parseDFallback(String(metadata.d ?? "")).map((sp) =>
              sp.map((p) => ({ x: p.x + object.position.x, y: p.y + object.position.y })),
            );
      return subpaths.map(rot);
    }
    default:
      return [];
  }
}

function emitStroke(subpaths: Point[][], speed: number, power: number, rapid: number) {
  const motions: Motion[] = [];
  subpaths.forEach((pts) => {
    if (pts.length < 2) return;
    motions.push(motion("G0", pts[0].x, pts[0].y, rapid));
    for (let i = 1; i < pts.length; i += 1) {
      motions.push(motion("G1", pts[i].x, pts[i].y, speed, power));
    }
  });
  return motions;
}

/** Scanline (raster) fill clipped to the actual closed outline of the object. */
function emitFill(
  subpaths: Point[][],
  speed: number,
  power: number,
  rapid: number,
  step: number,
  overscan: number,
) {
  const edges: Array<[Point, Point]> = [];
  let minY = Infinity;
  let maxY = -Infinity;
  subpaths.forEach((pts) => {
    if (pts.length < 2) return;
    for (let i = 0; i < pts.length; i += 1) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      edges.push([a, b]);
      minY = Math.min(minY, a.y);
      maxY = Math.max(maxY, a.y);
    }
  });
  if (!Number.isFinite(minY) || edges.length === 0) return [];

  const motions: Motion[] = [];
  let reverse = false;
  for (let y = minY + step / 2; y < maxY; y += step) {
    const xs: number[] = [];
    edges.forEach(([a, b]) => {
      if (a.y === b.y) return;
      if (y >= Math.min(a.y, b.y) && y < Math.max(a.y, b.y)) {
        xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
    });
    if (xs.length < 2) continue;
    xs.sort((p, q) => p - q);
    const spans: Array<[number, number]> = [];
    for (let i = 0; i + 1 < xs.length; i += 2) {
      spans.push([xs[i], xs[i + 1]]);
    }
    if (reverse) spans.reverse();
    spans.forEach(([x1, x2]) => {
      const startX = reverse ? x2 : x1;
      const endX = reverse ? x1 : x2;
      const dir = endX >= startX ? 1 : -1;
      motions.push(motion("G0", startX - dir * overscan, y, rapid));
      motions.push(motion("G1", startX, y, speed, 0));
      motions.push(motion("G1", endX, y, speed, power));
      motions.push(motion("G1", endX + dir * overscan, y, speed, 0));
    });
    reverse = !reverse;
  }
  return motions;
}

function buildObjectMotions(object: VectorObject, options: GCodeOptions): Motion[] {
  const speed = Math.max(1, object.speed);
  const power = Math.round((object.power / 100) * options.pwmMax);
  const passes = Math.max(1, object.passes);
  const mode = String(object.metadata?.layerMode ?? "line");
  const subpaths = objectOutline(object);
  if (subpaths.length === 0) return [];

  const step = Number(object.metadata?.fillStep ?? 0.4);
  const overscan = Number(object.metadata?.overscan ?? 2);
  const motions: Motion[] = [];
  for (let pass = 0; pass < passes; pass += 1) {
    if (mode === "fill" || mode === "offset-fill" || mode === "image") {
      motions.push(...emitFill(subpaths, speed, power, options.rapidRate, step, overscan));
    } else {
      motions.push(...emitStroke(subpaths, speed, power, options.rapidRate));
    }
  }
  return motions;
}

function header(flavor: GCodeFlavor) {
  const spindle = flavor === "marlin" || flavor === "ruida" ? "M3" : "M4";
  return ["; Laser Studio", `; Flavor ${flavor}`, "G21", "G90", "G92 X0 Y0", spindle];
}

function toGcodeLine(item: Motion) {
  const parts = [
    item.command,
    `X${item.x.toFixed(3)}`,
    `Y${item.y.toFixed(3)}`,
    `F${Math.round(item.feed)}`,
  ];
  if (item.command === "G1") {
    parts.push(`S${Math.max(0, Math.round(item.power))}`);
  }
  return parts.join(" ");
}

export function generateGcode(
  objects: VectorObject[],
  flavor: GCodeFlavor = "grbl",
  options: Partial<GCodeOptions> = {},
) {
  const opts: GCodeOptions = { ...DEFAULT_OPTIONS, ...options };
  const body = objects.flatMap((object, index) => {
    const motions = buildObjectMotions(object, opts);
    if (motions.length === 0) return [];
    return [
      `; object ${index} ${object.type} (${object.power}% @ ${object.speed}mm/min)`,
      ...motions.map(toGcodeLine),
    ];
  });
  const footer = ["M5", `G0 X0 Y0 F${opts.rapidRate}`];
  return [...header(flavor), ...body, ...footer].join("\n");
}

export function optimizePath(objects: VectorObject[]) {
  return [...objects].sort(
    (a, b) => a.layer.localeCompare(b.layer) || a.zIndex - b.zIndex,
  );
}

export function estimateJobTime(
  objects: VectorObject[],
  options: Partial<GCodeOptions> = {},
) {
  const opts: GCodeOptions = { ...DEFAULT_OPTIONS, ...options };
  const motions = objects.flatMap((object) => buildObjectMotions(object, opts));
  let totalMinutes = 0;
  let previous = { x: 0, y: 0 };
  motions.forEach((item) => {
    const distance = Math.hypot(item.x - previous.x, item.y - previous.y);
    const feed = item.command === "G0" ? opts.rapidRate : Math.max(1, item.feed);
    totalMinutes += distance / feed;
    previous = { x: item.x, y: item.y };
  });
  return totalMinutes;
}
