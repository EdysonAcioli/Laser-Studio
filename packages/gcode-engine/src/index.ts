import type { VectorObject } from "@laser/shared-types";

export type GCodeFlavor =
  | "grbl"
  | "smoothieware"
  | "marlin"
  | "ruida"
  | "esp32"
  | "laserweb";

type Motion = {
  command: "G0" | "G1";
  x: number;
  y: number;
  feed: number;
  power?: number;
};

type Bounds = { x: number; y: number; width: number; height: number };

function getBounds(object: VectorObject): Bounds {
  const metadata = object.metadata ?? {};
  switch (object.type) {
    case "rectangle":
    case "bitmap":
      return {
        x: object.position.x,
        y: object.position.y,
        width: Number(metadata.width ?? 80) * object.scale.x,
        height: Number(metadata.height ?? 50) * object.scale.y,
      };
    case "circle": {
      const radius = Number(metadata.radius ?? 30) * object.scale.x;
      return {
        x: object.position.x - radius,
        y: object.position.y - radius,
        width: radius * 2,
        height: radius * 2,
      };
    }
    case "ellipse":
      return {
        x: object.position.x - 40 * object.scale.x,
        y: object.position.y - 25 * object.scale.y,
        width: 80 * object.scale.x,
        height: 50 * object.scale.y,
      };
    case "line": {
      const x2 = Number(metadata.x2 ?? object.position.x + 80);
      const y2 = Number(metadata.y2 ?? object.position.y);
      return {
        x: Math.min(object.position.x, x2),
        y: Math.min(object.position.y, y2),
        width: Math.abs(x2 - object.position.x),
        height: Math.abs(y2 - object.position.y),
      };
    }
    default:
      return { x: object.position.x, y: object.position.y, width: 60, height: 40 };
  }
}

function motion(command: Motion["command"], x: number, y: number, feed: number, power?: number): Motion {
  return { command, x, y, feed, power };
}

function emitPolyline(points: Array<{ x: number; y: number }>, speed: number, power: number) {
  if (points.length === 0) {
    return [] as Motion[];
  }

  const motions = [motion("G0", points[0].x, points[0].y, speed)];
  for (let index = 1; index < points.length; index += 1) {
    motions.push(motion("G1", points[index].x, points[index].y, speed, power));
  }
  return motions;
}

function emitRectangleOutline(bounds: Bounds, speed: number, power: number) {
  return emitPolyline(
    [
      { x: bounds.x, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
      { x: bounds.x, y: bounds.y + bounds.height },
      { x: bounds.x, y: bounds.y },
    ],
    speed,
    power,
  );
}

function emitLine(object: VectorObject, speed: number, power: number) {
  const x2 = Number(object.metadata?.x2 ?? object.position.x + 80);
  const y2 = Number(object.metadata?.y2 ?? object.position.y);
  return emitPolyline(
    [
      { x: object.position.x, y: object.position.y },
      { x: x2, y: y2 },
    ],
    speed,
    power,
  );
}

function emitEllipse(object: VectorObject, speed: number, power: number, segments = 36) {
  const bounds = getBounds(object);
  const center = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
  const rx = bounds.width / 2;
  const ry = bounds.height / 2;
  const points = Array.from({ length: segments + 1 }, (_, index) => {
    const angle = (index / segments) * Math.PI * 2;
    return {
      x: center.x + Math.cos(angle) * rx,
      y: center.y + Math.sin(angle) * ry,
    };
  });
  return emitPolyline(points, speed, power);
}

function emitFill(object: VectorObject, speed: number, power: number) {
  const bounds = getBounds(object);
  const step = Number(object.metadata?.fillStep ?? 0.8);
  const overscan = Number(object.metadata?.overscan ?? 3);
  const motions: Motion[] = [];
  let reverse = false;

  for (let y = bounds.y; y <= bounds.y + bounds.height; y += step) {
    const startX = reverse ? bounds.x + bounds.width : bounds.x;
    const endX = reverse ? bounds.x : bounds.x + bounds.width;
    const overscanStart = reverse ? startX + overscan : startX - overscan;
    const overscanEnd = reverse ? endX - overscan : endX + overscan;

    motions.push(motion("G0", overscanStart, y, speed));
    motions.push(motion("G1", startX, y, speed, 0));
    motions.push(motion("G1", endX, y, speed, power));
    motions.push(motion("G1", overscanEnd, y, speed, 0));
    reverse = !reverse;
  }

  return motions;
}

function buildObjectMotions(object: VectorObject) {
  const speed = Math.max(1, object.speed);
  const power = Math.round((object.power / 100) * 1000);
  const passes = Math.max(1, object.passes);
  const layerMode = String(object.metadata?.layerMode ?? "line");
  const motions: Motion[] = [];

  for (let pass = 0; pass < passes; pass += 1) {
    if (layerMode === "fill" || layerMode === "offset-fill" || layerMode === "image") {
      motions.push(...emitFill(object, speed, power));
      continue;
    }

    if (object.type === "rectangle" || object.type === "bitmap") {
      motions.push(...emitRectangleOutline(getBounds(object), speed, power));
      continue;
    }

    if (object.type === "line") {
      motions.push(...emitLine(object, speed, power));
      continue;
    }

    if (object.type === "circle" || object.type === "ellipse") {
      motions.push(...emitEllipse(object, speed, power));
      continue;
    }

    motions.push(
      motion("G0", object.position.x, object.position.y, speed),
      motion("G1", object.position.x, object.position.y, speed, power),
    );
  }

  return motions;
}

function toGcodeLine(item: Motion) {
  const parts = [item.command, `X${item.x.toFixed(3)}`, `Y${item.y.toFixed(3)}`, `F${Math.round(item.feed)}`];
  if (item.command === "G1") {
    parts.push(`S${Math.max(0, Math.round(item.power ?? 0))}`);
  }
  return parts.join(" ");
}

export function generateGcode(
  objects: VectorObject[],
  flavor: GCodeFlavor = "grbl",
) {
  const header = ["; Laser Studio", `; Flavor ${flavor}`, "G21", "G90", "M4"];
  const body = objects.flatMap((object, index) => {
    const motions = buildObjectMotions(object);
    return [`; object ${index} ${object.type}`, ...motions.map(toGcodeLine)];
  });
  const footer = ["M5", "G0 X0 Y0"];

  return [...header, ...body, ...footer].join("\n");
}

export function optimizePath(objects: VectorObject[]) {
  return [...objects].sort(
    (a, b) => a.layer.localeCompare(b.layer) || a.id.localeCompare(b.id),
  );
}

export function estimateJobTime(objects: VectorObject[]) {
  const motions = objects.flatMap((object) => buildObjectMotions(object));
  let totalMinutes = 0;
  let previous = { x: 0, y: 0 };

  motions.forEach((item) => {
    const distance = Math.hypot(item.x - previous.x, item.y - previous.y);
    const feed = Math.max(1, item.feed);
    totalMinutes += distance / feed;
    previous = { x: item.x, y: item.y };
  });

  return totalMinutes;
}
