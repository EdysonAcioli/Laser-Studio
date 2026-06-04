import { useState, useMemo } from "react";
import { useCanvasStore } from "../../stores/useCanvasStore";
import { useLayerStore } from "../../stores/useLayerStore";
import { useMachineStore } from "../../stores/useMachineStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import {
  generateGcode,
  estimateJobTime,
  optimizePath,
} from "@laser/gcode-engine";
import type { GCodeFlavor } from "@laser/gcode-engine";

const FLAVORS: { value: GCodeFlavor; label: string }[] = [
  { value: "grbl", label: "GRBL" },
  { value: "marlin", label: "Marlin" },
  { value: "smoothieware", label: "Smoothieware" },
  { value: "ruida", label: "Ruida" },
  { value: "esp32", label: "ESP32" },
  { value: "laserweb", label: "LaserWeb" },
];

export function GcodePanel() {
  const objects = useCanvasStore((state) => state.objects);
  const layers = useLayerStore((state) => state.layers);
  const { sendCommand, state: machineState } = useMachineStore();
  const machineConfig = useSettingsStore((state) => state.machineConfig);
  const [flavor, setFlavor] = useState<GCodeFlavor>("grbl");

  const gcodeOptions = useMemo(
    () => ({ pwmMax: machineConfig.pwmMax, rapidRate: machineConfig.maxSpeed }),
    [machineConfig.pwmMax, machineConfig.maxSpeed],
  );

  const preparedObjects = useMemo(
    () =>
      objects.map((object) => ({
        ...object,
        metadata: {
          ...object.metadata,
          layerMode: layers.find((layer) => layer.id === object.layer)?.mode ?? "line",
        },
      })),
    [layers, objects],
  );
  const optimized = useMemo(() => optimizePath(preparedObjects), [preparedObjects]);
  const previewCode = useMemo(
    () => generateGcode(optimized, flavor, gcodeOptions),
    [optimized, flavor, gcodeOptions],
  );
  const estimate = useMemo(
    () => estimateJobTime(optimized, gcodeOptions),
    [optimized, gcodeOptions],
  );

  const exportFile = () => {
    const blob = new Blob([previewCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laser-job.${flavor === "ruida" || flavor === "laserweb" ? "lbrn2" : "gcode"}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sendToMachine = async () => {
    const lines = previewCode
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith(";"));
    for (const line of lines) {
      await sendCommand(line);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-[#11151b] p-4 text-sm text-slate-200 shadow-lg">
      <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.22em] text-slate-500">
        <span>G-code</span>
        <span>
          {layers.length} camada{layers.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Flavor selector */}
      <div className="mb-3 flex flex-wrap gap-1">
        {FLAVORS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFlavor(f.value)}
            className={`rounded px-2 py-1 text-xs transition ${flavor === f.value ? "bg-accent text-white" : "bg-[#1f2730] text-slate-400 hover:text-white"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 rounded border border-border bg-[#141a21] p-3 text-xs text-slate-400">
        <span>
          Tempo estimado:{" "}
          <span className="text-slate-200">{estimate.toFixed(2)} min</span>
        </span>
        <span>
          Objetos: <span className="text-slate-200">{objects.length}</span>
        </span>
        <span>
          Linhas:{" "}
          <span className="text-slate-200">
            {previewCode.split("\n").length}
          </span>
        </span>
        <span>
          Tamanho:{" "}
          <span className="text-slate-200">
            {(previewCode.length / 1024).toFixed(1)} KB
          </span>
        </span>
      </div>

      <pre className="mb-3 max-h-52 overflow-y-auto rounded border border-border bg-[#0d1116] p-3 text-xs text-slate-300 scrollbar-thin">
        {previewCode || "; Sem objetos no canvas"}
      </pre>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={exportFile}
          className="rounded bg-[#1f2730] px-3 py-2 text-sm text-slate-200 transition hover:bg-[#27334b]"
        >
          Exportar arquivo
        </button>
        <button
          type="button"
          onClick={() => void sendToMachine()}
          disabled={machineState !== "connected"}
          className="rounded bg-[#1a2d40] px-3 py-2 text-sm text-slate-200 transition hover:bg-[#1d3550] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Enviar para máquina
        </button>
      </div>
    </section>
  );
}
