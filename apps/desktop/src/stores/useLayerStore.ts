import { create } from "zustand";
import { useCanvasStore } from "./useCanvasStore";
import type { LayerConfig } from "@laser/shared-types";

const defaultLayers: LayerConfig[] = [
  {
    id: "layer-1",
    name: "Layer 1",
    color: "#fb7185",
    mode: "line",
    power: 80,
    speed: 300,
    passes: 1,
    visible: true,
    locked: false,
    order: 1,
  },
  {
    id: "layer-2",
    name: "Layer 2",
    color: "#38bdf8",
    mode: "fill",
    power: 45,
    speed: 600,
    passes: 1,
    visible: true,
    locked: false,
    order: 2,
  },
];

export interface LayerState {
  layers: LayerConfig[];
  activeLayerId: string;
  setActiveLayer: (id: string) => void;
  setLayers: (layers: LayerConfig[]) => void;
  toggleVisibility: (id: string) => void;
  updateLayer: (id: string, patch: Partial<LayerConfig>) => void;
  addLayer: (layer: LayerConfig) => void;
  removeLayer: (id: string) => void;
  reorderLayers: (sourceId: string, targetId: string) => void;
}

export const useLayerStore = create<LayerState>((set) => ({
  layers: defaultLayers,
  activeLayerId: defaultLayers[0].id,
  setActiveLayer: (id) => set({ activeLayerId: id }),
  setLayers: (layers) =>
    set({
      layers,
      activeLayerId: layers[0]?.id ?? "",
    }),
  toggleVisibility: (id) =>
    set((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === id ? { ...layer, visible: !layer.visible } : layer,
      ),
    })),
  updateLayer: (id, patch) =>
    set((state) => {
      const layers = state.layers.map((layer) =>
        layer.id === id ? { ...layer, ...patch } : layer,
      );

      const currentLayer = state.layers.find((layer) => layer.id === id);
      const nextLayer = layers.find((layer) => layer.id === id);
      if (currentLayer && nextLayer) {
        const objects = useCanvasStore.getState().objects;
        const updatedObjects = objects.map((object) => {
          if (object.layer !== id) {
            return object;
          }

          const nextStroke = patch.color ?? object.stroke;
          const nextFill =
            nextLayer.mode === "fill" || nextLayer.mode === "offset-fill"
              ? (patch.color ?? nextLayer.color)
              : "none";

          return {
            ...object,
            stroke: nextStroke,
            fill:
              patch.mode != null || patch.color != null
                ? nextFill
                : object.fill,
            power: patch.power ?? object.power,
            speed: patch.speed ?? object.speed,
            passes: patch.passes ?? object.passes,
          };
        });

        useCanvasStore.getState().setObjects(updatedObjects);
      }

      return { layers };
    }),
  addLayer: (layer) => set((state) => ({ layers: [...state.layers, layer] })),
  removeLayer: (id) =>
    set((state) => {
      const layers = state.layers.filter((layer) => layer.id !== id);
      return {
        layers,
        activeLayerId:
          state.activeLayerId === id
            ? (layers[0]?.id ?? "")
            : state.activeLayerId,
      };
    }),
  reorderLayers: (sourceId, targetId) =>
    set((state) => {
      const layers = [...state.layers].sort((a, b) => a.order - b.order);
      const sourceIndex = layers.findIndex((layer) => layer.id === sourceId);
      const targetIndex = layers.findIndex((layer) => layer.id === targetId);

      if (
        sourceIndex === -1 ||
        targetIndex === -1 ||
        sourceIndex === targetIndex
      ) {
        return state;
      }

      const [moved] = layers.splice(sourceIndex, 1);
      layers.splice(targetIndex, 0, moved);

      return {
        layers: layers.map((layer, index) => ({ ...layer, order: index + 1 })),
      };
    }),
}));
