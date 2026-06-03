import { useMemo } from "react";
import { useCanvasStore } from "../stores/useCanvasStore";
import { useLayerStore } from "../stores/useLayerStore";
import { useMachineStore } from "../stores/useMachineStore";

const MACHINE_COLOR: Record<string, string> = {
  connected: "text-emerald-400",
  connecting: "text-yellow-400",
  disconnected: "text-slate-500",
};

export function StatusBar() {
  const selectedTool = useCanvasStore((state) => state.selectedTool);
  const cursorWorld = useCanvasStore((state) => state.cursorWorld);
  const snapToGrid = useCanvasStore((state) => state.snapToGrid);
  const layers = useLayerStore((state) => state.layers);
  const objectCount = useCanvasStore((state) => state.objects.length);
  const machineState = useMachineStore((state) => state.state);
  const port = useMachineStore((state) => state.port);

  const visibilitySummary = useMemo(
    () => `${layers.filter((l) => l.visible).length}/${layers.length} visíveis`,
    [layers],
  );

  return (
    <footer className="flex items-center justify-between border-t border-border bg-[#0d1013] px-4 py-1 text-xs text-slate-400">
      <div className="flex items-center gap-4">
        <span className="rounded bg-[#1f2730] px-2 py-0.5 uppercase tracking-[0.14em] text-slate-200">
          {selectedTool}
        </span>
        <span>
          {objectCount} objeto{objectCount !== 1 ? "s" : ""}
        </span>
        <span>{visibilitySummary}</span>
        <span>
          X {cursorWorld.x.toFixed(1)} / Y {cursorWorld.y.toFixed(1)}
        </span>
        <span>{snapToGrid ? "Snap on" : "Snap off"}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className={MACHINE_COLOR[machineState]}>
          {machineState === "connected"
            ? `Conectado (${port})`
            : machineState === "connecting"
              ? "Conectando..."
              : "Desconectado"}
        </span>
        <span className="text-slate-600">Laser Studio v1.0</span>
      </div>
    </footer>
  );
}
