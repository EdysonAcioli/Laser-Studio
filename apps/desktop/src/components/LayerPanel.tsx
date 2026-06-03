import { useState } from "react";
import { useCanvasStore } from "../stores/useCanvasStore";
import { useLayerStore } from "../stores/useLayerStore";
import type { LayerConfig } from "@laser/shared-types";

const MODES = ["line", "fill", "offset-fill", "image"] as const;

function LayerRow({
  layer,
  active,
  onSelect,
}: {
  layer: LayerConfig;
  active: boolean;
  onSelect: () => void;
}) {
  const { toggleVisibility, updateLayer, removeLayer, reorderLayers } =
    useLayerStore();
  const layers = useLayerStore((state) => state.layers);
  const objects = useCanvasStore((state) => state.objects);
  const setObjects = useCanvasStore((state) => state.setObjects);
  const [editing, setEditing] = useState(false);
  const objectCount = objects.filter((object) => object.layer === layer.id).length;

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/layer-id", layer.id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const sourceId = e.dataTransfer.getData("text/layer-id");
        if (sourceId) {
          reorderLayers(sourceId, layer.id);
        }
      }}
      onClick={onSelect}
      className={`cursor-pointer rounded border p-3 transition ${active ? "border-accent bg-[#1a2640]" : "border-border bg-[#11151b] hover:border-[#3f4b5a]"}`}
    >
      <div className="flex items-center gap-2">
        {/* color swatch */}
        <span
          className="h-3 w-3 flex-shrink-0 rounded-full ring-1 ring-white/10"
          style={{ backgroundColor: layer.color }}
        />
        {/* name */}
        {editing ? (
          <input
            autoFocus
            className="flex-1 rounded border border-accent bg-transparent px-1 text-xs text-white outline-none"
            value={layer.name}
            onChange={(e) => updateLayer(layer.id, { name: e.target.value })}
            onBlur={() => setEditing(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditing(false)}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span
            className="flex-1 text-xs text-slate-100"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
          >
            {layer.name}
          </span>
        )}
        {/* visibility */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleVisibility(layer.id);
          }}
          className="text-slate-400 hover:text-white"
          title={layer.visible ? "Ocultar" : "Mostrar"}
        >
          {layer.visible ? "👁" : "🙈"}
        </button>
        <button
          type="button"
          disabled={layers.length <= 1}
          onClick={(e) => {
            e.stopPropagation();
            if (layers.length <= 1) return;
            const fallbackLayer = layers.find((item) => item.id !== layer.id)?.id;
            if (fallbackLayer) {
              setObjects(
                objects.map((object) =>
                  object.layer === layer.id
                    ? { ...object, layer: fallbackLayer }
                    : object,
                ),
              );
            }
            removeLayer(layer.id);
          }}
          className="text-slate-500 transition hover:text-rose-400 disabled:opacity-30"
          title="Excluir camada"
        >
          ×
        </button>
      </div>
      <div className="mt-2 text-[11px] text-slate-500">{objectCount} objeto(s)</div>

      {active && (
        <div className="mt-3 grid gap-2" onClick={(e) => e.stopPropagation()}>
          {/* mode */}
          <div className="flex gap-1">
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => updateLayer(layer.id, { mode: m })}
                className={`flex-1 rounded px-1 py-1 text-[10px] transition ${layer.mode === m ? "bg-accent text-white" : "bg-[#1f2730] text-slate-400 hover:text-white"}`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <label className="grid gap-1 text-slate-400">
              Potência %
              <input
                type="number"
                min={0}
                max={100}
                value={layer.power}
                onChange={(e) =>
                  updateLayer(layer.id, { power: Number(e.target.value) })
                }
                className="rounded border border-border bg-[#141a21] px-2 py-1 text-slate-100"
              />
            </label>
            <label className="grid gap-1 text-slate-400">
              Velocidade
              <input
                type="number"
                min={1}
                value={layer.speed}
                onChange={(e) =>
                  updateLayer(layer.id, { speed: Number(e.target.value) })
                }
                className="rounded border border-border bg-[#141a21] px-2 py-1 text-slate-100"
              />
            </label>
            <label className="grid gap-1 text-slate-400">
              Passadas
              <input
                type="number"
                min={1}
                max={20}
                value={layer.passes}
                onChange={(e) =>
                  updateLayer(layer.id, { passes: Number(e.target.value) })
                }
                className="rounded border border-border bg-[#141a21] px-2 py-1 text-slate-100"
              />
            </label>
            <label className="grid gap-1 text-slate-400">
              Cor
              <input
                type="color"
                value={layer.color}
                onChange={(e) =>
                  updateLayer(layer.id, { color: e.target.value })
                }
                className="h-8 w-full cursor-pointer rounded border border-border bg-transparent"
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              className="accent-accent"
              checked={layer.locked}
              onChange={(e) =>
                updateLayer(layer.id, { locked: e.target.checked })
              }
            />
            Trancado
          </label>
        </div>
      )}
    </div>
  );
}

export function LayerPanel() {
  const { layers, activeLayerId, setActiveLayer, addLayer } = useLayerStore();

  const addNewLayer = () => {
    const id = `layer-${Date.now()}`;
    addLayer({
      id,
      name: `Layer ${layers.length + 1}`,
      color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 55%)`,
      mode: "line",
      power: 60,
      speed: 400,
      passes: 1,
      visible: true,
      locked: false,
      order: layers.length + 1,
    });
    setActiveLayer(id);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
          Camadas
        </span>
        <button
          type="button"
          onClick={addNewLayer}
          className="rounded bg-[#1f2730] px-3 py-1 text-xs text-slate-200 transition hover:bg-[#27334b]"
        >
          + Adicionar
        </button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {[...layers]
          .sort((a, b) => a.order - b.order)
          .map((layer) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              active={layer.id === activeLayerId}
              onSelect={() => setActiveLayer(layer.id)}
            />
          ))}
      </div>
    </div>
  );
}
