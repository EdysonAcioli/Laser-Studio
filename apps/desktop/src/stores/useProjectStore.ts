import { create } from "zustand";
import type { LayerConfig, VectorObject } from "@laser/shared-types";

export type ToolType =
  | "select"
  | "node"
  | "line"
  | "rectangle"
  | "circle"
  | "ellipse"
  | "bezier"
  | "text"
  | "measure"
  | "pan"
  | "zoom"
  | "cut"
  | "offset";

export interface ProjectState {
  selectedTool: ToolType;
  layers: LayerConfig[];
  objects: VectorObject[];
  activeLayerId: string;
  setSelectedTool: (tool: ToolType) => void;
  toggleLayerVisibility: (id: string) => void;
}

const defaultLayers: LayerConfig[] = [
  {
    id: "layer-1",
    name: "Layer 1",
    color: "#f97316",
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
    color: "#22c55e",
    mode: "fill",
    power: 45,
    speed: 600,
    passes: 1,
    visible: true,
    locked: false,
    order: 2,
  },
];

export const useProjectStore = create<ProjectState>((set) => ({
  selectedTool: "select",
  layers: defaultLayers,
  objects: [],
  activeLayerId: defaultLayers[0].id,
  setSelectedTool: (tool) => set({ selectedTool: tool }),
  toggleLayerVisibility: (id) =>
    set((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === id ? { ...layer, visible: !layer.visible } : layer,
      ),
    })),
}));
