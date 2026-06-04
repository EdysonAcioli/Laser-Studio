import type { PathNode, VectorObject } from "@laser/shared-types";
import {
  applyMatrix,
  hasRotationOrSkew,
  IDENTITY,
  matrixRotation,
  matrixScale,
  multiply,
  parsePathData,
  parseTransform,
  transformPathNodes,
  type Matrix,
} from "./pathGeometry";

function randomId() {
  return Math.random().toString(36).slice(2, 10);
}

const KAPPA = 0.5522847498307936;

function parseStyle(style: string | null): Record<string, string> {
  return Object.fromEntries(
    (style ?? "")
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const idx = item.indexOf(":");
        return [item.slice(0, idx).trim(), item.slice(idx + 1).trim()];
      })
      .filter(([key]) => key),
  );
}

function extractVisuals(el: Element) {
  const style = parseStyle(el.getAttribute("style"));
  const stroke = el.getAttribute("stroke") ?? style.stroke ?? "#f97316";
  let fill = el.getAttribute("fill") ?? style.fill ?? "none";
  if (fill === "transparent") fill = "none";
  return { stroke: stroke === "none" ? "#f97316" : stroke, fill };
}

function num(el: Element, attr: string, fallback = 0) {
  const value = el.getAttribute(attr);
  if (value == null) return fallback;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Combined matrix from the SVG viewport down to (and including) the element. */
function elementMatrix(el: Element, viewport: Matrix): Matrix {
  const chain: Element[] = [];
  let node: Element | null = el;
  while (node && node.nodeType === 1) {
    chain.unshift(node);
    node = node.parentElement;
  }
  let matrix = viewport;
  chain.forEach((item) => {
    matrix = multiply(matrix, parseTransform(item.getAttribute("transform")));
  });
  return matrix;
}

function viewportMatrix(svg: Element): Matrix {
  const viewBox = svg.getAttribute("viewBox");
  if (!viewBox) return IDENTITY;
  const parts = viewBox.split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return IDENTITY;
  }
  const [minX, minY, vbW, vbH] = parts;
  const width = parseFloat(svg.getAttribute("width") ?? "");
  const height = parseFloat(svg.getAttribute("height") ?? "");
  const scaleX = Number.isFinite(width) && vbW ? width / vbW : 1;
  const scaleY = Number.isFinite(height) && vbH ? height / vbH : 1;
  return [scaleX, 0, 0, scaleY, -minX * scaleX, -minY * scaleY];
}

function ellipsePathNodes(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
): PathNode[] {
  const ox = rx * KAPPA;
  const oy = ry * KAPPA;
  return [
    { type: "M", x: cx + rx, y: cy },
    { type: "C", cx1: cx + rx, cy1: cy + oy, cx2: cx + ox, cy2: cy + ry, x: cx, y: cy + ry },
    { type: "C", cx1: cx - ox, cy1: cy + ry, cx2: cx - rx, cy2: cy + oy, x: cx - rx, y: cy },
    { type: "C", cx1: cx - rx, cy1: cy - oy, cx2: cx - ox, cy2: cy - ry, x: cx, y: cy - ry },
    { type: "C", cx1: cx + ox, cy1: cy - ry, cx2: cx + rx, cy2: cy - oy, x: cx + rx, y: cy },
  ];
}

