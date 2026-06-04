import { useCallback, useEffect, useRef, useState } from "react";
import { useCanvasStore } from "../stores/useCanvasStore";
import { useLayerStore } from "../stores/useLayerStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { nestObjects } from "../utils/nesting";
import type { VectorObject } from "@laser/shared-types";

const GRID_MINOR = 20;
const GRID_MAJOR = 100;
const HANDLE_SIZE = 8;
const WORKSPACE_WIDTH = 600;
const WORKSPACE_HEIGHT = 400;

type Point = { x: number; y: number };
type ResizeHandle = "nw" | "ne" | "sw" | "se";

// Clipboard shared across the editor session for copy/paste.
let clipboard: VectorObject | null = null;
type PathNode =
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

type NodeHandle = "anchor" | "control" | "control1" | "control2";

type InteractionState =
  | { type: "idle" }
  | { type: "pan"; startClient: Point; startPan: Point }
  | {
      type: "draw";
      tool: "rectangle" | "circle" | "ellipse" | "line" | "measure";
      start: Point;
      current: Point;
    }
  | {
      type: "draw-path";
      tool: "path" | "bezier";
      points: PathNode[];
      current: Point;
    }
  | {
      type: "text";
      point: Point;
      value: string;
    }
  | {
      type: "edit-node";
      objectId: string;
      nodeIndex: number;
      handle: NodeHandle;
      basePoints: PathNode[];
      startPoint: Point;
    }
  | {
      type: "move";
      objectId: string;
      start: Point;
      baseObjects: VectorObject[];
    }
  | {
      type: "resize";
      objectId: string;
      handle: ResizeHandle;
      baseObjects: VectorObject[];
    };

