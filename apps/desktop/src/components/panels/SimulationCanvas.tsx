import { useEffect, useRef, useState, useCallback } from "react";
import { useCanvasStore } from "../../stores/useCanvasStore";
import { useLayerStore } from "../../stores/useLayerStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { optimizePath, generateGcode, estimateJobTime } from "@laser/gcode-engine";

const CANVAS_W = 600;
const CANVAS_H = 400;
const PADDING = 24;

type Move = { x: number; y: number; laser: boolean; power: number };

/** Parse generated G-code into world-space moves (mm), tracking laser power. */
function parseGcode(code: string): Move[] {
  const moves: Move[] = [];
  let cx = 0;
  let cy = 0;
  let power = 0;

  for (const rawLine of code.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith(";")) continue;

    const isG0 = /^G0\b/.test(line);
    const isG1 = /^G1\b/.test(line);
    if (!isG0 && !isG1) continue;

    const xm = line.match(/X(-?[\d.]+)/);
    const ym = line.match(/Y(-?[\d.]+)/);
    const sm = line.match(/S(-?[\d.]+)/);

    if (isG0) power = 0;
    if (sm) power = Number(sm[1]);

    if (xm) cx = parseFloat(xm[1]);
    if (ym) cy = parseFloat(ym[1]);
    moves.push({ x: cx, y: cy, laser: isG1 && power > 0, power });
  }
  return moves;
}