export function importSvgString(
  svgText: string,
  activeLayerId: string,
): VectorObject[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  if (doc.querySelector("parsererror")) {
    return [];
  }
  const svg = doc.documentElement;
  const viewport = viewportMatrix(svg);
  const objects: VectorObject[] = [];

  const base = (): Omit<VectorObject, "id" | "type" | "position" | "metadata"> => ({
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
  });

  const pushPath = (el: Element, nodes: PathNode[]) => {
    if (nodes.length < 2) return;
    const visuals = extractVisuals(el);
    objects.push({
      ...base(),
      id: randomId(),
      type: "path",
      stroke: visuals.stroke,
      fill: visuals.fill,
      position: { x: 0, y: 0 },
      zIndex: objects.length,
      metadata: { points: nodes, d: nodesToD(nodes) },
    });
  };

  svg.querySelectorAll("rect").forEach((el) => {
    const m = elementMatrix(el, viewport);
    const x = num(el, "x");
    const y = num(el, "y");
    const w = num(el, "width", 50);
    const h = num(el, "height", 50);
    const visuals = extractVisuals(el);
    if (!hasRotationOrSkew(m)) {
      const tl = applyMatrix(m, x, y);
      objects.push({
        ...base(),
        id: randomId(),
        type: "rectangle",
        stroke: visuals.stroke,
        fill: visuals.fill,
        position: tl,
        zIndex: objects.length,
        metadata: { width: w * m[0], height: h * m[3] },
      });
      return;
    }
    pushPath(
      el,
      transformPathNodes(
        [
          { type: "M", x, y },
          { type: "L", x: x + w, y },
          { type: "L", x: x + w, y: y + h },
          { type: "L", x, y: y + h },
          { type: "L", x, y },
        ],
        m,
      ),
    );
  });

  svg.querySelectorAll("circle, ellipse").forEach((el) => {
    const m = elementMatrix(el, viewport);
    const cx = num(el, "cx");
    const cy = num(el, "cy");
    const isCircle = el.tagName.toLowerCase() === "circle";
    const rx = isCircle ? num(el, "r", 25) : num(el, "rx", 25);
    const ry = isCircle ? num(el, "r", 25) : num(el, "ry", 25);
    const visuals = extractVisuals(el);
    if (!hasRotationOrSkew(m)) {
      const center = applyMatrix(m, cx, cy);
      const sx = m[0];
      const sy = m[3];
      if (isCircle && Math.abs(sx - sy) < 1e-6) {
        objects.push({
          ...base(),
          id: randomId(),
          type: "circle",
          stroke: visuals.stroke,
          fill: visuals.fill,
          position: center,
          zIndex: objects.length,
          metadata: { radius: rx * sx },
        });
        return;
      }
      objects.push({
        ...base(),
        id: randomId(),
        type: "ellipse",
        stroke: visuals.stroke,
        fill: visuals.fill,
        position: center,
        zIndex: objects.length,
        metadata: { width: rx * 2 * sx, height: ry * 2 * sy },
      });
      return;
    }
    pushPath(el, transformPathNodes(ellipsePathNodes(cx, cy, rx, ry), m));
  });

  svg.querySelectorAll("line").forEach((el) => {
    const m = elementMatrix(el, viewport);
    const p1 = applyMatrix(m, num(el, "x1"), num(el, "y1"));
    const p2 = applyMatrix(m, num(el, "x2"), num(el, "y2"));
    const visuals = extractVisuals(el);
    objects.push({
      ...base(),
      id: randomId(),
      type: "line",
      stroke: visuals.stroke,
      fill: "none",
      position: p1,
      zIndex: objects.length,
      metadata: { x2: p2.x, y2: p2.y },
    });
  });

  svg.querySelectorAll("polyline, polygon").forEach((el) => {
    const m = elementMatrix(el, viewport);
    const coords = (el.getAttribute("points") ?? "")
      .trim()
      .split(/[\s,]+/)
      .map(Number)
      .filter((n) => Number.isFinite(n));
    const nodes: PathNode[] = [];
    for (let i = 0; i + 1 < coords.length; i += 2) {
      nodes.push({
        type: i === 0 ? "M" : "L",
        x: coords[i],
        y: coords[i + 1],
      });
    }
    if (el.tagName.toLowerCase() === "polygon" && nodes.length > 1) {
      nodes.push({ type: "L", x: nodes[0].x, y: nodes[0].y });
    }
    pushPath(el, transformPathNodes(nodes, m));
  });

  svg.querySelectorAll("path").forEach((el) => {
    const m = elementMatrix(el, viewport);
    const nodes = parsePathData(el.getAttribute("d") ?? "");
    pushPath(el, transformPathNodes(nodes, m));
  });

  svg.querySelectorAll("text").forEach((el) => {
    const m = elementMatrix(el, viewport);
    const pos = applyMatrix(m, num(el, "x"), num(el, "y"));
    const visuals = extractVisuals(el);
    const fontSize = num(el, "font-size", 24) * matrixScale(m) || 24;
    objects.push({
      ...base(),
      id: randomId(),
      type: "text",
      stroke: visuals.stroke,
      fill: visuals.fill === "none" ? visuals.stroke : visuals.fill,
      position: pos,
      rotation: hasRotationOrSkew(m) ? matrixRotation(m) : 0,
      zIndex: objects.length,
      metadata: {
        text: el.textContent?.trim() ?? "",
        fontFamily: el.getAttribute("font-family") ?? "Arial",
        fontSize,
      },
    });
  });

  return objects;
}

function nodesToD(nodes: PathNode[]) {
  return nodes
    .map((node) => {
      if (node.type === "M") return `M ${node.x} ${node.y}`;
      if (node.type === "L") return `L ${node.x} ${node.y}`;
      if (node.type === "Q") return `Q ${node.cx} ${node.cy} ${node.x} ${node.y}`;
      return `C ${node.cx1} ${node.cy1} ${node.cx2} ${node.cy2} ${node.x} ${node.y}`;
    })
    .join(" ");
}