export function EditorCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageCacheRef = useRef(new Map<string, HTMLImageElement>());
  const selectedTool = useCanvasStore((state) => state.selectedTool);
  const objects = useCanvasStore((state) => state.objects);
  const setObjects = useCanvasStore((state) => state.setObjects);
  const setObjectsSilently = useCanvasStore(
    (state) => state.setObjectsSilently,
  );
  const activeObjectId = useCanvasStore((state) => state.activeObjectId);
  const addObject = useCanvasStore((state) => state.addObject);
  const setActiveObjectId = useCanvasStore((state) => state.setActiveObjectId);
  const snapToGrid = useCanvasStore((state) => state.snapToGrid);
  const setSnapToGrid = useCanvasStore((state) => state.setSnapToGrid);
  const setCursorWorld = useCanvasStore((state) => state.setCursorWorld);
  const setSelectedTool = useCanvasStore((state) => state.setSelectedTool);
  const layers = useLayerStore((state) => state.layers);
  const activeLayerId = useLayerStore((state) => state.activeLayerId);
  const { cameraOffsetX, cameraOffsetY, workspaceWidth, workspaceHeight } =
    useSettingsStore((state) => state.machineConfig);

  const panRef = useRef<Point>({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const [zoom, setZoom] = useState(1);
  const [interaction, setInteraction] = useState<InteractionState>({
    type: "idle",
  });

  const activeObject =
    objects.find((object) => object.id === activeObjectId) ?? null;
  const activeLayer = layers.find((item) => item.id === activeLayerId);
  const defaultFill = activeLayer?.mode === "fill" ? activeLayer.color : "none";
  const defaultStroke = activeLayer?.color || "#f97316";

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const { width, height } = canvas;
    const pan = panRef.current;
    const zoomLevel = zoomRef.current;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#0d1117";
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoomLevel, zoomLevel);

    drawGrid(ctx, width, height, pan, zoomLevel);
    drawCameraOverlay(
      ctx,
      cameraOffsetX,
      cameraOffsetY,
      width,
      height,
      zoomLevel,
    );

    ctx.strokeStyle = "#2a4060";
    ctx.lineWidth = 1.5 / zoomLevel;
    ctx.strokeRect(0, 0, workspaceWidth, workspaceHeight);
    ctx.fillStyle = "rgba(30,50,80,0.07)";
    ctx.fillRect(0, 0, workspaceWidth, workspaceHeight);

    objects.forEach((object) => {
      const layer = layers.find((item) => item.id === object.layer);
      if (layer?.visible === false) {
        return;
      }

      const objectColor = layer?.color || "#f97316";
      ctx.strokeStyle = object.id === activeObjectId ? "#f8fafc" : objectColor;
      ctx.lineWidth = (object.id === activeObjectId ? 2 : 1.4) / zoomLevel;
      ctx.fillStyle =
        object.fill && object.fill !== "none" ? object.fill : "transparent";
      drawObject(
        ctx,
        object,
        zoomLevel,
        imageCacheRef.current,
        draw,
        activeObjectId,
        objectColor,
      );

      if (object.id === activeObjectId) {
        drawSelection(
          ctx,
          getObjectBounds(object),
          zoomLevel,
          object.rotation,
          object.position,
        );
      }
    });

    if (interaction.type === "draw" || interaction.type === "draw-path") {
      drawPreview(ctx, interaction, zoomLevel);
    }

    ctx.restore();
  }, [
    activeObjectId,
    cameraOffsetX,
    cameraOffsetY,
    workspaceWidth,
    workspaceHeight,
    interaction,
    layers,
    objects,
  ]);

  useEffect(() => {
    draw();
  }, [draw]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) {
      return;
    }

    const resize = () => {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      draw();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    return () => observer.disconnect();
  }, [draw]);

  const onWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      const prevZoom = zoomRef.current;
      const nextZoom = Math.max(
        0.15,
        Math.min(8, prevZoom * (event.deltaY < 0 ? 1.1 : 0.9)),
      );

      panRef.current.x =
        mouseX - ((mouseX - panRef.current.x) * nextZoom) / prevZoom;
      panRef.current.y =
        mouseY - ((mouseY - panRef.current.y) * nextZoom) / prevZoom;
      zoomRef.current = nextZoom;
      setZoom(nextZoom);
      draw();
    },
    [draw],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  const onMouseDown = (event: React.MouseEvent) => {
    const point = getWorldPoint(
      event,
      canvasRef.current,
      panRef.current,
      zoomRef.current,
    );

    if (selectedTool === "pan" || event.button === 1) {
      setInteraction({
        type: "pan",
        startClient: { x: event.clientX, y: event.clientY },
        startPan: { ...panRef.current },
      });
      return;
    }

    if (selectedTool === "text") {
      setInteraction({ type: "text", point, value: "" });
      setActiveObjectId(null);
      return;
    }

    if (
      selectedTool === "rectangle" ||
      selectedTool === "circle" ||
      selectedTool === "ellipse" ||
      selectedTool === "line" ||
      selectedTool === "measure"
    ) {
      setInteraction({
        type: "draw",
        tool: selectedTool,
        start: point,
        current: point,
      });
      setActiveObjectId(null);
      return;
    }

    if (selectedTool === "path" || selectedTool === "bezier") {
      event.preventDefault();
      const continuing =
        interaction.type === "draw-path" && interaction.tool === selectedTool;
      const nextPoint: PathNode = !continuing
        ? { type: "M", x: point.x, y: point.y }
        : selectedTool === "path"
          ? { type: "L", x: point.x, y: point.y }
          : createBezierSegment(
              interaction.points[interaction.points.length - 1],
              point,
            );
      const newPoints = continuing
        ? [...interaction.points, nextPoint]
        : [nextPoint];

      const shouldClose =
        continuing &&
        newPoints.length >= 2 &&
        isClosePoint(point, interaction.points[0], 12);

      if (shouldClose) {
        const created = createObjectFromPath(
          { ...interaction, points: newPoints, current: point },
          activeLayerId,
          objects.length,
          defaultStroke,
          defaultFill,
        );
        addObject(created);
        setInteraction({ type: "idle" });
        return;
      }

      if (continuing) {
        setInteraction({
          type: "draw-path",
          tool: selectedTool,
          points: newPoints,
          current: point,
        });
      } else {
        setInteraction({
          type: "draw-path",
          tool: selectedTool,
          points: newPoints,
          current: point,
        });
        setActiveObjectId(null);
      }
      return;
    }

    const hit =
      [...objects].reverse().find((object) => {
        const layer = layers.find((item) => item.id === object.layer);
        return layer?.visible !== false && hitTestObject(point, object);
      }) ?? null;

    if (selectedTool === "offset") {
      const target = hit ?? activeObject;
      if (target) {
        const amountString = window.prompt("Distância de offset (mm)", "5");
        const amount = Number(amountString);
        if (!Number.isFinite(amount) || amount === 0) {
          return;
        }
        const offsetObject = createOffsetObject(target, amount, objects.length);
        if (offsetObject) {
          addObject(offsetObject);
        }
        if (hit) {
          setActiveObjectId(hit.id);
        }
        return;
      }
    }

    if (selectedTool === "node") {
      const target = hit ?? activeObject;
      if (target && (target.type === "path" || target.type === "bezier")) {
        const points = target.metadata?.points as PathNode[] | undefined;
        if (points?.length) {
          const hitHandle = findPathNodeHandle(point, points);
          if (hitHandle) {
            setActiveObjectId(target.id);
            setInteraction({
              type: "edit-node",
              objectId: target.id,
              nodeIndex: hitHandle.nodeIndex,
              handle: hitHandle.handle,
              basePoints: structuredClone(points),
              startPoint: point,
            });
            return;
          }
        }
      }
    }

    if (selectedTool === "select" && activeObject) {
      const handle = hitResizeHandle(
        localPoint(point, activeObject),
        getObjectBounds(activeObject),
        zoomRef.current,
      );
      if (handle) {
        setInteraction({
          type: "resize",
          objectId: activeObject.id,
          handle,
          baseObjects: structuredClone(objects),
        });
        return;
      }
    }

    setActiveObjectId(hit?.id ?? null);
    if (hit) {
      setInteraction({
        type: "move",
        objectId: hit.id,
        start: point,
        baseObjects: structuredClone(objects),
      });
    }
  };

  const onMouseMove = (event: React.MouseEvent) => {
    const point = getWorldPoint(
      event,
      canvasRef.current,
      panRef.current,
      zoomRef.current,
    );
    setCursorWorld(point);

    if (interaction.type === "pan") {
      panRef.current = {
        x: interaction.startPan.x + (event.clientX - interaction.startClient.x),
        y: interaction.startPan.y + (event.clientY - interaction.startClient.y),
      };
      draw();
      return;
    }

    if (interaction.type === "draw") {
      setInteraction({ ...interaction, current: point });
      return;
    }

    if (interaction.type === "draw-path") {
      setInteraction({ ...interaction, current: point });
      return;
    }

    if (interaction.type === "edit-node") {
      const objectsToUpdate = objects.map((object) => {
        if (object.id !== interaction.objectId) {
          return object;
        }
        const points = interaction.basePoints.map((item, index) => {
          if (index !== interaction.nodeIndex) {
            return item;
          }
          switch (interaction.handle) {
            case "anchor":
              return { ...item, x: point.x, y: point.y };
            case "control":
              if (item.type === "Q") {
                return { ...item, cx: point.x, cy: point.y };
              }
              return item;
            case "control1":
              if (item.type === "C") {
                return { ...item, cx1: point.x, cy1: point.y };
              }
              return item;
            case "control2":
              if (item.type === "C") {
                return { ...item, cx2: point.x, cy2: point.y };
              }
              return item;
            default:
              return item;
          }
        });
        return {
          ...object,
          metadata: {
            ...object.metadata,
            points,
            d: pathStringFromPoints(points),
          },
        };
      });
      setObjectsSilently(objectsToUpdate);
      return;
    }

    if (interaction.type === "move") {
      const delta = {
        x: point.x - interaction.start.x,
        y: point.y - interaction.start.y,
      };
      setObjectsSilently(
        interaction.baseObjects.map((object) =>
          object.id === interaction.objectId
            ? moveObject(object, delta, snapToGrid)
            : object,
        ),
      );
      return;
    }

    if (interaction.type === "resize") {
      setObjectsSilently(
        interaction.baseObjects.map((object) =>
          object.id === interaction.objectId
            ? resizeObject(
                object,
                interaction.handle,
                localPoint(point, object),
                snapToGrid,
              )
            : object,
        ),
      );
    }
  };

  const onMouseUp = () => {
    if (interaction.type === "draw") {
      const created = createObjectFromDraw(
        interaction,
        activeLayerId,
        objects.length,
        snapToGrid,
        defaultStroke,
        defaultFill,
      );
      if (created) {
        addObject(created);
      }
      setInteraction({ type: "idle" });
      return;
    }

    if (interaction.type === "draw-path") {
      return;
    }

    if (
      interaction.type === "move" ||
      interaction.type === "resize" ||
      interaction.type === "edit-node"
    ) {
      const state = useCanvasStore.getState();
      state.setObjects(state.objects);
      setInteraction({ type: "idle" });
      return;
    }

    setInteraction({ type: "idle" });
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && interaction.type === "draw-path") {
        event.preventDefault();
        event.stopImmediatePropagation();
        setInteraction({ type: "idle" });
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [interaction.type]);

  useEffect(() => {
    const handleEditKeys = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (interaction.type !== "idle") return;

      const active = objects.find((object) => object.id === activeObjectId);
      const ctrl = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (ctrl && key === "d") {
        event.preventDefault();
        if (active) {
          addObject(duplicateObject(active, objects.length));
        }
        return;
      }
      if (ctrl && key === "c") {
        if (active) clipboard = structuredClone(active);
        return;
      }
      if (ctrl && key === "v") {
        event.preventDefault();
        if (clipboard) {
          addObject(duplicateObject(clipboard, objects.length));
        }
        return;
      }

      const nudges: Record<string, Point> = {
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
      };
      const nudge = nudges[event.key];
      if (nudge && active) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const moved = moveObject(
          active,
          { x: nudge.x * step, y: nudge.y * step },
          false,
        );
        setObjects(
          objects.map((object) => (object.id === active.id ? moved : object)),
        );
      }
    };

    window.addEventListener("keydown", handleEditKeys);
    return () => window.removeEventListener("keydown", handleEditKeys);
  }, [interaction.type, objects, activeObjectId, addObject, setObjects]);

  const onDoubleClick = (event: React.MouseEvent) => {
    if (interaction.type === "draw-path" && interaction.points.length >= 2) {
      event.preventDefault();
      const created = createObjectFromPath(
        interaction,
        activeLayerId,
        objects.length,
        defaultStroke,
        defaultFill,
      );
      addObject(created);
      setInteraction({ type: "idle" });
    }
  };

  const zoomToFit = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const bounds =
      objects.length === 0
        ? { x: 0, y: 0, width: workspaceWidth, height: workspaceHeight }
        : unionBounds(objects.map(getObjectBounds));
    const padding = 40;
    const nextZoom = Math.max(
      0.15,
      Math.min(
        6,
        Math.min(
          (canvas.width - padding * 2) / Math.max(bounds.width, 1),
          (canvas.height - padding * 2) / Math.max(bounds.height, 1),
        ),
      ),
    );

    zoomRef.current = nextZoom;
    panRef.current = {
      x: padding - bounds.x * nextZoom,
      y: padding - bounds.y * nextZoom,
    };
    setZoom(nextZoom);
    draw();
  };

  const autoLayout = () => {
    setObjects(nestObjects(objects, workspaceWidth, workspaceHeight, 12));
  };

  const resetView = () => {
    zoomRef.current = 1;
    panRef.current = { x: 0, y: 0 };
    setZoom(1);
    draw();
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden bg-[#0d1117]"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ cursor: selectedTool === "pan" ? "grab" : "crosshair" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onDoubleClick={onDoubleClick}
        onContextMenu={(event) => event.preventDefault()}
      />
      {interaction.type === "text" && (
        <TextInputOverlay
          interaction={interaction}
          canvas={canvasRef.current}
          pan={panRef.current}
          zoom={zoomRef.current}
          onChange={(value) => setInteraction({ ...interaction, value })}
          onCancel={() => setInteraction({ type: "idle" })}
          onSubmit={(value) => {
            if (!value.trim()) {
              setInteraction({ type: "idle" });
              return;
            }
            addObject({
              id: Math.random().toString(36).slice(2),
              type: "text",
              position: snap(interaction.point, snapToGrid),
              rotation: 0,
              scale: { x: 1, y: 1 },
              stroke: defaultStroke,
              fill: "none",
              power: 80,
              speed: 300,
              passes: 1,
              layer: activeLayerId,
              airAssist: false,
              zIndex: objects.length,
              metadata: {
                text: value,
                fontFamily: "Arial",
                fontSize: 24,
                fontWeight: "normal",
                fontStyle: "normal",
                uppercase: false,
                letterSpacing: 0,
                lineSpacing: 0,
              },
            });
            setInteraction({ type: "idle" });
          }}
        />
      )}
      <div className="pointer-events-none absolute left-3 top-3 rounded border border-[#1b2430] bg-[#111820]/80 px-3 py-2 text-xs text-slate-300 backdrop-blur-sm">
        <span className="mr-3 font-semibold text-accent">{selectedTool}</span>
        <span className="mr-2 text-slate-500">{objects.length} obj</span>
        <span className="text-slate-500">zoom {(zoom * 100).toFixed(0)}%</span>
      </div>
      <div className="absolute right-3 top-3 flex gap-2">
        <button
          type="button"
          onClick={zoomToFit}
          className="rounded border border-border bg-[#111820]/90 px-3 py-2 text-xs text-slate-100 transition hover:border-accent"
        >
          Zoom to fit
        </button>
        <button
          type="button"
          onClick={resetView}
          className="rounded border border-border bg-[#111820]/90 px-3 py-2 text-xs text-slate-100 transition hover:border-accent"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={autoLayout}
          className="rounded border border-border bg-[#111820]/90 px-3 py-2 text-xs text-slate-100 transition hover:border-accent"
        >
          Nesting
        </button>
        <button
          type="button"
          onClick={() => setSnapToGrid(!snapToGrid)}
          className={`rounded border px-3 py-2 text-xs transition ${snapToGrid ? "border-accent bg-[#223250] text-white" : "border-border bg-[#111820]/90 text-slate-100"}`}
        >
          {snapToGrid ? "Snap on" : "Snap off"}
        </button>
      </div>
    </div>
  );
}

