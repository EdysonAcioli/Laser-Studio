import type { VectorObject } from "@laser/shared-types";

type Point = { x: number; y: number };
export type PathNode =
  | { type: "M"; x: number; y: number }
  | { type: "L"; x: number; y: number }
  | { type: "Q"; x: number; y: number; cx: number; cy: number }
  | {
      type: "C";
      x: number;
      y: number;
      cx1: number;
      cy1: number;
      cx2: number;
      cy2: number;
    };

type BoundingBox = { x: number; y: number; width: number; height: number };

export function getPathBounds(
  points: PathNode[] | undefined,
): BoundingBox | null {
  if (!points || points.length === 0) {
    return null;
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const controlXs = points.flatMap((point) => {
    if (point.type === "Q") {
      return [point.cx];
    }
    if (point.type === "C") {
      return [point.cx1, point.cx2];
    }
    return [] as number[];
  });
  const controlYs = points.flatMap((point) => {
    if (point.type === "Q") {
      return [point.cy];
    }
    if (point.type === "C") {
      return [point.cy1, point.cy2];
    }
    return [] as number[];
  });

  const allX = xs.concat(controlXs);
  const allY = ys.concat(controlYs);

  return {
    x: Math.min(...allX),
    y: Math.min(...allY),
    width: Math.max(...allX) - Math.min(...allX),
    height: Math.max(...allY) - Math.min(...allY),
  };
}

export function getObjectBounds(object: VectorObject): BoundingBox {
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
    case "line": {
      const x2 = Number(metadata.x2 ?? object.position.x + 80);
      const y2 = Number(metadata.y2 ?? object.position.y);
      return {
        x: Math.min(object.position.x, x2) - 4,
        y: Math.min(object.position.y, y2) - 4,
        width: Math.max(8, Math.abs(x2 - object.position.x)),
        height: Math.max(8, Math.abs(y2 - object.position.y)),
      };
    }
    case "text":
      return {
        x: object.position.x,
        y: object.position.y - 16,
        width: 140,
        height: 20,
      };
    case "path":
    case "bezier": {
      const points = metadata.points as PathNode[] | undefined;
      const bounds = getPathBounds(points);
      if (bounds) {
        return bounds;
      }
      return {
        x: object.position.x,
        y: object.position.y,
        width: 60,
        height: 40,
      };
    }
    default:
      return {
        x: object.position.x,
        y: object.position.y,
        width: 60,
        height: 40,
      };
  }
}

export function translateObject(
  object: VectorObject,
  dx: number,
  dy: number,
): VectorObject {
  const metadata = object.metadata ?? {};
  if (object.type === "line") {
    return {
      ...object,
      position: { x: object.position.x + dx, y: object.position.y + dy },
      metadata: {
        ...metadata,
        x2: Number(metadata.x2 ?? object.position.x + 80) + dx,
        y2: Number(metadata.y2 ?? object.position.y) + dy,
      },
    };
  }

  if (object.type === "path" || object.type === "bezier") {
    const points = metadata.points as PathNode[] | undefined;
    if (!points) {
      return {
        ...object,
        position: { x: object.position.x + dx, y: object.position.y + dy },
      };
    }
    const movedPoints = points.map((point) => {
      if (point.type === "Q") {
        return {
          ...point,
          x: point.x + dx,
          y: point.y + dy,
          cx: point.cx + dx,
          cy: point.cy + dy,
        };
      }
      if (point.type === "C") {
        return {
          ...point,
          x: point.x + dx,
          y: point.y + dy,
          cx1: point.cx1 + dx,
          cy1: point.cy1 + dy,
          cx2: point.cx2 + dx,
          cy2: point.cy2 + dy,
        };
      }
      return { ...point, x: point.x + dx, y: point.y + dy };
    });
    return {
      ...object,
      position: { x: object.position.x + dx, y: object.position.y + dy },
      metadata: {
        ...metadata,
        points: movedPoints,
        d: movedPoints
          .map((point) => {
            if (point.type === "M") {
              return `M ${point.x} ${point.y}`;
            }
            if (point.type === "L") {
              return `L ${point.x} ${point.y}`;
            }
            if (point.type === "Q") {
              return `Q ${point.cx} ${point.cy} ${point.x} ${point.y}`;
            }
            return `C ${point.cx1} ${point.cy1} ${point.cx2} ${point.cy2} ${point.x} ${point.y}`;
          })
          .join(" "),
      },
    };
  }

  return {
    ...object,
    position: { x: object.position.x + dx, y: object.position.y + dy },
  };
}

export function nestObjects(
  objects: VectorObject[],
  workspaceWidth: number,
  workspaceHeight: number,
  padding = 10,
): VectorObject[] {
  const items = objects
    .map((object, index) => ({
      object,
      index,
      bounds: getObjectBounds(object),
    }))
    .sort(
      (a, b) =>
        Math.max(b.bounds.width, b.bounds.height) -
        Math.max(a.bounds.width, a.bounds.height),
    );

  const rows: Array<{ x: number; y: number; height: number }> = [
    { x: padding, y: padding, height: 0 },
  ];
  const placements: Array<{ x: number; y: number } | null> = new Array(
    objects.length,
  ).fill(null);

  items.forEach((item) => {
    let placed = false;
    for (const row of rows) {
      if (row.x + item.bounds.width + padding <= workspaceWidth) {
        placements[item.index] = { x: row.x, y: row.y };
        row.x += item.bounds.width + padding;
        row.height = Math.max(row.height, item.bounds.height + padding);
        placed = true;
        break;
      }
    }

    if (!placed) {
      const nextRowY = rows[rows.length - 1].y + rows[rows.length - 1].height;
      if (nextRowY + item.bounds.height + padding <= workspaceHeight) {
        rows.push({
          x: padding + item.bounds.width + padding,
          y: nextRowY,
          height: item.bounds.height + padding,
        });
        placements[item.index] = { x: padding, y: nextRowY };
      } else {
        placements[item.index] = { x: padding, y: padding };
      }
    }
  });

  return objects.map((object, index) => {
    const placement = placements[index];
    if (!placement) {
      return object;
    }
    const originalBounds = getObjectBounds(object);
    return translateObject(
      object,
      placement.x - originalBounds.x,
      placement.y - originalBounds.y,
    );
  });
}
