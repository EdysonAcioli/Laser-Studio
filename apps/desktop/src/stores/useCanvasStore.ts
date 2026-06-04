import { create } from "zustand";
import type { VectorObject, VectorObjectType } from "@laser/shared-types";

const HISTORY_LIMIT = 50;

function clampHistory(history: VectorObject[][], historyIndex: number) {
  if (history.length <= HISTORY_LIMIT) {
    return { history, historyIndex };
  }

  const trimmed = history.slice(history.length - HISTORY_LIMIT);
  return {
    history: trimmed,
    historyIndex: Math.max(0, historyIndex - (history.length - trimmed.length)),
  };
}

function pushHistory(
  history: VectorObject[][],
  historyIndex: number,
  objects: VectorObject[],
) {
  const nextHistory = [
    ...history.slice(0, historyIndex + 1),
    structuredClone(objects),
  ];
  return clampHistory(nextHistory, nextHistory.length - 1);
}

export type ToolType =
  | "select"
  | "node"
  | "line"
  | "rectangle"
  | "circle"
  | "ellipse"
  | "polygon"
  | "text"
  | "svg"
  | "bitmap"
  | "path"
  | "bezier"
  | "pan"
  | "zoom"
  | "measure"
  | "cut"
  | "offset";

export interface CanvasState {
  selectedTool: ToolType;
  objects: VectorObject[];
  activeObjectId: string | null;
  selectedIds: string[];
  snapToGrid: boolean;
  cursorWorld: { x: number; y: number };
  history: VectorObject[][];
  historyIndex: number;
  setSelectedTool: (tool: ToolType) => void;
  setActiveObjectId: (id: string | null) => void;
  setSelectedIds: (ids: string[]) => void;
  toggleSelected: (id: string) => void;
  selectAll: () => void;
  setObjects: (objects: VectorObject[]) => void;
  setObjectsSilently: (objects: VectorObject[]) => void;
  addObject: (object: VectorObject) => void;
  updateObject: (id: string, partial: Partial<VectorObject>) => void;
  updateObjects: (ids: string[], partial: Partial<VectorObject>) => void;
  removeObject: (id: string) => void;
  removeObjects: (ids: string[]) => void;
  clearObjects: () => void;
  undo: () => void;
  redo: () => void;
  setSnapToGrid: (enabled: boolean) => void;
  setCursorWorld: (position: { x: number; y: number }) => void;
}

function pruneSelection(ids: string[], objects: VectorObject[]): string[] {
  const present = new Set(objects.map((object) => object.id));
  return ids.filter((id) => present.has(id));
}

