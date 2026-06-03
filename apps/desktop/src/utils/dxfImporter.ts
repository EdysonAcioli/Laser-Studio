import DxfParser from "dxf-parser";
import type { VectorObject } from "@laser/shared-types";

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

export function importDxfString(dxfText: string, activeLayerId: string): VectorObject[] {
  const parser = new DxfParser();
  const dxf = parser.parseSync(dxfText) as {
    entities?: Array<Record<string, unknown>>;
  };

  const entities = dxf.entities ?? [];
  const objects: VectorObject[] = [];

  entities.forEach((entity) => {
    const base = {
      id: randomId(),
      rotation: 0,
      scale: { x: 1, y: 1 },
      stroke: "#60a5fa",
      fill: "none",
      power: 80,
      speed: 300,
      passes: 1,
      layer: activeLayerId,
      airAssist: false,
      zIndex: objects.length,
    };

    if (entity.type === "LINE") {
      const vertices = entity.vertices as Array<{ x: number; y: number }>;
      if (!vertices?.[0] || !vertices?.[1]) return;
      objects.push({
        ...base,
        type: "line",
        position: { x: vertices[0].x, y: vertices[0].y },
        metadata: { x2: vertices[1].x, y2: vertices[1].y },
      });
      return;
    }

    if (entity.type === "CIRCLE") {
      objects.push({
        ...base,
        type: "circle",
        position: {
          x: Number(entity.center?.x ?? 0),
          y: Number(entity.center?.y ?? 0),
        },
        metadata: { radius: Number(entity.radius ?? 10) },
      });
      return;
    }

    if (entity.type === "ARC") {
      const centerX = Number(entity.center?.x ?? 0);
      const centerY = Number(entity.center?.y ?? 0);
      const radius = Number(entity.radius ?? 10);
      const startAngle = Number(entity.startAngle ?? 0);
      const endAngle = Number(entity.endAngle ?? Math.PI);
      const points = Array.from({ length: 25 }, (_, index) => {
        const t = index / 24;
        const angle = startAngle + (endAngle - startAngle) * t;
        return {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
        };
      });
      const d = points
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
        .join(" ");
      objects.push({
        ...base,
        type: "path",
        position: { x: points[0]?.x ?? centerX, y: points[0]?.y ?? centerY },
        metadata: { d },
      });
      return;
    }

    if (entity.type === "LWPOLYLINE" || entity.type === "POLYLINE") {
      const vertices = (entity.vertices as Array<{ x: number; y: number }>) ?? [];
      if (vertices.length < 2) return;
      const d = vertices
        .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
        .join(" ");
      objects.push({
        ...base,
        type: "path",
        position: { x: vertices[0].x, y: vertices[0].y },
        metadata: { d },
      });
    }
  });

  return objects;
}