function TextInputOverlay({
  interaction,
  canvas,
  pan,
  zoom,
  onChange,
  onCancel,
  onSubmit,
}: {
  interaction: Extract<InteractionState, { type: "text" }>;
  canvas: HTMLCanvasElement | null;
  pan: Point;
  zoom: number;
  onChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const position = canvas
    ? {
        x: interaction.point.x * zoom + pan.x,
        y: interaction.point.y * zoom + pan.y,
      }
    : { x: 0, y: 0 };

  return (
    <input
      ref={inputRef}
      type="text"
      value={interaction.value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onSubmit(interaction.value);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
      onBlur={() => {
        if (interaction.value.trim()) {
          onSubmit(interaction.value);
        } else {
          onCancel();
        }
      }}
      className="absolute z-50 rounded border border-accent bg-[#0f172a]/95 px-2 py-1 text-sm text-white outline-none"
      style={{
        left: position.x,
        top: position.y,
        minWidth: 180,
      }}
      placeholder="Digite o texto e pressione Enter"
    />
  );
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pan: Point,
  zoom: number,
) {
  const startX = Math.floor(-pan.x / zoom / GRID_MINOR) * GRID_MINOR;
  const startY = Math.floor(-pan.y / zoom / GRID_MINOR) * GRID_MINOR;
  const endX = startX + width / zoom + GRID_MINOR * 2;
  const endY = startY + height / zoom + GRID_MINOR * 2;

  ctx.strokeStyle = "#1e2733";
  ctx.lineWidth = 0.5 / zoom;
  for (let x = startX; x <= endX; x += GRID_MINOR) {
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }
  for (let y = startY; y <= endY; y += GRID_MINOR) {
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }

  ctx.strokeStyle = "#263040";
  ctx.lineWidth = 1 / zoom;
  for (
    let x = Math.floor(startX / GRID_MAJOR) * GRID_MAJOR;
    x <= endX;
    x += GRID_MAJOR
  ) {
    ctx.beginPath();
    ctx.moveTo(x, startY);
    ctx.lineTo(x, endY);
    ctx.stroke();
  }
  for (
    let y = Math.floor(startY / GRID_MAJOR) * GRID_MAJOR;
    y <= endY;
    y += GRID_MAJOR
  ) {
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.lineTo(endX, y);
    ctx.stroke();
  }
}

function drawObject(
  ctx: CanvasRenderingContext2D,
  obj: VectorObject,
  zoom: number,
  imageCache: Map<string, HTMLImageElement>,
  redraw: () => void,
  activeObjectId: string | null,
  objectColor: string,
) {
  const { position, scale } = obj;
  const metadata = obj.metadata ?? {};

  ctx.save();
  ctx.translate(position.x, position.y);
  ctx.rotate((obj.rotation * Math.PI) / 180);

  switch (obj.type) {
    case "rectangle":
    case "bitmap": {
      const width = Number(metadata.width ?? 80) * scale.x;
      const height = Number(metadata.height ?? 50) * scale.y;
      if (obj.type === "bitmap") {
        const dataUrl = String(metadata.dataUrl ?? "");
        if (dataUrl) {
          let image = imageCache.get(dataUrl);
          if (!image) {
            image = new Image();
            image.src = dataUrl;
            image.onload = () => redraw();
            imageCache.set(dataUrl, image);
          }
          if (image.complete) {
            ctx.drawImage(image, 0, 0, width, height);
          }
        }
      }
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "circle": {
      const radius = Number(metadata.radius ?? 30) * scale.x;
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "ellipse": {
      const rx = (Number(metadata.width ?? 80) / 2) * scale.x;
      const ry = (Number(metadata.height ?? 50) / 2) * scale.y;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      break;
    }
    case "line": {
      const x2 = Number(metadata.x2 ?? position.x + 80) - position.x;
      const y2 = Number(metadata.y2 ?? position.y) - position.y;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      if (metadata.measurement) {
        ctx.font = `${12 / zoom}px sans-serif`;
        ctx.fillStyle = "#fbbf24";
        ctx.fillText(`${Math.hypot(x2, y2).toFixed(1)} mm`, x2 / 2, y2 / 2);
      }
      break;
    }
    case "path":
    case "bezier": {
      const points = metadata.points as PathNode[] | undefined;
      if (points && points.length > 0) {
        const relativePoints = points.map((point) => {
          if (point.type === "Q") {
            return {
              ...point,
              x: point.x - position.x,
              y: point.y - position.y,
              cx: point.cx - position.x,
              cy: point.cy - position.y,
            };
          }
          if (point.type === "C") {
            return {
              ...point,
              x: point.x - position.x,
              y: point.y - position.y,
              cx1: point.cx1 - position.x,
              cy1: point.cy1 - position.y,
              cx2: point.cx2 - position.x,
              cy2: point.cy2 - position.y,
            };
          }
          return {
            ...point,
            x: point.x - position.x,
            y: point.y - position.y,
          };
        });
        const closed = isPathClosed(points);
        const built = buildPath(relativePoints, closed);
        const path = new Path2D(built);
        if (obj.fill && obj.fill !== "none" && points.length > 2) {
          ctx.fillStyle = obj.fill;
          ctx.fill(path);
        }
        ctx.stroke(path);
        if (obj.id === activeObjectId) {
          relativePoints.forEach((point) => {
            ctx.save();
            ctx.fillStyle = "rgba(96, 165, 250, 0.8)";
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 1 / zoom;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 5 / zoom, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            if (point.type === "Q") {
              ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
              ctx.lineWidth = 0.75 / zoom;
              ctx.beginPath();
              ctx.moveTo(point.cx, point.cy);
              ctx.lineTo(point.x, point.y);
              ctx.stroke();
              ctx.fillStyle = "rgba(251, 191, 36, 0.7)";
              ctx.beginPath();
              ctx.arc(point.cx, point.cy, 3.5 / zoom, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }
            if (point.type === "C") {
              ctx.strokeStyle = "rgba(251, 191, 36, 0.4)";
              ctx.lineWidth = 0.75 / zoom;
              ctx.beginPath();
              ctx.moveTo(point.cx1, point.cy1);
              ctx.lineTo(point.x, point.y);
              ctx.moveTo(point.cx2, point.cy2);
              ctx.lineTo(point.x, point.y);
              ctx.stroke();
              ctx.fillStyle = "rgba(251, 191, 36, 0.7)";
              ctx.beginPath();
              ctx.arc(point.cx1, point.cy1, 3.5 / zoom, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              ctx.beginPath();
              ctx.arc(point.cx2, point.cy2, 3.5 / zoom, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }
            ctx.restore();
          });
        }
      } else {
        const d = String(metadata.d ?? "");
        if (d) {
          try {
            const path = new Path2D(d);
            if (obj.fill && obj.fill !== "none") {
              ctx.fillStyle = obj.fill;
              ctx.fill(path);
            }
            ctx.stroke(path);
          } catch {
            ctx.beginPath();
            ctx.rect(0, 0, 60, 40);
            ctx.fill();
            ctx.stroke();
          }
        }
      }
      break;
    }
    case "text": {
      const text = String(metadata.text ?? "Texto");
      const fontFamily = String(metadata.fontFamily ?? "Arial");
      const fontSize = Number(metadata.fontSize ?? 24);
      const fontWeight = metadata.fontWeight === "bold" ? "bold" : "normal";
      const fontStyle = metadata.fontStyle === "italic" ? "italic" : "normal";
      const uppercase = Boolean(metadata.uppercase);
      const letterSpacing = Number(metadata.letterSpacing ?? 0);
      const displayText = uppercase ? text.toUpperCase() : text;

      ctx.font = `${fontStyle} ${fontWeight} ${fontSize / zoom}px ${fontFamily}`;
      ctx.textBaseline = "top";
      ctx.fillStyle = objectColor;
      const lines = displayText.split("\n");
      const lineHeight = (fontSize + Number(metadata.lineSpacing ?? 0)) / zoom;

      lines.forEach((line, index) => {
        if (letterSpacing !== 0) {
          let x = 0;
          for (const char of line) {
            ctx.fillText(char, x, index * lineHeight);
            x += ctx.measureText(char).width + letterSpacing / zoom;
          }
        } else {
          ctx.fillText(line, 0, index * lineHeight);
        }
      });
      break;
    }
    default:
      ctx.beginPath();
      ctx.rect(0, 0, 60 * scale.x, 40 * scale.y);
      ctx.fill();
      ctx.stroke();
  }

  ctx.restore();
}

function drawSelection(
  ctx: CanvasRenderingContext2D,
  bounds: { x: number; y: number; width: number; height: number },
  zoom: number,
  rotation = 0,
  pivot: Point = { x: bounds.x, y: bounds.y },
) {
  ctx.save();
  if (rotation) {
    ctx.translate(pivot.x, pivot.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-pivot.x, -pivot.y);
  }
  ctx.strokeStyle = "#f8fafc";
  ctx.lineWidth = 1 / zoom;
  ctx.setLineDash([6 / zoom, 4 / zoom]);
  ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  ctx.setLineDash([]);

  Object.values(getHandlePoints(bounds)).forEach((handle) => {
    ctx.fillStyle = "#5d8bff";
    ctx.fillRect(
      handle.x - HANDLE_SIZE / 2 / zoom,
      handle.y - HANDLE_SIZE / 2 / zoom,
      HANDLE_SIZE / zoom,
      HANDLE_SIZE / zoom,
    );
  });
  ctx.restore();
}

function drawPreview(
  ctx: CanvasRenderingContext2D,
  interaction:
    | Extract<InteractionState, { type: "draw" }>
    | Extract<InteractionState, { type: "draw-path" }>,
  zoom: number,
) {
  ctx.save();
  ctx.strokeStyle = "#5d8bff";
  ctx.lineWidth = 1.25 / zoom;
  ctx.setLineDash([5 / zoom, 4 / zoom]);

  if (interaction.type === "draw") {
    const start = interaction.start;
    const current = interaction.current;
    const rect = normalizeRect(start, current);

    if (interaction.tool === "rectangle") {
      ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
    } else if (
      interaction.tool === "circle" ||
      interaction.tool === "ellipse"
    ) {
      ctx.beginPath();
      ctx.ellipse(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2,
        rect.width / 2,
        rect.height / 2,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(current.x, current.y);
      ctx.stroke();
      if (interaction.tool === "measure") {
        ctx.font = `${12 / zoom}px sans-serif`;
        ctx.fillStyle = "#fbbf24";
        ctx.fillText(
          `${Math.hypot(current.x - start.x, current.y - start.y).toFixed(1)} mm`,
          current.x,
          current.y - 6 / zoom,
        );
      }
    }
  } else {
    const { points, current, tool } = interaction;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      const point = points[i];
      if (point.type === "L") {
        ctx.lineTo(point.x, point.y);
      } else if (point.type === "Q") {
        ctx.quadraticCurveTo(point.cx, point.cy, point.x, point.y);
      } else if (point.type === "C") {
        ctx.bezierCurveTo(
          point.cx1,
          point.cy1,
          point.cx2,
          point.cy2,
          point.x,
          point.y,
        );
      }
    }

    if (tool === "path") {
      ctx.lineTo(current.x, current.y);
    } else {
      const lastPoint = points[points.length - 1];
      const cx = (lastPoint.x + current.x) / 2;
      const cy = (lastPoint.y + current.y) / 2;
      ctx.quadraticCurveTo(cx, cy, current.x, current.y);
    }

    ctx.stroke();

    ctx.fillStyle = "rgba(96, 165, 250, 0.65)";
    points.forEach((point) => {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 4 / zoom, 0, Math.PI * 2);
      ctx.fill();
      if (point.type === "Q") {
        ctx.beginPath();
        ctx.arc(point.cx, point.cy, 3 / zoom, 0, Math.PI * 2);
        ctx.fill();
      }
      if (point.type === "C") {
        ctx.beginPath();
        ctx.arc(point.cx1, point.cy1, 3 / zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(point.cx2, point.cy2, 3 / zoom, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.beginPath();
    ctx.arc(current.x, current.y, 4 / zoom, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `${12 / zoom}px sans-serif`;
    ctx.fillStyle = "#fbbf24";
    ctx.fillText(
      `Clique duas vezes para concluir`,
      current.x + 6 / zoom,
      current.y - 8 / zoom,
    );
  }

  ctx.restore();
}

function drawCameraOverlay(
  ctx: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
  zoom: number,
) {
  ctx.save();
  ctx.strokeStyle = "rgba(96, 165, 250, 0.75)";
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([4 / zoom, 4 / zoom]);
  ctx.strokeRect(offsetX - 20, offsetY - 20, 40, 40);
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(offsetX - 14, offsetY);
  ctx.lineTo(offsetX + 14, offsetY);
  ctx.moveTo(offsetX, offsetY - 14);
  ctx.lineTo(offsetX, offsetY + 14);
  ctx.stroke();
  ctx.fillStyle = "rgba(96, 165, 250, 0.15)";
  ctx.fillRect(offsetX - 20, offsetY - 20, 40, 40);
  ctx.font = `${11 / zoom}px sans-serif`;
  ctx.fillStyle = "#60a5fa";
  ctx.fillText(`Câmera (${offsetX},${offsetY})`, offsetX + 24, offsetY - 8);
  ctx.restore();
}

function createObjectFromPath(
  interaction: Extract<InteractionState, { type: "draw-path" }>,
  activeLayerId: string,
  zIndex: number,
  defaultStroke: string,
  defaultFill: string,
) {
  const points = interaction.points;
  const closed = isPathClosed(points);
  const closedPoints = closed
    ? points.map((node, index) =>
        index === points.length - 1
          ? { ...node, x: points[0].x, y: points[0].y }
          : node,
      )
    : points;
  return {
    id: Math.random().toString(36).slice(2),
    type: interaction.tool,
    position: { x: 0, y: 0 },
    rotation: 0,
    scale: { x: 1, y: 1 },
    stroke: defaultStroke,
    fill: defaultFill,
    power: 80,
    speed: 300,
    passes: 1,
    layer: activeLayerId,
    airAssist: false,
    zIndex,
    metadata: {
      points: closedPoints,
      d: `${pathStringFromPoints(closedPoints)}${closed ? " Z" : ""}`,
    },
  } satisfies VectorObject;
}

function pathStringFromPoints(points: PathNode[]) {
  if (points.length === 0) {
    return "";
  }
  return points
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
    .join(" ");
}

function isPathClosed(points: PathNode[]) {
  if (points.length < 2) {
    return false;
  }
  const first = points[0];
  const last = points[points.length - 1];
  return (
    Math.hypot(first.x - last.x, first.y - last.y) <= 8 &&
    (first.type === "M" || first.type === "L")
  );
}

function buildPath(points: PathNode[], close = false) {
  return `${pathStringFromPoints(points)}${close ? " Z" : ""}`;
}

function createOffsetObject(
  object: VectorObject,
  amount: number,
  zIndex: number,
) {
  const offsetColor = "#34d399";
  const base = getObjectBounds(object);
  const expanded = {
    x: base.x - amount,
    y: base.y - amount,
    width: base.width + amount * 2,
    height: base.height + amount * 2,
  };

  if (
    object.type === "rectangle" ||
    object.type === "bitmap" ||
    object.type === "text"
  ) {
    return {
      ...object,
      id: Math.random().toString(36).slice(2),
      position: { x: expanded.x, y: expanded.y },
      zIndex,
      stroke: offsetColor,
      fill: "none",
      metadata: {
        ...object.metadata,
        width: expanded.width,
        height: expanded.height,
      },
    } as VectorObject;
  }

  if (object.type === "circle") {
    const radius = Math.max(expanded.width, expanded.height) / 2;
    return {
      ...object,
      id: Math.random().toString(36).slice(2),
      position: { x: expanded.x + radius, y: expanded.y + radius },
      zIndex,
      stroke: offsetColor,
      fill: "none",
      metadata: { radius },
    } as VectorObject;
  }

  if (object.type === "line") {
    const x1 = object.position.x;
    const y1 = object.position.y;
    const x2 = Number(object.metadata?.x2 ?? x1 + 80);
    const y2 = Number(object.metadata?.y2 ?? y1);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy) || 1;
    const normal = { x: -dy / length, y: dx / length };

    return {
      ...object,
      id: Math.random().toString(36).slice(2),
      position: {
        x: x1 + normal.x * amount,
        y: y1 + normal.y * amount,
      },
      zIndex,
      stroke: offsetColor,
      fill: "none",
      metadata: {
        ...object.metadata,
        x2: x2 + normal.x * amount,
        y2: y2 + normal.y * amount,
      },
    } as VectorObject;
  }

  if (object.type === "path" || object.type === "bezier") {
    const points = object.metadata?.points as PathNode[] | undefined;
    if (!points || points.length < 2) {
      return {
        id: Math.random().toString(36).slice(2),
        type: "rectangle",
        position: { x: base.x - amount, y: base.y - amount },
        rotation: 0,
        scale: { x: 1, y: 1 },
        stroke: offsetColor,
        fill: "none",
        power: 80,
        speed: 300,
        passes: 1,
        layer: object.layer,
        airAssist: false,
        zIndex,
        metadata: {
          width: base.width + amount * 2,
          height: base.height + amount * 2,
        },
      } as VectorObject;
    }
    const offsetPoints = offsetPathPoints(points, amount);
    return {
      ...object,
      id: Math.random().toString(36).slice(2),
      zIndex,
      stroke: offsetColor,
      fill: "none",
      metadata: {
        ...object.metadata,
        points: offsetPoints,
        d: pathStringFromPoints(offsetPoints),
      },
    } as VectorObject;
  }

  return null;
}

function isClosePoint(point: Point, target: Point, distance: number) {
  return Math.hypot(point.x - target.x, point.y - target.y) <= distance;
}

function findPathNodeHandle(point: Point, points: PathNode[]) {
  for (let nodeIndex = 0; nodeIndex < points.length; nodeIndex += 1) {
    const node = points[nodeIndex];
    if (node.type === "Q") {
      if (isClosePoint(point, { x: node.cx, y: node.cy }, 8)) {
        return { nodeIndex, handle: "control" as NodeHandle };
      }
      if (isClosePoint(point, { x: node.x, y: node.y }, 8)) {
        return { nodeIndex, handle: "anchor" as NodeHandle };
      }
    }
    if (node.type === "C") {
      if (isClosePoint(point, { x: node.cx1, y: node.cy1 }, 8)) {
        return { nodeIndex, handle: "control1" as NodeHandle };
      }
      if (isClosePoint(point, { x: node.cx2, y: node.cy2 }, 8)) {
        return { nodeIndex, handle: "control2" as NodeHandle };
      }
      if (isClosePoint(point, { x: node.x, y: node.y }, 8)) {
        return { nodeIndex, handle: "anchor" as NodeHandle };
      }
    }
    if (node.type === "M" || node.type === "L") {
      if (isClosePoint(point, { x: node.x, y: node.y }, 8)) {
        return { nodeIndex, handle: "anchor" as NodeHandle };
      }
    }
  }
  return null;
}

function offsetPathPoints(points: PathNode[], amount: number) {
  return points.map((point, index) => {
    const prev = index > 0 ? points[index - 1] : point;
    const next = index < points.length - 1 ? points[index + 1] : point;
    const normal = computeNodeNormal(prev, point, next);
    const shift = { x: normal.x * amount, y: normal.y * amount };

    if (point.type === "M" || point.type === "L") {
      return { ...point, x: point.x + shift.x, y: point.y + shift.y };
    }

    if (point.type === "Q") {
      return {
        ...point,
        x: point.x + shift.x,
        y: point.y + shift.y,
        cx: point.cx + shift.x,
        cy: point.cy + shift.y,
      };
    }

    return {
      ...point,
      x: point.x + shift.x,
      y: point.y + shift.y,
      cx1: point.cx1 + shift.x,
      cy1: point.cy1 + shift.y,
      cx2: point.cx2 + shift.x,
      cy2: point.cy2 + shift.y,
    };
  });
}

function computeNodeNormal(prev: PathNode, current: PathNode, next: PathNode) {
  const fromPrev = normalize({ x: current.x - prev.x, y: current.y - prev.y });
  const toNext = normalize({ x: next.x - current.x, y: next.y - current.y });
  const n1 = { x: -fromPrev.y, y: fromPrev.x };
  const n2 = { x: -toNext.y, y: toNext.x };
  const blended = normalize({ x: n1.x + n2.x, y: n1.y + n2.y });
  return Math.abs(blended.x) < 1e-4 && Math.abs(blended.y) < 1e-4
    ? n1
    : blended;
}

function normalize(vector: Point) {
  const length = Math.hypot(vector.x, vector.y);
  return length === 0
    ? { x: 0, y: 0 }
    : { x: vector.x / length, y: vector.y / length };
}

function createBezierSegment(previous: PathNode, point: Point): PathNode {
  const cx = (previous.x + point.x) / 2;
  const cy = (previous.y + point.y) / 2;
  return { type: "Q", x: point.x, y: point.y, cx, cy };
}

function pointToSegmentDistance(a: Point, b: Point, c: Point) {
  const dx = c.x - a.x;
  const dy = c.y - a.y;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) {
    return Math.hypot(c.x - a.x, c.y - a.y);
  }
  const t = Math.max(
    0,
    Math.min(1, ((c.x - a.x) * dx + (c.y - a.y) * dy) / l2),
  );
  const projection = { x: a.x + t * dx, y: a.y + t * dy };
  return Math.hypot(c.x - projection.x, c.y - projection.y);
}

function rotatePoint(point: Point, pivot: Point, angleDeg: number): Point {
  if (!angleDeg) return point;
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  return {
    x: pivot.x + dx * cos - dy * sin,
    y: pivot.y + dx * sin + dy * cos,
  };
}

/** Map a world point into an object's local (unrotated) frame. */
function localPoint(point: Point, object: VectorObject): Point {
  return object.rotation
    ? rotatePoint(point, object.position, -object.rotation)
    : point;
}

function getWorldPoint(
  event: React.MouseEvent,
  canvas: HTMLCanvasElement | null,
  pan: Point,
  zoom: number,
) {
  const rect = canvas?.getBoundingClientRect();
  return {
    x: (event.clientX - (rect?.left ?? 0) - pan.x) / zoom,
    y: (event.clientY - (rect?.top ?? 0) - pan.y) / zoom,
  };
}

function getObjectBounds(object: VectorObject) {
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
    case "ellipse": {
      const rx = (Number(metadata.width ?? 80) / 2) * object.scale.x;
      const ry = (Number(metadata.height ?? 50) / 2) * object.scale.y;
      return {
        x: object.position.x - rx,
        y: object.position.y - ry,
        width: rx * 2,
        height: ry * 2,
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
    case "text": {
      const text = String(metadata.text ?? "Texto");
      const fontSize = Number(metadata.fontSize ?? 24);
      const width = Math.max(60, text.length * fontSize * 0.55);
      const height = fontSize * 1.2;
      return {
        x: object.position.x,
        y: object.position.y,
        width,
        height,
      };
    }
    case "path":
    case "bezier": {
      const points = metadata.points as PathNode[] | undefined;
      if (points && points.length > 0) {
        const xs = points.map((item) => item.x);
        const ys = points.map((item) => item.y);
        const controlXs = points.flatMap((item) =>
          item.type === "Q"
            ? [item.cx]
            : item.type === "C"
              ? [item.cx1, item.cx2]
              : ([] as number[]),
        );
        const controlYs = points.flatMap((item) =>
          item.type === "Q"
            ? [item.cy]
            : item.type === "C"
              ? [item.cy1, item.cy2]
              : ([] as number[]),
        );
        const allX = xs.concat(controlXs);
        const allY = ys.concat(controlYs);
        return {
          x: Math.min(...allX),
          y: Math.min(...allY),
          width: Math.max(...allX) - Math.min(...allX),
          height: Math.max(...allY) - Math.min(...allY),
        };
      }
      const d = String(metadata.d ?? "");
      if (d) {
        const parsedBounds = parseDStringBounds(d, object.position);
        if (parsedBounds) return parsedBounds;
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

function parseDStringBounds(d: string, offset: { x: number; y: number }) {
  const nums: number[] = [];
  const re = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    nums.push(parseFloat(m[0]));
  }
  if (nums.length < 4) return null;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2) {
    xs.push(nums[i]);
    ys.push(nums[i + 1]);
  }
  const minX = Math.min(...xs) + offset.x;
  const minY = Math.min(...ys) + offset.y;
  const maxX = Math.max(...xs) + offset.x;
  const maxY = Math.max(...ys) + offset.y;
  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

function hitTestObject(worldPoint: Point, object: VectorObject) {
  const point = localPoint(worldPoint, object);
  if (object.type === "path" || object.type === "bezier") {
    const points = object.metadata?.points as PathNode[] | undefined;
    if (points && points.length >= 2) {
      const closed = isPathClosed(points);
      if (closed && object.fill && object.fill !== "none") {
        const anchorPoints = points.map((item) => ({ x: item.x, y: item.y }));
        if (isPointInPolygon(point, anchorPoints)) {
          return true;
        }
      }

      for (let i = 1; i < points.length; i += 1) {
        const a = points[i - 1];
        const b = points[i];
        const dist = pointToSegmentDistance(a, b, point);
        if (dist < 8) {
          return true;
        }
      }
      return false;
    }

    const d = String(object.metadata?.d ?? "");
    if (d) {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.translate(object.position.x, object.position.y);
        try {
          const path = new Path2D(d);
          if (
            object.fill &&
            object.fill !== "none" &&
            ctx.isPointInPath(path, point.x, point.y)
          ) {
            return true;
          }
          if (ctx.isPointInStroke(path, point.x, point.y)) {
            return true;
          }
        } catch {
          // ignore invalid path data and fall back to bounding box
        }
      }
    }

    const bounds = getObjectBounds(object);
    return (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    );
  }

  const bounds = getObjectBounds(object);
  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  );
}

function isPointInPolygon(point: Point, polygon: Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function getHandlePoints(bounds: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return {
    nw: { x: bounds.x, y: bounds.y },
    ne: { x: bounds.x + bounds.width, y: bounds.y },
    sw: { x: bounds.x, y: bounds.y + bounds.height },
    se: { x: bounds.x + bounds.width, y: bounds.y + bounds.height },
  } as const;
}

function hitResizeHandle(
  point: Point,
  bounds: { x: number; y: number; width: number; height: number },
  zoom: number,
) {
  return (
    (Object.entries(getHandlePoints(bounds)).find(([, handle]) => {
      return (
        Math.abs(point.x - handle.x) <= HANDLE_SIZE / zoom &&
        Math.abs(point.y - handle.y) <= HANDLE_SIZE / zoom
      );
    })?.[0] as ResizeHandle | undefined) ?? null
  );
}

function normalizeRect(start: Point, end: Point) {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function snap(point: Point, enabled: boolean) {
  if (!enabled) {
    return point;
  }

  return {
    x: Math.round(point.x / GRID_MINOR) * GRID_MINOR,
    y: Math.round(point.y / GRID_MINOR) * GRID_MINOR,
  };
}

function duplicateObject(object: VectorObject, zIndex: number): VectorObject {
  const shifted = moveObject(object, { x: 10, y: 10 }, false);
  return {
    ...shifted,
    id: Math.random().toString(36).slice(2),
    zIndex,
  };
}

function moveObject(object: VectorObject, delta: Point, snapEnabled: boolean) {
  const translated = {
    ...object,
    position: snap(
      {
        x: object.position.x + delta.x,
        y: object.position.y + delta.y,
      },
      snapEnabled,
    ),
  };

  if (object.type === "circle") {
    return translated;
  }

  if (object.type === "line") {
    return {
      ...translated,
      metadata: {
        ...object.metadata,
        x2: Number(object.metadata?.x2 ?? object.position.x + 80) + delta.x,
        y2: Number(object.metadata?.y2 ?? object.position.y) + delta.y,
      },
    };
  }

  if (object.type === "path" || object.type === "bezier") {
    const points = object.metadata?.points as PathNode[] | undefined;
    if (!points) {
      return {
        ...object,
        position: snap(
          {
            x: object.position.x + delta.x,
            y: object.position.y + delta.y,
          },
          snapEnabled,
        ),
      };
    }

    const movedPoints = points.map((item) => {
      if (item.type === "Q") {
        return {
          ...item,
          x: item.x + delta.x,
          y: item.y + delta.y,
          cx: item.cx + delta.x,
          cy: item.cy + delta.y,
        };
      }
      if (item.type === "C") {
        return {
          ...item,
          x: item.x + delta.x,
          y: item.y + delta.y,
          cx1: item.cx1 + delta.x,
          cy1: item.cy1 + delta.y,
          cx2: item.cx2 + delta.x,
          cy2: item.cy2 + delta.y,
        };
      }
      return { ...item, x: item.x + delta.x, y: item.y + delta.y };
    });

    return {
      ...object,
      position: { x: 0, y: 0 },
      metadata: {
        ...object.metadata,
        points: movedPoints,
        d: pathStringFromPoints(movedPoints),
      },
    };
  }

  return translated;
}

function resizeObject(
  object: VectorObject,
  handle: ResizeHandle,
  point: Point,
  snapEnabled: boolean,
) {
  const snappedPoint = snap(point, snapEnabled);
  const bounds = getObjectBounds(object);
  const opposite =
    handle === "nw"
      ? { x: bounds.x + bounds.width, y: bounds.y + bounds.height }
      : handle === "ne"
        ? { x: bounds.x, y: bounds.y + bounds.height }
        : handle === "sw"
          ? { x: bounds.x + bounds.width, y: bounds.y }
          : { x: bounds.x, y: bounds.y };
  const rect = normalizeRect(snappedPoint, opposite);

  if (object.type === "circle") {
    return {
      ...object,
      position: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
      metadata: {
        ...object.metadata,
        radius: Math.max(rect.width, rect.height) / 2,
      },
    };
  }

  if (object.type === "line") {
    return {
      ...object,
      position: { x: rect.x, y: rect.y },
      metadata: {
        ...object.metadata,
        x2: rect.x + rect.width,
        y2: rect.y + rect.height,
      },
    };
  }

  if (object.type === "ellipse") {
    return {
      ...object,
      position: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
      scale: { x: 1, y: 1 },
      metadata: {
        ...object.metadata,
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
      },
    };
  }

  if (object.type === "path" || object.type === "bezier") {
    const points = object.metadata?.points as PathNode[] | undefined;
    if (points && points.length > 0) {
      const sx = rect.width / Math.max(1e-6, bounds.width);
      const sy = rect.height / Math.max(1e-6, bounds.height);
      const mapX = (x: number) => rect.x + (x - bounds.x) * sx;
      const mapY = (y: number) => rect.y + (y - bounds.y) * sy;
      const scaled = points.map((node) => {
        if (node.type === "Q") {
          return {
            ...node,
            x: mapX(node.x),
            y: mapY(node.y),
            cx: mapX(node.cx),
            cy: mapY(node.cy),
          };
        }
        if (node.type === "C") {
          return {
            ...node,
            x: mapX(node.x),
            y: mapY(node.y),
            cx1: mapX(node.cx1),
            cy1: mapY(node.cy1),
            cx2: mapX(node.cx2),
            cy2: mapY(node.cy2),
          };
        }
        return { ...node, x: mapX(node.x), y: mapY(node.y) };
      });
      return {
        ...object,
        position: { x: 0, y: 0 },
        metadata: {
          ...object.metadata,
          points: scaled,
          d: pathStringFromPoints(scaled),
        },
      };
    }
  }

  if (object.type === "rectangle" || object.type === "bitmap") {
    return {
      ...object,
      position: { x: rect.x, y: rect.y },
      scale: { x: 1, y: 1 },
      metadata: {
        ...object.metadata,
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
      },
    };
  }

  return {
    ...object,
    position: { x: rect.x, y: rect.y },
    metadata: {
      ...object.metadata,
      width: rect.width,
      height: rect.height,
    },
  };
}

function createObjectFromDraw(
  interaction: Extract<InteractionState, { type: "draw" }>,
  activeLayerId: string,
  zIndex: number,
  snapEnabled: boolean,
  defaultStroke: string,
  defaultFill: string,
) {
  const start = snap(interaction.start, snapEnabled);
  const current = snap(interaction.current, snapEnabled);
  const rect = normalizeRect(start, current);

  if (interaction.tool === "rectangle") {
    return {
      id: Math.random().toString(36).slice(2),
      type: "rectangle",
      position: { x: rect.x, y: rect.y },
      rotation: 0,
      scale: { x: 1, y: 1 },
      stroke: defaultStroke,
      fill: defaultFill,
      power: 80,
      speed: 300,
      passes: 1,
      layer: activeLayerId,
      airAssist: false,
      zIndex,
      metadata: {
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
      },
    } satisfies VectorObject;
  }

  if (interaction.tool === "circle") {
    return {
      id: Math.random().toString(36).slice(2),
      type: "circle",
      position: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      stroke: defaultStroke,
      fill: defaultFill,
      power: 80,
      speed: 300,
      passes: 1,
      layer: activeLayerId,
      airAssist: false,
      zIndex,
      metadata: { radius: Math.max(rect.width, rect.height) / 2 },
    } satisfies VectorObject;
  }

  if (interaction.tool === "ellipse") {
    return {
      id: Math.random().toString(36).slice(2),
      type: "ellipse",
      position: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      stroke: defaultStroke,
      fill: defaultFill,
      power: 80,
      speed: 300,
      passes: 1,
      layer: activeLayerId,
      airAssist: false,
      zIndex,
      metadata: {
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
      },
    } satisfies VectorObject;
  }

  if (interaction.tool === "measure") {
    return {
      id: Math.random().toString(36).slice(2),
      type: "line",
      position: start,
      rotation: 0,
      scale: { x: 1, y: 1 },
      stroke: "#fbbf24",
      fill: "none",
      power: 0,
      speed: 1000,
      passes: 1,
      layer: activeLayerId,
      airAssist: false,
      zIndex,
      metadata: { x2: current.x, y2: current.y, measurement: true },
    } satisfies VectorObject;
  }

  return {
    id: Math.random().toString(36).slice(2),
    type: "line",
    position: start,
    rotation: 0,
    scale: { x: 1, y: 1 },
    stroke: defaultStroke,
    fill: "none",
    power: 80,
    speed: 300,
    passes: 1,
    layer: activeLayerId,
    airAssist: false,
    zIndex,
    metadata: { x2: current.x, y2: current.y },
  } satisfies VectorObject;
}

function unionBounds(
  bounds: Array<{ x: number; y: number; width: number; height: number }>,
) {
  const minX = Math.min(...bounds.map((item) => item.x));
  const minY = Math.min(...bounds.map((item) => item.y));
  const maxX = Math.max(...bounds.map((item) => item.x + item.width));
  const maxY = Math.max(...bounds.map((item) => item.y + item.height));
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}
