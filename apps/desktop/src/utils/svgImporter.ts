import type { VectorObject } from "@laser/shared-types";

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

function parseSvgTranslate(transform?: string | null): {
  x: number;
  y: number;
} {
  if (!transform) return { x: 0, y: 0 };
  const m = transform.match(/translate\(\s*([-\d.]+)[,\s]+([-\d.]+)/);
  return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]) } : { x: 0, y: 0 };
}

function attributeOr(el: Element, attr: string, fallback = "0") {
  return el.getAttribute(attr) ?? fallback;
}

function parseStyle(style: string | null) {
  return Object.fromEntries(
    (style ?? "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const [key, value] = item.split(":");
        return [key.trim(), value.trim()];
      }),
  );
}

function extractVisuals(el: Element) {
  const style = parseStyle(el.getAttribute("style"));
  return {
    stroke: el.getAttribute("stroke") ?? style.stroke ?? "#f97316",
    fill: el.getAttribute("fill") ?? style.fill ?? "none",
  };
}

function accumulateTranslate(el: Element | null): { x: number; y: number } {
  if (!el) return { x: 0, y: 0 };
  const own = parseSvgTranslate(el.getAttribute("transform"));
  const parent = accumulateTranslate(el.parentElement);
  return { x: own.x + parent.x, y: own.y + parent.y };
}

export function importSvgString(
  svgText: string,
  activeLayerId: string,
): VectorObject[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const objects: VectorObject[] = [];

  const base: Omit<VectorObject, "id" | "type" | "position" | "metadata"> = {
    rotation: 0,
    scale: { x: 1, y: 1 },
    stroke: "#f97316",
    fill: "none",
    power: 80,
    speed: 300,
    passes: 1,
    layer: activeLayerId,
    airAssist: false,
    zIndex: objects.length,
  };

  doc.querySelectorAll("rect").forEach((el) => {
    const pos = accumulateTranslate(el);
    const visuals = extractVisuals(el);
    objects.push({
      ...base,
      id: randomId(),
      type: "rectangle",
      stroke: visuals.stroke,
      fill: visuals.fill,
      position: {
        x: pos.x + parseFloat(attributeOr(el, "x")),
        y: pos.y + parseFloat(attributeOr(el, "y")),
      },
      zIndex: objects.length,
      metadata: {
        width: parseFloat(attributeOr(el, "width", "50")),
        height: parseFloat(attributeOr(el, "height", "50")),
      },
    });
  });

  doc.querySelectorAll("circle, ellipse").forEach((el) => {
    const pos = accumulateTranslate(el);
    const cx = parseFloat(attributeOr(el, "cx"));
    const cy = parseFloat(attributeOr(el, "cy"));
    const visuals = extractVisuals(el);
    objects.push({
      ...base,
      id: randomId(),
      type: el.tagName === "circle" ? "circle" : "ellipse",
      stroke: visuals.stroke,
      fill: visuals.fill,
      position: { x: pos.x + cx, y: pos.y + cy },
      zIndex: objects.length,
      metadata: {
        radius: parseFloat(attributeOr(el, "r", "25")),
        radiusX: parseFloat(attributeOr(el, "rx", "25")),
        radiusY: parseFloat(attributeOr(el, "ry", "15")),
      },
    });
  });

  doc.querySelectorAll("line").forEach((el) => {
    const pos = accumulateTranslate(el);
    const visuals = extractVisuals(el);
    objects.push({
      ...base,
      id: randomId(),
      type: "line",
      stroke: visuals.stroke,
      fill: visuals.fill,
      position: {
        x: pos.x + parseFloat(attributeOr(el, "x1")),
        y: pos.y + parseFloat(attributeOr(el, "y1")),
      },
      zIndex: objects.length,
      metadata: {
        x2: parseFloat(attributeOr(el, "x2")),
        y2: parseFloat(attributeOr(el, "y2")),
      },
    });
  });

  doc.querySelectorAll("polyline, polygon").forEach((el) => {
    const pos = accumulateTranslate(el);
    const visuals = extractVisuals(el);
    const points = (el.getAttribute("points") ?? "")
      .trim()
      .split(/\s+/)
      .map((item) => item.split(",").map(Number))
      .filter((item) => item.length === 2 && !Number.isNaN(item[0]) && !Number.isNaN(item[1]));

    if (points.length < 2) return;

    const d = points
      .map(([x, y], index) => `${index === 0 ? "M" : "L"} ${x + pos.x} ${y + pos.y}`)
      .join(" ");

    objects.push({
      ...base,
      id: randomId(),
      type: "path",
      stroke: visuals.stroke,
      fill: visuals.fill,
      position: { x: points[0][0] + pos.x, y: points[0][1] + pos.y },
      zIndex: objects.length,
      metadata: { d: el.tagName === "polygon" ? `${d} Z` : d },
    });
  });

  doc.querySelectorAll("path").forEach((el) => {
    const pos = accumulateTranslate(el);
    const d = el.getAttribute("d") ?? "";
    const firstMove = d.match(/[Mm]\s*([-\d.]+)[,\s]+([-\d.]+)/);
    const fx = firstMove ? parseFloat(firstMove[1]) : 0;
    const fy = firstMove ? parseFloat(firstMove[2]) : 0;
    const visuals = extractVisuals(el);
    objects.push({
      ...base,
      id: randomId(),
      type: "path",
      stroke: visuals.stroke,
      fill: visuals.fill,
      position: { x: pos.x + fx, y: pos.y + fy },
      zIndex: objects.length,
      metadata: { d },
    });
  });

  doc.querySelectorAll("text").forEach((el) => {
    const pos = accumulateTranslate(el);
    const visuals = extractVisuals(el);
    objects.push({
      ...base,
      id: randomId(),
      type: "text",
      stroke: visuals.stroke,
      fill: visuals.fill,
      position: {
        x: pos.x + parseFloat(attributeOr(el, "x")),
        y: pos.y + parseFloat(attributeOr(el, "y")),
      },
      zIndex: objects.length,
      metadata: { text: el.textContent ?? "" },
    });
  });

  return objects;
}