export const useCanvasStore = create<CanvasState>((set) => ({
  selectedTool: "select",
  objects: [],
  activeObjectId: null,
  selectedIds: [],
  snapToGrid: true,
  cursorWorld: { x: 0, y: 0 },
  history: [[]],
  historyIndex: 0,
  setSelectedTool: (tool) => set({ selectedTool: tool }),
  setActiveObjectId: (id) =>
    set({ activeObjectId: id, selectedIds: id ? [id] : [] }),
  setSelectedIds: (ids) =>
    set({ selectedIds: ids, activeObjectId: ids[ids.length - 1] ?? null }),
  toggleSelected: (id) =>
    set((state) => {
      const exists = state.selectedIds.includes(id);
      const selectedIds = exists
        ? state.selectedIds.filter((item) => item !== id)
        : [...state.selectedIds, id];
      return {
        selectedIds,
        activeObjectId: exists
          ? (selectedIds[selectedIds.length - 1] ?? null)
          : id,
      };
    }),
  selectAll: () =>
    set((state) => {
      const selectedIds = state.objects.map((object) => object.id);
      return {
        selectedIds,
        activeObjectId: selectedIds[selectedIds.length - 1] ?? null,
      };
    }),
  setObjects: (objects) =>
    set((state) => {
      const next = pushHistory(state.history, state.historyIndex, objects);
      const selectedIds = pruneSelection(state.selectedIds, objects);
      return {
        objects,
        selectedIds,
        activeObjectId: selectedIds[selectedIds.length - 1] ?? null,
        history: next.history,
        historyIndex: next.historyIndex,
      };
    }),
  setObjectsSilently: (objects) =>
    set((state) => {
      const selectedIds = pruneSelection(state.selectedIds, objects);
      return {
        objects,
        selectedIds,
        activeObjectId: selectedIds[selectedIds.length - 1] ?? null,
      };
    }),
  addObject: (object) =>
    set((state) => {
      const objects = [...state.objects, object];
      const next = pushHistory(state.history, state.historyIndex, objects);
      return {
        objects,
        activeObjectId: object.id,
        selectedIds: [object.id],
        history: next.history,
        historyIndex: next.historyIndex,
      };
    }),
  updateObject: (id, partial) =>
    set((state) => {
      const objects = state.objects.map((obj) =>
        obj.id === id ? { ...obj, ...partial } : obj,
      );
      const next = pushHistory(state.history, state.historyIndex, objects);
      return {
        objects,
        history: next.history,
        historyIndex: next.historyIndex,
      };
    }),
  updateObjects: (ids, partial) =>
    set((state) => {
      const idSet = new Set(ids);
      const objects = state.objects.map((obj) =>
        idSet.has(obj.id) ? { ...obj, ...partial } : obj,
      );
      const next = pushHistory(state.history, state.historyIndex, objects);
      return {
        objects,
        history: next.history,
        historyIndex: next.historyIndex,
      };
    }),
  removeObject: (id) =>
    set((state) => {
      const objects = state.objects.filter((obj) => obj.id !== id);
      const next = pushHistory(state.history, state.historyIndex, objects);
      const selectedIds = pruneSelection(state.selectedIds, objects);
      return {
        objects,
        selectedIds,
        activeObjectId: selectedIds[selectedIds.length - 1] ?? null,
        history: next.history,
        historyIndex: next.historyIndex,
      };
    }),
  removeObjects: (ids) =>
    set((state) => {
      const idSet = new Set(ids);
      const objects = state.objects.filter((obj) => !idSet.has(obj.id));
      const next = pushHistory(state.history, state.historyIndex, objects);
      const selectedIds = pruneSelection(state.selectedIds, objects);
      return {
        objects,
        selectedIds,
        activeObjectId: selectedIds[selectedIds.length - 1] ?? null,
        history: next.history,
        historyIndex: next.historyIndex,
      };
    }),
  clearObjects: () =>
    set((state) => {
      const objects: VectorObject[] = [];
      const next = pushHistory(state.history, state.historyIndex, objects);
      return {
        objects,
        activeObjectId: null,
        selectedIds: [],
        history: next.history,
        historyIndex: next.historyIndex,
      };
    }),
  undo: () =>
    set((state) => {
      if (state.historyIndex <= 0) {
        return state;
      }

      const historyIndex = state.historyIndex - 1;
      const objects = structuredClone(state.history[historyIndex] ?? []);
      const selectedIds = pruneSelection(state.selectedIds, objects);
      return {
        objects,
        historyIndex,
        selectedIds,
        activeObjectId: selectedIds[selectedIds.length - 1] ?? null,
      };
    }),
  redo: () =>
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) {
        return state;
      }

      const historyIndex = state.historyIndex + 1;
      const objects = structuredClone(state.history[historyIndex] ?? []);
      const selectedIds = pruneSelection(state.selectedIds, objects);
      return {
        objects,
        historyIndex,
        selectedIds,
        activeObjectId: selectedIds[selectedIds.length - 1] ?? null,
      };
    }),
  setSnapToGrid: (enabled) => set({ snapToGrid: enabled }),
  setCursorWorld: (position) => set({ cursorWorld: position }),
}));
