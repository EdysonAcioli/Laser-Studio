import { useRef, useState } from "react";
import {
  processImageForLaser,
  type DitheringMode,
} from "../../utils/imageProcessor";
import { useCanvasStore } from "../../stores/useCanvasStore";
import { useLayerStore } from "../../stores/useLayerStore";

const MODES: { value: DitheringMode; label: string }[] = [
  { value: "threshold", label: "Limiar" },
  { value: "floyd-steinberg", label: "Floyd-Steinberg" },
  { value: "halftone", label: "Halftone (Bayer)" },
  { value: "grayscale", label: "Escala de cinza" },
];

export function ImageProcessorPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<DitheringMode>("floyd-steinberg");
  const [threshold, setThreshold] = useState(128);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const addObject = useCanvasStore((state) => state.addObject);
  const activeLayerId = useLayerStore((state) => state.activeLayerId);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const { dataUrl, width, height } = await processImageForLaser(
        file,
        mode,
        threshold,
      );
      setPreview(dataUrl);
      setSize({ w: width, h: height });
    } finally {
      setLoading(false);
    }
    e.target.value = "";
  };

  const addToCanvas = () => {
    if (!preview || !size) return;
    addObject({
      id: Math.random().toString(36).slice(2),
      type: "bitmap",
      position: { x: 10, y: 10 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      stroke: "none",
      fill: "none",
      power: 60,
      speed: 500,
      passes: 1,
      layer: activeLayerId,
      airAssist: false,
      zIndex: 0,
      metadata: { dataUrl: preview, width: size.w, height: size.h },
    });
  };

  return (
    <section className="rounded-xl border border-border bg-[#11151b] p-4 text-sm text-slate-200 shadow-lg">
      <div className="mb-3 text-xs uppercase tracking-[0.22em] text-slate-500">
        Imagem → Laser
      </div>

      {/* Mode selector */}
      <div className="mb-3 flex flex-wrap gap-1">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => setMode(m.value)}
            className={`rounded px-3 py-1 text-xs transition ${mode === m.value ? "bg-accent text-white" : "bg-[#1f2730] text-slate-400 hover:text-white"}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Threshold slider (only for threshold mode) */}
      {mode === "threshold" && (
        <div className="mb-3 grid gap-1 text-xs text-slate-400">
          <span>Limiar: {threshold}</span>
          <input
            type="range"
            min={0}
            max={255}
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={loading}
        className="w-full rounded border border-dashed border-border bg-[#1a2030] py-3 text-slate-400 transition hover:border-accent hover:text-white disabled:opacity-50"
      >
        {loading ? "Processando..." : "Carregar imagem"}
      </button>

      {preview && (
        <>
          <img
            src={preview}
            alt="preview"
            className="mt-3 w-full rounded border border-border"
          />
          {size && (
            <p className="mt-1 text-center text-xs text-slate-500">
              {size.w} × {size.h} px
            </p>
          )}
          <button
            type="button"
            onClick={addToCanvas}
            className="mt-3 w-full rounded bg-[#1f2730] px-3 py-2 text-slate-200 transition hover:bg-[#27334b]"
          >
            Adicionar ao canvas
          </button>
        </>
      )}
    </section>
  );
}
