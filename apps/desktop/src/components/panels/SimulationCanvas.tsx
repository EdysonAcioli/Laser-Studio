import { useEffect, useRef, useState, useCallback } from "react";
import { useCanvasStore } from "../../stores/useCanvasStore";
import { useLayerStore } from "../../stores/useLayerStore";
import { optimizePath, generateGcode } from "@laser/gcode-engine";

const CANVAS_W = 600;
const CANVAS_H = 400;
const SCALE = 0.75;

function parseGcodeLines(code: string) {
  const moves: { x: number; y: number; laser: boolean }[] = [];
  let cx = 0;
  let cy = 0;
  let laser = false;

  for (const rawLine of code.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith(";")) continue;

    const xm = line.match(/X([-\d.]+)/);
    const ym = line.match(/Y([-\d.]+)/);
    const sm = line.match(/S([\-\d.]+)/);
    const isG0 = /^G0\b/.test(line);
    const isG1 = /^G1\b/.test(line);

    if (sm) {
      laser = Number(sm[1]) > 0;
    } else if (isG0) {
      laser = false;
    } else if (isG1) {
      laser = true;
    }
    if (xm) cx = parseFloat(xm[1]);
    if (ym) cy = parseFloat(ym[1]);
    if (xm || ym) {
      moves.push({
        x: cx * SCALE + 20,
        y: CANVAS_H - (cy * SCALE + 20),
        laser: !!isLaser,
      });
    }
  }
  return moves;
}

export function SimulationCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const objects = useCanvasStore((state) => state.objects);
  const layers = useLayerStore((state) => state.layers);

  const drawGrid = useCallback((ctx: CanvasRenderingContext2D) => {
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
    ctx.strokeStyle = "#2f4060";
    ctx.lineWidth = 1;
    ctx.strokeRect(20, 20, CANVAS_W - 40, CANVAS_H - 40);
  }, []);

  const simulate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    if (animRef.current) cancelAnimationFrame(animRef.current);

    const optimized = optimizePath(objects);
    const pathPoints: { x: number; y: number; laser: boolean }[] = [];

    if (optimized.length === 0) {
      // draw demo paths from layers
      layers.forEach((layer, li) => {
        const ox = 40 + li * 80;
        const oy = 80 + li * 60;
        pathPoints.push({ x: ox, y: oy, laser: false });
        pathPoints.push({ x: ox + 100, y: oy, laser: true });
        pathPoints.push({ x: ox + 100, y: oy + 60, laser: true });
        pathPoints.push({ x: ox, y: oy + 60, laser: true });
        pathPoints.push({ x: ox, y: oy, laser: true });
      });
    } else {
      const objectsForSimulation = optimized.map((obj) => {
        const layer = layers.find((layerItem) => layerItem.id === obj.layer);
        return {
          ...obj,
          metadata: {
            ...(obj.metadata ?? {}),
            layerMode: layer?.mode ?? "line",
          },
        };
      });

      const gcode = generateGcode(objectsForSimulation);
      const parsedMoves = parseGcodeLines(gcode);
      pathPoints.push(...parsedMoves);
    }

    if (pathPoints.length < 2) {
      drawGrid(ctx);
      return;
    }

    const segments = pathPoints.slice(1).map((to, index) => {
      const from = pathPoints[index];
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      return {
        from,
        to,
        laser: to.laser,
        length: Math.max(1, Math.hypot(dx, dy)),
        dx,
        dy,
      };
    });

    const drawSegment = (
      from: { x: number; y: number },
      to: { x: number; y: number },
      laserOn: boolean,
    ) => {
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.strokeStyle = laserOn ? "#f97316" : "#334155";
      ctx.lineWidth = laserOn ? 1.5 : 0.8;
      ctx.stroke();
    };

    const drawFrame = (segmentIndex: number, progressInSegment: number) => {
      drawGrid(ctx);
      for (let index = 0; index < segmentIndex; index += 1) {
        const segment = segments[index];
        drawSegment(segment.from, segment.to, segment.laser);
      }

      const currentSegment = segments[segmentIndex];
      let head = currentSegment.to;
      if (currentSegment) {
        head = {
          x: currentSegment.from.x + currentSegment.dx * progressInSegment,
          y: currentSegment.from.y + currentSegment.dy * progressInSegment,
        };
        drawSegment(currentSegment.from, head, currentSegment.laser);
      }

      ctx.beginPath();
      ctx.arc(head.x, head.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = currentSegment?.laser ? "#fbbf24" : "#60a5fa";
      ctx.fill();
    };

    let segmentIndex = 0;
    let progressInSegment = 0;
    const speedPerFrame = 3;

    const animate = () => {
      if (segmentIndex >= segments.length) {
        setRunning(false);
        setProgress(100);
        return;
      }

      const current = segments[segmentIndex];
      const stepProgress = speedPerFrame / current.length;
      progressInSegment += stepProgress;

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
      setProgress(
        Math.round(
          ((segmentIndex + progressInSegment) / segments.length) * 100,
        ),
      );
      animRef.current = requestAnimationFrame(animate);
    };

    setRunning(true);
    setProgress(0);
    animate();
  }, [objects, layers, drawGrid]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    drawGrid(ctx);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [drawGrid]);

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
