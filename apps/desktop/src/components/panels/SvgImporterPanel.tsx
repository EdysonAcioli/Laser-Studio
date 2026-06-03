import { useRef } from "react";
import { useCanvasStore } from "../../stores/useCanvasStore";
import { useLayerStore } from "../../stores/useLayerStore";
import { importDxfString } from "../../utils/dxfImporter";
import { importSvgString } from "../../utils/svgImporter";

export function SvgImporterPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const addObject = useCanvasStore((state) => state.addObject);
  const objects = useCanvasStore((state) => state.objects);
  const clearObjects = useCanvasStore((state) => state.clearObjects);
  const activeLayerId = useLayerStore((state) => state.activeLayerId);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const imported = file.name.toLowerCase().endsWith(".dxf")
        ? importDxfString(text, activeLayerId)
        : importSvgString(text, activeLayerId);
      imported.forEach((obj) => addObject(obj));
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  return (
    <section className="rounded-xl border border-border bg-[#11151b] p-4 text-sm text-slate-200 shadow-lg">
      <div className="mb-3 text-xs uppercase tracking-[0.22em] text-slate-500">
        Importar SVG
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".svg,.dxf"
        className="hidden"
        onChange={handleFile}
      />

      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="w-full rounded border border-dashed border-border bg-[#1a2030] py-4 text-slate-400 transition hover:border-accent hover:text-white"
      >
        Clique para importar SVG ou DXF
      </button>

      <div className="mt-3 rounded border border-border bg-[#141a21] p-3 text-xs text-slate-400">
        {objects.length === 0
          ? "Nenhum objeto importado ainda."
          : `${objects.length} objeto${objects.length !== 1 ? "s" : ""} no canvas`}
      </div>

      {objects.length > 0 && (
        <button
          type="button"
          onClick={clearObjects}
          className="mt-2 w-full rounded bg-[#c2410c]/20 px-3 py-2 text-xs text-red-400 transition hover:bg-[#c2410c]/30"
        >
          Limpar canvas
        </button>
      )}
    </section>
  );
}
