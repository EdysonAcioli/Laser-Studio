import { useState } from "react";
import { useLayerStore } from "../../stores/useLayerStore";
import { useSettingsStore } from "../../stores/useSettingsStore";

export function MaterialLibraryPanel() {
  const presets = useSettingsStore((state) => state.materialPresets);
  const addMaterialPreset = useSettingsStore((state) => state.addMaterialPreset);
  const removeMaterialPreset = useSettingsStore((state) => state.removeMaterialPreset);
  const activeLayerId = useLayerStore((state) => state.activeLayerId);
  const updateLayer = useLayerStore((state) => state.updateLayer);
  const [draft, setDraft] = useState({
    material: "",
    power: 60,
    speed: 300,
    passes: 1,
  });

  return (
    <section className="rounded-3xl border border-border bg-[#11151b] p-4 text-sm text-slate-200 shadow-lg">
      <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.22em] text-slate-500">
        <span>Biblioteca de materiais</span>
        <span>{presets.length} presets</span>
      </div>
      <div className="grid gap-3">
        <div className="grid gap-2 rounded border border-border bg-[#141a21] p-3">
          <input
            value={draft.material}
            onChange={(e) =>
              setDraft((state) => ({ ...state, material: e.target.value }))
            }
            placeholder="Novo material"
            className="rounded border border-border bg-[#0f141a] px-3 py-2 text-xs text-slate-100"
          />
          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              min={0}
              max={100}
              value={draft.power}
              onChange={(e) =>
                setDraft((state) => ({ ...state, power: Number(e.target.value) }))
              }
              className="rounded border border-border bg-[#0f141a] px-3 py-2 text-xs text-slate-100"
            />
            <input
              type="number"
              min={1}
              value={draft.speed}
              onChange={(e) =>
                setDraft((state) => ({ ...state, speed: Number(e.target.value) }))
              }
              className="rounded border border-border bg-[#0f141a] px-3 py-2 text-xs text-slate-100"
            />
            <input
              type="number"
              min={1}
              value={draft.passes}
              onChange={(e) =>
                setDraft((state) => ({ ...state, passes: Number(e.target.value) }))
              }
              className="rounded border border-border bg-[#0f141a] px-3 py-2 text-xs text-slate-100"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              if (!draft.material.trim()) return;
              addMaterialPreset({
                material: draft.material.trim(),
                power: draft.power,
                speed: draft.speed,
                passes: draft.passes,
              });
              setDraft({ material: "", power: 60, speed: 300, passes: 1 });
            }}
            className="rounded bg-[#1f2730] px-3 py-2 text-xs text-slate-100 transition hover:bg-[#27334b]"
          >
            Adicionar preset
          </button>
        </div>
        {presets.map((preset) => (
          <div
            key={preset.material}
            className="rounded border border-border bg-[#141a21] p-3"
          >
            <div className="flex items-center justify-between text-slate-100">
              <span>{preset.material}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">
                  {preset.passes} passadas
                </span>
                <button
                  type="button"
                  onClick={() => removeMaterialPreset(preset.material)}
                  className="text-xs text-rose-400 transition hover:text-rose-300"
                >
                  Excluir
                </button>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
              <span>Power {preset.power}%</span>
              <span>Speed {preset.speed}</span>
            </div>
            <button
              type="button"
              onClick={() =>
                updateLayer(activeLayerId, {
                  power: preset.power,
                  speed: preset.speed,
                  passes: preset.passes,
                })
              }
              className="mt-3 rounded bg-[#1f2730] px-3 py-2 text-xs text-slate-100 transition hover:bg-[#27334b]"
            >
              Aplicar na camada ativa
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