export function SimulationCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(4);
  const objects = useCanvasStore((state) => state.objects);
  const layers = useLayerStore((state) => state.layers);
  const machineConfig = useSettingsStore((state) => state.machineConfig);
  const [estimate, setEstimate] = useState(0);

  const transformRef = useRef({ scale: 1, offsetX: 0, offsetY: 0, height: CANVAS_H });

  const toCanvas = useCallback((x: number, y: number) => {
    const t = transformRef.current;
    return {
      x: x * t.scale + t.offsetX,
      // Flip Y so the simulation matches machine orientation (Y up).
      y: t.height - (y * t.scale + t.offsetY),
    };
  }, []);

  const drawGrid = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.fillStyle = "#0d1116";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
      ctx.strokeStyle = "#1e2733";
      ctx.lineWidth = 0.5;
      for (let gx = 0; gx <= CANVAS_W; gx += 20) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, CANVAS_H);
        ctx.stroke();
      }
      for (let gy = 0; gy <= CANVAS_H; gy += 20) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(CANVAS_W, gy);
        ctx.stroke();
      }
      // Workspace bounds.
      const tl = toCanvas(0, machineConfig.workspaceHeight);
      const br = toCanvas(machineConfig.workspaceWidth, 0);
      ctx.strokeStyle = "#2f4060";
      ctx.lineWidth = 1;
      ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    },
    [toCanvas, machineConfig.workspaceWidth, machineConfig.workspaceHeight],
  );

  const buildMoves = useCallback((): Move[] => {
    const optimized = optimizePath(objects);
    if (optimized.length === 0) return [];
    const withMode = optimized.map((obj) => ({
      ...obj,
      metadata: {
        ...(obj.metadata ?? {}),
        layerMode: layers.find((l) => l.id === obj.layer)?.mode ?? "line",
      },
    }));
    const options = { pwmMax: machineConfig.pwmMax, rapidRate: machineConfig.maxSpeed };
    setEstimate(estimateJobTime(withMode, options));
    return parseGcode(generateGcode(withMode, "grbl", options));
  }, [objects, layers, machineConfig.pwmMax, machineConfig.maxSpeed]);

  const fitMoves = useCallback(
    (moves: Move[]) => {
      const w = machineConfig.workspaceWidth;
      const h = machineConfig.workspaceHeight;
      let maxX = w;
      let maxY = h;
      moves.forEach((m) => {
        maxX = Math.max(maxX, m.x);
        maxY = Math.max(maxY, m.y);
      });
      const scale = Math.min(
        (CANVAS_W - PADDING * 2) / Math.max(maxX, 1),
        (CANVAS_H - PADDING * 2) / Math.max(maxY, 1),
      );
      transformRef.current = {
        scale,
        offsetX: PADDING,
        offsetY: PADDING,
        height: CANVAS_H,
      };
    },
    [machineConfig.workspaceWidth, machineConfig.workspaceHeight],
  );

  const burnColor = (power: number) => {
    const pct = Math.max(0, Math.min(1, power / Math.max(1, machineConfig.pwmMax)));
    const r = 255;
    const g = Math.round(190 - pct * 130);
    const b = Math.round(60 - pct * 50);
    return `rgb(${r},${g},${b})`;
  };

  const simulate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    if (animRef.current) cancelAnimationFrame(animRef.current);

    const moves = buildMoves();
    fitMoves(moves);

    if (moves.length < 2) {
      drawGrid(ctx);
      setProgress(0);
      return;
    }

    const segments = moves.slice(1).map((to, index) => {
      const from = moves[index];
      const a = toCanvas(from.x, from.y);
      const b = toCanvas(to.x, to.y);
      return {
        from: a,
        to: b,
        laser: to.laser,
        power: to.power,
        length: Math.max(0.5, Math.hypot(b.x - a.x, b.y - a.y)),
      };
    });

    const drawSegment = (s: (typeof segments)[number], to = s.to) => {
      ctx.beginPath();
      ctx.moveTo(s.from.x, s.from.y);
      ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = s.laser ? burnColor(s.power) : "#334155";
      ctx.lineWidth = s.laser ? 1.6 : 0.6;
      if (!s.laser) ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    };

    const drawFrame = (segmentIndex: number, t: number) => {
      drawGrid(ctx);
      for (let i = 0; i < segmentIndex && i < segments.length; i += 1) {
        drawSegment(segments[i]);
      }
      const current = segments[Math.min(segmentIndex, segments.length - 1)];
      let head = current.to;
      if (segmentIndex < segments.length) {
        head = {
          x: current.from.x + (current.to.x - current.from.x) * t,
          y: current.from.y + (current.to.y - current.from.y) * t,
        };
        drawSegment(current, head);
      }
      ctx.beginPath();
      ctx.arc(head.x, head.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = current.laser ? "#fbbf24" : "#60a5fa";
      ctx.fill();
    };

    let segmentIndex = 0;
    let progressInSegment = 0;

    const animate = () => {
      const stepPx = speed * 4;
      const current = segments[segmentIndex];
      progressInSegment += stepPx / current.length;
      while (segmentIndex < segments.length && progressInSegment >= 1) {
        progressInSegment -= 1;
        segmentIndex += 1;
      }
      if (segmentIndex >= segments.length) {
        drawFrame(segments.length - 1, 1);
        setRunning(false);
        setProgress(100);
        return;
      }
      drawFrame(segmentIndex, progressInSegment);
      setProgress(Math.round(((segmentIndex + progressInSegment) / segments.length) * 100));
      animRef.current = requestAnimationFrame(animate);
    };

    setRunning(true);
    setProgress(0);
    animate();
  }, [buildMoves, fitMoves, toCanvas, drawGrid, speed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const moves = buildMoves();
    fitMoves(moves);
    drawGrid(ctx);
    // Draw a static preview of the full toolpath.
    for (let i = 1; i < moves.length; i += 1) {
      const a = toCanvas(moves[i - 1].x, moves[i - 1].y);
      const b = toCanvas(moves[i].x, moves[i].y);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = moves[i].laser ? "rgba(249,115,22,0.5)" : "rgba(51,65,85,0.4)";
      ctx.lineWidth = moves[i].laser ? 1.2 : 0.5;
      ctx.stroke();
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [buildMoves, fitMoves, toCanvas, drawGrid]);

  const stop = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    setRunning(false);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) drawGrid(ctx);
    setProgress(0);
  };

  return (
    <section className="rounded-xl border border-border bg-[#11151b] p-4 text-sm text-slate-200 shadow-lg">
      <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.22em] text-slate-500">
        <span>Simulação de trajetória</span>
        <span>{progress}%</span>
      </div>
      <canvas
        ref={canvasRef}
        width={CANVAS_W}
        height={CANVAS_H}
        className="w-full rounded-lg border border-border"
        style={{ maxHeight: 300, objectFit: "contain" }}
      />
      <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
        <span>
          Tempo estimado: <span className="text-slate-200">{estimate.toFixed(2)} min</span>
        </span>
        <label className="flex items-center gap-2">
          Velocidade
          <input
            type="range"
            min={1}
            max={12}
            value={speed}
            onChange={(event) => setSpeed(Number(event.target.value))}
            className="accent-accent"
          />
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={simulate}
          disabled={running}
          className="flex-1 rounded bg-[#1f2730] px-3 py-2 transition hover:bg-[#27334b] disabled:opacity-50"
        >
          ▶ Simular
        </button>
        <button
          type="button"
          onClick={stop}
          disabled={!running}
          className="flex-1 rounded bg-[#1a2030] px-3 py-2 transition hover:bg-[#27334b] disabled:opacity-50"
        >
          ■ Parar
        </button>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[#1a2030]">
        <div
          className="h-full rounded-full bg-accent transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
    </section>
  );
}
