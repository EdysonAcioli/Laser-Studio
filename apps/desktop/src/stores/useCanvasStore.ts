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
  snapToGrid: boolean;
  cursorWorld: { x: number; y: number };
  history: VectorObject[][];
  historyIndex: number;
  setSelectedTool: (tool: ToolType) => void;
  setActiveObjectId: (id: string | null) => void;
  setObjects: (objects: VectorObject[]) => void;
  setObjectsSilently: (objects: VectorObject[]) => void;
  addObject: (object: VectorObject) => void;
  updateObject: (id: string, partial: Partial<VectorObject>) => void;
  removeObject: (id: string) => void;
  clearObjects: () => void;
  undo: () => void;
  redo: () => void;
  setSnapToGrid: (enabled: boolean) => void;
  setCursorWorld: (position: { x: number; y: number }) => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  selectedTool: "select",
  objects: [],
  activeObjectId: null,
  snapToGrid: true,
  cursorWorld: { x: 0, y: 0 },
  history: [[]],
  historyIndex: 0,
  setSelectedTool: (tool) => set({ selectedTool: tool }),
  setActiveObjectId: (id) => set({ activeObjectId: id }),
  setObjects: (objects) =>
    set((state) => {
      const next = pushHistory(state.history, state.historyIndex, objects);
      return {
        objects,
        activeObjectId: objects.some((obj) => obj.id === state.activeObjectId)
          ? state.activeObjectId
          : null,
        history: next.history,
        historyIndex: next.historyIndex,
      };
    }),
  setObjectsSilently: (objects) =>
    set((state) => ({
      objects,
      activeObjectId: objects.some((obj) => obj.id === state.activeObjectId)
        ? state.activeObjectId
        : null,
    })),
  addObject: (object) =>
    set((state) => {
      const objects = [...state.objects, object];
      const next = pushHistory(state.history, state.historyIndex, objects);
      return {
        objects,
        activeObjectId: object.id,
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
  removeObject: (id) =>
    set((state) => {
      const objects = state.objects.filter((obj) => obj.id !== id);
      const next = pushHistory(state.history, state.historyIndex, objects);
      return {
        objects,
        activeObjectId:
          state.activeObjectId === id ? null : state.activeObjectId,
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
      return {
        objects,
        historyIndex,
        activeObjectId: objects.some((obj) => obj.id === state.activeObjectId)
          ? state.activeObjectId
          : null,
      };
    }),
  redo: () =>
    set((state) => {
      if (state.historyIndex >= state.history.length - 1) {
        return state;
      }

      const historyIndex = state.historyIndex + 1;
      const objects = structuredClone(state.history[historyIndex] ?? []);
      return {
        objects,
        historyIndex,
        activeObjectId: objects.some((obj) => obj.id === state.activeObjectId)
          ? state.activeObjectId
          : null,
      };
    }),
  setSnapToGrid: (enabled) => set({ snapToGrid: enabled }),
  setCursorWorld: (position) => set({ cursorWorld: position }),
}));
